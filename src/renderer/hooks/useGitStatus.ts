import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { GitStatus } from '../../shared/types';

const BACKGROUND_POLL_INTERVAL_MS = 30000;
const INACTIVE_POLL_INTERVAL_MS = 15000;

interface UseGitStatusOptions {
  sessionId: string;
  path: string;
  enabled?: boolean;
  isActive?: boolean; // Active sessions poll faster than inactive ones
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

export function useGitStatus({
  sessionId,
  path,
  enabled = true,
  isActive = true,
}: UseGitStatusOptions): GitStatus | undefined {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<GitStatus | undefined>(undefined);
  const isFetchingRef = useRef(false);
  const { terminals, updateGitStatus, settings, isPathDeleting } = useAppStore();

  // Track window focus state to throttle polling when in background
  const [isFocused, setIsFocused] = useState(document.hasFocus());

  // Track window focus changes
  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isCleanedUp = false;

    const fetchGitStatus = async () => {
      // Skip if already fetching (prevents process accumulation with slow operations)
      if (isFetchingRef.current) return;
      // Skip polling if repository is being deleted
      if (isPathDeleting(path)) return;

      isFetchingRef.current = true;
      try {
        const status = await window.terminal.getGitStatus(path);
        if (!isCleanedUp && status && !isGitStatusEqual(status, previousStatusRef.current)) {
          previousStatusRef.current = status;
          updateGitStatus(sessionId, status);
        }
      } catch (error) {
        console.error('[useGitStatus] Failed to fetch git status:', error);
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Fetch immediately (if not being deleted)
    if (!isPathDeleting(path)) {
      fetchGitStatus();
    }

    // Use longer polling interval when window is unfocused or session is inactive
    const pollInterval = !isFocused
      ? BACKGROUND_POLL_INTERVAL_MS
      : isActive
        ? settings.gitPollIntervalMs
        : INACTIVE_POLL_INTERVAL_MS;
    intervalRef.current = setInterval(fetchGitStatus, pollInterval);

    return () => {
      isCleanedUp = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    sessionId,
    path,
    enabled,
    isActive,
    settings.gitPollIntervalMs,
    updateGitStatus,
    isPathDeleting,
    isFocused,
  ]);

  return terminals.get(sessionId)?.gitStatus;
}
