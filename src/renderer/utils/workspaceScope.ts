import type { Repository, WorktreeSession } from '../../shared/types';

export function isGlobalWorkspace(worktree?: Pick<WorktreeSession, 'isMainWorktree'>): boolean {
  return !worktree || worktree.isMainWorktree === true;
}

// Preserve content created before the primary checkout became the global scope.
export function migrateGlobalContent(repository: Repository): Repository {
  const mainSessions = repository.worktreeSessions.filter(
    (session) => session.isMainWorktree && (session.todos?.length || session.notes)
  );
  if (!mainSessions.length) return repository;
  const todos = [...(repository.todos ?? [])];
  let notes = repository.notes ?? '';
  for (const session of mainSessions) {
    for (const todo of session.todos ?? []) {
      // IDs should be unique, but preserve differing content if legacy data has a collision.
      const existing = todos.find((item) => item.id === todo.id);
      if (!existing) todos.push(todo);
      else if (JSON.stringify(existing) !== JSON.stringify(todo))
        todos.push({ ...todo, id: crypto.randomUUID() });
    }
    if (session.notes && session.notes !== notes)
      notes = notes ? `${notes}<div><br></div>${session.notes}` : session.notes;
  }
  return {
    ...repository,
    todos,
    notes,
    worktreeSessions: repository.worktreeSessions.map((session) =>
      session.isMainWorktree ? { ...session, todos: undefined, notes: undefined } : session
    ),
  };
}
