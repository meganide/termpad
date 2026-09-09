import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { TodoKanban } from './TodoKanban';
import type { TodoItem } from '../../../shared/types';

// JSDOM cannot measure drag geometry. Exercise the same drop handler with the
// container/card IDs produced by dnd-kit, including an initially empty column.
vi.mock('@dnd-kit/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dnd-kit/core')>()),
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => (
    <>
      {children}
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
  const [todos, setTodos] = useState<TodoItem[]>([
    { id: 'task', text: 'Build feature', completed: false, createdAt: '2026-01-01' },
    { id: 'finished', text: 'Finished task', completed: true, createdAt: '2026-01-01' },
  ]);
  return (
    <TodoKanban
      todos={todos}
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
