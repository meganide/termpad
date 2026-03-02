import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Trash2, Keyboard, MoreVertical } from 'lucide-react';
import type { WorktreeSession, Repository } from '../../../shared/types';

interface WorktreeDropdownMenuProps {
  session: WorktreeSession;
  repository: Repository;
  onRemove: (session: WorktreeSession, repository: Repository) => void;
  onOpenChange?: (open: boolean) => void;
  onAssignShortcut?: (session: WorktreeSession) => void;
}

export function WorktreeDropdownMenu({
  session,
  repository,
  onRemove,
  onOpenChange,
  onAssignShortcut,
}: WorktreeDropdownMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-accent-foreground/10"
          aria-label="Session menu"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end">
        {onAssignShortcut && (
          <>
            <DropdownMenuItem onClick={() => onAssignShortcut(session)}>
              <Keyboard className="mr-2 h-4 w-4" />
              Assign Shortcut
            </DropdownMenuItem>
            {!session.isMainWorktree && <DropdownMenuSeparator />}
          </>
        )}
        {!session.isMainWorktree && (
          <DropdownMenuItem onClick={() => onRemove(session, repository)} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Worktree
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
