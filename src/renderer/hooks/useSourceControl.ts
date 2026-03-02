import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  FileStatusResult,
  FileStatus,
  GitOperationResult,
  CommitResult,
  AheadBehindResult,
  OperationProgress,
  HookManifest,
} from '../../shared/types';
import { useAppStore } from '../stores/appStore';

const BACKGROUND_POLL_INTERVAL_MS = 30000;

// Store per-repo state so each worktree maintains its own state
const operationProgressMap = new Map<string, OperationProgress>();
const operationLoadingMap = new Map<string, boolean>();
const repoStateListeners = new Set<() => void>();

function notifyListeners() {
  repoStateListeners.forEach((listener) => listener());
}

function getOperationProgress(repoPath: string | null): OperationProgress {
  if (!repoPath) return DEFAULT_OPERATION_PROGRESS;
  return operationProgressMap.get(repoPath) || DEFAULT_OPERATION_PROGRESS;
}

function setOperationProgressForRepo(repoPath: string, progress: OperationProgress) {
  operationProgressMap.set(repoPath, progress);
  notifyListeners();
}

function clearOperationProgressForRepo(repoPath: string) {
  operationProgressMap.delete(repoPath);
  notifyListeners();
}

function getOperationLoading(repoPath: string | null): boolean {
  if (!repoPath) return false;
  return operationLoadingMap.get(repoPath) || false;
}

function setOperationLoadingForRepo(repoPath: string, loading: boolean) {
  if (loading) {
    operationLoadingMap.set(repoPath, true);
  } else {
    operationLoadingMap.delete(repoPath);
  }
  notifyListeners();
}

// For testing: reset all per-repo state
export function resetOperationProgressState() {
  operationProgressMap.clear();
  operationLoadingMap.clear();
  notifyListeners();
}

interface UseSourceControlOptions {
  repoPath: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
}

interface UseSourceControlResult {
  // File statuses grouped by category
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];

  // Remote status
  aheadBehind: AheadBehindResult;
  currentBranch: string | null;
  remoteUrl: string | null;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  isOperationLoading: boolean;

  // Error state
  error: string | null;

  // Operations
  stageFiles: (files: string[]) => Promise<GitOperationResult>;
  stageAll: () => Promise<GitOperationResult>;
  unstageFiles: (files: string[]) => Promise<GitOperationResult>;
  unstageAll: () => Promise<GitOperationResult>;
  discardFiles: (tracked: string[], untracked: string[]) => Promise<GitOperationResult>;
  discardAll: () => Promise<GitOperationResult>;
  commit: (message: string) => Promise<CommitResult>;
  push: () => Promise<GitOperationResult>;
  pull: () => Promise<GitOperationResult>;
  addRemote: (name: string, url: string) => Promise<GitOperationResult>;

  // Manual refresh
  refresh: () => void;

  // Operation progress (for streaming output)
  operationProgress: OperationProgress;
  clearOperationProgress: () => void;
  cancelOperation: () => Promise<void>;

  // Hook manifest for tooltip display
  hookManifest: HookManifest | null;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;

const DEFAULT_AHEAD_BEHIND: AheadBehindResult = {
  ahead: 0,
  behind: 0,
  hasRemote: false,
};

const DEFAULT_FILE_STATUS_RESULT: FileStatusResult = {
  staged: [],
  unstaged: [],
  untracked: [],
};

const DEFAULT_OPERATION_PROGRESS: OperationProgress = {
  status: 'idle',
  operationType: null,
  currentHook: null,
  output: [],
};

function areFileStatusesEqual(a: FileStatusResult, b: FileStatusResult): boolean {
  const compareFiles = (arr1: FileStatus[], arr2: FileStatus[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (
        arr1[i].path !== arr2[i].path ||
        arr1[i].type !== arr2[i].type ||
        arr1[i].additions !== arr2[i].additions ||
        arr1[i].deletions !== arr2[i].deletions ||
        arr1[i].oldPath !== arr2[i].oldPath
      ) {
        return false;
      }
    }
    return true;
  };

  return (
    compareFiles(a.staged, b.staged) &&
    compareFiles(a.unstaged, b.unstaged) &&
    compareFiles(a.untracked, b.untracked)
  );
}

function areAheadBehindEqual(a: AheadBehindResult, b: AheadBehindResult): boolean {
  return (
    a.ahead === b.ahead &&
    a.behind === b.behind &&
    a.hasRemote === b.hasRemote &&
    a.remoteBranch === b.remoteBranch
  );
}

