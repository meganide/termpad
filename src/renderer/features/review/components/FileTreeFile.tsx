import { CheckCircle, Circle, File, FileCode, FileText, FileJson } from 'lucide-react';
import type { DiffFile, DiffFileStatus } from '../../../../shared/reviewTypes';
import { cn } from '@/lib/utils';
import { TreeGuide } from './TreeGuide';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FileTreeFileProps {
  file: DiffFile;
  depth: number;
  isLast: boolean;
  isSelected: boolean;
  isViewed: boolean;
  onClick: () => void;
  onToggleViewed: () => void;
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

function getStatusColor(status: DiffFileStatus): string {
  switch (status) {
    case 'added':
      return 'text-green-500';
    case 'deleted':
      return 'text-red-500';
    case 'renamed':
      return 'text-blue-500';
    case 'modified':
    default:
      return 'text-yellow-500';
  }
}

function getStatusLabel(status: DiffFileStatus): string {
  switch (status) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'modified':
    default:
      return 'M';
  }
}

export function FileTreeFile({
  file,
  depth,
  isLast,
  isSelected,
  isViewed,
  onClick,
  onToggleViewed,
}: FileTreeFileProps) {
  const fileName = file.path.split('/').pop() || file.path;

  const handleToggleViewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleViewed();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer',
        'hover:bg-muted/50 rounded-md',
        isSelected && 'bg-muted'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {/* Tree guide lines */}
      <TreeGuide depth={depth} isLast={isLast} />

      {/* Viewed indicator - clickable */}
      <button
        className="flex-shrink-0 p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
        onClick={handleToggleViewed}
        aria-label={isViewed ? 'Mark as not viewed' : 'Mark as viewed'}
        data-testid="toggle-viewed-button"
      >
        {isViewed ? (
          <CheckCircle className="h-4 w-4 text-green-500" data-testid="viewed-icon" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" data-testid="unviewed-icon" />
        )}
      </button>

      {/* File icon */}
      <FileIcon path={file.path} className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

      {/* Status indicator */}
      <span className={cn('text-xs font-mono flex-shrink-0', getStatusColor(file.status))}>
        {getStatusLabel(file.status)}
      </span>

      {/* File name only (no dir path - hierarchy shows it) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-1 min-w-0 w-0 overflow-hidden font-mono cursor-default">
            <div className="truncate text-xs text-foreground">{fileName}</div>
            {file.oldPath && file.status === 'renamed' && (
              <div className="text-[10px] text-muted-foreground truncate">
                from: {file.oldPath.split('/').pop()}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="font-mono text-xs">{file.path}</p>
          {file.oldPath && (
            <p className="font-mono text-xs text-muted-foreground">from: {file.oldPath}</p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Stats */}
      <div className="flex items-baseline gap-1 flex-shrink-0 text-xs font-mono">
        {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
        {file.isBinary && <span className="text-muted-foreground">binary</span>}
      </div>
    </div>
  );
}
