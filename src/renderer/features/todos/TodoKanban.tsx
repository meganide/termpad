import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TodoItem, TodoStatus } from '../../../shared/types';
import { getTodoStatus, TODO_STATUSES, TODO_STATUS_LABELS, TODO_STATUS_COLORS } from './status';

// Pointer drops follow the column under the cursor, including its empty space.
// Prefer a card within that column when one is under the cursor for reordering.
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCorners(args);
  const hits = pointerWithin(args);
  const cards = hits.filter((hit) => !String(hit.id).startsWith('column:'));
  return cards.length ? cards : hits;
};

function Column({
  status,
  todos,
  renderTodo,
}: {
  status: TodoStatus;
  todos: TodoItem[];
  renderTodo: (todo: TodoItem) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={TODO_STATUS_LABELS[status]}
      className={`flex min-h-40 flex-col gap-3 rounded-lg p-2 ${isOver ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-muted/30'}`}
    >
      <div className="flex items-center gap-2 px-1 py-1 text-xs font-semibold">
        <span className={`size-2 rounded-full ${TODO_STATUS_COLORS[status]}`} />
        <h3>{TODO_STATUS_LABELS[status]}</h3>
        <span className="ml-auto font-mono text-muted-foreground">{todos.length}</span>
      </div>
      <SortableContext items={todos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex-1 space-y-2">{todos.map(renderTodo)}</ul>
      </SortableContext>
      {todos.length === 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">Drop a todo here</p>
      )}
    </section>
  );
}

export function TodoKanban({
  todos,
  renderTodo,
  onStatusChange,
  onReorder,
}: {
  todos: TodoItem[];
  renderTodo: (todo: TodoItem) => ReactNode;
  onStatusChange: (todo: TodoItem, status: TodoStatus) => void;
  onReorder: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const todo = todos.find((item) => item.id === active.id);
    const target = todos.find((item) => item.id === over.id);
    const status = target
      ? getTodoStatus(target)
      : TODO_STATUSES.find((value) => over.id === `column:${value}`);
    if (!todo || !status) return;
    if (getTodoStatus(todo) !== status) onStatusChange(todo, status);
    if (target) {
      onReorder(
        arrayMove(todos, todos.indexOf(todo), todos.indexOf(target)).map((item) => item.id)
      );
    }
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragEnd={handleDragEnd}
    >
      <div
        className="grid min-h-full grid-cols-[repeat(3,minmax(14rem,1fr))] gap-3 pb-2"
        data-testid="todo-kanban"
      >
        {TODO_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            todos={todos.filter((todo) => getTodoStatus(todo) === status)}
            renderTodo={renderTodo}
          />
        ))}
      </div>
    </DndContext>
  );
}
