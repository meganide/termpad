import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, type TodoScope } from './appStore';
import { getTodoColumns } from '../../shared/todoColumns';
import { createMockRepositoryWithWorktreeSessions, resetAllStores } from '../../../tests/utils';

const scope: TodoScope = { type: 'repository', repositoryId: 'repo' };

describe('todo columns', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useAppStore.setState({
      repositories: [
        createMockRepositoryWithWorktreeSessions({ id: 'repo' }, 2),
        createMockRepositoryWithWorktreeSessions({ id: 'other' }, 1),
      ],
      isInitialized: true,
    });
  });

  it('persists custom columns from a worktree on its repository and restores their order', () => {
    const store = useAppStore.getState();
    expect(
      store.addTodoColumn(
        { type: 'worktree', worktreeSessionId: 'session-repo-0' },
        '  In review  '
      )
    ).toBe(true);
    const custom = useAppStore.getState().repositories[0].todoColumns?.at(-1);
    assert(custom);
    expect(custom).toMatchObject({ name: 'In review' });
    expect(custom.id).toMatch(/^custom:/);
    store.reorderTodoColumns(scope, [custom.id, 'done', 'in_progress', 'backlog']);
    expect(window.storage.saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        repositories: expect.arrayContaining([
          expect.objectContaining({
            id: 'repo',
            todoColumns: [
              custom,
              { id: 'done', name: 'Done' },
              { id: 'in_progress', name: 'In progress' },
              { id: 'backlog', name: 'Backlog' },
            ],
          }),
        ]),
      })
    );
    const saved = JSON.parse(JSON.stringify(useAppStore.getState().repositories));
    resetAllStores();
    useAppStore.setState({ repositories: saved });
    expect(getTodoColumns(saved[0].todoColumns).map((column) => column.id)).toEqual([
      custom.id,
      'done',
      'in_progress',
      'backlog',
    ]);
    expect(saved[1].todoColumns).toBeUndefined();
  });

  it('rejects blank and duplicate names and preserves omitted columns when reordering', () => {
    const store = useAppStore.getState();
    expect(store.addTodoColumn(scope, ' ')).toBe(false);
    expect(store.addTodoColumn(scope, ' BACKLOG ')).toBe(false);
    expect(store.addTodoColumn(scope, 'Review')).toBe(true);
    expect(store.addTodoColumn(scope, 'review')).toBe(false);
    store.reorderTodoColumns(scope, ['done', 'done', 'custom:missing']);
    expect(
      useAppStore.getState().repositories[0].todoColumns?.map((column) => column.name)
    ).toEqual(['Done', 'Backlog', 'In progress', 'Review']);
  });

  it('keeps custom status when moving a todo and supports completion and automatic progress', () => {
    const store = useAppStore.getState();
    store.addTodoColumn(scope, 'Review');
    const status = useAppStore.getState().repositories[0].todoColumns?.at(-1)?.id;
    assert(status);
    store.addTodo(scope, 'Review this change');
    const id = useAppStore.getState().repositories[0].todos?.[0].id;
    assert(id);
    store.updateTodo(scope, id, { status });
    expect(store.moveTodoToWorktree(scope, id, 'session-repo-1')).toBe(true);
    const worktreeScope: TodoScope = { type: 'worktree', worktreeSessionId: 'session-repo-1' };
    const todo = () => useAppStore.getState().repositories[0].worktreeSessions[1].todos?.[0];
    expect(todo()).toMatchObject({ id, status, completed: false });
    store.updateTodo(worktreeScope, id, { completed: true });
    expect(todo()).toMatchObject({ status: 'done', completed: true });
    store.updateTodo(worktreeScope, id, { status: 'in_progress' });
    expect(todo()).toMatchObject({ status: 'in_progress', completed: false });
  });
});
