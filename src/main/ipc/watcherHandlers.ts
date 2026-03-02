import type { IpcMain, BrowserWindow } from 'electron';
import { worktreeWatcher } from '../services/worktreeWatcher';

export function registerWatcherHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Worktree watcher handlers
  ipcMain.on('watcher:startRepositoryWatch', (_, repositoryId: string, repoPath: string) => {
    const win = getMainWindow();
    if (win) {
      worktreeWatcher.startWatching(repositoryId, repoPath, win);
    }
  });

  ipcMain.handle('watcher:stopRepositoryWatch', async (_, repositoryId: string) => {
    await worktreeWatcher.stopWatching(repositoryId);
  });
}

export function cleanupWatchers(): void {
  worktreeWatcher.stopAll();
}
