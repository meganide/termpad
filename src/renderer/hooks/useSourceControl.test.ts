import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSourceControl, resetOperationProgressState } from './useSourceControl';
import { resetAllStores } from '../../../tests/utils';
import type { FileStatusResult, AheadBehindResult } from '../../shared/types';

describe('useSourceControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllStores();
    resetOperationProgressState();
    vi.clearAllMocks();
    // Mock document.hasFocus to return true so polling uses configured interval
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to flush promises without running more timers
  const flushPromises = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  describe('initial fetch', () => {
    it('fetches source control data immediately when mounted', async () => {
      const mockStatuses: FileStatusResult = {
        staged: [{ path: 'file1.ts', type: 'modified', additions: 5, deletions: 2 }],
        unstaged: [{ path: 'file2.ts', type: 'modified', additions: 3, deletions: 1 }],
        untracked: [{ path: 'file3.ts', type: 'added', additions: 0, deletions: 0 }],
      };
      const mockAheadBehind: AheadBehindResult = {
        ahead: 2,
        behind: 1,
        hasRemote: true,
        remoteBranch: 'origin/main',
      };

      vi.mocked(window.terminal.getFileStatuses).mockResolvedValueOnce(mockStatuses);
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValueOnce('feature-branch');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValueOnce(mockAheadBehind);
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValueOnce(
        'https://github.com/user/repo.git'
      );

      renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      expect(window.terminal.getFileStatuses).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getCurrentBranch).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getAheadBehind).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getRemoteUrl).toHaveBeenCalledWith('/test/repo');

      await flushPromises();
    });

    it('populates state with fetched data', async () => {
      const mockStatuses: FileStatusResult = {
        staged: [{ path: 'staged.ts', type: 'added', additions: 10, deletions: 0 }],
        unstaged: [{ path: 'unstaged.ts', type: 'modified', additions: 5, deletions: 3 }],
        untracked: [{ path: 'untracked.ts', type: 'added', additions: 0, deletions: 0 }],
      };
      const mockAheadBehind: AheadBehindResult = {
        ahead: 3,
        behind: 0,
        hasRemote: true,
        remoteBranch: 'origin/main',
      };

      vi.mocked(window.terminal.getFileStatuses).mockResolvedValueOnce(mockStatuses);
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValueOnce('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValueOnce(mockAheadBehind);
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValueOnce(
        'https://github.com/user/repo.git'
      );

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      expect(result.current.staged).toEqual(mockStatuses.staged);
      expect(result.current.unstaged).toEqual(mockStatuses.unstaged);
      expect(result.current.untracked).toEqual(mockStatuses.untracked);
      expect(result.current.aheadBehind).toEqual(mockAheadBehind);
      expect(result.current.currentBranch).toBe('main');
      expect(result.current.remoteUrl).toBe('https://github.com/user/repo.git');
    });

    it('sets isLoading to true during initial fetch', async () => {
      let resolveStatuses: ((value: FileStatusResult) => void) | undefined;
      vi.mocked(window.terminal.getFileStatuses).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStatuses = resolve;
          })
      );

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        if (resolveStatuses) {
          resolveStatuses({ staged: [], unstaged: [], untracked: [] });
        }
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('polling', () => {
    it('polls for changes at configured interval', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          pollIntervalMs: 1000,
        })
      );

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      // Advance by poll interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);

      // Advance again
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(3);
    });

    it('uses default poll interval of 2000ms', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      // Advance by less than default interval (2000ms)
      await act(async () => {
        vi.advanceTimersByTime(1800);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      // Advance past default interval
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('enabled option', () => {
    it('does not fetch when enabled is false', () => {
      renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          enabled: false,
        })
      );

      expect(window.terminal.getFileStatuses).not.toHaveBeenCalled();
    });

    it('starts fetching when enabled changes to true', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { rerender } = renderHook(
        ({ enabled }) =>
          useSourceControl({
            repoPath: '/test/repo',
            enabled,
          }),
        { initialProps: { enabled: false } }
      );

      expect(window.terminal.getFileStatuses).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);
    });

    it('stops polling when enabled changes to false', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { rerender } = renderHook(
        ({ enabled }) =>
          useSourceControl({
            repoPath: '/test/repo',
            enabled,
            pollIntervalMs: 1000,
          }),
        { initialProps: { enabled: true } }
      );

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });

      // Advance time - should not trigger more fetches
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);
    });
  });

  describe('operations - stage', () => {
    it('stageFiles calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.stageFiles).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      // Call stageFiles
      await act(async () => {
        const stageResult = await result.current.stageFiles(['file.ts']);
        expect(stageResult.success).toBe(true);
      });

      expect(window.terminal.stageFiles).toHaveBeenCalledWith('/test/repo', ['file.ts']);
      // Should have refreshed (initial + after operation)
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });

    it('stageAll calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.stageAll).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const stageResult = await result.current.stageAll();
        expect(stageResult.success).toBe(true);
      });

      expect(window.terminal.stageAll).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('operations - unstage', () => {
    it('unstageFiles calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.unstageFiles).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const unstageResult = await result.current.unstageFiles(['file.ts']);
        expect(unstageResult.success).toBe(true);
      });

      expect(window.terminal.unstageFiles).toHaveBeenCalledWith('/test/repo', ['file.ts']);
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });

    it('unstageAll calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.unstageAll).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const unstageResult = await result.current.unstageAll();
        expect(unstageResult.success).toBe(true);
      });

      expect(window.terminal.unstageAll).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('operations - discard', () => {
    it('discardFiles calls API with tracked and untracked arrays', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.discardFiles).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const discardResult = await result.current.discardFiles(['tracked.ts'], ['untracked.ts']);
        expect(discardResult.success).toBe(true);
      });

      expect(window.terminal.discardFiles).toHaveBeenCalledWith(
        '/test/repo',
        ['tracked.ts'],
        ['untracked.ts']
      );
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });

    it('discardAll calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.discardAll).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const discardResult = await result.current.discardAll();
        expect(discardResult.success).toBe(true);
      });

      expect(window.terminal.discardAll).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('operations - commit', () => {
    const noHooksManifest = {
      'pre-commit': false,
      'commit-msg': false,
      'post-commit': false,
      'pre-push': false,
      'post-push': false,
    };

    const withHooksManifest = {
      'pre-commit': true,
      'commit-msg': false,
      'post-commit': false,
      'pre-push': false,
      'post-push': false,
    };

    it('commit without hooks uses simple commit API', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.getHookManifest).mockResolvedValue(noHooksManifest);
      vi.mocked(window.terminal.commit).mockResolvedValue({
        success: true,
        commitHash: 'abc123',
      });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const commitResult = await result.current.commit('Test commit message');
        expect(commitResult.success).toBe(true);
        expect(commitResult.commitHash).toBe('abc123');
      });

      expect(window.terminal.getHookManifest).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.commit).toHaveBeenCalledWith('/test/repo', 'Test commit message');
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });

    it('commit with hooks uses streaming commit API', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.getHookManifest).mockResolvedValue(withHooksManifest);
      vi.mocked(window.terminal.commitWithHooks).mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        output: ['Running lint...', 'Lint passed'],
      });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const commitResult = await result.current.commit('Test commit message');
        expect(commitResult.success).toBe(true);
        expect(commitResult.commitHash).toBe('abc123');
      });

      expect(window.terminal.getHookManifest).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.commitWithHooks).toHaveBeenCalledWith(
        '/test/repo',
        'Test commit message'
      );
      expect(window.terminal.commit).not.toHaveBeenCalled();
    });

    it('commit progress updates through streaming commit', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.getHookManifest).mockResolvedValue(withHooksManifest);
      vi.mocked(window.terminal.commitWithHooks).mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        output: ['Running lint...', 'Lint passed'],
      });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      // Initial state
      expect(result.current.operationProgress.status).toBe('idle');

      await act(async () => {
        await result.current.commit('Test commit message');
      });

      // After successful commit
      expect(result.current.operationProgress.status).toBe('success');
      expect(result.current.operationProgress.output).toEqual(['Running lint...', 'Lint passed']);
    });

    it('commit progress shows error state on failure', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.getHookManifest).mockResolvedValue(withHooksManifest);
      vi.mocked(window.terminal.commitWithHooks).mockResolvedValue({
        success: false,
        error: 'Lint failed',
        output: ['Running lint...', 'Error: lint failed'],
      });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const commitResult = await result.current.commit('Test commit message');
        expect(commitResult.success).toBe(false);
        expect(commitResult.error).toBe('Lint failed');
      });

      expect(result.current.operationProgress.status).toBe('error');
      expect(result.current.operationProgress.error).toBe('Lint failed');
    });

    it('clearOperationProgress resets progress to idle', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.getHookManifest).mockResolvedValue(withHooksManifest);
      vi.mocked(window.terminal.commitWithHooks).mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        output: [],
      });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        await result.current.commit('Test commit message');
      });

      expect(result.current.operationProgress.status).toBe('success');

      act(() => {
        result.current.clearOperationProgress();
      });

      expect(result.current.operationProgress.status).toBe('idle');
      expect(result.current.operationProgress.output).toEqual([]);
    });
  });

  describe('operations - push/pull', () => {
    it('push calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 1,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue('https://github.com/user/repo.git');
      vi.mocked(window.terminal.push).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const pushResult = await result.current.push();
        expect(pushResult.success).toBe(true);
      });

      expect(window.terminal.push).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getAheadBehind).toHaveBeenCalledTimes(2);
    });

    it('pull calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 2,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue('https://github.com/user/repo.git');
      vi.mocked(window.terminal.pull).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const pullResult = await result.current.pull();
        expect(pullResult.success).toBe(true);
      });

      expect(window.terminal.pull).toHaveBeenCalledWith('/test/repo');
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('operations - addRemote', () => {
    it('addRemote calls API and refreshes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: false,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);
      vi.mocked(window.terminal.addRemote).mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      await act(async () => {
        const addResult = await result.current.addRemote(
          'origin',
          'https://github.com/user/repo.git'
        );
        expect(addResult.success).toBe(true);
      });

      expect(window.terminal.addRemote).toHaveBeenCalledWith(
        '/test/repo',
        'origin',
        'https://github.com/user/repo.git'
      );
      expect(window.terminal.getRemoteUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe('operations - no repo path', () => {
    it('operations return error when no repo path', async () => {
      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: null,
        })
      );

      await flushPromises();

      const stageResult = await result.current.stageFiles(['file.ts']);
      expect(stageResult.success).toBe(false);
      expect(stageResult.error).toBe('No repository path');

      const commitResult = await result.current.commit('message');
      expect(commitResult.success).toBe(false);
      expect(commitResult.error).toBe('No repository path');
    });
  });

  describe('isOperationLoading', () => {
    it('sets isOperationLoading during operations', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      let resolveStageAll: ((value: { success: boolean }) => void) | undefined;
      vi.mocked(window.terminal.stageAll).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStageAll = resolve;
          })
      );

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();
      expect(result.current.isOperationLoading).toBe(false);

      // Start operation
      let stageAllPromise: Promise<unknown>;
      act(() => {
        stageAllPromise = result.current.stageAll();
      });

      expect(result.current.isOperationLoading).toBe(true);

      // Complete operation
      await act(async () => {
        if (resolveStageAll) {
          resolveStageAll({ success: true });
        }
        await stageAllPromise!;
      });

      expect(result.current.isOperationLoading).toBe(false);
    });
  });

  describe('refresh', () => {
    it('manually refreshes data when refresh is called', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          pollIntervalMs: 0, // Disable polling
        })
      );

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      // Manually refresh
      act(() => {
        result.current.refresh();
      });

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('sets error state when fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getFileStatuses).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
        })
      );

      await flushPromises();

      expect(result.current.error).toBe('Network error');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useSourceControl] Failed to fetch source control data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('clears error on successful fetch', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getFileStatuses)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ staged: [], unstaged: [], untracked: [] });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          pollIntervalMs: 1000,
        })
      );

      await flushPromises();
      expect(result.current.error).toBe('Network error');

      // Advance to next poll
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      expect(result.current.error).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('clears interval on unmount', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [],
        unstaged: [],
        untracked: [],
      });
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { unmount } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          pollIntervalMs: 1000,
        })
      );

      await flushPromises();
      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      unmount();

      // Advance time after unmount - should not trigger more calls
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);
    });

    it('resets state when repo path changes to null', async () => {
      const mockStatuses: FileStatusResult = {
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      };

      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue(mockStatuses);
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 1,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue('https://github.com/user/repo.git');

      const { result, rerender } = renderHook(
        ({ repoPath }) =>
          useSourceControl({
            repoPath,
          }),
        { initialProps: { repoPath: '/test/repo' as string | null } }
      );

      await flushPromises();

      expect(result.current.staged.length).toBe(1);
      expect(result.current.currentBranch).toBe('main');

      // Change to null
      rerender({ repoPath: null });

      expect(result.current.staged).toEqual([]);
      expect(result.current.unstaged).toEqual([]);
      expect(result.current.untracked).toEqual([]);
      expect(result.current.currentBranch).toBeNull();
      expect(result.current.remoteUrl).toBeNull();
      expect(result.current.aheadBehind.hasRemote).toBe(false);
    });
  });

  describe('state comparison', () => {
    it('does not update state when file statuses are unchanged', async () => {
      const mockStatuses: FileStatusResult = {
        staged: [{ path: 'file.ts', type: 'modified', additions: 1, deletions: 0 }],
        unstaged: [],
        untracked: [],
      };

      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue(mockStatuses);
      vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('main');
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: true,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useSourceControl({
          repoPath: '/test/repo',
          pollIntervalMs: 1000,
        })
      );

      await flushPromises();

      // Get reference to staged array
      const initialStaged = result.current.staged;

      // Advance to next poll with same data
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      // Should be the same reference since data hasn't changed
      expect(result.current.staged).toBe(initialStaged);
    });
  });
});
