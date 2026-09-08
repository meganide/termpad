import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
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

  const submitDraft = useCallback(() => {
    if (!draft.trim()) return;
    addTodo(scope, draft);
    setDraft('');
  }, [addTodo, draft, scope]);

  const { active, completed } = useMemo(
    () => ({
      active: todos.filter((todo) => !todo.completed),
      completed: todos.filter((todo) => todo.completed),
    }),
    [todos]
  );

  const renderRow = (todo: TodoItem) => (
    <TodoItemRow
      key={todo.id}
      todo={todo}
      onToggle={(isCompleted) => updateTodo(scope, todo.id, { completed: isCompleted })}
      onRename={(text) => updateTodo(scope, todo.id, { text })}
      onRemove={() => removeTodo(scope, todo.id)}
    />
  );

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-1">
        <label className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground truncate">
          {label}
        </label>
        {todos.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {completed.length}/{todos.length}
          </span>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitDraft();
        }}
        className="flex items-start gap-1.5"
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          rows={2}
          placeholder="Add a todo (Shift+Enter for a new line)"
          aria-label={`Add a todo to ${label}`}
          className="min-h-14 max-h-40 resize-none rounded-lg border-obsidian-400 bg-obsidian-800/60 py-1.5 text-sm focus-visible:border-primary"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} className="h-8 w-8 shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {todos.length === 0 && (
          <p className="pt-4 text-center text-sm text-muted-foreground">No todos yet</p>
        )}

        {active.length > 0 && <ul className="space-y-1">{active.map(renderRow)}</ul>}

        {todos.length > 0 && active.length === 0 && (
          <p className="pt-4 text-center text-sm text-muted-foreground">All done</p>
        )}

        {completed.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="completed" className="border-b-0">
              <AccordionTrigger className="rounded-lg px-2 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:no-underline hover:bg-obsidian-800/60">
                Completed ({completed.length})
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <ul className="space-y-1">{completed.map(renderRow)}</ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </div>
  );
}
