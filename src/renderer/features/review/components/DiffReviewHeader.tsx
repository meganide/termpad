import { X, GitBranch, LayoutList, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DiffViewMode } from '../../../../shared/reviewTypes';
import { ReviewToolbar } from './ReviewToolbar';

interface DiffReviewHeaderProps {
  baseBranch: string;
  compareBranch: string;
  viewMode: DiffViewMode;
  onViewModeChange: (mode: DiffViewMode) => void;
  onClose?: () => void;
  onClearAllComments?: () => Promise<void>;
}

export function DiffReviewHeader({
  baseBranch,
  compareBranch,
  viewMode,
  onViewModeChange,
  onClose,
  onClearAllComments,
}: DiffReviewHeaderProps) {
  return (
    <div
      className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background pointer-events-auto"
      data-testid="diff-review-header"
    >
      {/* Left side - Branch info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium" data-testid="base-branch">
            {baseBranch}
          </span>
          <span className="text-muted-foreground">←</span>
          <span className="font-medium" data-testid="compare-branch">
            {compareBranch}
          </span>
        </div>
      </div>

      {/* Center - View mode toggle */}
      <div
        className="flex items-center gap-1 bg-muted rounded-lg p-1"
        data-testid="view-mode-toggle"
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            viewMode === 'unified' && 'bg-background shadow-sm'
          )}
          onClick={() => onViewModeChange('unified')}
          data-testid="unified-mode-button"
        >
          <LayoutList className="h-4 w-4" />
          Unified
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            viewMode === 'split' && 'bg-background shadow-sm'
          )}
          onClick={() => onViewModeChange('split')}
          data-testid="split-mode-button"
        >
          <Columns className="h-4 w-4" />
          Split
        </button>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        <ReviewToolbar onClearAll={onClearAllComments} />
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-button">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
