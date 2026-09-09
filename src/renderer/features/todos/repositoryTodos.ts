import type { Repository, TodoItem } from '../../../shared/types';

// Worktree ownership is the assignment. Global is a view of these same records,
// never a second copy that could drift out of sync.
export function getRepositoryTodos(repository?: Repository): TodoItem[] {
  if (!repository) return [];
  const todos = [
    ...(repository.todos ?? []),
    ...repository.worktreeSessions.flatMap((session) => session.todos ?? []),
  ];
  if (!repository.todoOrder) return todos;
  const order = new Map(repository.todoOrder.map((id, index) => [id, index]));
  return todos.sort((a, b) => (order.get(a.id) ?? -1) - (order.get(b.id) ?? -1));
}
