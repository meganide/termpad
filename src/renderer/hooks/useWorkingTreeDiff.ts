import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiffFile, DiffFileStat } from '../../shared/reviewTypes';
import { useAppStore } from '../stores/appStore';

// Threshold for auto-loading hunks (files with more changes require manual expand)
const AUTO_LOAD_THRESHOLD = 500;

interface UseWorkingTreeDiffOptions {
  repoPath: string | null;
  enabled?: boolean;
}

// Extended DiffFile that tracks whether hunks are loaded
export interface LazyDiffFile extends DiffFileStat {
  hunks: DiffFile['hunks'];
  hunksLoaded: boolean;
  isLoadingHunks?: boolean;
}

interface UseWorkingTreeDiffResult {
  files: LazyDiffFile[];
  headCommit: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  loadFileHunks: (filePath: string) => Promise<void>;
}

function areStatsEqual(a: DiffFileStat[], b: DiffFileStat[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].path !== b[i].path ||
      a[i].oldPath !== b[i].oldPath ||
      a[i].status !== b[i].status ||
      a[i].additions !== b[i].additions ||
      a[i].deletions !== b[i].deletions ||
      a[i].isBinary !== b[i].isBinary
    ) {
      return false;
    }
  }
  return true;
}

function isSmallFile(file: DiffFileStat): boolean {
  return file.additions + file.deletions < AUTO_LOAD_THRESHOLD;
}

