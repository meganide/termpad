import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores, createMockRepositoryWithWorktreeSessions } from '../../../../tests/utils';
import type { TodoItem } from '../../../shared/types';
import { TodosPanel } from './TodosPanel';

const REPOSITORY_ID = 'repo-1';
const WORKTREE_ID = `session-${REPOSITORY_ID}-0`;

const renderPanel = () =>
  render(
    <TodosPanel
      repositoryId={REPOSITORY_ID}
      worktreeSessionId={WORKTREE_ID}
      repositoryName="Termpad"
      worktreeLabel="feature-x"
      titleSlot={null}
    />
  );

const seedRepository = (todos: { repository?: TodoItem[]; worktree?: TodoItem[] } = {}) => {
  const repository = createMockRepositoryWithWorktreeSessions({ id: REPOSITORY_ID }, 1);
  useAppStore.setState({
    repositories: [
      {
        ...repository,
        todos: todos.repository,
        worktreeSessions: repository.worktreeSessions.map((ws) => ({
          ...ws,
          todos: todos.worktree,
        })),
      },
    ],
  });
};

const makeTodo = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: 'todo-1',
  text: 'Write tests',
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const repositoryList = () => screen.getByLabelText('Add a todo to Repository: Termpad');
const worktreeList = () => screen.getByLabelText('Add a todo to Worktree: feature-x');

const getStoredTodos = () => {
  const repository = useAppStore.getState().repositories[0];
  return {
    repository: repository.todos ?? [],
    worktree: repository.worktreeSessions[0].todos ?? [],
  };
};

describe('TodosPanel', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('shows an empty state for both scopes', () => {
    seedRepository();
    renderPanel();

    expect(screen.getAllByText('No todos yet')).toHaveLength(2);
  });

  it('adds a todo to the repository scope only', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    await user.type(repositoryList(), 'Ship the release{Enter}');

    expect(getStoredTodos().repository.map((t) => t.text)).toEqual(['Ship the release']);
    expect(getStoredTodos().worktree).toEqual([]);
    expect(screen.getByText('Ship the release')).toBeInTheDocument();
  });

  it('adds a todo to the worktree scope only', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    await user.type(worktreeList(), 'Rebase branch{Enter}');

    expect(getStoredTodos().worktree.map((t) => t.text)).toEqual(['Rebase branch']);
    expect(getStoredTodos().repository).toEqual([]);
  });

  it('trims the new todo text and clears the input', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    const input = repositoryList();
    await user.type(input, '   padded   {Enter}');

    expect(getStoredTodos().repository[0].text).toBe('padded');
    expect(input).toHaveValue('');
  });

  it('does not add a blank todo', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    await user.type(repositoryList(), '   {Enter}');

    expect(getStoredTodos().repository).toEqual([]);
  });

  it('completes and un-completes a todo', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByRole('checkbox', { name: 'Write tests' }));
    expect(getStoredTodos().repository[0].completed).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Write tests' }));
    expect(getStoredTodos().repository[0].completed).toBe(false);
  });

  it('shows a completed count', () => {
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'todo-2', text: 'Second', completed: true })],
    });
    renderPanel();

    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('edits a todo', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByText('Write tests'));
    const editor = screen.getByLabelText('Edit "Write tests"');
    await user.clear(editor);
    await user.type(editor, 'Write more tests{Enter}');

    expect(getStoredTodos().repository[0].text).toBe('Write more tests');
  });

  it('keeps the original text when an edit is cancelled', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByText('Write tests'));
    const editor = screen.getByLabelText('Edit "Write tests"');
    await user.clear(editor);
    await user.type(editor, 'Discard me{Escape}');

    expect(getStoredTodos().repository[0].text).toBe('Write tests');
  });

  it('keeps the original text when an edit is emptied', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByText('Write tests'));
    const editor = screen.getByLabelText('Edit "Write tests"');
    await user.clear(editor);
    await user.tab();

    expect(getStoredTodos().repository[0].text).toBe('Write tests');
  });

  it('deletes a todo', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()], worktree: [makeTodo({ id: 'todo-2' })] });
    renderPanel();

    const [repositorySection] = screen.getAllByTestId('todo-item');
    await user.click(within(repositorySection).getByLabelText('Delete "Write tests"'));

    expect(getStoredTodos().repository).toEqual([]);
    expect(getStoredTodos().worktree).toHaveLength(1);
  });
});
