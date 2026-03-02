import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';
import { Trash2, GitCompare, Settings } from 'lucide-react';
import type { Repository } from '../../../shared/types';

interface RepositoryContextMenuProps {
  children: React.ReactNode;
  repository: Repository;
  onDelete: (repository: Repository) => void;
  onReview?: (repository: Repository) => void;
  onOpenSettings?: (repository: Repository) => void;
  onOpenChange?: (open: boolean) => void;
}

export function RepositoryContextMenu({
  children,
  repository,
  onDelete,
  onReview,
  onOpenSettings,
  onOpenChange,
}: RepositoryContextMenuProps) {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
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
