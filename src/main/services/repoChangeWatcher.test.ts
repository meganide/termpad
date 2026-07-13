import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';

const mocks = vi.hoisted(() => ({
  invalidateGitOpCache: vi.fn(),
  isWslPath: vi.fn(() => false),
  watchers: [] as Array<{
    handlers: Map<string, (...args: unknown[]) => void>;
    close: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../gitOperations', () => ({
  invalidateGitOpCache: mocks.invalidateGitOpCache,
  isWslPath: mocks.isWslPath,
}));

vi.mock('fs/promises', () => ({
  stat: vi.fn(async () => ({
    isDirectory: () => true,
    isFile: () => false,
  })),
  readFile: vi.fn(),
}));

vi.mock('chokidar', () => ({
  watch: vi.fn(() => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const watcher = {
      handlers,
      close: vi.fn(async () => undefined),
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        handlers.set(event, callback);
        return watcher;
      }),
    };
    mocks.watchers.push(watcher);
    return watcher;
  }),
}));

import { repoChangeWatcher } from './repoChangeWatcher';

describe('RepoChangeWatcherService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.watchers.length = 0;
    repoChangeWatcher.stopAll();
  });

  afterEach(() => {
    repoChangeWatcher.stopAll();
    vi.useRealTimers();
  });

  it('invalidates cached git reads before notifying subscribers', async () => {
    const send = vi.fn();
    const sender = {
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
      send,
    } as unknown as WebContents;

    repoChangeWatcher.watch('/repo', sender, 5000);

    const treeWatcher = mocks.watchers[0];
    expect(treeWatcher).toBeDefined();
    treeWatcher.handlers.get('all')?.('change', '/repo/file.txt');

    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.invalidateGitOpCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateGitOpCache).toHaveBeenCalledWith('/repo');
    expect(send).toHaveBeenCalledWith('watcher:repoChanged', '/repo');
    expect(mocks.invalidateGitOpCache.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0]
    );
  });
});
