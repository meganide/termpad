import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchTodoToWorktree } from './todoDispatch';
import { waitForTerminalStartup } from './terminalStartup';
import { getRepositoryTodos } from '../features/todos/repositoryTodos';
import { useAppStore } from '../stores/appStore';
import {
  createMockRepositoryWithWorktreeSessions,
  createMockSettings,
  resetAllStores,
} from '../../../tests/utils';

vi.mock('./terminalStartup', () => ({
  waitForTerminalStartup: vi.fn().mockResolvedValue(undefined),
}));
const todo = {
  id: 'todo',
  text: 'Implement the feature',
  completed: false,
  createdAt: '2026-01-01',
};
const scope = { type: 'repository' as const, repositoryId: 'repo' };

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  vi.mocked(waitForTerminalStartup).mockResolvedValue(undefined);
  const repository = createMockRepositoryWithWorktreeSessions({ id: 'repo', todos: [todo] }, 2);
  repository.todos = [todo];
  repository.worktreeSessions[0].isMainWorktree = true;
  useAppStore.setState({
    repositories: [repository],
    deletingPaths: new Set(),
    settings: createMockSettings({
      defaultPresetId: 'agent',
      terminalPresets: [{ id: 'agent', name: 'Codex', command: 'codex', icon: 'code', order: 0 }],
    }),
  });
  const store = useAppStore.getState();
  store.setActiveTerminal(repository.worktreeSessions[0].id);
  store.createTab(repository.worktreeSessions[0].id, 'Current terminal');
  store.setFocusArea('app');
});

const repo = () => useAppStore.getState().repositories[0];
const targetId = () => repo().worktreeSessions[1].id;

describe('planning dispatch', () => {
  it('starts a fresh agent without changing navigation or duplicating the global todo', async () => {
    const before = useAppStore.getState();
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await dispatchTodoToWorktree('repo', todo.id, targetId(), send);
    const state = useAppStore.getState();
    const terminalId = state.getTerminalIdForTab(targetId(), result.tabId);
    expect(state.getTabsForWorktree(targetId())).toEqual([
      expect.objectContaining({ command: 'codex' }),
    ]);
    expect(waitForTerminalStartup).toHaveBeenCalledWith(terminalId, true);
    expect(send).toHaveBeenCalledExactlyOnceWith(terminalId, todo.text);
    expect(state.activeTerminalId).toBe(before.activeTerminalId);
    expect(state.activeTabId).toBe(before.activeTabId);
    expect(state.focusArea).toBe('app');
    expect(repo().todos).toEqual([]);
    expect(getRepositoryTodos(repo())).toEqual([{ ...todo, status: 'in_progress' }]);
    expect(getRepositoryTodos(repo())[0]).toBe(repo().worktreeSessions[1].todos![0]);
  });

  it('keeps failed dispatches accessible without marking them started and permits retry', async () => {
    vi.mocked(waitForTerminalStartup).mockRejectedValueOnce(new Error('Startup failed'));
    const send = vi.fn().mockResolvedValue(undefined);
    await expect(dispatchTodoToWorktree('repo', todo.id, targetId(), send)).rejects.toThrow(
      'Startup failed'
    );
    expect(send).not.toHaveBeenCalled();
    expect(getRepositoryTodos(repo())).toEqual([todo]);
    await dispatchTodoToWorktree('repo', todo.id, targetId(), send);
    expect(getRepositoryTodos(repo())[0].status).toBe('in_progress');
  });

  it('prevents duplicate launches while a todo is starting', async () => {
    let ready!: () => void;
    vi.mocked(waitForTerminalStartup).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        ready = resolve;
      })
    );
    const send = vi.fn().mockResolvedValue(undefined);
    const pending = dispatchTodoToWorktree('repo', todo.id, targetId(), send);
    await expect(dispatchTodoToWorktree('repo', todo.id, targetId(), send)).rejects.toThrow(
      'already starting'
    );
    expect(useAppStore.getState().getTabsForWorktree(targetId())).toHaveLength(1);
    ready();
    await pending;
  });

  it('does not send a todo deleted during startup', async () => {
    vi.mocked(waitForTerminalStartup).mockImplementationOnce(async () => {
      useAppStore.getState().removeTodo(scope, todo.id);
    });
    const send = vi.fn();
    await expect(dispatchTodoToWorktree('repo', todo.id, targetId(), send)).rejects.toThrow(
      'no longer available'
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('uses edits made during startup and preserves a later status change', async () => {
    vi.mocked(waitForTerminalStartup).mockImplementationOnce(async () => {
      useAppStore.getState().updateTodo(scope, todo.id, { text: 'Updated instructions' });
    });
    const send = vi.fn().mockImplementation(async () => {
      useAppStore.getState().updateTodo(scope, todo.id, { status: 'done' });
    });
    await dispatchTodoToWorktree('repo', todo.id, targetId(), send);
    expect(send).toHaveBeenCalledWith(expect.any(String), 'Updated instructions');
    expect(getRepositoryTodos(repo())[0].status).toBe('done');
  });
});

describe('shared repository board', () => {
  it('keeps local ordering independent when editing or reordering the global board', () => {
    const store = useAppStore.getState();
    const localScope = { type: 'worktree' as const, worktreeSessionId: targetId() };
    store.moveGlobalTodoToWorktree('repo', todo.id, targetId());
    store.addTodo(localScope, 'Local task');
    const localOrder = repo().worktreeSessions[1].todos!.map((item) => item.id);
    store.reorderTodos(scope, [...localOrder].reverse());
    store.updateTodo(scope, todo.id, { text: 'New title' });
    expect(repo().worktreeSessions[1].todos!.map((item) => item.id)).toEqual(localOrder);
    expect(getRepositoryTodos(repo()).map((item) => item.id)).toEqual([...localOrder].reverse());
  });
  it('preserves global order across assignment and shares edits in both directions', () => {
    const store = useAppStore.getState();
    store.addTodo(scope, 'Second task');
    const order = getRepositoryTodos(repo()).map((item) => item.id);
    store.moveGlobalTodoToWorktree('repo', todo.id, targetId());
    expect(getRepositoryTodos(repo()).map((item) => item.id)).toEqual(order);
    store.updateTodo(scope, todo.id, { text: 'Edited globally' });
    expect(repo().worktreeSessions[1].todos![0].text).toBe('Edited globally');
    store.updateTodo({ type: 'worktree', worktreeSessionId: targetId() }, todo.id, {
      completed: true,
    });
    expect(getRepositoryTodos(repo()).find((item) => item.id === todo.id)?.completed).toBe(true);
    store.reorderTodos(scope, [...order].reverse());
    expect(getRepositoryTodos(repo()).map((item) => item.id)).toEqual([...order].reverse());
  });

  it('returns assigned todos to the repository when their worktree is removed', () => {
    const store = useAppStore.getState();
    const target = targetId();
    store.moveGlobalTodoToWorktree('repo', todo.id, target);
    store.removeWorktreeSession('repo', target);
    expect(getRepositoryTodos(repo())).toEqual([todo]);
    expect(repo().todos).toEqual([todo]);
  });

  it('supports assigning to the primary checkout without confusing it with global', () => {
    const store = useAppStore.getState();
    expect(store.moveGlobalTodoToWorktree('repo', todo.id, repo().worktreeSessions[0].id)).toBe(
      true
    );
    expect(repo().todos).toEqual([]);
    expect(repo().worktreeSessions[0].todos).toEqual([todo]);
  });
});
