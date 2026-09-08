import { LayoutGrid, X } from 'lucide-react';
import type { Repository } from '../../../shared/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface OverviewHeaderProps {
  agentCount: number;
  onClose: () => void;
  repositories?: Repository[];
  repositoryId?: string | null;
  onRepositoryChange?: (repositoryId: string | null) => void;
}

export function OverviewHeader({
  agentCount,
  onClose,
  repositories = [],
  repositoryId,
  onRepositoryChange,
}: OverviewHeaderProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-muted/80 px-4 py-2.5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2.5">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {repositoryId ? 'Repository split view' : 'Agent overview'}
        </span>
        <span className="text-xs text-muted-foreground/60">({agentCount})</span>
      </div>
      <div className="flex items-center gap-2">
        {onRepositoryChange && (
          <Select
            value={repositoryId ?? 'all'}
            onValueChange={(value) => onRepositoryChange(value === 'all' ? null : value)}
          >
            <SelectTrigger size="sm" className="max-w-48" aria-label="Overview repository">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repositories</SelectItem>
              {repositories.map((repository) => (
                <SelectItem key={repository.id} value={repository.id}>
                  {repository.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {repositoryId ? 'Click a terminal to interact' : '↑ ↓ ← → navigate · Enter open'}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Close overview"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {repositoryId ? 'Close repository split view (Ctrl+O)' : 'Close overview (Esc)'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
