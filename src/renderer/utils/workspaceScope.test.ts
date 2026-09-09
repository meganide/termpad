import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateGlobalContent } from './workspaceScope';
import { hasNoteContent } from '../components/RightPanel/scopeIndicators';
import { useAppStore } from '../stores/appStore';
import { createMockRepositoryWithWorktreeSessions, resetAllStores } from '../../../tests/utils';
import { getDefaultAppState } from '../../shared/types';

const todo = {
  id: 'todo',
  text: 'Important',
  completed: true,
  priority: 'high' as const,
  createdAt: '2026-01-01',
};
const fixture = () => {
  const repository = createMockRepositoryWithWorktreeSessions({ id: 'repo' }, 2);
  repository.worktreeSessions[0].isMainWorktree = true;
  return repository;
};

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  useAppStore.setState({ deletingPaths: new Set() });
});

describe('global content migration', () => {
  it('preserves existing global and main-checkout content without touching linked worktrees', () => {
    const repository = fixture();
    repository.todos = [{ ...todo, id: 'global' }];
    repository.notes = '<p>Global</p>';
    repository.worktreeSessions[0].todos = [todo];
    repository.worktreeSessions[0].notes = '<p>Main</p>';
    repository.worktreeSessions[1].notes = '<p>Local</p>';
    const result = migrateGlobalContent(repository);
    expect(result.todos).toEqual([{ ...todo, id: 'global' }, todo]);
    expect(result.notes).toBe('<p>Global</p><div><br></div><p>Main</p>');
    expect(result.worktreeSessions[0].todos).toBeUndefined();
    expect(result.worktreeSessions[0].notes).toBeUndefined();
    expect(result.worktreeSessions[1]).toBe(repository.worktreeSessions[1]);
    expect(migrateGlobalContent(result)).toBe(result);
    expect(repository.worktreeSessions[0].todos).toEqual([todo]);
  });

  it('persists the migration on initialization', async () => {
    const repository = fixture();
    repository.worktreeSessions[0].todos = [todo];
    repository.worktreeSessions[0].notes = 'Old main note';
    vi.mocked(window.storage.loadState).mockResolvedValue({
      ...getDefaultAppState(),
      repositories: [repository],
    });
    await useAppStore.getState().initialize();
    const updated = useAppStore.getState().repositories[0];
    expect(updated.todos).toEqual([todo]);
    expect(updated.notes).toBe('Old main note');
    expect(window.storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        repositories: [expect.objectContaining({ todos: [todo], notes: 'Old main note' })],
      })
    );
  });

  it('does not turn empty editor markup into a notes indicator during migration', () => {
    const repository = fixture();
    repository.notes = '<p><br></p>';
    repository.worktreeSessions[0].notes = '<div><br></div>';
    expect(hasNoteContent(migrateGlobalContent(repository).notes)).toBe(false);
  });
});

describe('moving global todos', () => {
  it('moves all metadata atomically and persists both scopes', () => {
    const repository = fixture();
    repository.todos = [todo];
    useAppStore.setState({ repositories: [repository], isInitialized: true });
    const states: unknown[] = [];
    const unsubscribe = useAppStore.subscribe((state) => states.push(state.repositories));
    expect(
      useAppStore
        .getState()
        .moveGlobalTodoToWorktree('repo', todo.id, repository.worktreeSessions[1].id)
    ).toBe(true);
    unsubscribe();
    expect(states).toHaveLength(1);
    const result = useAppStore.getState().repositories[0];
    expect(result.todos).toEqual([]);
    expect(result.worktreeSessions[1].todos).toEqual([todo]);
    expect(window.storage.saveState).toHaveBeenCalledTimes(1);
  });

  it.each(['missing', 'main', 'other-repo', 'duplicate', 'deleting'])(
    'rejects a %s target without removing the source',
    (kind) => {
      const repository = fixture();
      repository.todos = [todo];
      const other = createMockRepositoryWithWorktreeSessions({ id: 'other' }, 1);
      const target = repository.worktreeSessions[1];
      if (kind === 'duplicate') target.todos = [todo];
      useAppStore.setState({
        repositories: [repository, other],
        deletingPaths: new Set(kind === 'deleting' ? [target.path] : []),
      });
      const id =
        kind === 'missing'
          ? 'missing'
          : kind === 'main'
            ? repository.worktreeSessions[0].id
            : kind === 'other-repo'
              ? other.worktreeSessions[0].id
              : target.id;
      expect(useAppStore.getState().moveGlobalTodoToWorktree('repo', todo.id, id)).toBe(false);
      expect(useAppStore.getState().repositories[0].todos).toEqual([todo]);
      expect(window.storage.saveState).not.toHaveBeenCalled();
    }
  );
});

describe('todo status and moving between worktrees', () => {
  it('keeps status and completion in sync and persists status changes', () => {
    const repository = fixture();
    repository.todos = [todo];
    useAppStore.setState({ repositories: [repository], isInitialized: true });
    const scope = { type: 'repository' as const, repositoryId: 'repo' };
    const store = useAppStore.getState();
    store.updateTodo(scope, todo.id, { status: 'in_progress' });
    expect(useAppStore.getState().repositories[0].todos?.[0]).toMatchObject({
      status: 'in_progress',
      completed: false,
    });
    store.updateTodo(scope, todo.id, { completed: true });
    expect(useAppStore.getState().repositories[0].todos?.[0]).toMatchObject({
      status: 'done',
      completed: true,
    });
    store.updateTodo(scope, todo.id, { completed: false });
    expect(useAppStore.getState().repositories[0].todos?.[0]).toMatchObject({
      status: 'backlog',
      completed: false,
    });
    expect(window.storage.saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        repositories: [
          expect.objectContaining({ todos: [expect.objectContaining({ status: 'backlog' })] }),
        ],
      })
    );
  });

  it('moves the original worktree todo atomically and marks it in progress', () => {
    const repository = fixture();
    const source = repository.worktreeSessions[1];
    source.todos = [todo];
    const target = { ...source, id: 'target', path: '/test/target', todos: [] };
    repository.worktreeSessions.push(target);
    useAppStore.setState({ repositories: [repository], isInitialized: true });
    const states: unknown[] = [];
    const unsubscribe = useAppStore.subscribe((state) => states.push(state.repositories));
    expect(
      useAppStore
        .getState()
        .moveTodoToWorktree(
          { type: 'worktree', worktreeSessionId: source.id },
          todo.id,
          target.id,
          'in_progress'
        )
    ).toBe(true);
    unsubscribe();
    const result = useAppStore.getState().repositories[0];
    expect(states).toHaveLength(1);
    expect(result.worktreeSessions[1].todos).toEqual([]);
    expect(result.worktreeSessions[2].todos).toEqual([
      { ...todo, completed: false, status: 'in_progress' },
    ]);
    expect(result.todos).toBeUndefined();
  });
});
