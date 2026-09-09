import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { TodoKanban } from './TodoKanban';
import { DEFAULT_TODO_COLUMNS } from '../../../shared/todoColumns';
import type { TodoItem } from '../../../shared/types';

// JSDOM cannot measure drag geometry. Exercise the same drop handler with the
// container/card IDs produced by dnd-kit, including an initially empty column.
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
  DndContext: ({
    children,
    onDragEnd,
    onDragStart,
    onDragCancel,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
    onDragStart: (event: unknown) => void;
    onDragCancel: () => void;
  }) => (
    <>
      {children}
      <button onClick={() => onDragStart({ active: { id: 'task' } })}>Start card drag</button>
      <button onClick={onDragCancel}>Cancel drag</button>
      <button onClick={() => onDragEnd({ active: { id: 'task' }, over: null })}>
        Drop outside
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: 'task' }, over: { id: 'column:custom:review' } })}
      >
        Drop into custom column
      </button>
      <button
        onClick={() =>
          onDragEnd({ active: { id: 'column:custom:review' }, over: { id: 'column:backlog' } })
        }
      >
        Move custom column first
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: 'column:done' }, over: { id: 'column:backlog' } })}
      >
        Move done before backlog
      </button>
      <button
        onClick={() => onDragEnd({ active: { id: 'task' }, over: { id: 'column:in_progress' } })}
      >
        Drop into empty progress column
      </button>
      <button onClick={() => onDragEnd({ active: { id: 'task' }, over: { id: 'finished' } })}>
        Drop onto done card
      </button>
    </>
  ),
}));

function Board() {
  const [columns, setColumns] = useState([
    ...DEFAULT_TODO_COLUMNS,
    { id: 'custom:review' as const, name: 'Review' },
  ]);
  const [todos, setTodos] = useState<TodoItem[]>([
    { id: 'task', text: 'Build feature', completed: false, createdAt: '2026-01-01' },
    { id: 'finished', text: 'Finished task', completed: true, createdAt: '2026-01-01' },
  ]);
  return (
    <TodoKanban
      todos={todos}
      columns={columns}
      onReorderColumns={(ids) =>
        setColumns((current) => ids.flatMap((id) => current.filter((column) => column.id === id)))
      }
      renderTodo={(todo) => <li key={todo.id}>{todo.text}</li>}
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

describe('TodoKanban drops', () => {
  it('shows a separate floating card while dragging and removes it on cancel or drop', () => {
    render(<Board />);
    fireEvent.click(screen.getByText('Start card drag'));
    expect(screen.getByTestId('todo-drag-preview')).toHaveTextContent('Build feature');
    expect(
      within(screen.getByRole('region', { name: 'Backlog' })).getByText('Build feature')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel drag'));
    expect(screen.queryByTestId('todo-drag-preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Start card drag'));
    fireEvent.click(screen.getByText('Drop outside'));
    expect(screen.queryByTestId('todo-drag-preview')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Backlog' })).getByText('Build feature')
    ).toBeInTheDocument();
  });

  it('moves cards to custom columns and reorders both custom and built-in columns without changing their todos', () => {
    render(<Board />);
    fireEvent.click(screen.getByText('Drop into custom column'));
    fireEvent.click(screen.getByText('Move custom column first'));
    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    ).toEqual(['Review', 'Backlog', 'In progress', 'Done']);
    expect(
      within(screen.getByRole('region', { name: 'Review' })).getByText('Build feature')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Move done before backlog'));
    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    ).toEqual(['Review', 'Done', 'Backlog', 'In progress']);
  });

  it('changes status when dropped into an empty column or onto another card', () => {
    render(<Board />);
    fireEvent.click(screen.getByText('Drop into empty progress column'));
    expect(
      within(screen.getByRole('region', { name: 'In progress' })).getByText('Build feature')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Backlog' })).queryByText('Build feature')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Drop onto done card'));
    expect(
      within(screen.getByRole('region', { name: 'Done' })).getByText('Build feature')
    ).toBeInTheDocument();
  });
});
