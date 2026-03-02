import { BrowserWindow } from 'electron';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { listWorktrees } from '../gitOperations';
import type { WorktreeInfo } from '../../shared/types';

/**
 * Check if a path is a WSL UNC path (Windows accessing WSL filesystem).
 */
function isWslPath(filePath: string): boolean {
  if (process.platform !== 'win32') return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('//wsl$/') || normalized.startsWith('//wsl.localhost/');
}

/**
 * Join paths, handling WSL UNC paths correctly.
 */
function joinPath(basePath: string, ...segments: string[]): string {
  if (isWslPath(basePath)) {
    const normalized = basePath.replace(/\\/g, '/');
    const normalizedSegments = segments.map((s) => s.replace(/\\/g, '/'));
    const joined = [normalized, ...normalizedSegments].join('/');
    // Collapse multiple slashes but preserve the leading // for UNC paths
    const prefixMatch = joined.match(/^(\/\/wsl(?:\$|\.localhost))/i);
    let result: string;
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const rest = joined.substring(prefix.length).replace(/\/+/g, '/');
      result = prefix + rest;
    } else {
      result = joined.replace(/\/+/g, '/');
    }
    // Convert back to Windows UNC format with backslashes
    return result.replace(/\//g, '\\');
  }
  return path.join(basePath, ...segments);
}

/**
 * Resolve a path relative to a base, handling WSL UNC paths.
 * Handles both relative paths (../../foo) and absolute WSL-internal paths (/home/user/...).
 */
