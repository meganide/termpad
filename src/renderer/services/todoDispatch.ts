import type { TodoItem } from '../../shared/types';
import { useAppStore } from '../stores/appStore';
import { getRepositoryTodos } from '../features/todos/repositoryTodos';
import { waitForTerminalStartup } from './terminalStartup';

type SendText = (terminalId: string, text: string) => Promise<void>;
const startingTodos = new Set<string>();

export async function deliverTodoToTerminal(
  terminalId: string,
  todo: TodoItem,
  hasCommand: boolean,
  sendText: SendText
) {
  await waitForTerminalStartup(terminalId, hasCommand);
  const state = useAppStore.getState();
  const sessionId = state.worktreeTabs.find((group) =>
    group.tabs.some(
      (tab) => state.getTerminalIdForTab(group.worktreeSessionId, tab.id) === terminalId
    )
  )?.worktreeSessionId;
  const session = state.repositories
    .flatMap((repo) => repo.worktreeSessions)
    .find((item) => item.id === sessionId);
  const currentTodo = session?.todos?.find((item) => item.id === todo.id);
  if (!session || !currentTodo || state.isPathDeleting(session.path))
    throw new Error('The todo or its worktree is no longer available.');
  await sendText(terminalId, currentTodo.text);
  const latest = useAppStore
    .getState()
    .repositories.flatMap((repo) => repo.worktreeSessions)
    .find((item) => item.id === sessionId)
    ?.todos?.find((item) => item.id === todo.id);
  // Preserve a status the user changed while the agent was starting.
  if (latest && latest.status === currentTodo.status && latest.completed === currentTodo.completed)
    useAppStore
      .getState()
      .updateTodo({ type: 'worktree', worktreeSessionId: session.id }, todo.id, {
        status: 'in_progress',
      });
}

export async function dispatchTodoToWorktree(
  repositoryId: string,
  todoId: string,
  targetId: string,
  sendText: SendText
) {
  const key = `${repositoryId}:${todoId}`;
  if (startingTodos.has(key)) throw new Error('This todo is already starting.');
  startingTodos.add(key);
  try {
    const state = useAppStore.getState();
    const repository = state.repositories.find((item) => item.id === repositoryId);
    const target = repository?.worktreeSessions.find((item) => item.id === targetId);
    const todo = getRepositoryTodos(repository).find((item) => item.id === todoId);
    if (!target || !todo || state.isPathDeleting(target.path))
      throw new Error('The todo or worktree is no longer available.');
    if (
      !target.todos?.some((item) => item.id === todo.id) &&
      !state.moveGlobalTodoToWorktree(repositoryId, todo.id, targetId)
    )
      throw new Error('The todo could not be assigned.');
    const preset = state.settings.defaultPresetId
      ? state.settings.terminalPresets.find((item) => item.id === state.settings.defaultPresetId)
      : state.settings.terminalPresets.find((item) => item.isBuiltIn);
    const tab = state.createTab(
      targetId,
      preset?.name ?? 'Terminal',
      preset?.command,
      preset?.icon,
      { activate: false }
    );
    const terminalId = state.getTerminalIdForTab(targetId, tab.id);
    await deliverTodoToTerminal(terminalId, todo, Boolean(tab.command), sendText);
    return { tabId: tab.id, worktreeLabel: target.label };
  } finally {
    startingTodos.delete(key);
  }
}
