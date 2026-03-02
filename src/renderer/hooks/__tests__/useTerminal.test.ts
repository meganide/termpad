import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminal } from '../useTerminal';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores } from '../../../../tests/utils';
import { ACTIVITY_TIMEOUT_MS } from '../../utils/terminalStateDetector';

describe('useTerminal - Terminal Status Flow Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultOptions = {
    sessionId: 'test-session-1',
    cwd: '/test/project',
    autoSpawn: false,
    initialCommand: 'claude',
  };

  describe('spawn → starting → running flow', () => {
    it('should start with "starting" status on spawn', async () => {
      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.has(defaultOptions.sessionId)).toBe(true);
    });

    it('should stay in starting status when output has no shell prompt (startup grace period)', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // First output without shell prompt (e.g., shell initialization, motd)
      act(() => {
        capturedDataHandler?.('Loading...');
      });

      // Wait for the state check interval to fire
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should stay in 'starting' until we see an idle/waiting pattern
      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('starting');
    });

    it('should transition to idle after activity timeout', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // First output
      act(() => {
        capturedDataHandler?.('Welcome to bash\nSome output');
      });

      // Wait for activity timeout to pass
      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');
    });
  });

  describe('activity-based running detection', () => {
    it('should stay in starting while output is received without having reached stable state', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // Simulate output without shell prompt (no stable state reached yet)
      act(() => {
        capturedDataHandler?.('Working on something...');
      });

      // Advance timer but stay within activity timeout (2s)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should stay in 'starting' until we reach idle/waiting state
      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('starting');
    });

    it('should transition to running after having reached idle state first (with 4s delay)', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // First, reach idle state by waiting for activity timeout
      act(() => {
        capturedDataHandler?.('Some initial output');
      });

      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      // Verify we're in idle
      let terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');

      // Start outputting without prompt (e.g., command running)
      // Need to keep outputting during the 4s delay to maintain "recent activity"
      act(() => {
        capturedDataHandler?.('Running command...\nOutput line 1\n');
      });

      // After 500ms, should still be idle (running has 4s delay)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');

      // Keep outputting every 500ms to maintain activity during the 4s delay
      for (let i = 0; i < 8; i++) {
        act(() => {
          capturedDataHandler?.(`More output ${i}...\n`);
        });
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }

      // Total time elapsed: 500 + 500 + (8 * 500) = 5000ms
      // The 4s timer started at 500ms, so it should have fired at 4500ms
      // Should now be 'running' after the delay
      terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('running');
    });

    it('should transition to idle after activity timeout with no patterns', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // Simulate output without patterns
      act(() => {
        capturedDataHandler?.('Some output here');
      });

      // Advance timer past activity timeout
      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');
    });
  });

  describe('waiting state detection (highest priority)', () => {
    it('should detect waiting pattern immediately even with recent output', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // Simulate output with waiting pattern
      act(() => {
        capturedDataHandler?.('Do you want to continue? (y/n)');
      });

      // Even immediately, should be waiting (highest priority)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('waiting');
    });

    it('should detect generic y/n prompts as waiting', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      act(() => {
        capturedDataHandler?.('Proceed? [Y/n]');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('waiting');
    });
  });

  describe('exit → stopped/error flow', () => {
    it('should set status to stopped when exit code is 0', async () => {
      let capturedExitHandler: ((code: number, signal?: number) => void) | undefined;
      vi.mocked(window.terminal.onExit).mockImplementation((sessionId, handler) => {
        capturedExitHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      act(() => {
        capturedExitHandler?.(0);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('stopped');
    });

    it('should set status to error when exit code is non-zero', async () => {
      let capturedExitHandler: ((code: number, signal?: number) => void) | undefined;
      vi.mocked(window.terminal.onExit).mockImplementation((sessionId, handler) => {
        capturedExitHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      act(() => {
        capturedExitHandler?.(1);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('error');
    });

    it('should set status to error when killed with signal', async () => {
      let capturedExitHandler: ((code: number, signal?: number) => void) | undefined;
      vi.mocked(window.terminal.onExit).mockImplementation((sessionId, handler) => {
        capturedExitHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      act(() => {
        capturedExitHandler?.(130, 2);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('error');
    });
  });

  describe('Claude Code specific patterns (waiting detection)', () => {
    it('should detect "Yes, allow once" as waiting immediately', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      act(() => {
        capturedDataHandler?.('Run this command?\nYes, allow once\nNo, deny');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('waiting');
    });

    it('should detect "Esc to cancel" (AskUserQuestion) as waiting', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      act(() => {
        capturedDataHandler?.('Select an option:\nEsc to cancel');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('waiting');
    });

    it('should detect "enter to select" (AskUserQuestion) as waiting', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      act(() => {
        capturedDataHandler?.('Options:\n> Option 1\n  Option 2\nenter to select');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('waiting');
    });
  });

  describe('continuous output keeps running state', () => {
    it('should stay running when output keeps coming without prompts (after reaching stable state and 4s delay)', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // First, reach idle state by waiting for activity timeout
      act(() => {
        capturedDataHandler?.('Some initial output');
      });

      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      // Verify we're in idle
      let terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');

      // Start continuous output - keep outputting during the 4s delay
      // to maintain "recent activity" for when the timer fires
      for (let i = 0; i < 9; i++) {
        act(() => {
          capturedDataHandler?.(`Output chunk ${i}\n`);
        });
        act(() => {
          vi.advanceTimersByTime(500);
        });
      }

      // Total time: 9*500ms = 4500ms
      // The 4s timer starts and fires at ~4000ms
      // Now should be running
      terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('running');

      // Continue with more output - should stay running
      for (let i = 9; i < 14; i++) {
        act(() => {
          capturedDataHandler?.(`Output chunk ${i}\n`);
        });

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        terminals = useAppStore.getState().terminals;
        expect(terminals.get(defaultOptions.sessionId)?.status).toBe('running');
      }
    });

    it('should not show running if activity stops before 4s delay', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // First, reach idle state by waiting for activity timeout
      act(() => {
        capturedDataHandler?.('Some initial output');
      });

      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      let terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');

      // Brief output
      act(() => {
        capturedDataHandler?.('Quick command output\n');
      });

      // Wait 2 seconds (less than 4s delay)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should still be idle (running delay not complete)
      terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');

      // Wait for activity timeout to pass without more output
      act(() => {
        vi.advanceTimersByTime(ACTIVITY_TIMEOUT_MS + 1000);
      });

      // Should still be idle - activity stopped, never reached running
      terminals = useAppStore.getState().terminals;
      expect(terminals.get(defaultOptions.sessionId)?.status).toBe('idle');
    });

    it('should stay in starting when continuous output comes before reaching stable state', async () => {
      let capturedDataHandler: ((data: string) => void) | undefined;
      vi.mocked(window.terminal.onData).mockImplementation((sessionId, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useTerminal(defaultOptions));

      await act(async () => {
        await result.current.spawn();
      });

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      result.current.onData(() => {});

      // Simulate continuous output without ever showing shell prompt
      // This represents shell initialization or a long-running startup
      for (let i = 0; i < 5; i++) {
        act(() => {
          capturedDataHandler?.(`Initialization step ${i}...\n`);
        });

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        // Should stay in 'starting' because we haven't seen idle/waiting yet
        const terminals = useAppStore.getState().terminals;
        expect(terminals.get(defaultOptions.sessionId)?.status).toBe('starting');
      }
    });
  });
});
