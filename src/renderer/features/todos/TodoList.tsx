import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { getTodoRepository, useAppStore, type TodoScope } from '../../stores/appStore';
import type { TodoItem, TodoPriority, WorktreeSession } from '../../../shared/types';
import { getTodoColumns } from '../../../shared/todoColumns';
import { TodoKanban } from './TodoKanban';
import { TodoItemRow } from './TodoItemRow';
import { TodoSections } from './TodoSections';

interface TodoListProps {
  assignments?: WorktreeSession[];
  onDispatch?: (todo: TodoItem, targetId: string) => void;
  onOpenWorktree?: (worktreeSessionId: string) => void;
  view?: 'list' | 'kanban';
  label: string;
  scope: TodoScope;
  todos: TodoItem[];
  moveTargets?: WorktreeSession[];
  onSendToTerminal?: (todo: TodoItem) => void;
  onCreateWorktree?: (todo: TodoItem) => void;
}

export function TodoList({
  assignments,
  onDispatch,
  onOpenWorktree,
  view = 'list',
  label,
  scope,
  todos,
  moveTargets,
  onSendToTerminal,
  onCreateWorktree,
}: TodoListProps) {
  const { addTodo, updateTodo, removeTodo, reorderTodos, moveTodo } = useAppStore(
    useShallow((s) => ({
      addTodo: s.addTodo,
      updateTodo: s.updateTodo,
      removeTodo: s.removeTodo,
      reorderTodos: s.reorderTodos,
      moveTodo: s.moveTodo,
    }))
  );
  const savedColumns = useAppStore((s) => getTodoRepository(s.repositories, scope)?.todoColumns);
  const columns = useMemo(() => getTodoColumns(savedColumns), [savedColumns]);
  const addTodoColumn = useAppStore((s) => s.addTodoColumn);
  const reorderTodoColumns = useAppStore((s) => s.reorderTodoColumns);
  const [draft, setDraft] = useState('');

  const submitDraft = useCallback(() => {
    if (!draft.trim()) return;
    addTodo(scope, draft);
    setDraft('');
  }, [addTodo, draft, scope]);

  const renderRow = (todo: TodoItem, sortable: boolean) => {
    const assignment = assignments?.find((session) =>
      session.todos?.some((item) => item.id === todo.id)
    );
    return (
      <TodoItemRow
        key={todo.id}
        todo={todo}
        assignment={assignment?.label}
        onOpenWorktree={
          assignment && onOpenWorktree ? () => onOpenWorktree(assignment.id) : undefined
        }
        dispatch={Boolean(onDispatch)}
        sortable={sortable}
        card={view === 'kanban'}
        columns={columns}
        onStatusChange={(status) => updateTodo(scope, todo.id, { status })}
        onToggle={(isCompleted) => updateTodo(scope, todo.id, { completed: isCompleted })}
        onRename={(text) => updateTodo(scope, todo.id, { text })}
        onPriorityChange={(priority: TodoPriority | undefined) =>
          updateTodo(scope, todo.id, { priority })
        }
        onRemove={() => removeTodo(scope, todo.id)}
        onSendToTerminal={onSendToTerminal ? () => onSendToTerminal(todo) : undefined}
        onCreateWorktree={onCreateWorktree ? () => onCreateWorktree(todo) : undefined}
        moveTargets={moveTargets}
        currentWorktreeId={assignment?.id}
        onDispatch={onDispatch ? (targetId) => onDispatch(todo, targetId) : undefined}
        onMove={(targetId) => {
          const repository = getTodoRepository(useAppStore.getState().repositories, scope);
          if (!repository) return;
          const targetScope: TodoScope = targetId
            ? { type: 'worktree', worktreeSessionId: targetId }
            : { type: 'repository', repositoryId: repository.id };
          if (moveTodo(scope, todo.id, targetScope))
            toast.success(
              `Moved to ${targetId ? (moveTargets?.find((target) => target.id === targetId)?.label ?? 'worktree') : 'Global'}`
            );
          else toast.error('Could not move todo. The worktree or todo may no longer be available.');
        }}
      />
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-1.5">
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
        <Button
          type="submit"
          size="icon"
          aria-label={`Add todo to ${label}`}
          title="Add todo"
          disabled={!draft.trim()}
          className="h-8 w-8 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      <div
        className="flex-1 min-h-0 overflow-auto space-y-2"
        style={{ overflowAnchor: 'none' }}
        data-testid="todo-scroll-container"
      >
        {view === 'kanban' ? (
          <TodoKanban
            todos={todos}
            columns={columns}
            onAddColumn={(name) => addTodoColumn(scope, name)}
            onReorderColumns={(ids) => reorderTodoColumns(scope, ids)}
            renderTodo={(todo) => renderRow(todo, true)}
            onStatusChange={(todo, status) => updateTodo(scope, todo.id, { status })}
            onReorder={(ids) => reorderTodos(scope, ids)}
          />
        ) : (
          <>
            {todos.length === 0 && (
              <p className="pt-4 text-center text-sm text-muted-foreground">No todos yet</p>
            )}
            <TodoSections
              todos={todos}
              columns={columns}
              renderTodo={(todo) => renderRow(todo, true)}
              onStatusChange={(todo, status) => updateTodo(scope, todo.id, { status })}
              onReorder={(ids) => reorderTodos(scope, ids)}
            />
          </>
        )}
      </div>
    </div>
  );
}
