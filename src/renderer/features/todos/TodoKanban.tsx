import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import type { TodoColumn, TodoItem, TodoStatus } from '../../../shared/types';
import { DEFAULT_TODO_COLUMNS } from '../../../shared/todoColumns';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { getTodoStatus, TODO_STATUS_COLORS } from './status';
import { TodoDragPreview } from './TodoDragPreview';

const isColumn = (id: string | number) => String(id).startsWith('column:');

// Column drags only collide with columns. Card drops prefer the card under the
// pointer, while still allowing a drop anywhere in an empty column.
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const candidates = isColumn(args.active.id)
    ? { ...args, droppableContainers: args.droppableContainers.filter((item) => isColumn(item.id)) }
    : args;
  if (!args.pointerCoordinates) return closestCorners(candidates);
  const hits = pointerWithin(candidates);
  const cards = hits.filter((hit) => !isColumn(hit.id));
  return cards.length ? cards : hits;
};

const kanbanKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (!isColumn(args.active)) return sortableKeyboardCoordinates(event, args);
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
  event.preventDefault();
  const { collisionRect, droppableContainers, droppableRects } = args.context;
  if (!collisionRect) return;
  const rectangles = droppableContainers
    .getEnabled()
    .filter((item) => isColumn(item.id))
    .flatMap((item) => {
      const rect = droppableRects.get(item.id);
      return rect ? [rect] : [];
    })
    .filter((rect) =>
      event.code === 'ArrowRight'
        ? rect.left > collisionRect.left + 1
        : rect.left < collisionRect.left - 1
    )
    .sort((a, b) => Math.abs(a.left - collisionRect.left) - Math.abs(b.left - collisionRect.left));
  const next = rectangles[0];
  return next
    ? {
        x: args.currentCoordinates.x + next.left - collisionRect.left,
        y: args.currentCoordinates.y,
      }
    : undefined;
};

function Column({
  column,
  todos,
  renderTodo,
}: {
  column: TodoColumn;
  todos: TodoItem[];
  renderTodo: (todo: TodoItem) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isOver,
    isDragging,
    transform,
    transition,
  } = useSortable({
    id: `column:${column.id}`,
  });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-w-0 min-h-40 flex-col gap-3 rounded-lg p-2 ${isDragging ? 'opacity-30' : ''} ${isOver ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-muted/30'}`}
    >
      <h3>
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move column: ${column.name}`}
          title="Drag to reorder column"
          className="flex w-full cursor-grab touch-none items-center gap-2 rounded px-1 py-1 text-left text-xs font-semibold active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${TODO_STATUS_COLORS[column.id] ?? 'bg-primary'}`}
          />
          <span className="truncate">{column.name}</span>
          <span className="ml-auto font-mono text-muted-foreground">{todos.length}</span>
        </button>
      </h3>
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
  columns = DEFAULT_TODO_COLUMNS,
  renderTodo,
  onStatusChange,
  onReorder,
  onAddColumn,
  onReorderColumns,
}: {
  todos: TodoItem[];
  columns?: TodoColumn[];
  renderTodo: (todo: TodoItem) => ReactNode;
  onStatusChange: (todo: TodoItem, status: TodoStatus) => void;
  onReorder: (ids: string[]) => void;
  onAddColumn?: (name: string) => boolean;
  onReorderColumns?: (ids: TodoStatus[]) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [columnError, setColumnError] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: kanbanKeyboardCoordinates })
  );
  const draggedTodo = todos.find((todo) => todo.id === draggedId);
  const draggedColumn = columns.find((column) => `column:${column.id}` === draggedId);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedId(null);
    if (!over || active.id === over.id) return;
    if (isColumn(active.id)) {
      const from = columns.findIndex((column) => `column:${column.id}` === active.id);
      const to = columns.findIndex((column) => `column:${column.id}` === over.id);
      if (from !== -1 && to !== -1)
        onReorderColumns?.(arrayMove(columns, from, to).map((column) => column.id));
      return;
    }
    const todo = todos.find((item) => item.id === active.id);
    const target = todos.find((item) => item.id === over.id);
    const status = target
      ? getTodoStatus(target)
      : columns.find((column) => over.id === `column:${column.id}`)?.id;
    if (!todo || !status) return;
    if (getTodoStatus(todo) !== status) onStatusChange(todo, status);
    if (target)
      onReorder(
        arrayMove(todos, todos.indexOf(todo), todos.indexOf(target)).map((item) => item.id)
      );
  };
  return (
    <div className="flex min-h-full flex-col gap-3">
      {onAddColumn &&
        (addingColumn ? (
          <form
            className="sticky left-0 flex w-fit max-w-full flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (onAddColumn(columnName)) {
                setAddingColumn(false);
                setColumnName('');
                setColumnError('');
              } else setColumnError('Choose a unique, non-empty column name.');
            }}
          >
            <label className="flex flex-col gap-1 text-xs font-medium">
              Column name
              <Input
                autoFocus
                value={columnName}
                onChange={(event) => {
                  setColumnName(event.target.value);
                  setColumnError('');
                }}
                placeholder="e.g. In review"
                className="h-8 w-48"
                aria-invalid={Boolean(columnError)}
                aria-describedby={columnError ? 'column-error' : undefined}
              />
            </label>
            <Button type="submit" size="sm" className="h-8" disabled={!columnName.trim()}>
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setAddingColumn(false);
                setColumnName('');
                setColumnError('');
              }}
            >
              Cancel
            </Button>
            {columnError && (
              <p id="column-error" role="alert" className="w-full text-xs text-destructive">
                {columnError}
              </p>
            )}
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="sticky left-0 h-7 w-fit gap-2 text-xs"
            onClick={() => setAddingColumn(true)}
          >
            <Plus className="size-3.5" />
            Add column
          </Button>
        ))}
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={({ active }) => setDraggedId(String(active.id))}
        onDragCancel={() => setDraggedId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columns.map((column) => `column:${column.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className="grid flex-1 gap-3 pb-2"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(14rem, 1fr))` }}
            data-testid="todo-kanban"
          >
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                todos={todos.filter((todo) => getTodoStatus(todo) === column.id)}
                renderTodo={renderTodo}
              />
            ))}
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay dropAnimation={null} zIndex={1000}>
            {draggedTodo ? (
              <TodoDragPreview todo={draggedTodo} />
            ) : draggedColumn ? (
              <div
                className="flex flex-col gap-3 rounded-lg bg-background p-2 shadow-xl ring-1 ring-primary/40"
                data-testid="todo-column-drag-preview"
              >
                <div className="px-1 py-1 text-xs font-semibold">{draggedColumn.name}</div>
                {todos
                  .filter((todo) => getTodoStatus(todo) === draggedColumn.id)
                  .map((todo) => (
                    <TodoDragPreview key={todo.id} todo={todo} />
                  ))}
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
