import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { Trash2, GitCompare, Settings, LayoutGrid, Columns3 } from 'lucide-react';
import type { Repository } from '../../../shared/types';

interface RepositoryContextMenuProps {
  children: React.ReactNode;
  repository: Repository;
  onDelete: (repository: Repository) => void;
  onReview?: (repository: Repository) => void;
  onOpenSettings?: (repository: Repository) => void;
  onOpenChange?: (open: boolean) => void;
  onOpenOverview?: (repositoryId: string) => void;
  onOpenPlanning?: (repositoryId: string) => void;
}

export function RepositoryContextMenu({
  children,
  repository,
  onDelete,
  onReview,
  onOpenSettings,
  onOpenChange,
  onOpenOverview,
  onOpenPlanning,
}: RepositoryContextMenuProps) {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onOpenOverview && (
          <ContextMenuItem onClick={() => onOpenOverview(repository.id)}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Open agent overview
          </ContextMenuItem>
        )}
        {onOpenPlanning && (
          <ContextMenuItem onClick={() => onOpenPlanning(repository.id)}>
            <Columns3 className="mr-2 h-4 w-4" />
            Open Planning
          </ContextMenuItem>
        )}
        {onOpenSettings && (
          <>
            <ContextMenuItem
              onClick={() => onOpenSettings(repository)}
              data-testid="repository-settings-menu-item"
            >
              <Settings className="mr-2 h-4 w-4" />
              Repository Settings
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onReview && (
          <>
            <ContextMenuItem
              onClick={() => onReview(repository)}
              data-testid="review-repository-menu-item"
            >
              <GitCompare className="mr-2 h-4 w-4" />
              Review Changes
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onClick={() => onDelete(repository)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Repository
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
