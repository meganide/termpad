import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChangedFileItem } from './ChangedFileItem';
import type { DiffFile } from '../../../../shared/reviewTypes';
import { cn } from '@/lib/utils';

interface FileChangesPaneProps {
  files: DiffFile[];
  isLoading: boolean;
  error: string | null;
  onFileClick: (file: DiffFile) => void;
  onReviewClick: () => void;
}

export function FileChangesPane({
  files,
  isLoading,
  error,
  onFileClick,
  onReviewClick,
}: FileChangesPaneProps) {
  const stats = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 }
    );
  }, [files]);

  const hasChanges = files.length > 0;

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-full bg-background border-l border-border"
        data-testid="file-changes-pane"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Changes</span>
            {hasChanges && (
              <span className="text-xs text-muted-foreground" data-testid="file-count">
                ({files.length} {files.length === 1 ? 'file' : 'files'})
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReviewClick}
            disabled={!hasChanges || isLoading}
            data-testid="review-button"
          >
            Review
          </Button>
        </div>

        {/* Stats row */}
        {hasChanges && (
          <div className="flex items-center px-3 py-1.5 text-xs border-b border-border">
            <div className="flex items-center gap-2 font-mono">
              {stats.additions > 0 && (
                <span className="text-green-500" data-testid="total-additions">
                  +{stats.additions}
                </span>
              )}
              {stats.deletions > 0 && (
                <span className="text-red-500" data-testid="total-deletions">
                  -{stats.deletions}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        <div
          className={cn(
            'flex-1 overflow-y-auto',
            !hasChanges && 'flex items-center justify-center'
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="loading-state">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div
              className="flex items-center justify-center py-8 px-3 text-center"
              data-testid="error-state"
            >
              <span className="text-sm text-destructive">{error}</span>
            </div>
          ) : !hasChanges ? (
            <div className="text-center py-8 px-3" data-testid="empty-state">
              <p className="text-sm text-muted-foreground">No uncommitted changes</p>
            </div>
          ) : (
            <div className="py-1" data-testid="file-list">
              {files.map((file) => (
                <ChangedFileItem key={file.path} file={file} onClick={() => onFileClick(file)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
