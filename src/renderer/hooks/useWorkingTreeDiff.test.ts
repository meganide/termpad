import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkingTreeDiff } from './useWorkingTreeDiff';
import { resetAllStores } from '../../../tests/utils';
import type { WorkingTreeStatsResult, DiffFileStat, DiffFile } from '../../shared/reviewTypes';

const createMockDiffFileStat = (path: string, additions = 10, deletions = 5): DiffFileStat => ({
  path,
  status: 'modified',
  additions,
  deletions,
  isBinary: false,
});

const createMockDiffFile = (path: string, additions = 10, deletions = 5): DiffFile => ({
  path,
  status: 'modified',
  additions,
  deletions,
  isBinary: false,
  hunks: [
    {
      oldStart: 1,
      oldLines: 5,
      newStart: 1,
      newLines: 7,
      header: '@@ -1,5 +1,7 @@',
      lines: [],
    },
  ],
});

const createMockStatsResult = (
  files: DiffFileStat[] = [],
  headCommit = 'abc1234'
): WorkingTreeStatsResult => ({
  files,
  headCommit,
  isDirty: files.length > 0,
});

// Helper to flush promises without running more timers
const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useWorkingTreeDiff', () => {
  beforeEach(() => {
    resetAllStores();
    // Reset mocks
    vi.mocked(window.terminal.getWorkingTreeStats).mockReset();
    vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockReset();

    // Re-establish default behavior
    vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue({
      files: [],
      headCommit: 'abc123',
      isDirty: false,
    });
    vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial fetch', () => {
    it('fetches stats when mounted with valid repoPath', async () => {
      const mockStats = [createMockDiffFileStat('src/index.ts')];
      const mockStatsResult = createMockStatsResult(mockStats);
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValueOnce(mockStatsResult);

      // Mock single file diff for auto-loading (small file)
      const mockDiffFile = createMockDiffFile('src/index.ts');
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValueOnce(mockDiffFile);

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      expect(result.current.isLoading).toBe(true);

      await flushPromises();

      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledWith('/test/repo');
      expect(result.current.files.length).toBe(1);
      expect(result.current.files[0].path).toBe('src/index.ts');
      expect(result.current.files[0].hunksLoaded).toBe(true);
      expect(result.current.headCommit).toBe('abc1234');
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('does not fetch when repoPath is null', async () => {
      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: null }));

      expect(window.terminal.getWorkingTreeStats).not.toHaveBeenCalled();
      expect(result.current.files).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('does not fetch when enabled is false', async () => {
      const { result } = renderHook(() =>
        useWorkingTreeDiff({ repoPath: '/test/repo', enabled: false })
      );

      expect(window.terminal.getWorkingTreeStats).not.toHaveBeenCalled();
      expect(result.current.files).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles error on fetch', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(window.terminal.getWorkingTreeStats).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      await flushPromises();

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
      consoleSpy.mockRestore();
    });

    it('auto-loads hunks for small files (<500 lines)', async () => {
      // Small file (10 + 5 = 15 lines, well under 500 threshold)
      const mockStats = [createMockDiffFileStat('src/small.ts', 10, 5)];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValueOnce(
        createMockStatsResult(mockStats)
      );

      const mockDiffFile = createMockDiffFile('src/small.ts', 10, 5);
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValueOnce(mockDiffFile);

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      await flushPromises();

      expect(window.terminal.getSingleWorkingTreeFileDiff).toHaveBeenCalledWith(
        '/test/repo',
        'src/small.ts'
      );
      expect(result.current.files[0].hunksLoaded).toBe(true);
      expect(result.current.files[0].hunks.length).toBeGreaterThan(0);
    });

    it('does not auto-load hunks for large files (>=500 lines)', async () => {
      // Large file (300 + 250 = 550 lines, over 500 threshold)
      const mockStats = [createMockDiffFileStat('src/large.ts', 300, 250)];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValueOnce(
        createMockStatsResult(mockStats)
      );

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      await flushPromises();

      // Should not call getSingleWorkingTreeFileDiff for large file
      expect(window.terminal.getSingleWorkingTreeFileDiff).not.toHaveBeenCalled();
      expect(result.current.files[0].hunksLoaded).toBe(false);
      expect(result.current.files[0].hunks).toEqual([]);
    });
  });

  describe('lazy loading', () => {
    it('loadFileHunks loads hunks for a specific file', async () => {
      // Large file that won't auto-load
      const mockStats = [createMockDiffFileStat('src/large.ts', 300, 250)];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValueOnce(
        createMockStatsResult(mockStats)
      );

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      await flushPromises();

      expect(result.current.files[0].hunksLoaded).toBe(false);

      // Now load hunks manually
      const mockDiffFile = createMockDiffFile('src/large.ts', 300, 250);
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValueOnce(mockDiffFile);

      await act(async () => {
        await result.current.loadFileHunks('src/large.ts');
      });

      expect(window.terminal.getSingleWorkingTreeFileDiff).toHaveBeenCalledWith(
        '/test/repo',
        'src/large.ts'
      );
      expect(result.current.files[0].hunksLoaded).toBe(true);
      expect(result.current.files[0].hunks.length).toBeGreaterThan(0);
    });
  });

  describe('refresh', () => {
    it('refresh re-fetches stats', async () => {
      const mockStats = [createMockDiffFileStat('src/index.ts')];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(
        createMockStatsResult(mockStats)
      );
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValue(
        createMockDiffFile('src/index.ts')
      );

      const { result } = renderHook(() => useWorkingTreeDiff({ repoPath: '/test/repo' }));

      await flushPromises();
      expect(result.current.files.length).toBe(1);

      const initialCallCount = vi.mocked(window.terminal.getWorkingTreeStats).mock.calls.length;

      await act(async () => {
        result.current.refresh();
      });

      await flushPromises();

      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  describe('polling', () => {
    it('polls for stats at regular intervals', async () => {
      vi.useFakeTimers();

      const mockStats = [createMockDiffFileStat('src/index.ts')];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(
        createMockStatsResult(mockStats)
      );
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValue(
        createMockDiffFile('src/index.ts')
      );

      renderHook(() =>
        useWorkingTreeDiff({
          repoPath: '/test/repo',
          pollIntervalMs: 5000,
        })
      );

      await flushPromises();

      const initialCallCount = vi.mocked(window.terminal.getWorkingTreeStats).mock.calls.length;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Advance time to trigger poll
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await flushPromises();

      // Should have made at least one more call
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('does not poll when disabled', async () => {
      vi.useFakeTimers();

      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(createMockStatsResult([]));

      renderHook(() =>
        useWorkingTreeDiff({
          repoPath: '/test/repo',
          enabled: false,
          pollIntervalMs: 5000,
        })
      );

      await flushPromises();

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(window.terminal.getWorkingTreeStats).not.toHaveBeenCalled();
    });

    it('does not poll when pollIntervalMs is 0', async () => {
      vi.useFakeTimers();

      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(createMockStatsResult([]));

      renderHook(() =>
        useWorkingTreeDiff({
          repoPath: '/test/repo',
          pollIntervalMs: 0,
        })
      );

      await flushPromises();

      const initialCallCount = vi.mocked(window.terminal.getWorkingTreeStats).mock.calls.length;

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      // Should not have made additional calls
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledTimes(initialCallCount);
    });

    it('stops polling on unmount', async () => {
      vi.useFakeTimers();

      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(
        createMockStatsResult([createMockDiffFileStat('src/index.ts')])
      );
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValue(
        createMockDiffFile('src/index.ts')
      );

      const { unmount } = renderHook(() =>
        useWorkingTreeDiff({
          repoPath: '/test/repo',
          pollIntervalMs: 5000,
        })
      );

      await flushPromises();

      const callCountAfterMount = vi.mocked(window.terminal.getWorkingTreeStats).mock.calls.length;

      unmount();

      // Advance time after unmount
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      // No additional calls after unmount
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledTimes(callCountAfterMount);
    });
  });

  describe('repoPath changes', () => {
    it('clears state and refetches when repoPath changes', async () => {
      const mockStats1 = [createMockDiffFileStat('src/file1.ts')];
      const mockStats2 = [createMockDiffFileStat('src/file2.ts')];

      vi.mocked(window.terminal.getWorkingTreeStats)
        .mockResolvedValueOnce(createMockStatsResult(mockStats1, 'commit1'))
        .mockResolvedValueOnce(createMockStatsResult(mockStats2, 'commit2'));
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff)
        .mockResolvedValueOnce(createMockDiffFile('src/file1.ts'))
        .mockResolvedValueOnce(createMockDiffFile('src/file2.ts'));

      const { result, rerender } = renderHook(({ repoPath }) => useWorkingTreeDiff({ repoPath }), {
        initialProps: { repoPath: '/test/repo1' },
      });

      await flushPromises();

      expect(result.current.files[0].path).toBe('src/file1.ts');
      expect(result.current.headCommit).toBe('commit1');

      // Change repoPath
      rerender({ repoPath: '/test/repo2' });

      await flushPromises();

      expect(result.current.files[0].path).toBe('src/file2.ts');
      expect(result.current.headCommit).toBe('commit2');
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledWith('/test/repo1');
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalledWith('/test/repo2');
    });
  });

  describe('enabled toggle', () => {
    it('refetches when enabled changes from false to true', async () => {
      const mockStats = [createMockDiffFileStat('src/index.ts')];
      vi.mocked(window.terminal.getWorkingTreeStats).mockResolvedValue(
        createMockStatsResult(mockStats)
      );
      vi.mocked(window.terminal.getSingleWorkingTreeFileDiff).mockResolvedValue(
        createMockDiffFile('src/index.ts')
      );

      const { result, rerender } = renderHook(
        ({ enabled }) => useWorkingTreeDiff({ repoPath: '/test/repo', enabled }),
        { initialProps: { enabled: false } }
      );

      expect(window.terminal.getWorkingTreeStats).not.toHaveBeenCalled();
      expect(result.current.files).toEqual([]);

      // Enable
      rerender({ enabled: true });

      await flushPromises();

      expect(result.current.files).toEqual(mockStats.map((s) => expect.objectContaining(s)));
      expect(window.terminal.getWorkingTreeStats).toHaveBeenCalled();
    });
  });
});
