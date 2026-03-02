import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGitStatus } from './useGitStatus';
import { useAppStore } from '../stores/appStore';
import { resetAllStores, createMockSettings } from '../../../tests/utils';
import type { GitStatus, TerminalState } from '../../shared/types';

describe('useGitStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAllStores();
    vi.clearAllMocks();
    // Mock document.hasFocus to return true so polling uses configured interval
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  // Helper to flush promises without running more timers
  const flushPromises = async () => {
    await act(async () => {
      await Promise.resolve();
    });
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

      // Should have called getGitStatus immediately
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo');

      // Flush the pending promise
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

      // Flush the initial async call
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

  describe('interval polling', () => {
    it('sets up polling interval with configured interval', async () => {
      const mockStatus: GitStatus = { branch: 'main', isDirty: false, additions: 0, deletions: 0 };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue(mockStatus);

      // Set custom poll interval
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

      // Initial call
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      // Advance by interval
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);

      // Advance again
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(3);
    });

    it('uses default poll interval from settings', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      setupTerminal('session-1');

      // Default interval is 5000ms from getDefaultAppState
      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      // Advance by less than default interval (5000ms)
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      // Advance past the interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
    });

    it('updates store on each interval poll', async () => {
      const statuses: GitStatus[] = [
        { branch: 'main', isDirty: false, additions: 0, deletions: 0 },
        { branch: 'main', isDirty: true, additions: 5, deletions: 3 },
        { branch: 'feature', isDirty: true, additions: 15, deletions: 4 },
      ];
      let callCount = 0;
      vi.mocked(window.terminal.getGitStatus).mockImplementation(async () => {
        return statuses[callCount++] || statuses[statuses.length - 1];
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      // After initial fetch
      await flushPromises();
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual(statuses[0]);

      // After first interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual(statuses[1]);

      // After second interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual(statuses[2]);
    });

    it('does not update store when polled data is unchanged (deep comparison)', async () => {
      const mockStatus: GitStatus = { branch: 'main', isDirty: false, additions: 0, deletions: 0 };
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue(mockStatus);

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
      });

      setupTerminal('session-1');

      const updateGitStatusSpy = vi.spyOn(useAppStore.getState(), 'updateGitStatus');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      // Initial fetch should update
      await flushPromises();
      expect(updateGitStatusSpy).toHaveBeenCalledTimes(1);

      // Advance to next poll with same data
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      // Should not call updateGitStatus again since data is unchanged
      expect(updateGitStatusSpy).toHaveBeenCalledTimes(1);

      updateGitStatusSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('clears interval on unmount', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
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

      // Advance time after unmount - should not trigger more calls
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
    });

    it('clears interval when enabled changes to false', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
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

      // Disable polling
      rerender({ enabled: false });

      // Advance time - should not trigger more calls
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('enabled option', () => {
    it('does not fetch when enabled is false', () => {
      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
          enabled: false,
        })
      );

      expect(window.terminal.getGitStatus).not.toHaveBeenCalled();
    });

    it('cleanup runs safely when no interval was set (enabled was false)', () => {
      setupTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
          enabled: false,
        })
      );

      // Unmount triggers cleanup - should not throw even though no interval was set
      expect(() => unmount()).not.toThrow();
      expect(window.terminal.getGitStatus).not.toHaveBeenCalled();
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

      // Enable polling
      rerender({ enabled: true });

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
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
    it('restarts polling when sessionId changes', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
      });

      // Set up both terminals
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

      // Change sessionId
      rerender({ sessionId: 'session-2' });

      await flushPromises();

      // Should have called again for new session
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);
    });

    it('restarts polling when path changes', async () => {
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

      // Change path
      rerender({ path: '/test/repo-2' });

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/repo-2');
    });

    it('restarts polling when poll interval changes', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 5000 }),
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

      // Change poll interval via store
      act(() => {
        useAppStore.getState().updateSettings({ gitPollIntervalMs: 1000 });
      });

      await flushPromises();

      // Effect should have restarted with new interval (initial call again)
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);

      // Advance by new interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(3);
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

    it('continues polling after fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getGitStatus)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ branch: 'main', isDirty: false, additions: 0, deletions: 0 });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
      });

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

      // Advance to next interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();

      // Second call should succeed
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

      // Should not throw
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

      // updateGitStatus now creates a terminal entry even if one doesn't exist
      expect(result.current).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });

    it('updates return value when store updates', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

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
    });

    it('reflects latest status after multiple polls', async () => {
      vi.mocked(window.terminal.getGitStatus)
        .mockResolvedValueOnce({ branch: 'main', isDirty: false, additions: 0, deletions: 0 })
        .mockResolvedValueOnce({ branch: 'main', isDirty: true, additions: 5, deletions: 3 })
        .mockResolvedValueOnce({ branch: 'feature', isDirty: true, additions: 15, deletions: 4 });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 1000 }),
      });

      setupTerminal('session-1');

      const { result } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      // After initial fetch
      await flushPromises();
      expect(result.current).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      // After first interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await flushPromises();
      expect(result.current).toEqual({ branch: 'main', isDirty: true, additions: 5, deletions: 3 });

      // After second interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
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

      // Each enable triggers a new fetch
      // The hook will clean up and restart on each toggle
      expect(window.terminal.getGitStatus).toHaveBeenCalled();
    });

    it('handles very short poll interval', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.setState({
        settings: createMockSettings({ gitPollIntervalMs: 100 }),
      });

      setupTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/repo',
        })
      );

      await flushPromises();

      // Advance through multiple intervals
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          vi.advanceTimersByTime(100);
        });
        await flushPromises();
      }

      // Should have called multiple times (1 initial + 5 intervals)
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(6);
    });

    it('handles unmount during pending fetch', async () => {
      // Create a promise that we can control
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

      // Unmount before the promise resolves
      unmount();

      // Resolve the promise after unmount - should not throw
      await act(async () => {
        if (resolvePromise) {
          resolvePromise({ branch: 'main', isDirty: false, additions: 0, deletions: 0 });
        }
      });

      // No assertions needed - just verifying no errors occur
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

      // Each hook should have its own status
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
