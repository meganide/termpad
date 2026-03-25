import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from '../../hooks/useTerminal';
import { useAppStore } from '../../stores/appStore';
import { getTerminalTheme } from '../../themes/terminalThemes';
import { transformTerminalColors } from '../../utils/terminalColorTransformer';
import { Copy, ClipboardPaste, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FocusArea } from '../../../shared/types';

function cleanTerminalText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trimEnd();
}

interface TerminalViewProps {
  sessionId: string;
  terminalId?: string; // Optional separate terminal ID (for tabs: worktreeSessionId:tabId)
  cwd: string;
  isVisible: boolean;
  initialCommand?: string; // Command to auto-run on terminal start (e.g., 'claude', 'gemini')
  matchSystemBackground?: boolean; // Use bg-background matching colors instead of default terminal colors
  terminalType?: 'main' | 'user'; // Which focus area this terminal responds to (default: 'main')
}

export interface TerminalViewHandle {
  copyAllOutput: () => Promise<void>;
}

// System background color to override theme background when matchSystemBackground is true
const SYSTEM_BG_DARK = '#1d1f23';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

export const TerminalView = memo(
  forwardRef<TerminalViewHandle, TerminalViewProps>(function TerminalView(
    {
      sessionId,
      terminalId,
      cwd,
      isVisible,
      initialCommand,
      matchSystemBackground = false,
      terminalType = 'main',
    },
    ref
  ) {
    // Use terminalId if provided, otherwise fall back to sessionId (legacy behavior)
    const effectiveTerminalId = terminalId ?? sessionId;
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const hasSpawnedRef = useRef(false);
    const isReplayingRef = useRef(false);
    const pendingReplayWritesRef = useRef<string[]>([]);

    // Use selector to only subscribe to specific state, preventing re-renders on unrelated store changes
    const focusArea = useAppStore((state) => state.focusArea);
    const setFocusArea = useAppStore((state) => state.setFocusArea);
    const recordTerminalActivity = useAppStore((state) => state.recordTerminalActivity);

    const { spawn, write, resize, onData } = useTerminal({
      sessionId: effectiveTerminalId,
      cwd,
      autoSpawn: false,
      initialCommand,
    });

    const [hasSelection, setHasSelection] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
      isOpen: false,
      x: 0,
      y: 0,
    });

    // Expose copyAllOutput method via ref
    useImperativeHandle(ref, () => ({
      copyAllOutput: async () => {
        const terminal = terminalRef.current;
        if (!terminal) return;

        const buffer = terminal.buffer.active;
        const lines: string[] = [];

        // Get all lines from the buffer (from baseY to cursorY for scrollback + visible)
        const totalRows = buffer.baseY + buffer.cursorY + 1;
        for (let i = 0; i < totalRows; i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString(true));
          }
        }

        const text = cleanTerminalText(lines.join('\n'));
        if (text) {
          await navigator.clipboard.writeText(text);
        }
      },
    }));

    // Spawn the terminal process immediately on mount (separate from xterm UI initialization)
    // This ensures terminals are registered and running even if the container is hidden
    useEffect(() => {
      if (hasSpawnedRef.current) return;
      hasSpawnedRef.current = true;
      spawn();
    }, [spawn, effectiveTerminalId]);

    // Set up pty data subscription immediately (for status detection)
    // This is separate from xterm UI so status updates work even when hidden
    useEffect(() => {
      const unsubscribe = onData((data) => {
        if (isReplayingRef.current) {
          pendingReplayWritesRef.current.push(data);
          recordTerminalActivity(effectiveTerminalId);
          return;
        }
        // Write to xterm if it exists
        if (terminalRef.current) {
          // Transform true color sequences to use muted colors for diff highlighting
          const transformedData = transformTerminalColors(data);
          terminalRef.current.write(transformedData);
        }
        // Mark that terminal has received output (enables notifications)
        recordTerminalActivity(effectiveTerminalId);
      });

      return unsubscribe;
    }, [onData, effectiveTerminalId, recordTerminalActivity]);

    // Initialize xterm UI when container becomes available
    useEffect(() => {
      if (!containerRef.current || terminalRef.current) return;

      const buildTheme = () => {
        const selectedTheme = getTerminalTheme();
        const colors = { ...selectedTheme.colors };

        // Override background for system background mode
        if (matchSystemBackground) {
          colors.background = SYSTEM_BG_DARK;
          colors.cursorAccent = SYSTEM_BG_DARK;
          colors.black = SYSTEM_BG_DARK;
        }

        return colors;
      };

      const terminal = new Terminal({
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: true,
        theme: buildTheme(),
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon((_event, uri) => {
        window.electronAPI.openExternal(uri);
      });

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(containerRef.current);

      // Only fit if the container is visible (has dimensions)
      if (containerRef.current.offsetWidth > 0 && containerRef.current.offsetHeight > 0) {
        fitAddon.fit();
      }

      fitAddonRef.current = fitAddon;

      // Track whether this effect's terminal has been disposed so async
      // callbacks (buffer replay) don't write to a stale instance.
      let disposed = false;

      terminalRef.current = terminal;

      // For user terminals, replay buffered output before resuming live writes.
      // Buffer live output while the async replay runs to avoid duplicates
      // and missing data during initialization.
      if (terminalType === 'user') {
        isReplayingRef.current = true;
        pendingReplayWritesRef.current = [];
        window.terminal
          .getBuffer(effectiveTerminalId)
          .then((bufferedData) => {
            if (disposed) return;
            if (bufferedData) {
              terminal.write(transformTerminalColors(bufferedData));
            }
            const pendingWrites = pendingReplayWritesRef.current;
            pendingReplayWritesRef.current = [];
            isReplayingRef.current = false;
            for (const chunk of pendingWrites) {
              terminal.write(transformTerminalColors(chunk));
            }
          })
          .catch((error) => {
            if (disposed) return;
            console.error('Failed to replay terminal buffer:', error);
            const pendingWrites = pendingReplayWritesRef.current;
            pendingReplayWritesRef.current = [];
            isReplayingRef.current = false;
            for (const chunk of pendingWrites) {
              terminal.write(transformTerminalColors(chunk));
            }
          });
      }

      // Allow certain shortcuts to pass through to window instead of being handled by xterm
      terminal.attachCustomKeyEventHandler((e) => {
        // Detect Mac for platform-specific shortcuts
        const isMacPlatform = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        // Detect Linux for Ctrl+Space workaround (reserved by input method frameworks)
        const isLinuxPlatform = window.electronAPI?.platform === 'linux';

        // Let Ctrl+Space (or Ctrl+Shift+Space on Linux) pass through to window for sidebar/terminal focus toggle
        // On Linux, Ctrl+Space is reserved by input method frameworks, so we use Ctrl+Shift+Space instead
        const isSidebarShortcut = isLinuxPlatform
          ? e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === ' '
          : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === ' ';
        if (isSidebarShortcut) {
          return false; // Don't let xterm handle it, let it bubble to window
        }
        // Let Ctrl+1-9 (Windows/Linux) or Cmd+1-9 (Mac) pass through to window for tab switching
        const isTabSwitchModifier = isMacPlatform
          ? e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
          : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
        if (isTabSwitchModifier) {
          const keyNum = parseInt(e.key, 10);
          if (keyNum >= 1 && keyNum <= 9) {
            return false; // Don't let xterm handle it, let it bubble to window
          }
        }
        // Let Ctrl+T pass through for switching to main terminal
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 't') {
          return false; // Don't let xterm handle it, let it bubble to window
        }
        // Let Ctrl+U pass through for switching to user terminal
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'u') {
          return false; // Don't let xterm handle it, let it bubble to window
        }
        // Let Ctrl+W pass through for creating new tab
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'w') {
          return false; // Don't let xterm handle it, let it bubble to window
        }
        // Let Ctrl+Q pass through for closing current tab
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'q') {
          return false; // Don't let xterm handle it, let it bubble to window
        }

        // Handle Ctrl+V / Cmd+V paste
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isPaste = isMac
          ? e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v'
          : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'v';

        if (isPaste && e.type === 'keydown') {
          e.preventDefault();
          // Handle paste asynchronously
          (async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                write(text);
              }
            } catch (err) {
              console.error('Paste failed:', err);
            }
          })();
          return false; // Don't let xterm handle it
        }

        // Handle Ctrl+C / Cmd+C copy
        const isCopy = isMac
          ? e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c'
          : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'c';

        if (isCopy && e.type === 'keydown' && terminal.hasSelection()) {
          e.preventDefault();
          const selection = cleanTerminalText(terminal.getSelection());
          navigator.clipboard.writeText(selection);
          return false; // Don't let xterm handle it
        }

        return true; // Let xterm handle all other keys
      });

      // Handle user input
      terminal.onData((data) => {
        write(data);
      });

      // Update focus area when clicking anywhere in the terminal container
      // Use capture phase to ensure we get the event before xterm handles it
      // Also stop propagation to prevent Layout's onClick from overriding to 'app'
      const handleContainerClick = (e: MouseEvent) => {
        e.stopPropagation();
        const newFocusArea = terminalType === 'main' ? 'mainTerminal' : 'userTerminal';
        setFocusArea(newFocusArea);
      };
      containerRef.current.addEventListener('click', handleContainerClick, true);

      // Initial resize (only if visible)
      if (containerRef.current.offsetWidth > 0) {
        resize(terminal.cols, terminal.rows);
      }

      // Store container ref for cleanup
      const container = containerRef.current;

      return () => {
        disposed = true;
        container?.removeEventListener('click', handleContainerClick, true);
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        isReplayingRef.current = false;
        pendingReplayWritesRef.current = [];
      };
      // Note: matchSystemBackground and settings are intentionally excluded - we handle theme
      // changes in the separate useEffect below to avoid recreating the terminal
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveTerminalId, write, resize]);

    // Handle theme changes
    useEffect(() => {
      if (terminalRef.current) {
        const selectedTheme = getTerminalTheme();
        const colors = { ...selectedTheme.colors };

        // Override background for system background mode
        if (matchSystemBackground) {
          colors.background = SYSTEM_BG_DARK;
          colors.cursorAccent = SYSTEM_BG_DARK;
          colors.black = SYSTEM_BG_DARK;
        }

        terminalRef.current.options.theme = colors;
      }
    }, [matchSystemBackground]);

    // Handle resize
    useEffect(() => {
      if (!containerRef.current) return;

      const handleResize = () => {
        if (fitAddonRef.current && terminalRef.current && isVisible) {
          fitAddonRef.current.fit();
          resize(terminalRef.current.cols, terminalRef.current.rows);
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [isVisible, resize]);

    // Define expected focus area for this terminal type
    // Main terminals respond to 'mainTerminal', user terminals respond to 'userTerminal'
    const expectedFocusArea = terminalType === 'main' ? 'mainTerminal' : 'userTerminal';

    // Fit and focus when visibility changes
    // Only auto-focus if the focusArea matches this terminal's type
    useEffect(() => {
      if (isVisible && fitAddonRef.current && terminalRef.current) {
        // Delay to ensure dialogs have closed and container is laid out
        // Dialog animations take ~200ms, so we wait a bit longer
        const timeoutId = setTimeout(() => {
          fitAddonRef.current?.fit();
          if (terminalRef.current) {
            resize(terminalRef.current.cols, terminalRef.current.rows);
            // Only focus if the focusArea matches this terminal's expected focus area
            if (focusArea === expectedFocusArea) {
              terminalRef.current.focus();
            }
          }
        }, 250);

        return () => clearTimeout(timeoutId);
      }
    }, [isVisible, resize, focusArea, expectedFocusArea]);

    // Focus terminal when focus area changes to this terminal's type (e.g., from sidebar via Ctrl+Space)
    const prevFocusAreaRef = useRef<FocusArea>(focusArea);
    useEffect(() => {
      // Only focus if transitioning TO this terminal's focus area (not on mount)
      if (
        isVisible &&
        focusArea === expectedFocusArea &&
        prevFocusAreaRef.current !== expectedFocusArea &&
        terminalRef.current
      ) {
        terminalRef.current.focus();
      }
      prevFocusAreaRef.current = focusArea;
    }, [focusArea, isVisible, expectedFocusArea]);

    // Track selection changes
    useEffect(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      const disposable = terminal.onSelectionChange(() => {
        setHasSelection(terminal.hasSelection());
      });

      return () => disposable.dispose();
    }, [effectiveTerminalId]);

    // Close context menu on outside click or escape
    useEffect(() => {
      if (!contextMenu.isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
          terminalRef.current?.focus();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [contextMenu.isOpen]);

    const handleMouseDown = useCallback(() => {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));

      // Update focus area based on terminal type so keyboard shortcuts work
      setFocusArea(terminalType === 'main' ? 'mainTerminal' : 'userTerminal');

      // Focus the terminal
      if (terminalRef.current) {
        terminalRef.current.focus();

        // Also try to focus the xterm textarea directly as a fallback
        const textarea = containerRef.current?.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }
    }, [setFocusArea, terminalType]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
      });
    }, []);

    const handleCopy = useCallback(async () => {
      const terminal = terminalRef.current;
      if (!terminal || !terminal.hasSelection()) return;

      const selection = cleanTerminalText(terminal.getSelection());
      await navigator.clipboard.writeText(selection);
      terminal.clearSelection();
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
      terminal.focus();
    }, []);

    const handlePaste = useCallback(async () => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      const text = await navigator.clipboard.readText();
      if (text) {
        write(text);
      }
      terminal.clearSelection();
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
      terminal.focus();
    }, [write]);

    const handleClearSelection = useCallback(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      terminal.clearSelection();
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
      terminal.focus();
    }, []);

    return (
      <>
        <div
          ref={containerRef}
          className="h-full w-full outline-none rounded-lg overflow-hidden"
          style={{ display: isVisible ? 'block' : 'none' }}
          tabIndex={-1}
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
        />
        {contextMenu.isOpen && (
          <div
            ref={menuRef}
            className={cn(
              'fixed z-50 min-w-[10rem] overflow-hidden rounded-md border p-1 shadow-md',
              'bg-popover text-popover-foreground',
              'animate-in fade-in-0 zoom-in-95'
            )}
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className={cn(
                'relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors',
                'hover:bg-muted-foreground/20',
                !hasSelection && 'pointer-events-none opacity-50'
              )}
              onClick={handleCopy}
              disabled={!hasSelection}
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <button
              className={cn(
                'relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors',
                'hover:bg-muted-foreground/20'
              )}
              onClick={() => handlePaste()}
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </button>
            {hasSelection && (
              <>
                <div className="bg-border -mx-1 my-1 h-px" />
                <button
                  className={cn(
                    'relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors',
                    'hover:bg-muted-foreground/20'
                  )}
                  onClick={handleClearSelection}
                >
                  <XCircle className="h-4 w-4" />
                  Clear Selection
                </button>
              </>
            )}
          </div>
        )}
      </>
    );
  })
);
