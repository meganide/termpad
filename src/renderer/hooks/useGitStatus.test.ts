import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitStatus } from './useGitStatus';
import { useAppStore } from '../stores/appStore';
import { resetAllStores, createMockSettings } from '../../../tests/utils';
import type { GitStatus, TerminalState } from '../../shared/types';

describe('useGitStatus', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to set up a terminal in the store
  const setupTerminal = (sessionId: string, gitStatus?: GitStatus): void => {
    const terminals = new Map<string, TerminalState>();
    terminals.set(sessionId, {
      id: sessionId,
      status: 'idle',
      gitStatus,
      lastActivityTime: Date.now(),
      hasReceivedOutput: false,
    });
    useAppStore.setState({ terminals });
  };

  // Helper to flush promises
  const flushPromises = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  // Helper to capture the repo-changed callback registered by the hook
  const getRepoChangedCallback = (repoPath: string): (() => void) => {
    const calls = vi.mocked(window.watcher.onRepoChanged).mock.calls;
    const call = calls.find(([path]) => path === repoPath);
    if (!call) throw new Error(`No onRepoChanged subscription for ${repoPath}`);
    return call[1];
  };

  describe('initial fetch', () => {
    it('fetches git status immediately when mounted', async () => {
      const mockStatus: GitStatus = { branch: 'main', isDirty: false, additions: 0, deletions: 0 };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValueOnce(mockStatus);

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo');

      await flushPromises();
    });

    it('updates store with fetched git status', async () => {
      const mockStatus: GitStatus = {
        branch: 'feature-branch',
        isDirty: true,
        additions: 10,
        deletions: 2,
      };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValueOnce(mockStatus);

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      const state = useAppStore.getState();
      expect(state.terminals.get('session-1')?.gitStatus).toEqual(mockStatus);
    });

    it('does not update store if status is null', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValueOnce(null);

      setupTerminal('session-1', {
        branch: 'existing',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      const state = useAppStore.getState();
      // Should keep existing status
      expect(state.terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'existing',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });
  });

  describe('repo change subscription', () => {
    it('starts watching the repo path with the configured throttle', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 3000 }),
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      expect(window.watcher.watchRepoChanges).toHaveBeenCalledWith('/test/repo', 3000);
      expect(window.watcher.onRepoChanged).toHaveBeenCalledWith('/test/repo', expect.any(Function));
    });

    it('refetches git status when a repo change is signaled', async () => {
      const statuses: GitStatus[] = [
        { branch: 'main', isDirty: false, additions: 0, deletions: 0 },
        { branch: 'main', isDirty: true, additions: 5, deletions: 3 },
      ];
      let callCount = 0;
      vi.mocked(window.terminal.getGitStatus).mockImplementation(async () => {
        return statuses[callCount++] || statuses[statuses.length - 1];
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual(statuses[0]);

      // Simulate a change signal from the main-process watcher
      const onRepoChanged = getRepoChangedCallback('/test/repo');
      await act(async () => {
        onRepoChanged();
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual(statuses[1]);
    });

    it('queues one trailing refetch when a signal arrives during an in-flight fetch', async () => {
      let resolveFirst: ((value: GitStatus | null) => void) | undefined;
      vi.mocked(window.terminal.getGitStatus)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            })
        )
        .mockResolvedValue({ branch: 'main', isDirty: true, additions: 1, deletions: 0 });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      // Signal a change while the initial fetch is still pending
      const onRepoChanged = getRepoChangedCallback('/test/repo');
      await act(async () => {
        onRepoChanged();
      });
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      // Completing the first fetch triggers the queued trailing refetch
      await act(async () => {
        resolveFirst?.({ branch: 'main', isDirty: false, additions: 0, deletions: 0 });
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'main',
        isDirty: true,
        additions: 1,
        deletions: 0,
      });
    });

    it('does not update store when refetched data is unchanged (deep comparison)', async () => {
      const mockStatus: GitStatus = { branch: 'main', isDirty: false, additions: 0, deletions: 0 };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue(mockStatus);

      setupTerminal('session-1');

      const updateGitStatusSpy = vi.spyOn(useAppStore.getState(), 'updateGitStatus');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(updateGitStatusSpy).toHaveBeenCalledTimes(1);

      const onRepoChanged = getRepoChangedCallback('/test/repo');
      await act(async () => {
        onRepoChanged();
      });
      await flushPromises();

      // Should not call updateGitStatus again since data is unchanged
      expect(updateGitStatusSpy).toHaveBeenCalledTimes(1);

      updateGitStatusSpy.mockRestore();
    });

    it('refetches when the window regains focus', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('unsubscribes and unwatches on unmount', async () => {
      const unsubscribe = vi.fn();
      vi.mocked(window.watcher.onRepoChanged).mockReturnValue(unsubscribe);
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(window.watcher.unwatchRepoChanges).toHaveBeenCalledWith('/test/repo');
    });

    it('stops refetching on focus after unmount', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      unmount();

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
    });

    it('unwatches when enabled changes to false', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { rerender } = renderHook(
        ({ enabled }) =>
          useGitStatus({
            sessionId: 'session-1',
            path: '/test/repo',
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      rerender({ enabled: false });

      expect(window.watcher.unwatchRepoChanges).toHaveBeenCalledWith('/test/repo');

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('enabled option', () => {
    it('does not fetch or watch when enabled is false', () => {
      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
          enabled: false,
        })
      );

      expect(window.terminal.getGitStatus).not.toHaveBeenCalled();
      expect(window.watcher.watchRepoChanges).not.toHaveBeenCalled();
    });

    it('cleanup runs safely when enabled was false', () => {
      setupTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
          enabled: false,
        })
      );

      expect(() => unmount()).not.toThrow();
      expect(window.watcher.unwatchRepoChanges).not.toHaveBeenCalled();
    });

    it('starts fetching when enabled changes to true', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { rerender } = renderHook(
        ({ enabled }) =>
          useGitStatus({
            sessionId: 'session-1',
            path: '/test/repo',
            enabled,
          }),
        { initialProps: { enabled: false } }
      );

      expect(window.terminal.getGitStatus).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
      expect(window.watcher.watchRepoChanges).toHaveBeenCalledWith('/test/repo', 5000);
    });

    it('defaults enabled to true', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalled();
    });
  });

  describe('dependency changes', () => {
    it('resubscribes when sessionId changes', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      terminals.set('session-2', {
        id: 'session-2',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      useAppStore.setState({ terminals });

      const { rerender } = renderHook(
        ({ sessionId }) =>
          useGitStatus({
            sessionId,
            path: '/test/repo',
          }),
        { initialProps: { sessionId: 'session-1' } }
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      rerender({ sessionId: 'session-2' });

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
    });

    it('rewatches when path changes', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { rerender } = renderHook(
        ({ path }) =>
          useGitStatus({
            sessionId: 'session-1',
            path,
          }),
        { initialProps: { path: '/test/repo-1' } }
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo-1');
      expect(window.watcher.watchRepoChanges).toHaveBeenCalledWith('/test/repo-1', 5000);

      rerender({ path: '/test/repo-2' });

      await flushPromises();

      expect(window.watcher.unwatchRepoChanges).toHaveBeenCalledWith('/test/repo-1');
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo-2');
      expect(window.watcher.watchRepoChanges).toHaveBeenCalledWith('/test/repo-2', 5000);
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getGitStatus).mockRejectedValueOnce(new Error('Network error'));

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useGitStatus] Failed to fetch git status:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('recovers on the next change signal after a fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getGitStatus)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ branch: 'main', isDirty: false, additions: 0, deletions: 0 });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      // First call fails
      await flushPromises();
      expect(consoleSpy).toHaveBeenCalled();

      const onRepoChanged = getRepoChangedCallback('/test/repo');
      await act(async () => {
        onRepoChanged();
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      consoleSpy.mockRestore();
    });

    it('does not throw when store update fails', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      // Terminal not in store - updateGitStatus will do nothing
      renderHook(() =>
        useGitStatus({
          sessionId: 'nonexistent-session',
          path: '/test/repo',
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalled();
    });
  });

  describe('return value', () => {
    it('returns git status from terminals map', async () => {
      const mockStatus: GitStatus = {
        branch: 'develop',
        isDirty: true,
        additions: 8,
        deletions: 1,
      };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue(mockStatus);
      setupTerminal('session-1', mockStatus);

      const { result } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      expect(result.current).toEqual(mockStatus);
    });

    it('creates terminal entry and returns git status even when terminal was not initially in map', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      const { result } = renderHook(() =>
        useGitStatus({
          sessionId: 'nonexistent',
          path: '/test/repo',
        })
      );

      await flushPromises();

      // updateGitStatus creates a terminal entry even if one doesn't exist
      expect(result.current).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });

    it('reflects latest status across change signals', async () => {
      vi.mocked(window.terminal.getGitStatus)
        .mockResolvedValueOnce({ branch: 'main', isDirty: false, additions: 0, deletions: 0 })
        .mockResolvedValueOnce({ branch: 'main', isDirty: true, additions: 5, deletions: 3 })
        .mockResolvedValueOnce({ branch: 'feature', isDirty: true, additions: 15, deletions: 4 });

      setupTerminal('session-1');

      const { result } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(result.current).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      const onRepoChanged = getRepoChangedCallback('/test/repo');

      await act(async () => {
        onRepoChanged();
      });
      await flushPromises();
      expect(result.current).toEqual({ branch: 'main', isDirty: true, additions: 5, deletions: 3 });

      await act(async () => {
        onRepoChanged();
      });
      await flushPromises();
      expect(result.current).toEqual({
        branch: 'feature',
        isDirty: true,
        additions: 15,
        deletions: 4,
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty path', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '',
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('');
    });

    it('handles rapid enable/disable toggling', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const { rerender } = renderHook(
        ({ enabled }) =>
          useGitStatus({
            sessionId: 'session-1',
            path: '/test/repo',
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      await flushPromises();

      rerender({ enabled: false });
      rerender({ enabled: true });
      rerender({ enabled: false });
      rerender({ enabled: true });

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalled();
      // Every watch has a matching unwatch except the final active one
      expect(vi.mocked(window.watcher.watchRepoChanges).mock.calls.length).toBe(
        vi.mocked(window.watcher.unwatchRepoChanges).mock.calls.length + 1
      );
    });

    it('handles unmount during pending fetch', async () => {
      let resolvePromise: ((value: GitStatus) => void) | undefined;
      vi.mocked(window.terminal.getGitStatus).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      setupTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      unmount();

      // Resolve the promise after unmount - should not throw
      await act(async () => {
        if (resolvePromise) {
          resolvePromise({ branch: 'main', isDirty: false, additions: 0, deletions: 0 });
        }
      });

      expect(window.terminal.getGitStatus).toHaveBeenCalled();
    });

    it('handles path with special characters', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      const specialPath = '/test/repo with spaces/and-dashes/and_underscores';

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: specialPath,
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledWith(specialPath);
      expect(window.watcher.watchRepoChanges).toHaveBeenCalledWith(specialPath, 5000);
    });

    it('handles multiple hooks watching different sessions', async () => {
      vi.mocked(window.terminal.getGitStatus)
        .mockResolvedValueOnce({ branch: 'main', isDirty: false, additions: 0, deletions: 0 })
        .mockResolvedValueOnce({ branch: 'feature', isDirty: true, additions: 15, deletions: 4 });

      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      terminals.set('session-2', {
        id: 'session-2',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      useAppStore.setState({ terminals });

      const { result: result1 } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo-1',
        })
      );

      const { result: result2 } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-2',
          path: '/test/repo-2',
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo-1');
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo-2');

      expect(result1.current).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
      expect(result2.current).toEqual({
        branch: 'feature',
        isDirty: true,
        additions: 15,
        deletions: 4,
      });
    });
  });
});
