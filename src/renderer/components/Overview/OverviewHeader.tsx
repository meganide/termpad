import { Eye, EyeOff, Keyboard, LayoutGrid, X } from 'lucide-react';
import { isMac } from '../../utils/shortcuts';
import type { Repository } from '../../../shared/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface OverviewHeaderProps {
  agentCount: number;
  onClose: () => void;
  repositories?: Repository[];
  repositoryId?: string | null;
  onRepositoryChange?: (repositoryId: string | null) => void;
  hiddenAgents?: {
    terminalId: string;
    tabName: string;
    repositoryName: string;
    worktreeLabel: string;
  }[];
  onUnhideAgent?: (terminalId: string) => void;
  onUnhideAll?: () => void;
}

export function OverviewHeader({
  agentCount,
  onClose,
  repositories = [],
  repositoryId,
  onRepositoryChange,
  hiddenAgents = [],
  onUnhideAgent,
  onUnhideAll,
}: OverviewHeaderProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-muted/80 px-4 py-2.5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2.5">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Agent overview</span>
        <span className="text-xs text-muted-foreground/60">({agentCount})</span>
      </div>
      <div className="flex items-center gap-2">
        {hiddenAgents.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <EyeOff className="h-4 w-4" />
                Hidden ({hiddenAgents.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-80 max-w-80 overflow-y-auto"
              onEscapeKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem onSelect={onUnhideAll}>
                <Eye className="h-4 w-4" />
                Show all hidden agents
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {hiddenAgents.map((agent) => (
                <DropdownMenuItem
                  key={agent.terminalId}
                  onSelect={() => onUnhideAgent?.(agent.terminalId)}
                >
                  <Eye className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{agent.tabName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {agent.repositoryName} / {agent.worktreeLabel}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
          Click a terminal to interact · Right-click for actions
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Overview keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div>{isMac ? 'Cmd' : 'Ctrl'} + I: overview for current repository</div>
            <div>{isMac ? 'Cmd' : 'Ctrl'} + Arrow keys: select agent</div>
            <div>{isMac ? 'Cmd' : 'Ctrl'} + Shift + Enter: open in worktree</div>
            <div>{isMac ? 'Cmd' : 'Ctrl'} + -: close agent</div>
          </TooltipContent>
        </Tooltip>
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
          <TooltipContent>Close overview ({isMac ? 'Cmd' : 'Ctrl'}+O)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
