import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

const POLL_INTERVAL_MS = 30000; // 30 seconds

/**
 * Hook that polls for PR statuses from the GitHub API via gh CLI.
 * Features:
 * - Polls every 30 seconds when document is visible
 * - Pauses polling when document is hidden (tab not visible)
 * - Handles race conditions with fetchId tracking
 * - Cleans up properly on unmount (no memory leaks)
 */
export function usePRStatusPolling(): void {
  const fetchPRStatuses = useAppStore((state) => state.fetchPRStatuses);
  const isInitialized = useAppStore((state) => state.isInitialized);

  // Track whether the component is still mounted
  const isMountedRef = useRef(true);
  // Track the current fetch ID to handle race conditions
  const fetchIdRef = useRef(0);
  // Track the interval ID for cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const doFetch = async () => {
      if (!isMountedRef.current) return;

      // Increment fetch ID to track this specific fetch
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;

      await fetchPRStatuses();

      // If the component unmounted or a newer fetch started, ignore this result
      if (!isMountedRef.current || fetchIdRef.current !== currentFetchId) {
        return;
      }
    };

    const startPolling = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start a new interval
      intervalRef.current = setInterval(() => {
        if (document.hidden) return; // Skip if document is not visible
        doFetch();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Document became hidden - stop polling
        stopPolling();
      } else {
        // Document became visible - fetch immediately and restart polling
        doFetch();
        startPolling();
      }
    };

    // Only start when initialized
    if (isInitialized) {
      // Do an initial fetch
      doFetch();

      // Start polling
      startPolling();

      // Listen for visibility changes
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPRStatuses, isInitialized]);
}
