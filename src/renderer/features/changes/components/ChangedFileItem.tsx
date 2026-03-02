import type { DiffFile } from '../../../../shared/reviewTypes';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChangedFileItemProps {
  file: DiffFile;
  onClick: () => void;
}

export function ChangedFileItem({ file, onClick }: ChangedFileItemProps) {
  const fileName = file.path.split('/').pop() || file.path;
  // Remove trailing "/" so we can show it separately after ellipsis
  const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
        'hover:bg-muted/50 rounded-sm'
      )}
      data-testid="changed-file-item"
    >
      {/* File path - directory truncates, filename always visible */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-1 min-w-0 font-mono text-[11px] flex items-baseline overflow-hidden cursor-default">
            {dirPath && (
              <>
                <span className="text-muted-foreground truncate max-w-[120px] flex-shrink">
                  {dirPath}
                </span>
                <span className="text-muted-foreground flex-shrink-0">/</span>
              </>
            )}
            <span className="text-foreground flex-shrink-0">{fileName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="font-mono text-xs">{file.path}</p>
        </TooltipContent>
      </Tooltip>

      {/* Stats - additions and deletions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-mono">
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
        {file.isBinary && (
          <span className="text-muted-foreground" data-testid="binary-indicator">
            binary
          </span>
        )}
      </div>
    </button>
  );
}
