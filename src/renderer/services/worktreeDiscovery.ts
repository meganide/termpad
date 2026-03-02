import { useAppStore } from '../stores/appStore';
import type { WorktreeSession } from '../../shared/types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function discoverWorktreesForRepository(
  repositoryId: string,
  repositoryPath: string
): Promise<void> {
  const store = useAppStore.getState();
  const repository = store.repositories.find((r) => r.id === repositoryId);

  if (!repository) return;

  try {
    const worktrees = await window.terminal.listWorktrees(repositoryPath);

    // Filter to only non-main worktrees that don't already have sessions
    const existingPaths = new Set(repository.worktreeSessions.map((s) => s.path));

    for (const wt of worktrees) {
      if (wt.isMain || existingPaths.has(wt.path)) continue;

      // Create worktree session for discovered worktree
      const worktreeSession: WorktreeSession = {
        id: generateId(),
        label: wt.branch, // Use branch name as label
        path: wt.path,
        branchName: wt.branch,
        worktreeName: wt.path.split('/').pop() || wt.branch,
        createdAt: new Date().toISOString(),
        isExternal: true,
      };

      store.addWorktreeSession(repositoryId, worktreeSession);
    }
  } catch (error) {
    console.error(
      `[WorktreeDiscovery] Failed to discover worktrees for repository ${repositoryId}:`,
      error
    );
  }
}

export async function discoverAllWorktrees(): Promise<void> {
  const repositories = useAppStore.getState().repositories;

  await Promise.all(repositories.map((r) => discoverWorktreesForRepository(r.id, r.path)));
}
