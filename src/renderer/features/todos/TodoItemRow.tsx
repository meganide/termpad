import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Check, Copy, Flag, GripVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { TodoItem, TodoPriority } from '../../../shared/types';
import { PRIORITY_ORDER, PRIORITY_STYLES } from './priority';

interface TodoItemRowProps {
  todo: TodoItem;
  sortable: boolean;
  onToggle: (completed: boolean) => void;
  onRename: (text: string) => void;
  onPriorityChange: (priority: TodoPriority | undefined) => void;
  onRemove: () => void;
}

export function TodoItemRow({
  todo,
  sortable,
  onToggle,
  onRename,
  onPriorityChange,
  onRemove,
}: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const [justCopied, setJustCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !sortable,
  });

  const startEditing = () => {
    setDraft(todo.text);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== todo.text) {
      onRename(trimmed);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(todo.text);
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(todo.text);
      setJustCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setJustCopied(false), 1500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [todo.text]);

  const createdAt = new Date(todo.createdAt);
  const priorityStyle = todo.priority ? PRIORITY_STYLES[todo.priority] : undefined;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-start gap-2 rounded-lg bg-obsidian-800/60 py-1.5 pr-2 hover:bg-obsidian-800/80 ${
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

      {sortable && (
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

      <Checkbox
        checked={todo.completed}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={todo.text}
        className="mt-0.5"
      />

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
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className={`flex-1 whitespace-pre-wrap break-words text-left text-sm ${
            todo.completed ? 'text-muted-foreground line-through' : 'text-foreground'
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
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Priority for "${todo.text}"`}
            className={`h-6 w-6 shrink-0 transition-opacity ${
              priorityStyle
                ? 'text-foreground'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PRIORITY_ORDER.map((priority) => (
            <DropdownMenuItem key={priority} onSelect={() => onPriorityChange(priority)}>
              <span className={`size-2 rounded-full ${PRIORITY_STYLES[priority].dot}`} />
              {PRIORITY_STYLES[priority].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => onPriorityChange(undefined)}>
            <span className="size-2 rounded-full bg-muted-foreground" />
            None
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            aria-label={`Copy "${todo.text}"`}
            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
          >
            {justCopied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{justCopied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Delete "${todo.text}"`}
            className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Delete</TooltipContent>
      </Tooltip>
    </li>
  );
}
