import type { Repository, WorktreeSession } from '../../../shared/types';

export function hasNoteContent(notes?: string): boolean {
  if (!notes?.trim()) return false;
  // Rich-text editors leave empty paragraphs and non-breaking spaces after clearing.
  const body = new DOMParser().parseFromString(notes, 'text/html').body;
  return (
    !!body.textContent?.replace(/[\s\u200B]/g, '') || !!body.querySelector('img,video,audio,hr')
  );
}

export function getScopeIndicators(
  repository?: Pick<Repository, 'todos' | 'notes'>,
  worktree?: Pick<WorktreeSession, 'todos' | 'notes' | 'isMainWorktree'>
) {
  const summarize = (todos: Repository['todos'] = []) => ({
    completed: todos.filter((todo) => todo.completed).length,
    total: todos.length,
  });
  const global = !worktree;
  const content = global ? repository : worktree;
  return {
    scope: global ? ('global' as const) : ('worktree' as const),
    todos: summarize(content?.todos),
    notes: hasNoteContent(content?.notes),
  };
}
