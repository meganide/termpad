import type { IpcMain, BrowserWindow } from 'electron';
import { worktreeWatcher } from '../services/worktreeWatcher';
import { termpadConfigWatcher } from '../services/termpadConfigWatcher';
import { repoChangeWatcher } from '../services/repoChangeWatcher';

export function registerWatcherHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Worktree watcher handlers
  ipcMain.on('watcher:startRepositoryWatch', (_, repositoryId: string, repoPath: string) => {
    const win = getMainWindow();
    if (win) {
      worktreeWatcher.startWatching(repositoryId, repoPath, win);
      termpadConfigWatcher.startWatching(repositoryId, repoPath, win);
    }
  });

  ipcMain.handle('watcher:stopRepositoryWatch', async (_, repositoryId: string) => {
    await Promise.all([
      worktreeWatcher.stopWatching(repositoryId),
      termpadConfigWatcher.stopWatching(repositoryId),
    ]);
  });

  // Repo change signal: renderers subscribe per path and refetch git data
  // when the watcher signals a change, instead of polling on timers
  ipcMain.on('watcher:watchRepoChanges', (event, repoPath: string, throttleMs?: number) => {
    repoChangeWatcher.watch(repoPath, event.sender, throttleMs);
  });

  ipcMain.on('watcher:unwatchRepoChanges', (event, repoPath: string) => {
    repoChangeWatcher.unwatch(repoPath, event.sender);
  });
}

export function cleanupWatchers(): void {
  worktreeWatcher.stopAll();
  termpadConfigWatcher.stopAll();
  repoChangeWatcher.stopAll();
}
