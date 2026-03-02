import { useState, useEffect, ReactNode } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

interface TitleBarProps {
  /** The title to display in the title bar */
  title: string;
  /** Optional content to render on the left side (Windows/Linux) or right side (macOS) */
  menuContent?: ReactNode;
}

/**
 * Custom title bar component for Windows (frameless mode).
 * Provides draggable area, window title, and custom window controls (minimize, maximize, close).
 *
 * Not used on macOS or Linux - those platforms use native title bars.
 */
export function TitleBar({ title, menuContent }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = window.electronAPI?.platform === 'darwin';
  const isWindows = window.electronAPI?.platform === 'win32';

  // Track window maximized state
  useEffect(() => {
    window.electronAPI?.isWindowMaximized().then(setIsMaximized);
    const cleanup = window.electronAPI?.onMaximizedChange(setIsMaximized);
    return cleanup;
  }, []);

  return (
    <div
      className="h-9 bg-sidebar flex items-center shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {isMac ? (
        <>
          {/* macOS: Left padding for native traffic lights */}
          <div className="w-20" />
          {/* App title */}
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Menu content on right for macOS */}
          {menuContent && (
            <div
              className="flex items-center"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {menuContent}
            </div>
          )}
        </>
      ) : isWindows ? (
        <>
          {/* Windows: Menu content on left */}
          {menuContent && (
            <div
              className="flex items-center"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {menuContent}
            </div>
          )}
          {/* App title */}
          <span
            className={`text-xs font-medium text-muted-foreground ${menuContent ? '' : 'ml-3'}`}
          >
            {title}
          </span>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Window controls on right */}
          <div
            className="flex items-center h-full"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              onClick={() => window.electronAPI.windowMinimize()}
              className="h-full px-4 hover:bg-accent transition-colors"
              aria-label="Minimize"
            >
              <Minus className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => window.electronAPI.windowMaximize()}
              className="h-full px-4 hover:bg-accent transition-colors"
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => window.electronAPI.windowClose()}
              className="h-full px-4 hover:bg-red-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-white" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Linux: Native window frame, just show title and menu content */}
          {menuContent && (
            <div
              className="flex items-center"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {menuContent}
            </div>
          )}
          {/* App title */}
          <span
            className={`text-xs font-medium text-muted-foreground ${menuContent ? '' : 'ml-3'}`}
          >
            {title}
          </span>
          {/* Spacer */}
          <div className="flex-1" />
        </>
      )}
    </div>
  );
}
