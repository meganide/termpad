import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { useAppStore, type TodoScope } from '../../stores/appStore';
import type { TodoItem, TodoPriority, WorktreeSession } from '../../../shared/types';
import { getTodoStatus } from './status';
import { TodoKanban } from './TodoKanban';
import { TodoItemRow } from './TodoItemRow';

interface TodoListProps {
  view?: 'list' | 'kanban';
  label: string;
  scope: TodoScope;
  todos: TodoItem[];
  moveTargets?: WorktreeSession[];
  onSendToTerminal?: (todo: TodoItem) => void;
  onCreateWorktree?: (todo: TodoItem) => void;
}

export function TodoList({
  view = 'list',
  label,
  scope,
  todos,
  moveTargets,
  onSendToTerminal,
  onCreateWorktree,
}: TodoListProps) {
  const { addTodo, updateTodo, removeTodo, reorderTodos, moveGlobalTodoToWorktree } = useAppStore(
    useShallow((s) => ({
      addTodo: s.addTodo,
      updateTodo: s.updateTodo,
      removeTodo: s.removeTodo,
      reorderTodos: s.reorderTodos,
      moveGlobalTodoToWorktree: s.moveGlobalTodoToWorktree,
    }))
  );
  const [draft, setDraft] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const submitDraft = useCallback(() => {
    if (!draft.trim()) return;
    addTodo(scope, draft);
    setDraft('');
  }, [addTodo, draft, scope]);

  const { active, inProgress, completed } = useMemo(
    () => ({
      active: todos.filter((todo) => getTodoStatus(todo) === 'backlog'),
      inProgress: todos.filter((todo) => getTodoStatus(todo) === 'in_progress'),
      completed: todos.filter((todo) => getTodoStatus(todo) === 'done'),
    }),
    [todos]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active: dragged, over } = event;
      if (!over || dragged.id === over.id) return;

      const group = inProgress.some((todo) => todo.id === dragged.id) ? inProgress : active;
      const oldIndex = group.findIndex((todo) => todo.id === dragged.id);
      const newIndex = group.findIndex((todo) => todo.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(group, oldIndex, newIndex);
      reorderTodos(
        scope,
        [...reordered, ...todos.filter((todo) => !group.includes(todo))].map((todo) => todo.id)
      );
    },
    [active, inProgress, todos, reorderTodos, scope]
  );

  const renderRow = (todo: TodoItem, sortable: boolean) => (
    <TodoItemRow
      key={todo.id}
      todo={todo}
      sortable={sortable}
      card={view === 'kanban'}
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
      onMove={(targetId) => {
        if (scope.type !== 'repository') return;
        if (moveGlobalTodoToWorktree(scope.repositoryId, todo.id, targetId))
          toast.success(
            `Moved to ${moveTargets?.find((target) => target.id === targetId)?.label ?? 'worktree'}`
          );
        else toast.error('Could not move todo. The worktree or todo may no longer be available.');
      }}
    />
  );

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

      <div className="flex-1 min-h-0 overflow-auto space-y-2">
        {view === 'kanban' ? (
          <TodoKanban
            todos={todos}
            renderTodo={(todo) => renderRow(todo, true)}
            onStatusChange={(todo, status) => updateTodo(scope, todo.id, { status })}
            onReorder={(ids) => reorderTodos(scope, ids)}
          />
        ) : (
          <>
            {todos.length === 0 && (
              <p className="pt-4 text-center text-sm text-muted-foreground">No todos yet</p>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              {active.length > 0 && (
                <SortableContext
                  items={active.map((todo) => todo.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">{active.map((todo) => renderRow(todo, true))}</ul>
                </SortableContext>
              )}
              {inProgress.length > 0 && (
                <Accordion type="single" collapsible defaultValue="in-progress">
                  <AccordionItem value="in-progress" className="border-b-0">
                    <AccordionTrigger className="rounded-lg px-2 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:no-underline hover:bg-obsidian-800/60">
                      In progress ({inProgress.length})
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1">
                      <SortableContext
                        items={inProgress.map((todo) => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1">
                          {inProgress.map((todo) => renderRow(todo, true))}
                        </ul>
                      </SortableContext>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </DndContext>
            {todos.length > 0 && active.length === 0 && inProgress.length === 0 && (
              <p className="pt-4 text-center text-sm text-muted-foreground">All done</p>
            )}
            {completed.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="completed" className="border-b-0">
                  <AccordionTrigger className="rounded-lg px-2 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:no-underline hover:bg-obsidian-800/60">
                    Completed ({completed.length})
                  </AccordionTrigger>
                  <AccordionContent className="pb-0 pt-1">
                    <ul className="space-y-1">{completed.map((todo) => renderRow(todo, false))}</ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </>
        )}
      </div>
    </div>
  );
}
