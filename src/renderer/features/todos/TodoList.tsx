import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAppStore, type TodoScope } from '../../stores/appStore';
import type { TodoItem } from '../../../shared/types';
import { TodoItemRow } from './TodoItemRow';

interface TodoListProps {
  label: string;
  scope: TodoScope;
  todos: TodoItem[];
}

export function TodoList({ label, scope, todos }: TodoListProps) {
  const { addTodo, updateTodo, removeTodo } = useAppStore(
    useShallow((s) => ({
      addTodo: s.addTodo,
      updateTodo: s.updateTodo,
      removeTodo: s.removeTodo,
    }))
  );
  const [draft, setDraft] = useState('');

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!draft.trim()) return;
      addTodo(scope, draft);
      setDraft('');
    },
    [addTodo, draft, scope]
  );

  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-1">
        <label className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground truncate">
          {label}
        </label>
        {todos.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {completedCount}/{todos.length}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a todo"
          aria-label={`Add a todo to ${label}`}
          className="h-8 rounded-lg border-obsidian-400 bg-obsidian-800/60 text-sm focus-visible:border-primary"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} className="h-8 w-8 shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {todos.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
          No todos yet
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {todos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              onToggle={(completed) => updateTodo(scope, todo.id, { completed })}
              onRename={(text) => updateTodo(scope, todo.id, { text })}
              onRemove={() => removeTodo(scope, todo.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
