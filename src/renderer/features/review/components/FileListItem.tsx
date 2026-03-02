import { CheckCircle, Circle, File, FileCode, FileText, FileJson } from 'lucide-react';
import type { DiffFile, DiffFileStatus } from '../../../../shared/reviewTypes';
import { cn } from '@/lib/utils';

interface FileListItemProps {
  file: DiffFile;
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

export function FileListItem({
  file,
  isSelected,
  isViewed,
  onClick,
  onToggleViewed,
}: FileListItemProps) {
  const fileName = file.path.split('/').pop() || file.path;
  const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

  const handleToggleViewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleViewed();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer',
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

      {/* Status indicator - placed early so it's always visible */}
      <span className={cn('text-xs font-mono flex-shrink-0', getStatusColor(file.status))}>
        {getStatusLabel(file.status)}
      </span>

      {/* File name and path */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="truncate">
          <span className="font-semibold text-foreground">{fileName}</span>
          {dirPath && (
            <span className="text-xs text-muted-foreground/70 ml-1.5">{dirPath}</span>
          )}
        </div>
        {file.oldPath && file.status === 'renamed' && (
          <div className="text-xs text-muted-foreground truncate">from: {file.oldPath}</div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1 flex-shrink-0 text-xs font-mono">
        {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
        {file.isBinary && <span className="text-muted-foreground">binary</span>}
      </div>
    </div>
  );
}
