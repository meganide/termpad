import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiffFile, DiffFileStat } from '../../shared/reviewTypes';
import { useAppStore } from '../stores/appStore';

// Threshold for auto-loading hunks (files with more changes require manual expand)
const AUTO_LOAD_THRESHOLD = 500;
const DEFAULT_POLL_INTERVAL_MS = 5000;

interface UseWorkingTreeDiffOptions {
  repoPath: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
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
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
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

          // Determine which files need hunks loaded
          const smallFiles = statsResult.files.filter(isSmallFile);
          const largeFiles = statsResult.files.filter((f) => !isSmallFile(f));

          // For small files, load hunks in parallel
          const smallFileHunks = await Promise.all(
            smallFiles.map(async (file) => {
              // Check if we already have hunks cached
              const cachedHunks = loadedHunksRef.current.get(file.path);
              if (cachedHunks && !isInitialLoad) {
                // Reuse cached hunks if file stats haven't changed
                const prevFile = oldStats.find((f) => f.path === file.path);
                if (
                  prevFile &&
                  prevFile.additions === file.additions &&
                  prevFile.deletions === file.deletions
                ) {
                  return { ...file, hunks: cachedHunks, hunksLoaded: true };
                }
              }

              try {
                const diffFile = await window.terminal.getSingleWorkingTreeFileDiff(
                  repoPath,
                  file.path
                );
                if (diffFile) {
                  loadedHunksRef.current.set(file.path, diffFile.hunks);
                  return { ...file, hunks: diffFile.hunks, hunksLoaded: true };
                }
              } catch {
                // If loading fails, return without hunks
              }
              return { ...file, hunks: [], hunksLoaded: false };
            })
          );

          // For large files, preserve existing hunks if already loaded
          const largeFilesWithState: LazyDiffFile[] = largeFiles.map((file) => {
            const cachedHunks = loadedHunksRef.current.get(file.path);
            if (cachedHunks) {
              return { ...file, hunks: cachedHunks, hunksLoaded: true };
            }
            return { ...file, hunks: [], hunksLoaded: false };
          });

          // Combine and sort by original order
          const allFiles: LazyDiffFile[] = [...smallFileHunks, ...largeFilesWithState].sort(
            (a, b) => {
              const aIndex = statsResult.files.findIndex((f) => f.path === a.path);
              const bIndex = statsResult.files.findIndex((f) => f.path === b.path);
              return aIndex - bIndex;
            }
          );

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

  // Check if path is being deleted (to skip polling during deletion)
  const isPathDeleting = useAppStore((state) => state.isPathDeleting);

  // Poll for stats at regular intervals
  useEffect(() => {
    if (!enabled || !repoPath || pollIntervalMs <= 0) return;

    let isFetching = false;
    let isCleanedUp = false;

    const intervalId = setInterval(async () => {
      if (isFetching || isCleanedUp) return;
      if (!mountedRef.current || isPathDeleting(repoPath)) return;

      isFetching = true;
      try {
        // Only fetch stats during polling, not full hunks
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

          // Refetch hunks for small files that need it
          const smallFilesNeedingHunks = statsResult.files.filter(
            (f) => isSmallFile(f) && !loadedHunksRef.current.has(f.path)
          );

          if (smallFilesNeedingHunks.length > 0) {
            Promise.all(
              smallFilesNeedingHunks.map(async (file) => {
                try {
                  const diffFile = await window.terminal.getSingleWorkingTreeFileDiff(
                    repoPath,
                    file.path
                  );
                  if (diffFile && mountedRef.current) {
                    loadedHunksRef.current.set(file.path, diffFile.hunks);
                    setFiles((prev) =>
                      prev.map((f) =>
                        f.path === file.path
                          ? { ...f, hunks: diffFile.hunks, hunksLoaded: true }
                          : f
                      )
                    );
                  }
                } catch {
                  // Ignore errors for individual files
                }
              })
            );
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
      }
    }, pollIntervalMs);

    return () => {
      isCleanedUp = true;
      clearInterval(intervalId);
    };
  }, [enabled, repoPath, pollIntervalMs, isPathDeleting]);

  return {
    files,
    headCommit,
    isLoading,
    error,
    refresh,
    loadFileHunks,
  };
}
