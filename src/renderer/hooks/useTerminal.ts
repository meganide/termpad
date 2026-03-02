import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../stores/appStore';
import { OutputBuffer, ACTIVITY_TIMEOUT_MS } from '../utils/terminalStateDetector';

interface UseTerminalOptions {
  sessionId: string;
  cwd: string;
  autoSpawn?: boolean;
  initialCommand?: string; // Command to auto-run on terminal start (e.g., 'claude', 'gemini')
}

interface UseTerminalReturn {
  spawn: () => Promise<void>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => Promise<void>;
  onData: (callback: (data: string) => void) => () => void;
}

// How often to check terminal state (ms)
const STATE_CHECK_INTERVAL_MS = 500;

// How long to ignore output after user input (ms) - prevents echo from triggering "running"
const ECHO_IGNORE_WINDOW_MS = 200;

// How long to wait before showing "running" status (ms) - prevents flicker for short operations
const RUNNING_DISPLAY_DELAY_MS = 4000;

export function useTerminal({
  sessionId,
  cwd,
  autoSpawn = false,
  initialCommand,
}: UseTerminalOptions): UseTerminalReturn {
  const outputBufferRef = useRef<OutputBuffer>(new OutputBuffer());
  const stateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasReceivedFirstOutputRef = useRef<boolean>(false);
  // Track the current status locally to avoid unnecessary updates
  const currentStatusRef = useRef<string>('stopped');
  // Track when user last wrote to terminal (to ignore echo)
  const lastUserInputTimeRef = useRef<number>(0);
  // Track whether terminal has reached a stable state (idle/waiting) at least once
  // This prevents premature transitions from 'starting' to 'running' during shell init
  const hasReachedStableStateRef = useRef<boolean>(false);
  // Track pending "running" status transition (delayed to avoid flicker)
  const pendingRunningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use selectors to only subscribe to the actions we need, preventing re-renders on unrelated store changes
  const updateTerminalStatus = useAppStore((state) => state.updateTerminalStatus);
  const registerTerminal = useAppStore((state) => state.registerTerminal);
  const unregisterTerminal = useAppStore((state) => state.unregisterTerminal);

  const spawn = useCallback(async () => {
    // Reset state for new spawn
    outputBufferRef.current.clear();
    hasReceivedFirstOutputRef.current = false;
    currentStatusRef.current = 'starting';
    hasReachedStableStateRef.current = false;

    // Cancel any pending running transition
    if (pendingRunningTimeoutRef.current) {
      clearTimeout(pendingRunningTimeoutRef.current);
      pendingRunningTimeoutRef.current = null;
    }

    // Register terminal with 'starting' status
    registerTerminal(sessionId);
    updateTerminalStatus(sessionId, 'starting');

    try {
      await window.terminal.spawn(sessionId, cwd, initialCommand);
    } catch (error) {
      console.error(`[Terminal] Failed to spawn terminal for ${sessionId}:`, error);
      updateTerminalStatus(sessionId, 'error');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to start terminal', {
        description: errorMessage.includes('ENOENT')
          ? 'Shell not found. Check your shell settings.'
          : errorMessage.includes('EACCES')
            ? 'Permission denied. Check directory permissions.'
            : errorMessage.includes('ENOTDIR')
              ? 'Invalid working directory path.'
              : `Error: ${errorMessage}`,
        duration: 10000,
      });
    }
  }, [sessionId, cwd, initialCommand, registerTerminal, updateTerminalStatus]);

  const write = useCallback(
    (data: string) => {
      // Track when user writes (to ignore echo in status detection)
      lastUserInputTimeRef.current = Date.now();
      window.terminal.write(sessionId, data);
    },
    [sessionId]
  );

  const resize = useCallback(
    (cols: number, rows: number) => {
      window.terminal.resize(sessionId, cols, rows);
    },
    [sessionId]
  );

  const kill = useCallback(async () => {
    if (stateCheckIntervalRef.current) {
      clearInterval(stateCheckIntervalRef.current);
      stateCheckIntervalRef.current = null;
    }
    if (pendingRunningTimeoutRef.current) {
      clearTimeout(pendingRunningTimeoutRef.current);
      pendingRunningTimeoutRef.current = null;
    }
    await window.terminal.kill(sessionId);
    unregisterTerminal(sessionId);
  }, [sessionId, unregisterTerminal]);

  const onData = useCallback(
    (callback: (data: string) => void) => {
      return window.terminal.onData(sessionId, (data) => {
        // Append to output buffer (also updates lastDataTime)
        outputBufferRef.current.append(data);

        // Handle first output - transition from 'starting'
        if (!hasReceivedFirstOutputRef.current) {
          hasReceivedFirstOutputRef.current = true;
        }

        // Only check for idle/waiting patterns immediately (not running)
        // This prevents keystroke echo from constantly triggering "running"
        // The interval will handle the running state based on activity timeout
        const detectedState = outputBufferRef.current.detectState();
        if (
          detectedState &&
          detectedState !== 'running' &&
          detectedState !== currentStatusRef.current
        ) {
          // Mark that we've reached a stable state (idle or waiting)
          // This allows future 'running' transitions
          if (detectedState === 'idle' || detectedState === 'waiting') {
            hasReachedStableStateRef.current = true;
            // Cancel any pending running transition since we're now idle/waiting
            if (pendingRunningTimeoutRef.current) {
              clearTimeout(pendingRunningTimeoutRef.current);
              pendingRunningTimeoutRef.current = null;
            }
          }
          updateTerminalStatus(sessionId, detectedState);
          currentStatusRef.current = detectedState;
        }

        callback(data);
      });
    },
    [sessionId, updateTerminalStatus]
  );

  // Setup state detection interval - activity-based detection
  // Running = output received within last 4 seconds (and not just echo)
  // Waiting = waiting pattern detected
  // Idle = no recent output OR idle pattern detected
  useEffect(() => {
    stateCheckIntervalRef.current = setInterval(() => {
      // Only check state if we've received any output
      if (!hasReceivedFirstOutputRef.current) {
        return;
      }

      const now = Date.now();
      const lastOutputTime = outputBufferRef.current.getLastDataTime();
      const lastUserInputTime = lastUserInputTimeRef.current;
      const currentStatus = currentStatusRef.current;

      // Check if recent output is likely just echo from user input
      // Only apply echo ignore when NOT already in 'running' state.
      // When running, we want to stay running as long as there's any output.
      // Echo ignore is meant to prevent idle->running transitions from keystroke echo.
      const isLikelyEcho =
        currentStatus !== 'running' &&
        lastUserInputTime > 0 &&
        lastOutputTime > 0 &&
        lastOutputTime >= lastUserInputTime &&
        lastOutputTime - lastUserInputTime < ECHO_IGNORE_WINDOW_MS;

      // Determine state based on activity and patterns
      // If output is likely echo, pass a fake "old" timestamp to treat it as no recent activity
      const effectiveLastOutputTime = isLikelyEcho ? 0 : lastOutputTime;
      const detectedState = outputBufferRef.current.detectState(now, effectiveLastOutputTime);

      // Only update if state changed
      if (detectedState && detectedState !== currentStatus) {
        // Don't transition to 'running' until we've seen idle/waiting at least once
        // This prevents premature 'starting' -> 'running' during shell initialization
        if (detectedState === 'running' && !hasReachedStableStateRef.current) {
          return;
        }

        // Mark that we've reached a stable state
        if (detectedState === 'idle' || detectedState === 'waiting') {
          hasReachedStableStateRef.current = true;
          // Cancel any pending running transition
          if (pendingRunningTimeoutRef.current) {
            clearTimeout(pendingRunningTimeoutRef.current);
            pendingRunningTimeoutRef.current = null;
          }
          updateTerminalStatus(sessionId, detectedState);
          currentStatusRef.current = detectedState;
          return;
        }

        // For 'running' state, delay the transition to avoid flicker
        if (detectedState === 'running') {
          // Only start the timer if we don't already have one pending
          if (!pendingRunningTimeoutRef.current) {
            pendingRunningTimeoutRef.current = setTimeout(() => {
              pendingRunningTimeoutRef.current = null;
              // Check if there's been recent activity (output within activity timeout)
              const lastOutput = outputBufferRef.current.getLastDataTime();
              const hasRecentActivity =
                lastOutput > 0 && Date.now() - lastOutput < ACTIVITY_TIMEOUT_MS;
              if (hasRecentActivity && currentStatusRef.current !== 'running') {
                updateTerminalStatus(sessionId, 'running');
                currentStatusRef.current = 'running';
              }
            }, RUNNING_DISPLAY_DELAY_MS);
          }
          return;
        }

        updateTerminalStatus(sessionId, detectedState);
        currentStatusRef.current = detectedState;
      }
    }, STATE_CHECK_INTERVAL_MS);

    return () => {
      if (stateCheckIntervalRef.current) {
        clearInterval(stateCheckIntervalRef.current);
      }
      if (pendingRunningTimeoutRef.current) {
        clearTimeout(pendingRunningTimeoutRef.current);
      }
    };
  }, [sessionId, updateTerminalStatus]);

  // Handle exit event
  useEffect(() => {
    const unsubscribe = window.terminal.onExit(sessionId, (code, _signal) => {
      if (stateCheckIntervalRef.current) {
        clearInterval(stateCheckIntervalRef.current);
        stateCheckIntervalRef.current = null;
      }
      if (pendingRunningTimeoutRef.current) {
        clearTimeout(pendingRunningTimeoutRef.current);
        pendingRunningTimeoutRef.current = null;
      }
      updateTerminalStatus(sessionId, code === 0 ? 'stopped' : 'error');
    });

    return unsubscribe;
  }, [sessionId, updateTerminalStatus]);

  // Auto-spawn if enabled
  useEffect(() => {
    if (autoSpawn) {
      spawn();
    }
  }, [autoSpawn, spawn]);

  return { spawn, write, resize, kill, onData };
}
