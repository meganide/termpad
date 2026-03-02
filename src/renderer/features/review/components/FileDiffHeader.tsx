import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DiffFile, DiffFileStatus } from '../../../../shared/reviewTypes';

interface FileDiffHeaderProps {
  file: DiffFile;
  isExpanded: boolean;
  isViewed: boolean;
  /** Whether the Expand All operation is in progress */
  isExpandingAll?: boolean;
  onToggleExpand: () => void;
  onMarkViewed: () => void;
  /** Callback to expand all hidden context lines in the file */
  onExpandAll?: () => void;
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = path.split('.').pop()?.toLowerCase();

  if (ext === 'json') return <FileJson className={className} />;
  if (ext === 'md' || ext === 'txt') return <FileText className={className} />;
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h'].includes(ext || '')) {
    return <FileCode className={className} />;
  }
  return <File className={className} />;
}

function getStatusBadge(status: DiffFileStatus): { text: string; className: string } {
  switch (status) {
    case 'added':
      return { text: 'Added', className: 'bg-green-500/20 text-green-500' };
    case 'deleted':
      return { text: 'Deleted', className: 'bg-red-500/20 text-red-500' };
    case 'renamed':
      return { text: 'Renamed', className: 'bg-blue-500/20 text-blue-500' };
    case 'binary':
      return { text: 'Binary', className: 'bg-yellow-500/20 text-yellow-500' };
    case 'modified':
    default:
      return { text: 'Modified', className: 'bg-yellow-500/20 text-yellow-500' };
  }
}

export function FileDiffHeader({
  file,
  isExpanded,
  isViewed,
  isExpandingAll = false,
  onToggleExpand,
  onMarkViewed,
  onExpandAll,
}: FileDiffHeaderProps) {
  const statusBadge = getStatusBadge(file.status);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 bg-muted border-b border-border',
        'sticky -top-4 z-20'
      )}
      data-testid="file-diff-header"
    >
      {/* Expand/collapse button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={onToggleExpand}
        data-testid="expand-toggle"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Expand All button - expands all hidden context lines */}
      {onExpandAll && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onExpandAll();
              }}
              disabled={!isExpanded || isExpandingAll}
              data-testid="expand-all-button"
            >
              {isExpandingAll ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ChevronsUpDown className="h-3 w-3 mr-1" />
              )}
              {isExpandingAll ? 'Loading...' : 'Expand All'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Expand all hidden context</TooltipContent>
        </Tooltip>
      )}

      {/* File icon */}
      <FileIcon path={file.path} className="h-4 w-4 text-muted-foreground" />

      {/* File path */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-medium text-sm truncate">{file.path}</span>
        {file.oldPath && file.status === 'renamed' && (
          <span className="text-xs text-muted-foreground truncate">(from {file.oldPath})</span>
        )}
        <span className={cn('text-xs px-1.5 py-0.5 rounded', statusBadge.className)}>
          {statusBadge.text}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs font-mono">
        {file.additions > 0 && (
          <span className="text-green-500" data-testid="additions">
            +{file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-500" data-testid="deletions">
            -{file.deletions}
          </span>
        )}
      </div>

      {/* Mark as viewed checkbox */}
      <label
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        data-testid="mark-viewed-label"
      >
        <Checkbox
          checked={isViewed}
          onCheckedChange={() => onMarkViewed()}
          data-testid="mark-viewed-checkbox"
        />
        <span className="text-xs text-muted-foreground">Viewed</span>
      </label>
    </div>
  );
}