export function useWorkingTreeDiff({
  repoPath,
  enabled = true,
}: UseWorkingTreeDiffOptions): UseWorkingTreeDiffResult {
  const [files, setFiles] = useState<LazyDiffFile[]>([]);
  const [headCommit, setHeadCommit] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const previousStatsRef = useRef<DiffFileStat[]>([]);
  const previousHeadCommitRef = useRef<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const loadedHunksRef = useRef<Map<string, DiffFile['hunks']>>(new Map());

  // Load hunks for a single file
  const loadFileHunks = useCallback(
    async (filePath: string) => {
      if (!repoPath) return;

      // Mark file as loading
      setFiles((prev) =>
        prev.map((f) => (f.path === filePath ? { ...f, isLoadingHunks: true } : f))
      );

      try {
        const diffFile = await window.terminal.getSingleWorkingTreeFileDiff(repoPath, filePath);
        if (mountedRef.current && diffFile) {
          loadedHunksRef.current.set(filePath, diffFile.hunks);
          setFiles((prev) =>
            prev.map((f) =>
              f.path === filePath
                ? { ...f, hunks: diffFile.hunks, hunksLoaded: true, isLoadingHunks: false }
                : f
            )
          );
        }
      } catch (err) {
        console.error(`[useWorkingTreeDiff] Failed to load hunks for ${filePath}:`, err);
        if (mountedRef.current) {
          setFiles((prev) =>
            prev.map((f) => (f.path === filePath ? { ...f, isLoadingHunks: false } : f))
          );
        }
      }
    },
    [repoPath]
  );

  // Fetch stats and optionally load hunks for small files
  const fetchStats = useCallback(
    async (isInitialLoad = false) => {
      if (!repoPath || !enabled) return;

      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const statsResult = await window.terminal.getWorkingTreeStats(repoPath);
        if (!mountedRef.current) return;

        const statsChanged = !areStatsEqual(statsResult.files, previousStatsRef.current);
        const headChanged = statsResult.headCommit !== previousHeadCommitRef.current;

        if (headChanged) {
          previousHeadCommitRef.current = statsResult.headCommit;
          setHeadCommit(statsResult.headCommit);
        }

        if (statsChanged) {
          const oldStats = previousStatsRef.current;
          previousStatsRef.current = statsResult.files;

          // Determine which small files actually need hunks fetched (cache
          // misses or changed stats); everything else reuses cached hunks
          const oldStatsByPath = new Map(oldStats.map((f) => [f.path, f]));
          const pathsToFetch: string[] = [];
          for (const file of statsResult.files) {
            if (!isSmallFile(file)) continue;
            const cachedHunks = loadedHunksRef.current.get(file.path);
            if (cachedHunks && !isInitialLoad) {
              const prevFile = oldStatsByPath.get(file.path);
              if (
                prevFile &&
                prevFile.additions === file.additions &&
                prevFile.deletions === file.deletions
              ) {
                continue;
              }
            }
            pathsToFetch.push(file.path);
          }

          // One git diff + one IPC round-trip for all files needing hunks
          if (pathsToFetch.length > 0) {
            try {
              const diffFiles = await window.terminal.getWorkingTreeFileDiffs(
                repoPath,
                pathsToFetch
              );
              for (const diffFile of diffFiles) {
                loadedHunksRef.current.set(diffFile.path, diffFile.hunks);
              }
            } catch {
              // If loading fails, files render without hunks
            }
          }

          const allFiles: LazyDiffFile[] = statsResult.files.map((file) => {
            const cachedHunks = loadedHunksRef.current.get(file.path);
            if (cachedHunks) {
              return { ...file, hunks: cachedHunks, hunksLoaded: true };
            }
            return { ...file, hunks: [], hunksLoaded: false };
          });

          setFiles(allFiles);

          // Clean up cached hunks for files that no longer exist
          const currentPaths = new Set(statsResult.files.map((f) => f.path));
          for (const path of loadedHunksRef.current.keys()) {
            if (!currentPaths.has(path)) {
              loadedHunksRef.current.delete(path);
            }
          }
        }
      } catch (err) {
        console.error('[useWorkingTreeDiff] Failed to fetch stats:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch diff');
        }
      } finally {
        if (mountedRef.current) {
          hasLoadedOnceRef.current = true;
          if (isInitialLoad) {
            setIsLoading(false);
          }
        }
      }
    },
    [repoPath, enabled]
  );

  const refresh = useCallback(() => {
    fetchStats(true);
  }, [fetchStats]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && repoPath) {
      const isInitial = !hasLoadedOnceRef.current;
      fetchStats(isInitial);
    } else {
      previousStatsRef.current = [];
      previousHeadCommitRef.current = null;
      hasLoadedOnceRef.current = false;
      loadedHunksRef.current.clear();
      setFiles([]);
      setHeadCommit(null);
      setError(null);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [repoPath, enabled, fetchStats]);

  // Check if path is being deleted (to skip refreshes during deletion)
  const isPathDeleting = useAppStore((state) => state.isPathDeleting);
  const throttleMs = useAppStore((state) => state.settings.gitPollIntervalMs);

  // Refresh stats when the main-process repo watcher signals a change
  // (throttled there) or the window regains focus, instead of polling
  useEffect(() => {
    if (!enabled || !repoPath) return;

    let isFetching = false;
    let refetchQueued = false;
    let isCleanedUp = false;

    const refreshStats = async () => {
      if (isFetching) {
        refetchQueued = true;
        return;
      }
      if (isCleanedUp || !mountedRef.current || isPathDeleting(repoPath)) return;

      isFetching = true;
      try {
        // Only fetch stats on change signals, not full hunks
        const statsResult = await window.terminal.getWorkingTreeStats(repoPath);
        if (!mountedRef.current || isCleanedUp) return;

        const statsChanged = !areStatsEqual(statsResult.files, previousStatsRef.current);
        const headChanged = statsResult.headCommit !== previousHeadCommitRef.current;

        if (headChanged) {
          previousHeadCommitRef.current = statsResult.headCommit;
          setHeadCommit(statsResult.headCommit);
        }

        if (statsChanged) {
          previousStatsRef.current = statsResult.files;

          // Update files with new stats, preserving loaded hunks
          setFiles((prevFiles) => {
            const newFiles: LazyDiffFile[] = statsResult.files.map((stat) => {
              const existingFile = prevFiles.find((f) => f.path === stat.path);
              const cachedHunks = loadedHunksRef.current.get(stat.path);

              // If file stats changed and we had hunks loaded, we need to refetch them
              if (existingFile && cachedHunks) {
                const statsMatchPrev =
                  existingFile.additions === stat.additions &&
                  existingFile.deletions === stat.deletions;

                if (statsMatchPrev) {
                  // Stats unchanged, keep existing hunks
                  return { ...stat, hunks: cachedHunks, hunksLoaded: true };
                } else {
                  // Stats changed, mark hunks as stale (will be refetched if small, or on expand)
                  loadedHunksRef.current.delete(stat.path);
                  if (isSmallFile(stat)) {
                    // Will trigger refetch below
                    return { ...stat, hunks: [], hunksLoaded: false };
                  }
                  return { ...stat, hunks: [], hunksLoaded: false };
                }
              }

              // New file or file without hunks loaded
              return { ...stat, hunks: [], hunksLoaded: false };
            });

            return newFiles;
          });

          // Refetch hunks for small files that need it: one git diff + one
          // IPC round-trip + one state update for the whole batch
          const smallFilesNeedingHunks = statsResult.files.filter(
            (f) => isSmallFile(f) && !loadedHunksRef.current.has(f.path)
          );

          if (smallFilesNeedingHunks.length > 0) {
            window.terminal
              .getWorkingTreeFileDiffs(
                repoPath,
                smallFilesNeedingHunks.map((f) => f.path)
              )
              .then((diffFiles) => {
                if (!mountedRef.current || isCleanedUp || diffFiles.length === 0) return;
                const hunksByPath = new Map(diffFiles.map((df) => [df.path, df.hunks]));
                for (const [filePath, hunks] of hunksByPath) {
                  loadedHunksRef.current.set(filePath, hunks);
                }
                setFiles((prev) =>
                  prev.map((f) => {
                    const hunks = hunksByPath.get(f.path);
                    return hunks ? { ...f, hunks, hunksLoaded: true } : f;
                  })
                );
              })
              .catch(() => {
                // Ignore errors; files render without hunks until the next change signal
              });
          }

          // Clean up cached hunks for files that no longer exist
          const currentPaths = new Set(statsResult.files.map((f) => f.path));
          for (const path of loadedHunksRef.current.keys()) {
            if (!currentPaths.has(path)) {
              loadedHunksRef.current.delete(path);
            }
          }
        }
      } finally {
        isFetching = false;
        if (refetchQueued && !isCleanedUp) {
          refetchQueued = false;
          refreshStats();
        }
      }
    };

    window.watcher.watchRepoChanges(repoPath, throttleMs);
    const unsubscribe = window.watcher.onRepoChanged(repoPath, refreshStats);

    const onFocus = () => refreshStats();
    window.addEventListener('focus', onFocus);

    return () => {
      isCleanedUp = true;
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      window.watcher.unwatchRepoChanges(repoPath);
    };
  }, [enabled, repoPath, throttleMs, isPathDeleting]);

  return {
    files,
    headCommit,
    isLoading,
    error,
    refresh,
    loadFileHunks,
  };
}
