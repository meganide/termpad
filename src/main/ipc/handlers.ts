import type { IpcMain, BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { app, shell, BrowserWindow as ElectronBrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import TerminalManager from '../terminalManager';
import { setupGitIpcHandlers } from '../gitOperations';
import { setupStorageIpcHandlers } from '../storage';
import { setupReviewStorageIpcHandlers } from '../reviewStorage';
import { setupNotificationIpcHandlers } from '../notifications';
import { setupAdvancedNotificationHandlers } from './notificationHandlers';
import { setupDialogIpcHandlers } from '../dialogs';
import { registerWatcherHandlers } from './watcherHandlers';
import { setupDiffWindowIpcHandlers } from '../diffWindowManager';
import { detectAvailableShells, validateShellPath } from '../services/shellDetector';
import { getShellEnv } from '../utils/shellEnv';
import {
  initAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getUpdateStatus,
  dismissUpdate,
} from '../autoUpdater';
import type { OpenEditorResult, OpenFolderResult, ShellInfo } from '../../shared/types';
import type { ShellValidationResult } from '../services/shellDetector';

const execAsync = promisify(exec);

let terminalManager: TerminalManager | null = null;
let closeCallback: (() => void) | null = null;

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  console.log('[IPC] Registering handlers...');

  // Create terminal manager
  terminalManager = new TerminalManager(getMainWindow);
  terminalManager.setupIpcHandlers(ipcMain);

  // Setup other IPC handlers
  setupGitIpcHandlers(ipcMain);
  setupStorageIpcHandlers(ipcMain);
  setupReviewStorageIpcHandlers(ipcMain);
  setupNotificationIpcHandlers(ipcMain);
  setupAdvancedNotificationHandlers(ipcMain, getMainWindow);
  setupDialogIpcHandlers(ipcMain);
  registerWatcherHandlers(ipcMain, getMainWindow);
  setupDiffWindowIpcHandlers(ipcMain, getMainWindow);

  // Window control handlers
  ipcMain.handle('ping', async () => {
    return 'Pong';
  });

  // Window control handlers - these target the sender's window, not just the main window
  // This allows diff viewer and other windows to control themselves
  ipcMain.on('window-minimize', (event: IpcMainEvent) => {
    console.log('[IPC] window-minimize received');
    const win = ElectronBrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event: IpcMainEvent) => {
    console.log('[IPC] window-maximize received');
    const win = ElectronBrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event: IpcMainEvent) => {
    console.log('[IPC] window-close received');
    const win = ElectronBrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.handle('window-is-maximized', (event: IpcMainInvokeEvent) => {
    const win = ElectronBrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.on('open-devtools', () => {
    const win = getMainWindow();
    if (win) win.webContents.openDevTools();
  });

  // Close confirmation handlers
  ipcMain.on('app:confirmClose', () => {
    if (closeCallback) {
      closeCallback();
      closeCallback = null;
    }
  });

  ipcMain.on('app:cancelClose', () => {
    closeCallback = null;
  });

  // Editor open handler
  ipcMain.handle(
    'editor:openPath',
    async (
      _event,
      filePath: string,
      editor: 'cursor' | 'vscode',
      workspacePath?: string
    ): Promise<OpenEditorResult> => {
      const command = editor === 'cursor' ? 'cursor' : 'code';
      // Use shell environment to ensure commands like 'cursor' and 'code' are found
      // (they may be in paths not available to packaged Electron apps)
      const env = getShellEnv();
      try {
        // If workspace path provided, open as new window with workspace and file
        // Otherwise just open the file
        if (workspacePath) {
          // Open workspace in new window, then goto the file
          await execAsync(`${command} --new-window "${workspacePath}" --goto "${filePath}"`, {
            env,
          });
        } else {
          await execAsync(`${command} "${filePath}"`, { env });
        }
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[IPC] Failed to open editor: ${message}`);
        return { success: false, error: message };
      }
    }
  );

  // Open external URL in system browser
  ipcMain.handle('shell:openExternal', async (_event, url: string): Promise<void> => {
    await shell.openExternal(url);
  });

  // Open folder in system file explorer (Windows Explorer, Finder, etc.)
  ipcMain.handle(
    'shell:openFolder',
    async (_event, folderPath: string): Promise<OpenFolderResult> => {
      try {
        const errorMessage = await shell.openPath(folderPath);
        if (errorMessage) {
          console.error(`[IPC] Failed to open folder: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[IPC] Failed to open folder: ${message}`);
        return { success: false, error: message };
      }
    }
  );

  // Shell detection and validation handlers
  ipcMain.handle('terminal:getAvailableShells', async (): Promise<ShellInfo[]> => {
    return detectAvailableShells();
  });

  ipcMain.handle(
    'terminal:validateShellPath',
    async (_event, shellPath: string): Promise<ShellValidationResult> => {
      return validateShellPath(shellPath);
    }
  );

  // Auto-updater handlers (only in packaged app)
  if (app.isPackaged) {
    initAutoUpdater(getMainWindow);

    ipcMain.handle('updater:checkForUpdates', async () => {
      return checkForUpdates();
    });

    ipcMain.handle('updater:downloadUpdate', async () => {
      return downloadUpdate();
    });

    ipcMain.handle('updater:installUpdate', () => {
      installUpdate();
    });

    ipcMain.handle('updater:getStatus', () => {
      return getUpdateStatus();
    });

    ipcMain.on('updater:dismissUpdate', () => {
      dismissUpdate();
    });
  }
}

export function getTerminalManager(): TerminalManager | null {
  return terminalManager;
}

export function setCloseCallback(callback: () => void): void {
  closeCallback = callback;
}

export function hasCloseCallback(): boolean {
  return closeCallback !== null;
}
