import { useCallback, useRef, useState } from 'react';
import { format } from 'date-fns';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '../../components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { TodoItem, TodoPriority, TodoStatus, WorktreeSession } from '../../../shared/types';
import { getTodoStatus } from './status';
import { PRIORITY_STYLES } from './priority';
import { TodoDetailDialog } from './TodoDetailDialog';
import { TodoActionItems } from './TodoActionItems';

interface TodoItemRowProps {
  todo: TodoItem;
  sortable: boolean;
  onToggle: (completed: boolean) => void;
  onRename: (text: string) => void;
  onPriorityChange: (priority: TodoPriority | undefined) => void;
  onRemove: () => void;
  moveTargets?: WorktreeSession[];
  onMove: (id: string) => void;
  onStatusChange: (status: TodoStatus) => void;
  card?: boolean;
  onSendToTerminal?: () => void;
  onCreateWorktree?: () => void;
}

export function TodoItemRow({
  todo,
  sortable,
  onToggle,
  onRename,
  onPriorityChange,
  onRemove,
  moveTargets,
  onMove,
  onStatusChange,
  card = false,
  onSendToTerminal,
  onCreateWorktree,
}: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const afterMenuClose = useRef<(() => void) | null>(null);
  const handleMenuCloseAutoFocus = (event: Event) => {
    if (!afterMenuClose.current) return;
    event.preventDefault();
    const action = afterMenuClose.current;
    afterMenuClose.current = null;
    action();
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !sortable || isEditing,
  });

  const startEditing = () => {
    setDraft(todo.text);
    setIsEditing(true);
  };
  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== todo.text) onRename(trimmed);
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(todo.text);
  };
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(todo.text);
      toast.success('Todo copied');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [todo.text]);

  const done = getTodoStatus(todo) === 'done';
  const createdAt = new Date(todo.createdAt);
  const priorityStyle = todo.priority ? PRIORITY_STYLES[todo.priority] : undefined;
  const actions = {
    todo,
    onOpen: () => {
      afterMenuClose.current = () => setIsDetailOpen(true);
    },
    onEdit: () => {
      afterMenuClose.current = startEditing;
    },
    onCopy: handleCopy,
    onRemove: () => {
      afterMenuClose.current = () => setConfirmDelete(true);
    },
    onPriorityChange,
    moveTargets,
    onMove,
    onStatusChange,
    onSendToTerminal: onSendToTerminal
      ? () => {
          afterMenuClose.current = onSendToTerminal;
        }
      : undefined,
    onCreateWorktree: onCreateWorktree
      ? () => {
          afterMenuClose.current = onCreateWorktree;
        }
      : undefined,
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={isEditing}>
          <li
            ref={setNodeRef}
            {...(card && !isEditing ? attributes : {})}
            {...(card && !isEditing ? listeners : {})}
            aria-label={card ? `Move todo: ${todo.text}` : undefined}
            onPointerDown={
              card
                ? (event) => {
                    // Menus and the editor retain their own pointer interactions.
                    if (
                      (event.target as HTMLElement).closest(
                        'button, textarea, input, [role="menu"]'
                      )
                    )
                      return;
                    if (!isEditing) listeners?.onPointerDown?.(event);
                  }
                : undefined
            }
            onKeyDown={
              card
                ? (event) => {
                    if (event.target === event.currentTarget && !isEditing)
                      listeners?.onKeyDown?.(event);
                  }
                : undefined
            }
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`group relative flex ${card ? 'flex-wrap cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''} items-start gap-2 rounded-lg bg-obsidian-800/60 py-1.5 pr-2 hover:bg-obsidian-800/80 ${
              priorityStyle ? 'pl-3' : 'pl-2'
            } ${isDragging ? 'z-10 opacity-80' : ''}`}
            data-testid="todo-item"
          >
            {priorityStyle && (
              <span
                aria-hidden
                className={`absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full ${priorityStyle.stripe}`}
              />
            )}
            {sortable && !card && (
              <button
                type="button"
                aria-label={`Reorder "${todo.text}"`}
                className="mt-0.5 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}
            {!card && (
              <Checkbox
                checked={done}
                onCheckedChange={(checked) => onToggle(checked === true)}
                aria-label={todo.text}
                className="mt-0.5"
              />
            )}
            {isEditing ? (
              <Textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    commitEdit();
                  }
                  if (event.key === 'Escape') cancelEdit();
                }}
                aria-label={`Edit "${todo.text}"`}
                className="min-h-0 max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0"
              />
            ) : card ? (
              <span
                className={`order-first w-full line-clamp-6 whitespace-pre-wrap break-words text-sm ${done ? 'text-muted-foreground' : 'text-foreground'}`}
              >
                {todo.text}
              </span>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className={`line-clamp-2 flex-1 whitespace-pre-wrap break-words text-left text-sm ${
                  done ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}
              >
                {todo.text}
              </button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <time
                  dateTime={todo.createdAt}
                  className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground"
                >
                  {format(createdAt, 'MMM d')}
                </time>
              </TooltipTrigger>
              <TooltipContent side="left">Created {format(createdAt, 'PPp')}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for "${todo.text}"`}
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">Todo actions (or right-click)</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" onCloseAutoFocus={handleMenuCloseAutoFocus}>
                <TodoActionItems {...actions} />
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={handleMenuCloseAutoFocus}>
          <TodoActionItems context {...actions} />
        </ContextMenuContent>
      </ContextMenu>
      {isDetailOpen && (
        <TodoDetailDialog todo={todo} onClose={() => setIsDetailOpen(false)} onSave={onRename} />
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete todo?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this todo.</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{todo.text}</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