function resolvePath(basePath: string, ...segments: string[]): string {
  if (isWslPath(basePath)) {
    const normalized = basePath.replace(/\\/g, '/');
    const prefixMatch = normalized.match(/^(\/\/wsl(?:\$|\.localhost)\/[^/]+)/i);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    // Start with the path parts after the WSL prefix
    const baseParts = normalized
      .substring(prefix.length)
      .split('/')
      .filter((p) => p && p !== '.');

    let currentParts = [...baseParts];

    for (const segment of segments) {
      const normalizedSeg = segment.replace(/\\/g, '/');

      // Check if this segment is an absolute WSL-internal path (starts with /)
      // This happens when git writes absolute paths in .git files
      if (normalizedSeg.startsWith('/')) {
        // Reset to the absolute path (within the WSL prefix)
        currentParts = normalizedSeg.split('/').filter((p) => p && p !== '.');
        continue;
      }

      // Handle relative path segments
      const segParts = normalizedSeg.split('/').filter((p) => p && p !== '.');
      for (const part of segParts) {
        if (part === '..') {
          currentParts.pop();
        } else {
          currentParts.push(part);
        }
      }
    }

    // Convert back to Windows UNC format with backslashes
    const result = prefix + '/' + currentParts.join('/');
    return result.replace(/\//g, '\\');
  }
  return path.resolve(basePath, ...segments);
}

/**
 * Normalize a file path for comparison.
 * Converts backslashes to forward slashes, lowercases on Windows, and normalizes
 * WSL path formats (wsl$ -> wsl.localhost) for consistent comparison.
 */
function normalizePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  // Normalize WSL path formats (wsl$ -> wsl.localhost) for consistent comparison
  normalized = normalized.replace(/^\/\/wsl\$\//i, '//wsl.localhost/');
  return normalized;
}

interface WatcherEntry {
  repositoryId: string;
  repoPath: string;
  watcher: chokidar.FSWatcher;
  branchWatcher: chokidar.FSWatcher | null;
  repoExistenceWatcher: chokidar.FSWatcher | null;
  worktreeExistenceWatchers: Map<string, chokidar.FSWatcher>; // path -> watcher
  debounceTimeout: NodeJS.Timeout | null;
  branchDebounceTimeout: NodeJS.Timeout | null;
  lastWorktrees: Map<string, WorktreeInfo>;
}

class WorktreeWatcherService {
  private watchers = new Map<string, WatcherEntry>();
  private debounceMs = 1000;

  async startWatching(repositoryId: string, repoPath: string, win: BrowserWindow): Promise<void> {
    // Stop existing watcher if any
    this.stopWatching(repositoryId);

    const gitDir = joinPath(repoPath, '.git');

    try {
      const stat = await fs.stat(gitDir);
      let watchPath: string;
      let actualGitDir: string;

      if (stat.isDirectory()) {
        // Regular repo - watch .git/worktrees
        actualGitDir = gitDir;
        watchPath = joinPath(gitDir, 'worktrees');
      } else if (stat.isFile()) {
        // This is already a worktree - find main repo
        const content = await fs.readFile(gitDir, 'utf-8');
        const match = content.match(/gitdir: (.+)/);
        if (!match) return;

        actualGitDir = resolvePath(repoPath, match[1], '..', '..');
        watchPath = joinPath(actualGitDir, 'worktrees');
      } else {
        return;
      }

      // Ensure worktrees directory exists, if not create an empty watcher
      // chokidar will handle non-existent paths gracefully
      try {
        await fs.access(watchPath);
      } catch {
        // Worktrees directory doesn't exist yet - still set up watcher
        // It will detect when the directory is created
      }

      // Get initial worktree state (use normalized paths as keys for consistent comparison)
      const initialWorktrees = await listWorktrees(repoPath);
      const worktreeMap = new Map(initialWorktrees.map((w) => [normalizePath(w.path), w]));

      // Use polling for WSL paths since fs.watch() doesn't work reliably on WSL UNC paths
      const usePolling = isWslPath(repoPath);
      const watcher = chokidar.watch(watchPath, {
        ignoreInitial: true,
        depth: 1,
        persistent: true,
        usePolling,
        interval: usePolling ? 1000 : undefined,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      });

      watcher.on('error', (error) => {
        console.error(`[WorktreeWatcher] Main watcher error for ${repoPath}:`, error);
      });

      const entry: WatcherEntry = {
        repositoryId,
        repoPath,
        watcher,
        branchWatcher: null,
        repoExistenceWatcher: null,
        worktreeExistenceWatchers: new Map(),
        debounceTimeout: null,
        branchDebounceTimeout: null,
        lastWorktrees: worktreeMap,
      };

      // Helper to start watching a worktree directory for external deletion.
      // Note: Callers should filter out main worktrees before calling this function.
      const startWorktreeExistenceWatch = async (worktreePath: string) => {
        const normalizedPath = normalizePath(worktreePath);
        if (entry.worktreeExistenceWatchers.has(normalizedPath)) return;

        const parentDir = path.dirname(worktreePath);
        const worktreeBasename = path.basename(worktreePath);

        try {
          await fs.access(parentDir);
          // Use polling for WSL paths
          const usePollingForWorktree = isWslPath(worktreePath);
          const existenceWatcher = chokidar.watch(parentDir, {
            ignoreInitial: true,
            depth: 0,
            persistent: true,
            usePolling: usePollingForWorktree,
            interval: usePollingForWorktree ? 1000 : undefined,
          });

          entry.worktreeExistenceWatchers.set(normalizedPath, existenceWatcher);

          existenceWatcher.on('error', (error) => {
            console.error(`[WorktreeWatcher] Existence watcher error for ${worktreePath}:`, error);
            existenceWatcher.close().catch((err) => {
              console.error('[WorktreeWatcher] Error closing existence watcher:', err);
            });
            entry.worktreeExistenceWatchers.delete(normalizedPath);
          });

          existenceWatcher.on('unlinkDir', (deletedPath) => {
            const deletedBasename = path.basename(deletedPath);
            if (deletedBasename === worktreeBasename) {
              console.log(
                `[WorktreeWatcher] Worktree directory deleted externally: ${worktreePath}`
              );
              win.webContents.send('watcher:worktreeRemoved', repositoryId, worktreePath, true);

              // Clean up this watcher
              existenceWatcher.close().catch((err) => {
                console.error('[WorktreeWatcher] Error closing existence watcher:', err);
              });
              entry.worktreeExistenceWatchers.delete(normalizedPath);
              entry.lastWorktrees.delete(normalizedPath);
            }
          });
        } catch (error) {
          // Check for ENOENT specifically - other errors might be transient
          if (error instanceof Error && 'code' in error) {
            const fsError = error as NodeJS.ErrnoException;
            if (fsError.code === 'ENOENT') {
              console.log(
                `[WorktreeWatcher] Worktree parent directory doesn't exist: ${worktreePath}`
              );
              win.webContents.send('watcher:worktreeRemoved', repositoryId, worktreePath, true);
              entry.lastWorktrees.delete(normalizedPath);
              return;
            }
          }
          console.error(
            `[WorktreeWatcher] Unexpected error accessing worktree parent directory for ${worktreePath}:`,
            error
          );
        }
      };

      // Helper to stop watching a worktree directory
      const stopWorktreeExistenceWatch = async (normalizedPath: string) => {
        const existenceWatcher = entry.worktreeExistenceWatchers.get(normalizedPath);
        if (existenceWatcher) {
          await existenceWatcher.close();
          entry.worktreeExistenceWatchers.delete(normalizedPath);
        }
      };

      // Start watching existing non-main worktrees
      for (const [, wt] of worktreeMap) {
        if (!wt.isMain) {
          startWorktreeExistenceWatch(wt.path);
        }
      }

      const handleChange = () => {
        if (entry.debounceTimeout) {
          clearTimeout(entry.debounceTimeout);
        }

        entry.debounceTimeout = setTimeout(async () => {
          try {
            const currentWorktrees = await listWorktrees(repoPath);
            // Use normalized paths as keys for consistent comparison
            const currentMap = new Map(currentWorktrees.map((w) => [normalizePath(w.path), w]));

            // Find added worktrees
            for (const [normalizedPath, wt] of currentMap) {
              if (!entry.lastWorktrees.has(normalizedPath) && !wt.isMain) {
                win.webContents.send('watcher:worktreeAdded', repositoryId, wt);
                // Start watching for external deletion of this worktree
                startWorktreeExistenceWatch(wt.path);
              }
            }

            // Find removed worktrees
            for (const [normalizedPath, wt] of entry.lastWorktrees) {
              if (!currentMap.has(normalizedPath) && !wt.isMain) {
                win.webContents.send('watcher:worktreeRemoved', repositoryId, wt.path, false);
                // Stop watching this worktree
                stopWorktreeExistenceWatch(normalizedPath);
              }
            }

            entry.lastWorktrees = currentMap;
          } catch (error) {
            console.error('[WorktreeWatcher] Error handling worktree change:', error);
          }
        }, this.debounceMs);
      };

      watcher.on('add', handleChange);
      watcher.on('addDir', handleChange);
      watcher.on('unlink', handleChange);
      watcher.on('unlinkDir', handleChange);

      this.watchers.set(repositoryId, entry);

      // Watch for repository directory deletion
      // We watch the parent directory and listen for the repo folder being deleted
      const parentDir = path.dirname(repoPath);
      const repoBasename = path.basename(repoPath);

      try {
        await fs.access(parentDir);
        // Use polling for WSL paths
        const repoExistenceWatcher = chokidar.watch(parentDir, {
          ignoreInitial: true,
          depth: 0, // Only watch immediate children
          persistent: true,
          usePolling,
          interval: usePolling ? 1000 : undefined,
        });

        entry.repoExistenceWatcher = repoExistenceWatcher;

        repoExistenceWatcher.on('error', (error) => {
          console.error(
            `[WorktreeWatcher] Repository existence watcher error for ${repoPath}:`,
            error
          );
          repoExistenceWatcher.close().catch((err) => {
            console.error('[WorktreeWatcher] Error closing repository existence watcher:', err);
          });
          entry.repoExistenceWatcher = null;
        });

        repoExistenceWatcher.on('unlinkDir', (deletedPath) => {
          const deletedBasename = path.basename(deletedPath);
          if (deletedBasename === repoBasename) {
            console.log(`[WorktreeWatcher] Repository directory deleted externally: ${repoPath}`);
            win.webContents.send('watcher:repositoryDeleted', repositoryId, repoPath);
          }
        });
      } catch (error) {
        // Check for ENOENT specifically - other errors might be transient
        if (error instanceof Error && 'code' in error) {
          const fsError = error as NodeJS.ErrnoException;
          if (fsError.code === 'ENOENT') {
            console.log(
              `[WorktreeWatcher] Parent directory doesn't exist, repository may be deleted: ${repoPath}`
            );
            win.webContents.send('watcher:repositoryDeleted', repositoryId, repoPath);
          } else {
            console.error(
              `[WorktreeWatcher] Unexpected error accessing parent directory for ${repoPath}:`,
              error
            );
          }
        }
      }

      // Also watch for branch changes in refs/heads
      const refsHeadsPath = joinPath(actualGitDir, 'refs', 'heads');

      try {
        await fs.access(refsHeadsPath);
        // Use polling for WSL paths
        const branchWatcher = chokidar.watch(refsHeadsPath, {
          ignoreInitial: true,
          depth: 10, // Support nested branch names like feature/foo/bar
          persistent: true,
          usePolling,
          interval: usePolling ? 1000 : undefined,
        });

        entry.branchWatcher = branchWatcher;

        const handleBranchChange = () => {
          if (entry.branchDebounceTimeout) {
            clearTimeout(entry.branchDebounceTimeout);
          }

          entry.branchDebounceTimeout = setTimeout(() => {
            win.webContents.send('watcher:branchesChanged', repositoryId);
          }, this.debounceMs);
        };

        branchWatcher.on('error', (error) => {
          console.error(`[WorktreeWatcher] Branch watcher error for ${repoPath}:`, error);
          branchWatcher.close().catch((err) => {
            console.error('[WorktreeWatcher] Error closing branch watcher:', err);
          });
          entry.branchWatcher = null;
        });

        branchWatcher.on('add', handleBranchChange);
        branchWatcher.on('unlink', handleBranchChange);
        branchWatcher.on('change', handleBranchChange);
      } catch (error) {
        // refs/heads directory doesn't exist yet - this is normal for new repos
        if (error instanceof Error && 'code' in error) {
          const fsError = error as NodeJS.ErrnoException;
          if (fsError.code !== 'ENOENT') {
            console.error(
              `[WorktreeWatcher] Unexpected error accessing refs/heads for ${repoPath}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[WorktreeWatcher] Failed to start watcher for repository ${repositoryId}:`,
        error
      );
    }
  }

  async stopWatching(repositoryId: string): Promise<void> {
    const entry = this.watchers.get(repositoryId);
    if (entry) {
      if (entry.debounceTimeout) {
        clearTimeout(entry.debounceTimeout);
      }
      if (entry.branchDebounceTimeout) {
        clearTimeout(entry.branchDebounceTimeout);
      }
      // Close all watchers and wait for them to fully release file handles
      const closePromises: Promise<void>[] = [entry.watcher.close()];
      if (entry.branchWatcher) {
        closePromises.push(entry.branchWatcher.close());
      }
      if (entry.repoExistenceWatcher) {
        closePromises.push(entry.repoExistenceWatcher.close());
      }
      // Close all worktree existence watchers
      for (const existenceWatcher of entry.worktreeExistenceWatchers.values()) {
        closePromises.push(existenceWatcher.close());
      }
      entry.worktreeExistenceWatchers.clear();
      await Promise.all(closePromises);
      this.watchers.delete(repositoryId);

      // On Windows, add brief delay for chokidar to release file handles after close()
      if (process.platform === 'win32') {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    for (const repositoryId of this.watchers.keys()) {
      stopPromises.push(this.stopWatching(repositoryId));
    }
    await Promise.all(stopPromises);
  }
}

export const worktreeWatcher = new WorktreeWatcherService();
