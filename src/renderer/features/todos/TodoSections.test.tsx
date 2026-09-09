import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TODO_COLUMNS } from '../../../shared/todoColumns';
import type { TodoItem } from '../../../shared/types';
import { TodoSections } from './TodoSections';

// Geometry is checked in a real browser. These events exercise drops on a
// section header, empty body, and another row, plus cancelling a drag.
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
  DndContext: ({
    children,
    onDragStart,
    onDragCancel,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragStart: (event: unknown) => void;
    onDragCancel: () => void;
    onDragEnd: (event: unknown) => void;
  }) => (
    <>
      {children}
      <button onClick={() => onDragStart({ active: { id: 'task' } })}>Start drag</button>
      <button onClick={onDragCancel}>Cancel drag</button>
      <button onClick={() => onDragEnd({ active: { id: 'task' }, over: null })}>
        Drop outside
      </button>
      {[
        'section:backlog',
        'section:in_progress',
        'section:done',
        'section:custom:review',
        'finished',
        'second',
      ].map((id) => (
        <button key={id} onClick={() => onDragEnd({ active: { id: 'task' }, over: { id } })}>
          Drop on {id}
        </button>
      ))}
    </>
  ),
}));

function List() {
  const [todos, setTodos] = useState<TodoItem[]>([
    { id: 'task', text: 'Build feature', completed: false, createdAt: '2026-01-01' },
    { id: 'second', text: 'Second task', completed: false, createdAt: '2026-01-01' },
    { id: 'finished', text: 'Finished task', completed: true, createdAt: '2026-01-01' },
  ]);
  return (
    <TodoSections
      todos={todos}
      columns={[...DEFAULT_TODO_COLUMNS, { id: 'custom:review', name: 'Review' }]}
      renderTodo={(todo) => (
        <li key={todo.id}>
          {todo.text} {todo.completed ? '(done)' : '(open)'}
        </li>
      )}
      onStatusChange={(todo, status) =>
        setTodos((current) =>
          current.map((item) =>
            item.id === todo.id ? { ...item, status, completed: status === 'done' } : item
          )
        )
      }
      onReorder={(ids) =>
        setTodos((current) => ids.flatMap((id) => current.filter((todo) => todo.id === id)))
      }
    />
  );
}
const section = (name: string) => screen.getByRole('region', { name });

describe('Todo list sections', () => {
  it('drops into an empty section and opens a collapsed destination, syncing completion both ways', () => {
    render(<List />);
    fireEvent.click(screen.getByText('Drop on section:in_progress'));
    expect(
      within(section('In progress (1)')).getByText('Build feature (open)')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Drop on section:done'));
    expect(screen.getByRole('button', { name: 'Done (2)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(within(section('Done (2)')).getByText('Build feature (done)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Drop on section:backlog'));
    expect(within(section('Backlog (2)')).getByText('Build feature (open)')).toBeInTheDocument();
  });

  it('supports custom sections and drops onto rows in another section', () => {
    render(<List />);
    fireEvent.click(screen.getByRole('button', { name: 'Review (0)' }));
    fireEvent.click(screen.getByText('Drop on section:custom:review'));
    expect(within(section('Review (1)')).getByText('Build feature (open)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done (1)' }));
    fireEvent.click(screen.getByText('Drop on finished'));
    expect(within(section('Done (2)')).getByText('Build feature (done)')).toBeInTheDocument();
    expect(
      within(section('Review (0)')).queryByText('Build feature (open)')
    ).not.toBeInTheDocument();
  });

  it('reorders within a section and leaves status unchanged on cancel or outside drops', () => {
    render(<List />);
    fireEvent.click(screen.getByText('Drop on second'));
    expect(
      within(section('Backlog (2)'))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Second task (open)', 'Build feature (open)']);
    fireEvent.click(screen.getByText('Start drag'));
    expect(screen.getByTestId('todo-drag-preview')).toHaveTextContent('Build feature');
    fireEvent.click(screen.getByText('Cancel drag'));
    expect(screen.queryByTestId('todo-drag-preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Start drag'));
    fireEvent.click(screen.getByText('Drop outside'));
    expect(screen.queryByTestId('todo-drag-preview')).not.toBeInTheDocument();
    expect(within(section('Backlog (2)')).getByText('Build feature (open)')).toBeInTheDocument();
  });
});
