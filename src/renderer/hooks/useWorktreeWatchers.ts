import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../stores/appStore';
import type { WorktreeSession, WorktreeInfo } from '../../shared/types';
import { normalizePath } from '../utils/worktreeUtils';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useWorktreeWatchers() {
  const repositories = useAppStore((state) => state.repositories);
  const addWorktreeSession = useAppStore((state) => state.addWorktreeSession);
  const removeWorktreeSession = useAppStore((state) => state.removeWorktreeSession);
  const removeRepository = useAppStore((state) => state.removeRepository);
  const isInitialized = useAppStore((state) => state.isInitialized);

  // Track which repositories we've started watching
  const watchedRepositoriesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isInitialized) return;

    // Get all current repository IDs
    const allRepositoryIds = new Set(repositories.map((r) => r.id));

    // Start worktree watchers for new repositories (all repositories are now git repos)
    for (const repository of repositories) {
      if (!watchedRepositoriesRef.current.has(repository.id)) {
        window.watcher.startRepositoryWatch(repository.id, repository.path);
        watchedRepositoriesRef.current.add(repository.id);
      }
    }

    // Stop worktree watchers for removed repositories
    for (const repositoryId of watchedRepositoriesRef.current) {
      if (!allRepositoryIds.has(repositoryId)) {
        window.watcher.stopRepositoryWatch(repositoryId);
        watchedRepositoriesRef.current.delete(repositoryId);
      }
    }
  }, [repositories, isInitialized]);

  // Setup event listeners once on mount
  useEffect(() => {
    if (!isInitialized) return;

    const unsubAdded = window.watcher.onWorktreeAdded(
      (repositoryId: string, worktree: WorktreeInfo) => {
        const repository = useAppStore.getState().repositories.find((r) => r.id === repositoryId);
        if (!repository) return;

        // Check if session already exists for this path (using normalized paths for comparison)
        const normalizedWorktreePath = normalizePath(worktree.path);
        const exists = repository.worktreeSessions.some(
          (s) => normalizePath(s.path) === normalizedWorktreePath
        );
        if (exists) return;

        console.log(
          `[useWorktreeWatchers] Adding session for discovered worktree: ${worktree.branch}`
        );

        const session: WorktreeSession = {
          id: generateId(),

          label: worktree.branch,
          path: worktree.path,
          branchName: worktree.branch,
          worktreeName: worktree.path.split('/').pop() || worktree.branch,
          createdAt: new Date().toISOString(),
          isExternal: true,
        };

        addWorktreeSession(repositoryId, session);
      }
    );

    const unsubRemoved = window.watcher.onWorktreeRemoved(
      (repositoryId: string, worktreePath: string, isExternal: boolean) => {
        const repository = useAppStore.getState().repositories.find((r) => r.id === repositoryId);
        if (!repository) return;

        // Use normalized paths for comparison
        const normalizedRemovedPath = normalizePath(worktreePath);
        const session = repository.worktreeSessions.find(
          (s) => normalizePath(s.path) === normalizedRemovedPath
        );
        if (session) {
          console.log(
            `[useWorktreeWatchers] Removing session for deleted worktree: ${worktreePath}`
          );

          // Show toast for externally deleted worktrees
          if (isExternal) {
            toast.info(`Worktree "${session.label}" was removed`, {
              description: 'The folder was deleted from outside the application.',
              duration: 5000,
            });
          }

          removeWorktreeSession(repositoryId, session.id);
        }
      }
    );

    // Handle repository folder deletion (external deletion)
    const unsubDeleted = window.watcher.onRepositoryDeleted(
      (repositoryId: string, repoPath: string) => {
        const repository = useAppStore.getState().repositories.find((r) => r.id === repositoryId);
        if (!repository) return;

        console.log(`[useWorktreeWatchers] Repository folder deleted externally: ${repoPath}`);

        // Show toast notification to inform user
        toast.info(`Repository "${repository.name}" was removed`, {
          description: 'The folder was deleted from outside the application.',
          duration: 5000,
        });

        // Stop watching this repository
        window.watcher.stopRepositoryWatch(repositoryId);
        watchedRepositoriesRef.current.delete(repositoryId);

        // Remove the repository from app state
        removeRepository(repositoryId);
      }
    );

    // Capture current ref values for cleanup
    const watchedRepositories = watchedRepositoriesRef.current;

    return () => {
      unsubAdded();
      unsubRemoved();
      unsubDeleted();

      // Stop all watchers on unmount
      for (const repositoryId of watchedRepositories) {
        window.watcher.stopRepositoryWatch(repositoryId);
      }
      watchedRepositories.clear();
    };
  }, [isInitialized, addWorktreeSession, removeWorktreeSession, removeRepository]);
}
