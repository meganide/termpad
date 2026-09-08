import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { TodoItem } from '../../../shared/types';

interface TodoItemRowProps {
  todo: TodoItem;
  onToggle: (completed: boolean) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}

export function TodoItemRow({ todo, onToggle, onRename, onRemove }: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

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

  return (
    <li
      className="group flex items-start gap-2 rounded-lg bg-obsidian-800/60 px-2 py-1.5 hover:bg-obsidian-800/80"
      data-testid="todo-item"
    >
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
