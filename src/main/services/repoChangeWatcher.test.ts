import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';

const mocks = vi.hoisted(() => ({
  invalidateGitOpCache: vi.fn(),
  isWslPath: vi.fn(() => false),
  nativeWatch: vi.fn(),
  nativeWatchers: [] as Array<{
    handlers: Map<string, (...args: unknown[]) => void>;
    close: ReturnType<typeof vi.fn>;
    emitChange: (filename: string | Buffer | null) => void;
  }>,
  chokidarWatchers: [] as Array<{
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

vi.mock('fs', () => ({
  default: { watch: mocks.nativeWatch },
  watch: mocks.nativeWatch.mockImplementation(
    (
      _path: string,
      _options: unknown,
      callback: (_eventType: string, filename: string | Buffer | null) => void
    ) => {
      const handlers = new Map<string, (...args: unknown[]) => void>();
      const watcher = {
        handlers,
        close: vi.fn(),
        emitChange: (filename: string | Buffer | null) => callback('change', filename),
        on: vi.fn((event: string, eventCallback: (...args: unknown[]) => void) => {
          handlers.set(event, eventCallback);
          return watcher;
        }),
      };
      mocks.nativeWatchers.push(watcher);
      return watcher;
    }
  ),
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
    mocks.chokidarWatchers.push(watcher);
    return watcher;
  }),
}));

import { repoChangeWatcher } from './repoChangeWatcher';

describe('RepoChangeWatcherService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.nativeWatchers.length = 0;
    mocks.chokidarWatchers.length = 0;
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

    const treeWatcher = mocks.nativeWatchers[0];
    expect(treeWatcher).toBeDefined();
    treeWatcher.emitChange('file.txt');

    await vi.advanceTimersByTimeAsync(300);

    expect(mocks.invalidateGitOpCache).toHaveBeenCalledOnce();
    expect(mocks.invalidateGitOpCache).toHaveBeenCalledWith('/repo');
    expect(send).toHaveBeenCalledWith('watcher:repoChanged', '/repo');
    expect(mocks.invalidateGitOpCache.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0]
    );
  });

  it('uses the native recursive watcher without crawling the working tree', async () => {
    const sender = {
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    } as unknown as WebContents;

    repoChangeWatcher.watch('/large-repo', sender);
    await vi.waitFor(() => expect(mocks.chokidarWatchers).toHaveLength(1));

    expect(mocks.nativeWatch).toHaveBeenCalledWith(
      '/large-repo',
      { recursive: true, persistent: true },
      expect.any(Function)
    );
    expect(mocks.chokidarWatchers).toHaveLength(1);
  });

  it('ignores node_modules and git metadata events from the tree watcher', async () => {
    const send = vi.fn();
    const sender = {
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
      send,
    } as unknown as WebContents;

    repoChangeWatcher.watch('/repo', sender, 1000);
    const treeWatcher = mocks.nativeWatchers[0];
    treeWatcher.emitChange('node_modules/package/index.js');
    treeWatcher.emitChange('.git/index');

    await vi.advanceTimersByTimeAsync(1000);
    expect(send).not.toHaveBeenCalled();

    treeWatcher.emitChange('src/index.ts');
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledWith('watcher:repoChanged', '/repo');
  });

  it('closes watchers and falls back to polling after a watcher error', async () => {
    const send = vi.fn();
    const sender = {
      once: vi.fn(),
      isDestroyed: vi.fn(() => false),
      send,
    } as unknown as WebContents;

    repoChangeWatcher.watch('/repo', sender);
    await vi.waitFor(() => expect(mocks.chokidarWatchers).toHaveLength(1));

    const nativeWatcher = mocks.nativeWatchers[0];
    const metadataWatcher = mocks.chokidarWatchers[0];
    nativeWatcher.handlers.get('error')?.(new Error('watch failed'));

    expect(nativeWatcher.close).toHaveBeenCalledOnce();
    expect(metadataWatcher.close).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(15000);
    expect(send).toHaveBeenCalledWith('watcher:repoChanged', '/repo');
  });
});
