import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperationProgress, OperationProgressStatus } from '../../../../shared/types';

interface OperationDrawerProps {
  progress: OperationProgress;
  onViewFullError?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

function isRunningStatus(status: OperationProgressStatus): boolean {
  return status === 'checking-hooks' || status === 'running-hook' || status === 'executing';
}

export function OperationDrawer({
  progress,
  onViewFullError,
  onCancel,
  onClose,
}: OperationDrawerProps) {
  // User can manually collapse the drawer
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const { status, output, error, hookManifest, operationType, currentHook } = progress;

  // Check if we have any hooks configured
  const hasHooks =
    hookManifest &&
    (hookManifest['pre-commit'] ||
      hookManifest['commit-msg'] ||
      hookManifest['post-commit'] ||
      hookManifest['pre-push'] ||
      hookManifest['post-push']);

  const isRunning = isRunningStatus(status);
  const isSuccess = status === 'success';
  const isError = status === 'error';

  // Track scroll position to determine if user is at bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Consider "at bottom" if within 20px of the bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll to bottom when new output arrives, only if user is at bottom
  useEffect(() => {
    if (scrollRef.current && !isCollapsed && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, isCollapsed]);

  // Toggle collapse handler
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Don't render if idle
  if (status === 'idle') {
    return null;
  }

  // Don't render for no-hooks commits unless there's an error
  // (fast path - no need to show drawer for simple commits)
  if (!hasHooks && !isError) {
    return null;
  }

  // Generate status text based on operation type and current hook
  const getStatusText = (): string => {
    const opLabel = operationType === 'push' ? 'Push' : 'Commit';

    switch (status) {
      case 'checking-hooks':
        return 'Checking hooks...';
      case 'running-hook':
        if (currentHook) {
          return `Running ${currentHook} hook...`;
        }
        return 'Running hooks...';
      case 'executing':
        return operationType === 'push' ? 'Pushing...' : 'Committing...';
      case 'success':
        return `${opLabel} successful`;
      case 'error':
        return progress.operationSucceeded
          ? `${opLabel} OK, ${currentHook || 'post'} hook failed`
          : `${opLabel} failed`;
      default:
        return '';
    }
  };

  const statusText = getStatusText();

  // Check if this is a post-hook failure (operation succeeded but hook failed)
  const isPostHookFailure = isError && progress.operationSucceeded;

  // Determine which icon to show
  const statusIcon = isRunning ? (
    <Loader2 className="size-4 animate-spin" data-testid="status-loading" />
  ) : isSuccess ? (
    <CheckCircle2 className="size-4 text-green-500" data-testid="status-success" />
  ) : isPostHookFailure ? (
    // Post-hook failure: show both success and error indicators
    <div className="flex items-center gap-0.5" data-testid="status-post-hook-error">
      <CheckCircle2 className="size-3.5 text-green-500" />
      <XCircle className="size-3.5 text-destructive" />
    </div>
  ) : isError ? (
    <XCircle className="size-4 text-destructive" data-testid="status-error" />
  ) : (
    <Terminal className="size-4" />
  );

  return (
    <div
      className={cn(
        'border-t bg-muted/30 transition-all duration-200',
        isCollapsed ? 'h-10' : 'h-[292px]'
      )}
      data-testid="operation-drawer"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-10 cursor-pointer hover:bg-muted/50"
        onClick={handleToggleCollapse}
        data-testid="drawer-header"
      >
        <div className="flex items-center gap-2 text-sm">
          {statusIcon}
          <span className={cn(isError && 'text-destructive')}>{statusText}</span>
        </div>
        <div className="flex items-center gap-1">
          {isRunning && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              data-testid="cancel-operation-button"
            >
              <X className="size-3.5 mr-1" />
              Cancel
            </Button>
          )}
          {isError && onViewFullError && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onViewFullError();
              }}
              data-testid="view-full-error-button"
            >
              View Full Error
            </Button>
          )}
          {(isSuccess || isError) && onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              data-testid="close-drawer-button"
            >
              <X className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="collapse-toggle">
            {isCollapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Content - scrollable output area */}
      {!isCollapsed && (
        <div className="relative h-[calc(100%-2.5rem)]">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-auto"
            data-testid="output-area"
          >
            <div className="px-3 py-2 font-mono text-xs space-y-0.5">
              {output.length === 0 ? (
                <div className="text-muted-foreground">Waiting for output...</div>
              ) : (
                output.map((line, index) => (
                  <div
                    key={index}
                    className={cn(
                      'whitespace-pre-wrap break-all',
                      // Highlight error lines
                      (line.toLowerCase().includes('error') ||
                        line.toLowerCase().includes('failed')) &&
                        'text-destructive'
                    )}
                    data-testid="output-line"
                  >
                    {line}
                  </div>
                ))
              )}
              {error && !output.includes(error) && (
                <div className="text-destructive mt-2" data-testid="error-message">
                  {error}
                </div>
              )}
            </div>
          </div>
          {/* Scroll to bottom button */}
          {!isAtBottom && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-2 right-4 h-7 w-7 rounded-full shadow-md"
              onClick={scrollToBottom}
              data-testid="scroll-to-bottom"
            >
              <ArrowDown className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
