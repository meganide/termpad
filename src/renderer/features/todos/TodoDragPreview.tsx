import { format } from 'date-fns';
import { CheckSquare, GripVertical, MoreHorizontal, Square } from 'lucide-react';
import type { TodoItem } from '../../../shared/types';
import { PRIORITY_STYLES } from './priority';
import { getTodoStatus } from './status';

// Presentational only: registering another sortable in the overlay would reuse
// the source card's drag ID and break its measurement and keyboard focus.
export function TodoDragPreview({ todo, card = true }: { todo: TodoItem; card?: boolean }) {
  const priority = todo.priority ? PRIORITY_STYLES[todo.priority] : undefined;
  return (
    <div
      data-testid="todo-drag-preview"
      aria-hidden="true"
      className={`relative flex cursor-grabbing ${card ? 'flex-wrap' : ''} items-start gap-2 rounded-lg bg-obsidian-800 py-1.5 pr-2 shadow-xl ring-1 ring-primary/40 ${priority ? 'pl-3' : 'pl-2'}`}
    >
      {priority && (
        <span
          className={`absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full ${priority.stripe}`}
        />
      )}
      {!card && (
        <>
          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {getTodoStatus(todo) === 'done' ? (
            <CheckSquare className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </>
      )}
      <span
        className={`${card ? 'w-full line-clamp-6' : 'flex-1 line-clamp-2'} whitespace-pre-wrap break-words text-sm ${getTodoStatus(todo) === 'done' ? 'text-muted-foreground' : 'text-foreground'}`}
      >
        {todo.text}
      </span>
      <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {format(new Date(todo.createdAt), 'MMM d')}
      </span>
      <MoreHorizontal className="size-6 p-1 text-muted-foreground" />
    </div>
  );
}
