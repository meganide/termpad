import type { WebContents } from 'electron';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { isWslPath } from '../gitOperations';

// Batch rapid successive fs events (e.g. an editor "save all") into one signal
const BATCH_DELAY_MS = 300;
// Never signal more than once per throttle window per repo
const DEFAULT_THROTTLE_MS = 5000;
const MIN_THROTTLE_MS = 1000;
// WSL UNC paths can't be fs-watched reliably, so signal on a timer instead;
// also used when a watcher errors out
const FALLBACK_INTERVAL_MS = 15000;

interface WatchedRepo {
  repoPath: string;
  throttleMs: number;
  // WebContents -> subscription refcount (multiple hooks can watch one path)
  subscribers: Map<WebContents, number>;
  watchers: chokidar.FSWatcher[];
  fallbackTimer: NodeJS.Timeout | null;
  emitTimer: NodeJS.Timeout | null;
  lastEmitAt: number;
  disposed: boolean;
}

/**
 * Resolve the directory holding a repo's git metadata (HEAD, index, logs).
 * For worktrees `.git` is a file pointing at the real git dir.
 */
async function resolveGitDir(repoPath: string): Promise<string | null> {
  const gitPath = path.join(repoPath, '.git');
  try {
    const stat = await fs.stat(gitPath);
    if (stat.isDirectory()) return gitPath;
    if (stat.isFile()) {
      const content = await fs.readFile(gitPath, 'utf-8');
      const match = content.match(/^gitdir: (.+)$/m);
      if (match) return path.resolve(repoPath, match[1].trim());
    }
  } catch {
    // Not a git repo (yet); the tree watcher alone still signals changes
  }
  return null;
}

/**
 * Watches a repository's working tree and git metadata, and pushes a
 * throttled `watcher:repoChanged` signal to subscribed renderers when
 * something actually changed. Renderers refetch git data on that signal
 * instead of polling on timers.
 */
class RepoChangeWatcherService {
  private watched = new Map<string, WatchedRepo>();
  // Track senders that already have a global 'destroyed' cleanup listener
  // so we add at most one per WebContents regardless of how many repos it watches
  private senderCleanups = new WeakSet<WebContents>();

  watch(repoPath: string, sender: WebContents, throttleMs?: number): void {
    const existing = this.watched.get(repoPath);
    if (existing) {
      this.addSubscriber(existing, sender);
      return;
    }

    const entry: WatchedRepo = {
      repoPath,
      throttleMs: Math.max(MIN_THROTTLE_MS, throttleMs ?? DEFAULT_THROTTLE_MS),
      subscribers: new Map(),
      watchers: [],
      fallbackTimer: null,
      emitTimer: null,
      lastEmitAt: 0,
      disposed: false,
    };
    this.watched.set(repoPath, entry);
    this.addSubscriber(entry, sender);

    this.start(entry).catch((error) => {
      console.error(`[RepoChangeWatcher] Failed to start watching ${repoPath}:`, error);
      this.startFallbackTimer(entry);
    });
  }

  unwatch(repoPath: string, sender: WebContents): void {
    const entry = this.watched.get(repoPath);
    if (!entry) return;

    const count = entry.subscribers.get(sender);
    if (count === undefined) return;
    if (count > 1) {
      entry.subscribers.set(sender, count - 1);
      return;
    }
    entry.subscribers.delete(sender);
    if (entry.subscribers.size === 0) {
      this.dispose(entry);
    }
  }

  stopAll(): void {
    for (const entry of [...this.watched.values()]) {
      this.dispose(entry);
    }
  }

  private addSubscriber(entry: WatchedRepo, sender: WebContents): void {
    const count = entry.subscribers.get(sender) ?? 0;
    entry.subscribers.set(sender, count + 1);
    if (!this.senderCleanups.has(sender)) {
      this.senderCleanups.add(sender);
      sender.once('destroyed', () => {
        for (const watchedEntry of [...this.watched.values()]) {
          watchedEntry.subscribers.delete(sender);
          if (watchedEntry.subscribers.size === 0) {
            this.dispose(watchedEntry);
          }
        }
      });
    }
  }

  private async start(entry: WatchedRepo): Promise<void> {
    if (isWslPath(entry.repoPath)) {
      this.startFallbackTimer(entry);
      return;
    }

    const onChange = () => this.scheduleEmit(entry);
    const onError = (error: unknown) => {
      console.error(`[RepoChangeWatcher] Watcher error for ${entry.repoPath}:`, error);
      this.closeWatchers(entry);
      if (!entry.disposed) {
        this.startFallbackTimer(entry);
      }
    };

    const treeWatcher = chokidar.watch(entry.repoPath, {
      ignoreInitial: true,
      persistent: true,
      ignored: (watchedPath: string) => {
        const base = path.basename(watchedPath);
        return base === '.git' || base === 'node_modules';
      },
    });
    treeWatcher.on('all', onChange);
    treeWatcher.on('error', onError);
    entry.watchers.push(treeWatcher);

    const gitDir = await resolveGitDir(entry.repoPath);
    if (entry.disposed || !gitDir) return;

    // The tree watcher ignores .git, so watch the metadata files that change
    // on git operations: HEAD (branch switch), index (staging),
    // logs/HEAD (commit/reset/merge/rebase)
    const metaWatcher = chokidar.watch(
      [path.join(gitDir, 'HEAD'), path.join(gitDir, 'index'), path.join(gitDir, 'logs', 'HEAD')],
      { ignoreInitial: true, persistent: true }
    );
    metaWatcher.on('all', onChange);
    metaWatcher.on('error', onError);
    entry.watchers.push(metaWatcher);
  }

  private scheduleEmit(entry: WatchedRepo): void {
    if (entry.disposed || entry.emitTimer) return;
    const sinceLastEmit = Date.now() - entry.lastEmitAt;
    const delay = Math.max(BATCH_DELAY_MS, entry.throttleMs - sinceLastEmit);
    entry.emitTimer = setTimeout(() => {
      entry.emitTimer = null;
      entry.lastEmitAt = Date.now();
      this.emit(entry);
    }, delay);
  }

  private emit(entry: WatchedRepo): void {
    if (entry.disposed) return;
    for (const sender of entry.subscribers.keys()) {
      if (!sender.isDestroyed()) {
        sender.send('watcher:repoChanged', entry.repoPath);
      }
    }
  }

  private startFallbackTimer(entry: WatchedRepo): void {
    if (entry.disposed || entry.fallbackTimer) return;
    entry.fallbackTimer = setInterval(() => this.emit(entry), FALLBACK_INTERVAL_MS);
  }

  private closeWatchers(entry: WatchedRepo): void {
    for (const watcher of entry.watchers) {
      watcher.close().catch((error) => {
        console.error(`[RepoChangeWatcher] Error closing watcher for ${entry.repoPath}:`, error);
      });
    }
    entry.watchers = [];
  }

  private dispose(entry: WatchedRepo): void {
    if (entry.disposed) return;
    entry.disposed = true;
    if (entry.emitTimer) clearTimeout(entry.emitTimer);
    if (entry.fallbackTimer) clearInterval(entry.fallbackTimer);
    this.closeWatchers(entry);
    if (this.watched.get(entry.repoPath) === entry) {
      this.watched.delete(entry.repoPath);
    }
  }
}

export const repoChangeWatcher = new RepoChangeWatcherService();
