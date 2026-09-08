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

  it('adds a new line on Shift+Enter instead of submitting', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    const input = repositoryList();
    await user.type(input, 'first{Shift>}{Enter}{/Shift}second');

    expect(input).toHaveValue('first\nsecond');
    expect(getStoredTodos().repository).toEqual([]);

    await user.type(input, '{Enter}');
    expect(getStoredTodos().repository[0].text).toBe('first\nsecond');
  });

  it('does not add a blank todo', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    await user.type(repositoryList(), '   {Enter}');

    expect(getStoredTodos().repository).toEqual([]);
  });

  it('moves a completed todo into the collapsed Completed accordion', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByRole('checkbox', { name: 'Write tests' }));

    expect(getStoredTodos().repository[0].completed).toBe(true);
    // Collapsed accordion content is unmounted, so the row is no longer reachable
    expect(screen.queryByRole('checkbox', { name: 'Write tests' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Completed \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('All done')).toBeInTheDocument();
  });

  it('un-completes a todo from the Completed accordion', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo({ completed: true })] });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Completed \(1\)/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'Write tests' }));

    expect(getStoredTodos().repository[0].completed).toBe(false);
    expect(screen.queryByRole('button', { name: /Completed/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Write tests' })).toBeInTheDocument();
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

  it('puts newly added todos at the top', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo({ id: 'todo-old', text: 'Older' })] });
    renderPanel();

    await user.type(repositoryList(), 'Newer{Enter}');

    expect(getStoredTodos().repository.map((t) => t.text)).toEqual(['Newer', 'Older']);
  });

  it('shows the creation date of a todo', () => {
    seedRepository({ repository: [makeTodo({ createdAt: '2026-03-14T10:00:00.000Z' })] });
    renderPanel();

    expect(screen.getByText('Mar 14')).toBeInTheDocument();
  });

  it('sets and clears a priority', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Priority for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'High' }));
    expect(getStoredTodos().repository[0].priority).toBe('high');

    await user.click(screen.getByLabelText('Priority for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'None' }));
    expect(getStoredTodos().repository[0].priority).toBeUndefined();
  });

  it('copies a todo to the clipboard', async () => {
    // userEvent.setup() swaps in its own clipboard, so spy after it installs
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Copy "Write tests"'));

    expect(writeText).toHaveBeenCalledWith('Write tests');
  });

  it('offers a drag handle for active todos but not completed ones', () => {
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'todo-2', text: 'Done one', completed: true })],
    });
    renderPanel();

    expect(screen.getByLabelText('Reorder "Write tests"')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reorder "Done one"')).not.toBeInTheDocument();
  });

  it('reorders todos through the store', () => {
    seedRepository({
      repository: [
        makeTodo({ id: 'a', text: 'A' }),
        makeTodo({ id: 'b', text: 'B' }),
        makeTodo({ id: 'c', text: 'C' }),
      ],
    });

    useAppStore
      .getState()
      .reorderTodos({ type: 'repository', repositoryId: REPOSITORY_ID }, ['c', 'a', 'b']);

    expect(getStoredTodos().repository.map((t) => t.text)).toEqual(['C', 'A', 'B']);
  });

  it('keeps todos the caller left out of a reorder', () => {
    seedRepository({
      repository: [makeTodo({ id: 'a', text: 'A' }), makeTodo({ id: 'b', text: 'B' })],
    });

    useAppStore.getState().reorderTodos({ type: 'repository', repositoryId: REPOSITORY_ID }, ['b']);

    expect(getStoredTodos().repository.map((t) => t.text)).toEqual(['B', 'A']);
  });

  it('clamps the row text so a long todo cannot take over the list', () => {
    seedRepository({ repository: [makeTodo({ text: 'x'.repeat(400) })] });
    renderPanel();

    expect(screen.getByText('x'.repeat(400))).toHaveClass('line-clamp-2');
  });

  it('opens the full todo in a dialog and saves an edit', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Open "Write tests"'));

    const editor = await screen.findByLabelText('Todo text');
    expect(editor).toHaveValue('Write tests');

    await user.clear(editor);
    await user.type(editor, 'A much longer rewritten todo');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(getStoredTodos().repository[0].text).toBe('A much longer rewritten todo');
    expect(screen.queryByTestId('todo-detail-dialog')).not.toBeInTheDocument();
  });

  it('discards a dialog edit on cancel', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Open "Write tests"'));
    const editor = await screen.findByLabelText('Todo text');
    await user.clear(editor);
    await user.type(editor, 'Never saved');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(getStoredTodos().repository[0].text).toBe('Write tests');
  });

  it('cannot save an empty todo from the dialog', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Open "Write tests"'));
    const editor = await screen.findByLabelText('Todo text');
    await user.clear(editor);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('collapses one scope so the other can be worked on exclusively', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    const repositoryHeader = screen.getByRole('button', { name: /Repository: Termpad/ });
    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'true');
    expect(repositoryList()).toBeInTheDocument();

    await user.click(repositoryHeader);

    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Add a todo to Repository: Termpad')).not.toBeInTheDocument();
    // The sibling scope is untouched
    expect(worktreeList()).toBeInTheDocument();

    await user.click(repositoryHeader);
    expect(repositoryList()).toBeInTheDocument();
  });

  it('keeps the todo count visible while a scope is collapsed', async () => {
    const user = userEvent.setup();
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'todo-2', text: 'Second', completed: true })],
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Repository: Termpad/ }));

    expect(screen.getByText('1/2')).toBeInTheDocument();
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
