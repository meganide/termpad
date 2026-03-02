import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HunkSeparatorProps {
  /** The line number before the gap starts (last line of previous hunk) */
  prevHunkEndLine: number;
  /** The line number after the gap ends (first line of next hunk) */
  nextHunkStartLine: number;
  /** Context label from git diff header (e.g., function or class name) */
  contextHeader?: string;
  /** Side of the diff (for split view) */
  side?: 'old' | 'new';
  /** Callback when Expand Up is clicked (loads lines above) */
  onExpandUp?: () => void;
  /** Callback when Expand Down is clicked (loads lines below) */
  onExpandDown?: () => void;
  /** Callback when Bridge/Show All is clicked (loads all remaining lines) */
  onBridge?: () => void;
}

const EXPAND_INCREMENT = 20;

/**
 * Calculate the gap size between two hunks.
 * Gap is the number of hidden lines between the last line of one hunk
 * and the first line of the next hunk (exclusive of both boundaries).
 */
function calculateGap(prevEnd: number, nextStart: number): number {
  // Gap is the space between prevEnd and nextStart
  // For example: prevEnd=10, nextStart=15 → gap of 4 lines (11, 12, 13, 14)
  return Math.max(0, nextStart - prevEnd - 1);
}

/**
 * HunkSeparator appears between hunks to show hidden context.
 * Provides expansion controls positioned in the gutter area.
 *
 * For gaps ≤20 lines: Shows single "Show all N lines" bridge button
 * For gaps >20 lines: Shows Expand Up (top), Show all N lines (middle), Expand Down (bottom)
 */
export function HunkSeparator({
  prevHunkEndLine,
  nextHunkStartLine,
  contextHeader,
  side = 'new',
  onExpandUp,
  onExpandDown,
  onBridge,
}: HunkSeparatorProps) {
  const gap = calculateGap(prevHunkEndLine, nextHunkStartLine);

  // If no gap, don't render anything
  if (gap <= 0) {
    return null;
  }

  const isBridgeMode = gap <= EXPAND_INCREMENT;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 bg-muted/20 border-y border-border',
        'text-xs text-muted-foreground'
      )}
      data-testid="hunk-separator"
      data-gap={gap}
      data-mode={isBridgeMode ? 'bridge' : 'progressive'}
      data-side={side}
    >
      {/* Gutter area with expansion controls */}
      <div className="flex items-center gap-1 min-w-[120px]">
        {isBridgeMode ? (
          // Bridge mode: Single button to show all lines
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onBridge}
            data-testid="bridge-button"
          >
            <span>Show all {gap} lines</span>
          </Button>
        ) : (
          // Progressive expansion mode
          <>
            {onExpandUp && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onExpandUp}
                data-testid="expand-up-button"
                title={`Expand up (${EXPAND_INCREMENT} lines)`}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
            )}

            <span className="text-xs px-1">···</span>

            {onBridge && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onBridge}
                data-testid="show-all-button"
              >
                Show all {gap} lines
              </Button>
            )}

            <span className="text-xs px-1">···</span>

            {onExpandDown && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onExpandDown}
                data-testid="expand-down-button"
                title={`Expand down (${EXPAND_INCREMENT} lines)`}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Context header (function/class name from git diff) */}
      {contextHeader && (
        <div className="flex-1 truncate text-muted-foreground/70" data-testid="context-header">
          {contextHeader}
        </div>
      )}
    </div>
  );
}

/**
 * Get the number of lines to load for an expand operation.
 * Expand Up/Down load exactly EXPAND_INCREMENT lines.
 */
export function getExpandLineCount(
  operation: 'up' | 'down' | 'bridge',
  gap: number
): number {
  if (operation === 'bridge') {
    return gap;
  }
  return Math.min(EXPAND_INCREMENT, gap);
}