export function useSourceControl({
  repoPath,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseSourceControlOptions): UseSourceControlResult {
  const [fileStatuses, setFileStatuses] = useState<FileStatusResult>(DEFAULT_FILE_STATUS_RESULT);
  const [aheadBehind, setAheadBehind] = useState<AheadBehindResult>(DEFAULT_AHEAD_BEHIND);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [hookManifest, setHookManifest] = useState<HookManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Subscribe to per-repo state changes
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const listener = () => forceUpdate({});
    repoStateListeners.add(listener);
    return () => {
      repoStateListeners.delete(listener);
    };
  }, []);

  // Get current operation progress for this repo
  const operationProgress = useMemo(
    () => getOperationProgress(repoPath),
    [repoPath, getOperationProgress(repoPath)] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Get current operation loading state for this repo
  const isOperationLoading = useMemo(
    () => getOperationLoading(repoPath),
    [repoPath, getOperationLoading(repoPath)] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const mountedRef = useRef(true);
  const previousFileStatusesRef = useRef<FileStatusResult>(DEFAULT_FILE_STATUS_RESULT);
  const previousAheadBehindRef = useRef<AheadBehindResult>(DEFAULT_AHEAD_BEHIND);
  const hasLoadedOnceRef = useRef(false);

  const fetchData = useCallback(
    async (options: { isInitialLoad?: boolean; isRefresh?: boolean } = {}) => {
      const { isInitialLoad = false, isRefresh = false } = options;
      if (!repoPath || !enabled) return;

      if (isInitialLoad) {
        setIsLoading(true);
      }
      if (isRefresh) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        // Fetch all data in parallel
        // Only fetch hook manifest on initial load (it doesn't change frequently)
        const promises: [
          Promise<FileStatusResult>,
          Promise<string | null>,
          Promise<AheadBehindResult>,
          Promise<string | null>,
          ...Promise<HookManifest>[],
        ] = [
          window.terminal.getFileStatuses(repoPath),
          window.terminal.getCurrentBranch(repoPath),
          window.terminal.getAheadBehind(repoPath),
          window.terminal.getRemoteUrl(repoPath),
        ];

        if (isInitialLoad) {
          promises.push(window.terminal.getHookManifest(repoPath));
        }

        const results = await Promise.all(promises);
        const [statusResult, branchResult, aheadBehindResult, remoteUrlResult] = results as [
          FileStatusResult,
          string | null,
          AheadBehindResult,
          string | null,
        ];
        const hookManifestResult = isInitialLoad ? (results[4] as HookManifest) : undefined;

        if (mountedRef.current) {
          // Only update file statuses if changed
          if (!areFileStatusesEqual(statusResult, previousFileStatusesRef.current)) {
            previousFileStatusesRef.current = statusResult;
            setFileStatuses(statusResult);
          }

          // Only update ahead/behind if changed
          if (!areAheadBehindEqual(aheadBehindResult, previousAheadBehindRef.current)) {
            previousAheadBehindRef.current = aheadBehindResult;
            setAheadBehind(aheadBehindResult);
          }

          setCurrentBranch(branchResult);
          setRemoteUrl(remoteUrlResult);

          if (hookManifestResult !== undefined) {
            setHookManifest(hookManifestResult);
          }
        }
      } catch (err) {
        console.error('[useSourceControl] Failed to fetch source control data:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch source control data');
        }
      } finally {
        if (mountedRef.current) {
          hasLoadedOnceRef.current = true;
          if (isInitialLoad) {
            setIsLoading(false);
          }
          if (isRefresh) {
            setIsRefreshing(false);
          }
        }
      }
    },
    [repoPath, enabled]
  );

  const refresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

  // Wrapper for operations that refreshes data after completion
  const withRefresh = useCallback(
    <T>(operation: () => Promise<T>, operationRepoPath: string) =>
      async (): Promise<T> => {
        setOperationLoadingForRepo(operationRepoPath, true);
        try {
          const result = await operation();
          // Refresh data after operation (no visual loading indicator)
          await fetchData();
          return result;
        } finally {
          setOperationLoadingForRepo(operationRepoPath, false);
        }
      },
    [fetchData]
  );

  // Stage operations
  const stageFiles = useCallback(
    async (files: string[]): Promise<GitOperationResult> => {
      if (!repoPath) return { success: false, error: 'No repository path' };
      return withRefresh(() => window.terminal.stageFiles(repoPath, files), repoPath)();
    },
    [repoPath, withRefresh]
  );

  const stageAll = useCallback(async (): Promise<GitOperationResult> => {
    if (!repoPath) return { success: false, error: 'No repository path' };
    return withRefresh(() => window.terminal.stageAll(repoPath), repoPath)();
  }, [repoPath, withRefresh]);

  // Unstage operations
  const unstageFiles = useCallback(
    async (files: string[]): Promise<GitOperationResult> => {
      if (!repoPath) return { success: false, error: 'No repository path' };
      return withRefresh(() => window.terminal.unstageFiles(repoPath, files), repoPath)();
    },
    [repoPath, withRefresh]
  );

  const unstageAll = useCallback(async (): Promise<GitOperationResult> => {
    if (!repoPath) return { success: false, error: 'No repository path' };
    return withRefresh(() => window.terminal.unstageAll(repoPath), repoPath)();
  }, [repoPath, withRefresh]);

  // Discard operations
  const discardFiles = useCallback(
    async (tracked: string[], untracked: string[]): Promise<GitOperationResult> => {
      if (!repoPath) return { success: false, error: 'No repository path' };
      return withRefresh(
        () => window.terminal.discardFiles(repoPath, tracked, untracked),
        repoPath
      )();
    },
    [repoPath, withRefresh]
  );

  const discardAll = useCallback(async (): Promise<GitOperationResult> => {
    if (!repoPath) return { success: false, error: 'No repository path' };
    return withRefresh(() => window.terminal.discardAll(repoPath), repoPath)();
  }, [repoPath, withRefresh]);

  // Clear operation progress for current repo
  const clearOperationProgress = useCallback(() => {
    if (repoPath) {
      clearOperationProgressForRepo(repoPath);
    }
  }, [repoPath]);

  // Cancel active operation for current repo
  const cancelOperation = useCallback(async () => {
    if (repoPath) {
      await window.terminal.abortOperation(repoPath);
      setOperationLoadingForRepo(repoPath, false);
      setOperationProgressForRepo(repoPath, {
        status: 'error',
        operationType: null,
        currentHook: null,
        output: [],
        error: 'Operation cancelled',
      });
    }
  }, [repoPath]);

  // Commit operation with streaming output for hooks support
  const commitChanges = useCallback(
    async (message: string): Promise<CommitResult> => {
      if (!repoPath) return { success: false, error: 'No repository path' };

      // Capture repoPath for use in callbacks (it won't change during this commit)
      const commitRepoPath = repoPath;

      setOperationLoadingForRepo(commitRepoPath, true);

      try {
        // Get hook manifest to check which hooks exist
        setOperationProgressForRepo(commitRepoPath, {
          status: 'checking-hooks',
          operationType: 'commit',
          currentHook: null,
          output: [],
        });
        const manifest = await window.terminal.getHookManifest(commitRepoPath);
        const hasAnyHooks =
          manifest['pre-commit'] || manifest['commit-msg'] || manifest['post-commit'];

        if (hasAnyHooks) {
          // Use streaming commit for repos with hooks
          setOperationProgressForRepo(commitRepoPath, {
            status: 'running-hook',
            operationType: 'commit',
            currentHook: null,
            output: [],
            hookManifest: manifest,
          });

          // Subscribe to output events, filtering by current repoPath
          const outputLines: string[] = [];
          const unsubscribe = window.terminal.onOperationOutput(
            (eventRepoPath, line, phase, hook) => {
              // Only process output for this repo
              if (eventRepoPath !== commitRepoPath) return;
              outputLines.push(line);
              const currentProgress =
                operationProgressMap.get(commitRepoPath) || DEFAULT_OPERATION_PROGRESS;
              setOperationProgressForRepo(commitRepoPath, {
                ...currentProgress,
                status: phase,
                currentHook: hook || null,
                output: [...outputLines],
              });
            }
          );

          try {
            const result = await window.terminal.commitWithHooks(commitRepoPath, message);

            // Unsubscribe immediately to prevent late IPC events from overwriting final status
            unsubscribe();

            if (result.success) {
              setOperationProgressForRepo(commitRepoPath, {
                status: 'success',
                operationType: 'commit',
                currentHook: null,
                output: result.output,
                hookManifest: manifest,
              });
            } else if (result.postHookFailed) {
              // Post-hook failed but commit succeeded
              setOperationProgressForRepo(commitRepoPath, {
                status: 'error',
                operationType: 'commit',
                currentHook: result.failedHook || null,
                output: result.output,
                error: result.error,
                hookManifest: manifest,
                operationSucceeded: true,
              });
            } else {
              setOperationProgressForRepo(commitRepoPath, {
                status: 'error',
                operationType: 'commit',
                currentHook: result.failedHook || null,
                output: result.output,
                error: result.error,
                hookManifest: manifest,
              });
            }

            // Refresh data after operation
            await fetchData();

            return {
              success: result.success || result.operationSucceeded === true,
              commitHash: result.commitHash,
              error: result.error,
            };
          } catch (err) {
            // Ensure unsubscribe on error
            unsubscribe();
            throw err;
          }
        } else {
          // No hooks - use simple commit (fast path)
          setOperationProgressForRepo(commitRepoPath, {
            status: 'executing',
            operationType: 'commit',
            currentHook: null,
            output: [],
          });

          const result = await window.terminal.commit(commitRepoPath, message);

          if (result.success) {
            // Success without hooks
            setOperationProgressForRepo(commitRepoPath, {
              status: 'success',
              operationType: 'commit',
              currentHook: null,
              output: [],
            });
          } else {
            // Error without hooks
            setOperationProgressForRepo(commitRepoPath, {
              status: 'error',
              operationType: 'commit',
              currentHook: null,
              output: [],
              error: result.error,
            });
          }

          // Refresh data after operation
          await fetchData();

          return result;
        }
      } finally {
        setOperationLoadingForRepo(commitRepoPath, false);
      }
    },
    [repoPath, fetchData]
  );

  // Push operation with hooks support
  const pushChanges = useCallback(async (): Promise<GitOperationResult> => {
    if (!repoPath) return { success: false, error: 'No repository path' };

    const pushRepoPath = repoPath;
    setOperationLoadingForRepo(pushRepoPath, true);

    try {
      // Get hook manifest to check which hooks exist
      setOperationProgressForRepo(pushRepoPath, {
        status: 'checking-hooks',
        operationType: 'push',
        currentHook: null,
        output: [],
      });
      const manifest = await window.terminal.getHookManifest(pushRepoPath);
      const hasAnyHooks = manifest['pre-push'] || manifest['post-push'];

      if (hasAnyHooks) {
        // Use streaming push for repos with hooks
        setOperationProgressForRepo(pushRepoPath, {
          status: 'running-hook',
          operationType: 'push',
          currentHook: null,
          output: [],
          hookManifest: manifest,
        });

        // Subscribe to output events
        const outputLines: string[] = [];
        const unsubscribe = window.terminal.onOperationOutput(
          (eventRepoPath, line, phase, hook) => {
            if (eventRepoPath !== pushRepoPath) return;
            outputLines.push(line);
            const currentProgress =
              operationProgressMap.get(pushRepoPath) || DEFAULT_OPERATION_PROGRESS;
            setOperationProgressForRepo(pushRepoPath, {
              ...currentProgress,
              status: phase,
              currentHook: hook || null,
              output: [...outputLines],
            });
          }
        );

        try {
          const result = await window.terminal.pushWithHooks(pushRepoPath);

          // Unsubscribe immediately to prevent late IPC events from overwriting final status
          unsubscribe();

          if (result.success) {
            setOperationProgressForRepo(pushRepoPath, {
              status: 'success',
              operationType: 'push',
              currentHook: null,
              output: result.output,
              hookManifest: manifest,
            });
          } else if (result.postHookFailed) {
            // Post-hook failed but push succeeded
            setOperationProgressForRepo(pushRepoPath, {
              status: 'error',
              operationType: 'push',
              currentHook: result.failedHook || null,
              output: result.output,
              error: result.error,
              hookManifest: manifest,
              operationSucceeded: true,
            });
          } else {
            setOperationProgressForRepo(pushRepoPath, {
              status: 'error',
              operationType: 'push',
              currentHook: result.failedHook || null,
              output: result.output,
              error: result.error,
              hookManifest: manifest,
            });
          }

          // Refresh data after operation
          await fetchData();

          return {
            success: result.success || result.operationSucceeded === true,
            error: result.error,
          };
        } catch (err) {
          // Ensure unsubscribe on error
          unsubscribe();
          throw err;
        }
      } else {
        // No hooks - use simple push (fast path)
        setOperationProgressForRepo(pushRepoPath, {
          status: 'executing',
          operationType: 'push',
          currentHook: null,
          output: [],
        });

        const result = await window.terminal.push(pushRepoPath);

        if (result.success) {
          setOperationProgressForRepo(pushRepoPath, {
            status: 'success',
            operationType: 'push',
            currentHook: null,
            output: [],
          });
        } else {
          setOperationProgressForRepo(pushRepoPath, {
            status: 'error',
            operationType: 'push',
            currentHook: null,
            output: [],
            error: result.error,
          });
        }

        // Refresh data after operation
        await fetchData();

        return result;
      }
    } finally {
      setOperationLoadingForRepo(pushRepoPath, false);
    }
  }, [repoPath, fetchData]);

  const pullChanges = useCallback(async (): Promise<GitOperationResult> => {
    if (!repoPath) return { success: false, error: 'No repository path' };
    return withRefresh(() => window.terminal.pull(repoPath), repoPath)();
  }, [repoPath, withRefresh]);

  // Add remote operation
  const addRemoteOperation = useCallback(
    async (name: string, url: string): Promise<GitOperationResult> => {
      if (!repoPath) return { success: false, error: 'No repository path' };
      return withRefresh(() => window.terminal.addRemote(repoPath, name, url), repoPath)();
    },
    [repoPath, withRefresh]
  );

  // Initial fetch and reset on dependency changes
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && repoPath) {
      const isInitial = !hasLoadedOnceRef.current;
      fetchData({ isInitialLoad: isInitial });
    } else {
      // Reset state when disabled or no repo path
      previousFileStatusesRef.current = DEFAULT_FILE_STATUS_RESULT;
      previousAheadBehindRef.current = DEFAULT_AHEAD_BEHIND;
      hasLoadedOnceRef.current = false;
      setFileStatuses(DEFAULT_FILE_STATUS_RESULT);
      setAheadBehind(DEFAULT_AHEAD_BEHIND);
      setCurrentBranch(null);
      setRemoteUrl(null);
      setHookManifest(null);
      setError(null);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [repoPath, enabled, fetchData]);

  // Check if path is being deleted (to skip polling during deletion)
  const isPathDeleting = useAppStore((state) => state.isPathDeleting);

  // Polling for changes
  useEffect(() => {
    if (!enabled || !repoPath || pollIntervalMs <= 0) return;

    let isFetching = false;
    let isCleanedUp = false;

    // Use longer polling interval when window is unfocused
    const effectivePollInterval = isFocused ? pollIntervalMs : BACKGROUND_POLL_INTERVAL_MS;

    const intervalId = setInterval(async () => {
      // Skip if already fetching (prevents process accumulation with slow operations like WSL)
      if (isFetching || isCleanedUp) return;
      // Skip polling if repository is being deleted
      if (!mountedRef.current || isPathDeleting(repoPath)) return;

      isFetching = true;
      try {
        await fetchData();
      } finally {
        isFetching = false;
      }
    }, effectivePollInterval);

    return () => {
      isCleanedUp = true;
      clearInterval(intervalId);
    };
  }, [enabled, repoPath, pollIntervalMs, fetchData, isPathDeleting, isFocused]);

  // Periodic fetch from remote to keep ahead/behind accurate
  useEffect(() => {
    if (!enabled || !repoPath || !aheadBehind.hasRemote) return;

    const FETCH_INTERVAL_MS = 5000;
    let isFetching = false;
    let isCleanedUp = false;

    const intervalId = setInterval(async () => {
      // Skip if already fetching, cleaned up, or path being deleted
      if (isFetching || isCleanedUp || !mountedRef.current || isPathDeleting(repoPath)) return;

      isFetching = true;
      try {
        await window.terminal.fetchBranches(repoPath);
        if (!isCleanedUp && mountedRef.current) {
          fetchData();
        }
      } catch (err) {
        // Log error but don't break UI - network issues are expected
        console.warn('[fetchBranches] Polling failed:', err);
      } finally {
        isFetching = false;
      }
    }, FETCH_INTERVAL_MS);

    return () => {
      isCleanedUp = true;
      clearInterval(intervalId);
    };
  }, [enabled, repoPath, aheadBehind.hasRemote, fetchData, isPathDeleting]);

  return {
    // File statuses
    staged: fileStatuses.staged,
    unstaged: fileStatuses.unstaged,
    untracked: fileStatuses.untracked,

    // Remote status
    aheadBehind,
    currentBranch,
    remoteUrl,

    // Loading states
    isLoading,
    isRefreshing,
    isOperationLoading,

    // Error
    error,

    // Operations
    stageFiles,
    stageAll,
    unstageFiles,
    unstageAll,
    discardFiles,
    discardAll,
    commit: commitChanges,
    push: pushChanges,
    pull: pullChanges,
    addRemote: addRemoteOperation,

    // Manual refresh
    refresh,

    // Operation progress
    operationProgress,
    clearOperationProgress,
    cancelOperation,

    // Hook manifest for tooltip display
    hookManifest,
  };
}
