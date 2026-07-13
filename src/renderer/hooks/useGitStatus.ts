import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import type { GitStatus } from '../../shared/types';

interface UseGitStatusOptions {
  sessionId: string;
  path: string;
  enabled?: boolean;
}

function isGitStatusEqual(a: GitStatus | undefined, b: GitStatus | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.branch === b.branch &&
    a.isDirty === b.isDirty &&
    a.additions === b.additions &&
    a.deletions === b.deletions
  );
}

/**
 * Keeps a session's git status in the store up to date. Event-driven: fetches
 * once on mount, then refetches only when the main-process repo watcher
 * signals a change (throttled there) or the window regains focus.
 */
export function useGitStatus({
  sessionId,
  path,
  enabled = true,
}: UseGitStatusOptions): GitStatus | undefined {
  const previousStatusRef = useRef<GitStatus | undefined>(undefined);
  // Narrow selectors: this hook is mounted once per session, so subscribing to
  // the whole store would re-render every session row on unrelated changes.
  const updateGitStatus = useAppStore((s) => s.updateGitStatus);
  const isPathDeleting = useAppStore((s) => s.isPathDeleting);
  const throttleMs = useAppStore((s) => s.settings.gitPollIntervalMs);
  const gitStatus = useAppStore((s) => s.terminals.get(sessionId)?.gitStatus);

  useEffect(() => {
    if (!enabled) return;

    let isCleanedUp = false;
    let isFetching = false;
    let refetchQueued = false;

    const fetchGitStatus = async () => {
      // A change signal during an in-flight fetch queues one trailing refetch
      // so the final repo state is never missed
      if (isFetching) {
        refetchQueued = true;
        return;
      }
      if (isCleanedUp || isPathDeleting(path)) return;

      isFetching = true;
      try {
        const status = await window.terminal.getGitStatus(path);
        if (!isCleanedUp && status && !isGitStatusEqual(status, previousStatusRef.current)) {
          previousStatusRef.current = status;
          updateGitStatus(sessionId, status);
        }
      } catch (error) {
        console.error('[useGitStatus] Failed to fetch git status:', error);
      } finally {
        isFetching = false;
        if (refetchQueued && !isCleanedUp) {
          refetchQueued = false;
          fetchGitStatus();
        }
      }
    };

    // Initial fetch; afterwards the main-process watcher signals changes
    fetchGitStatus();
    window.watcher.watchRepoChanges(path, throttleMs);
    const unsubscribe = window.watcher.onRepoChanged(path, fetchGitStatus);

    // Reconcile on refocus in case fs events were missed
    const onFocus = () => fetchGitStatus();
    window.addEventListener('focus', onFocus);

    return () => {
      isCleanedUp = true;
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      window.watcher.unwatchRepoChanges(path);
    };
  }, [sessionId, path, enabled, throttleMs, updateGitStatus, isPathDeleting]);

  return gitStatus;
}
