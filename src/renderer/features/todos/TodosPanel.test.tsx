import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores, createMockRepositoryWithWorktreeSessions } from '../../../../tests/utils';
import type { TodoItem } from '../../../shared/types';
import { TodosPanel } from './TodosPanel';

const REPOSITORY_ID = 'repo-1';
const WORKTREE_ID = `session-${REPOSITORY_ID}-0`;

const renderPanel = (actions: Partial<React.ComponentProps<typeof TodosPanel>> = {}) =>
  render(
    <TodosPanel
      repositoryId={REPOSITORY_ID}
      worktreeSessionId={WORKTREE_ID}
      repositoryName="Termpad"
      worktreeLabel="feature-x"
      titleSlot={null}
      {...actions}
    />
  );

const seedRepository = (
  todos: { repository?: TodoItem[]; worktree?: TodoItem[] } = {},
  global = true
) => {
  const repository = createMockRepositoryWithWorktreeSessions({ id: REPOSITORY_ID }, 1);
  useAppStore.setState({
    repositories: [
      {
        ...repository,
        todos: todos.repository,
        worktreeSessions: repository.worktreeSessions.map((ws) => ({
          ...ws,
          isMainWorktree: global,
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

const repositoryList = () => screen.getByLabelText('Add a todo to All: Termpad');
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
    localStorage.removeItem('termpad:todos-view');
    vi.clearAllMocks();
  });

  it('creates a custom column, keeps its todos visible in list view, and restores the board on remount', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    const panel = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Kanban' }));
    await user.click(screen.getByRole('button', { name: 'Add column' }));
    await user.type(screen.getByRole('textbox', { name: 'Column name' }), 'In review');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('region', { name: 'In review' })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId('todo-item'));
    await user.click(await screen.findByRole('menuitem', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'In review' }));
    expect(
      within(screen.getByRole('region', { name: 'In review' })).getByText('Write tests')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: 'In review (1)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.queryByText('All done')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kanban' }));
    panel.unmount();
    renderPanel();
    expect(
      within(screen.getByRole('region', { name: 'In review' })).getByText('Write tests')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add column' }));
    await user.type(screen.getByRole('textbox', { name: 'Column name' }), 'in REVIEW');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('unique');
    expect(screen.getAllByRole('region', { name: 'In review' })).toHaveLength(1);
  });

  it('shows matching accordions for every column, including empty sections, and collapses Backlog', async () => {
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    const backlog = screen.getByRole('button', { name: 'Backlog (1)' });
    expect(backlog).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'In progress (0)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Done (0)' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    fireEvent.click(backlog);
    expect(screen.queryByRole('checkbox', { name: 'Write tests' })).not.toBeInTheDocument();
    fireEvent.click(backlog);
    expect(await screen.findByRole('checkbox', { name: 'Write tests' })).toBeInTheDocument();
  });

  it.each(['dropdown', 'right-click'])(
    'sends the full multiline todo and opens worktree creation from the %s menu',
    async (entry) => {
      const user = userEvent.setup();
      const todo = makeTodo({ text: 'First line\nSecond line' });
      const onSendToTerminal = vi.fn();
      const onCreateWorktree = vi.fn();
      seedRepository({ repository: [todo] });
      renderPanel({ onSendToTerminal, onCreateWorktree });
      const openMenu = async () => {
        if (entry === 'right-click') fireEvent.contextMenu(screen.getByTestId('todo-item'));
        else await user.click(screen.getByRole('button', { name: /^Actions for/ }));
      };
      await openMenu();
      await user.click(await screen.findByRole('menuitem', { name: 'Send to active terminal' }));
      expect(onSendToTerminal).toHaveBeenCalledExactlyOnceWith(todo);
      await openMenu();
      await user.click(await screen.findByRole('menuitem', { name: 'Start in worktree' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'New…' }));
      await waitFor(() => expect(onCreateWorktree).toHaveBeenCalledExactlyOnceWith(todo));
      expect(getStoredTodos().repository).toEqual([todo]);
    }
  );

  it('disables sending when no running main terminal is available', async () => {
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId('todo-item'));
    expect(
      await screen.findByRole('menuitem', { name: 'Send to active terminal' })
    ).toHaveAttribute('data-disabled');
  });

  it('sets status manually in the list and groups in-progress todos in an expanded accordion', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId('todo-item'));
    await user.click(await screen.findByRole('menuitem', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'In progress' }));
    expect(getStoredTodos().repository[0]).toMatchObject({
      status: 'in_progress',
      completed: false,
    });
    expect(screen.getByRole('button', { name: 'In progress (1)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.queryByText('All done')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'In progress (1)' }));
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'In progress (1)' }));
    fireEvent.contextMenu(screen.getByTestId('todo-item'));
    await user.click(await screen.findByRole('menuitem', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Done' }));
    expect(getStoredTodos().repository[0]).toMatchObject({ status: 'done', completed: true });
    expect(screen.getByRole('button', { name: 'Done (1)' })).toBeInTheDocument();
  });

  it('makes kanban cards draggable without checkboxes or drag handles and keeps editing in the menu', async () => {
    const user = userEvent.setup();
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'done', text: 'Finished', completed: true })],
    });
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Kanban' }));
    const board = screen.getByTestId('todo-kanban');
    expect(within(board).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(board).queryByLabelText(/^Reorder/)).not.toBeInTheDocument();
    expect(within(board).getByRole('button', { name: 'Move todo: Write tests' })).toHaveAttribute(
      'tabindex',
      '0'
    );
    expect(within(board).getByRole('button', { name: 'Move todo: Finished' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const editor = screen.getByLabelText('Edit "Write tests"');
    await user.clear(editor);
    await user.type(editor, 'Updated card{Enter}');
    expect(getStoredTodos().repository[0].text).toBe('Updated card');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('checkbox', { name: 'Updated card' })).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder "Updated card"')).toBeInTheDocument();
  });

  it('switches between list and kanban, keeps legacy todos in their columns, and remembers the view', async () => {
    const user = userEvent.setup();
    seedRepository({
      repository: [
        makeTodo(),
        makeTodo({ id: 'active', text: 'Working', status: 'in_progress' }),
        makeTodo({ id: 'done', text: 'Finished', completed: true }),
      ],
    });
    const { unmount } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Kanban' }));
    expect(
      within(screen.getByRole('region', { name: 'Backlog' })).getByText('Write tests')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'In progress' })).getByText('Working')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Done' })).getByText('Finished')
    ).toBeInTheDocument();
    fireEvent.contextMenu(
      within(screen.getByRole('region', { name: 'In progress' })).getByTestId('todo-item')
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Status' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Backlog' }));
    expect(
      within(screen.getByRole('region', { name: 'Backlog' })).getByText('Working')
    ).toBeInTheDocument();
    unmount();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryByTestId('todo-kanban')).not.toBeInTheDocument();
  });

  it('shows only the global empty state in the primary checkout', () => {
    seedRepository();
    renderPanel();

    expect(screen.getAllByText('No todos yet')).toHaveLength(1);
    expect(repositoryList()).toBeInTheDocument();
    expect(screen.queryByLabelText('Add a todo to Worktree: feature-x')).not.toBeInTheDocument();
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
    seedRepository({}, false);
    renderPanel();

    await user.type(worktreeList(), 'Rebase branch{Enter}');

    expect(getStoredTodos().worktree.map((t) => t.text)).toEqual(['Rebase branch']);
    expect(getStoredTodos().repository).toEqual([]);
    expect(screen.queryByLabelText('Add a todo to All: Termpad')).not.toBeInTheDocument();
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

  it('moves a completed todo into the collapsed Done accordion', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByRole('checkbox', { name: 'Write tests' }));

    expect(getStoredTodos().repository[0].completed).toBe(true);
    // Collapsed accordion content is unmounted, so the row is no longer reachable
    expect(screen.queryByRole('checkbox', { name: 'Write tests' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backlog (0)' })).toBeInTheDocument();
  });

  it('un-completes a todo from the Done accordion', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo({ completed: true })] });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Done \(1\)/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'Write tests' }));

    expect(getStoredTodos().repository[0].completed).toBe(false);
    expect(screen.getByRole('button', { name: 'Done (0)' })).toBeInTheDocument();
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

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Priority' }));
    // JSDOM has no submenu geometry for pointer travel between the two menus.
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'High' }));
    expect(getStoredTodos().repository[0].priority).toBe('high');

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Priority' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'None' }));
    expect(getStoredTodos().repository[0].priority).toBeUndefined();
  });

  it('copies a todo to the clipboard', async () => {
    // userEvent.setup() swaps in its own clipboard, so spy after it installs
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    seedRepository({ repository: [makeTodo()] });
    renderPanel();

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('Write tests');
  });

  it('offers drag handles for backlog and done todos', async () => {
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'todo-2', text: 'Done one', completed: true })],
    });
    renderPanel();

    expect(screen.getByLabelText('Reorder "Write tests"')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done (1)' }));
    expect(await screen.findByLabelText('Reorder "Done one"')).toBeInTheDocument();
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

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Open full todo' }));

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

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Open full todo' }));
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

    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Open full todo' }));
    const editor = await screen.findByLabelText('Todo text');
    await user.clear(editor);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows the global scope as a static title with its todos visible', () => {
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    expect(screen.getByRole('heading', { name: 'All: Termpad' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All: Termpad' })).not.toBeInTheDocument();
    expect(repositoryList()).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Write tests' })).toBeInTheDocument();
  });

  it('keeps the todo count beside the scope title', () => {
    seedRepository({
      repository: [makeTodo(), makeTodo({ id: 'todo-2', text: 'Second', completed: true })],
    });
    renderPanel();
    expect(screen.getByRole('heading', { name: 'All: Termpad' }).parentElement).toHaveTextContent(
      '1/2'
    );
  });

  it('deletes a todo', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()], worktree: [makeTodo({ id: 'todo-2' })] });
    renderPanel();

    const [repositorySection] = screen.getAllByTestId('todo-item');
    await user.click(within(repositorySection).getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' })
    );

    expect(getStoredTodos().repository).toEqual([]);
    expect(getStoredTodos().worktree).toHaveLength(1);
  });

  it.each(['dropdown', 'right-click'])(
    'moves a global todo to a worktree from the %s menu',
    async (entry) => {
      const user = userEvent.setup();
      const todo = makeTodo({ priority: 'high' });
      seedRepository({ repository: [todo] });
      const repository = useAppStore.getState().repositories[0];
      const target = {
        ...repository.worktreeSessions[0],
        id: 'target',
        label: 'Feature work',
        path: '/repo/feature',
        branchName: 'feature',
        isMainWorktree: false,
      };
      useAppStore.setState({
        repositories: [
          { ...repository, worktreeSessions: [...repository.worktreeSessions, target] },
        ],
      });
      renderPanel();
      if (entry === 'dropdown')
        await user.click(screen.getByLabelText('Actions for "Write tests"'));
      else fireEvent.contextMenu(screen.getByTestId('todo-item'));
      await user.click(await screen.findByRole('menuitem', { name: 'Move to worktree' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /Feature work/ }));
      const updated = useAppStore.getState().repositories[0];
      expect(updated.todos).toEqual([]);
      expect(updated.worktreeSessions[1].todos).toEqual([todo]);
      expect(updated.worktreeSessions[0].todos).toBeUndefined();
    }
  );

  it('does not offer moving a worktree todo or reveal global todos there', async () => {
    const user = userEvent.setup();
    seedRepository(
      { repository: [makeTodo({ id: 'global', text: 'Global task' })], worktree: [makeTodo()] },
      false
    );
    renderPanel();
    expect(screen.queryByText('Global task')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    expect(screen.queryByRole('menuitem', { name: 'Move to worktree' })).not.toBeInTheDocument();
  });

  it('offers the same edit action on right-click and focuses the editor', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId('todo-item'));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const editor = screen.getByLabelText('Edit "Write tests"');
    expect(editor).toHaveFocus();
    await user.clear(editor);
    await user.type(editor, 'Updated{Enter}');
    expect(getStoredTodos().repository[0].text).toBe('Updated');
  });

  it('can cancel deletion from the action menu', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' })
    );
    expect(getStoredTodos().repository).toHaveLength(1);
  });

  it('supports keyboard navigation through priority options', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    screen.getByLabelText('Actions for "Write tests"').focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menuitem', { name: 'Open full todo' });
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}');
    await screen.findByRole('menuitemradio', { name: 'High' });
    await user.keyboard('{Enter}');
    expect(getStoredTodos().repository[0].priority).toBe('high');
  });

  it('explains when there are no worktrees to move a global todo to', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: [makeTodo()] });
    renderPanel();
    await user.click(screen.getByLabelText('Actions for "Write tests"'));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to worktree' }));
    expect(await screen.findByRole('menuitem', { name: 'No worktrees available' })).toHaveAttribute(
      'data-disabled'
    );
  });
});
