import { BrowserWindow } from 'electron';
import * as chokidar from 'chokidar';
import * as path from 'path';

const CONFIG_FILENAME = 'termpad.json';

interface ConfigWatcherEntry {
  repositoryId: string;
  repoPath: string;
  watcher: chokidar.FSWatcher;
  debounceTimeout: NodeJS.Timeout | null;
}

/**
 * Check if a path is a WSL UNC path (Windows accessing WSL filesystem).
 */
function isWslPath(filePath: string): boolean {
  if (process.platform !== 'win32') return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('//wsl$/') || normalized.startsWith('//wsl.localhost/');
}

class TermpadConfigWatcherService {
  private watchers = new Map<string, ConfigWatcherEntry>();
  private debounceMs = 1000;

  async startWatching(repositoryId: string, repoPath: string, win: BrowserWindow): Promise<void> {
    this.stopWatching(repositoryId);

    const configPath = path.join(repoPath, CONFIG_FILENAME);
    const usePolling = isWslPath(repoPath);

    const watcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      persistent: true,
      usePolling,
      interval: usePolling ? 1000 : undefined,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    const entry: ConfigWatcherEntry = {
      repositoryId,
      repoPath,
      watcher,
      debounceTimeout: null,
    };

    const handleChange = () => {
      if (entry.debounceTimeout) {
        clearTimeout(entry.debounceTimeout);
      }
      entry.debounceTimeout = setTimeout(() => {
        console.log(`[TermpadConfigWatcher] Config file changed for repository ${repositoryId}`);
        win.webContents.send('watcher:configChanged', repositoryId);
      }, this.debounceMs);
    };

    watcher.on('add', handleChange);
    watcher.on('change', handleChange);
    watcher.on('unlink', handleChange);
    watcher.on('error', (error) => {
      console.error(`[TermpadConfigWatcher] Watcher error for ${repoPath}:`, error);
    });

    this.watchers.set(repositoryId, entry);
  }

  async stopWatching(repositoryId: string): Promise<void> {
    const entry = this.watchers.get(repositoryId);
    if (entry) {
      if (entry.debounceTimeout) {
        clearTimeout(entry.debounceTimeout);
      }
      await entry.watcher.close();
      this.watchers.delete(repositoryId);
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

export const termpadConfigWatcher = new TermpadConfigWatcherService();
