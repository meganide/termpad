import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TodoColumn, TodoItem, TodoStatus } from '../../../shared/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { getTodoStatus } from './status';
import { TodoDragPreview } from './TodoDragPreview';

// Headers remain drop targets when collapsed or empty. Prefer a row when the
// pointer is over one so users can also choose the order inside a section.
export const listCollisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCorners(args);
  const hits = pointerWithin(args);
  const rows = hits.filter((hit) => !String(hit.id).startsWith('section:'));
  return rows.length ? rows : hits;
};

function Section({
  column,
  todos,
  renderTodo,
}: {
  column: TodoColumn;
  todos: TodoItem[];
  renderTodo: (todo: TodoItem) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${column.id}` });
  return (
    <AccordionItem
      ref={setNodeRef}
      value={column.id}
      className={`rounded-lg border-b-0 ${isOver ? 'bg-primary/10 ring-1 ring-primary/40' : ''}`}
    >
      <AccordionTrigger className="rounded-lg px-2 py-1.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:no-underline hover:bg-obsidian-800/60">
        {column.name} ({todos.length})
      </AccordionTrigger>
      <AccordionContent className="pb-0 pt-1">
        <SortableContext
          items={todos.map((todo) => todo.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">{todos.map(renderTodo)}</ul>
        </SortableContext>
        {todos.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Drop a todo here</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function TodoSections({
  todos,
  columns,
  renderTodo,
  onStatusChange,
  onReorder,
}: {
  todos: TodoItem[];
  columns: TodoColumn[];
  renderTodo: (todo: TodoItem) => ReactNode;
  onStatusChange: (todo: TodoItem, status: TodoStatus) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [openSections, setOpenSections] = useState<string[]>(() =>
    columns.filter((column) => column.id !== 'done').map((column) => column.id)
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const draggedTodo = todos.find((todo) => todo.id === draggedId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedId(null);
    if (!over || active.id === over.id) return;
    const todo = todos.find((item) => item.id === active.id);
    const target = todos.find((item) => item.id === over.id);
    const status = target
      ? getTodoStatus(target)
      : columns.find((column) => over.id === `section:${column.id}`)?.id;
    if (!todo || !status) return;
    const changedSection = getTodoStatus(todo) !== status;
    if (changedSection) onStatusChange(todo, status);
    if (target)
      onReorder(
        arrayMove(todos, todos.indexOf(todo), todos.indexOf(target)).map((item) => item.id)
      );
    else if (changedSection)
      onReorder([...todos.filter((item) => item.id !== todo.id), todo].map((item) => item.id));
    setOpenSections((current) => (current.includes(status) ? current : [...current, status]));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={listCollisionDetection}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }) => setDraggedId(String(active.id))}
      onDragCancel={() => setDraggedId(null)}
      onDragEnd={handleDragEnd}
    >
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-2"
      >
        {columns.map((column) => (
          <Section
            key={column.id}
            column={column}
            todos={todos.filter((todo) => getTodoStatus(todo) === column.id)}
            renderTodo={renderTodo}
          />
        ))}
      </Accordion>
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={1000}>
          {draggedTodo ? <TodoDragPreview todo={draggedTodo} card={false} /> : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
