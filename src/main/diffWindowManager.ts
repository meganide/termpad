import { BrowserWindow, IpcMain } from 'electron';
import path from 'path';
import type { ReviewSession, ReviewData } from '../shared/reviewTypes';
import { getConstrainedWindowSize } from './utils/windowUtils';

declare const DIFF_WINDOW_VITE_DEV_SERVER_URL: string;
declare const DIFF_WINDOW_VITE_NAME: string;

interface DiffWindowInitData {
  currentReview: ReviewSession;
  reviewData: ReviewData;
  projectPath: string;
  selectedFile: string | null;
}

let diffWindow: BrowserWindow | null = null;
let pendingInitData: DiffWindowInitData | null = null;

export function createDiffWindow(
  getMainWindow: () => BrowserWindow | null,
  initData: DiffWindowInitData
): BrowserWindow {
  // If a diff window already exists, focus it and update its data
  if (diffWindow && !diffWindow.isDestroyed()) {
    if (diffWindow.isMinimized()) {
      diffWindow.restore();
    }
    diffWindow.show();
    diffWindow.focus();
    diffWindow.webContents.send('diff-window:review-data-update', initData.reviewData);
    return diffWindow;
  }

  const preloadPath = path.join(__dirname, 'preload.js');

  // Store the init data for when the window requests it
  pendingInitData = initData;

  // Get constrained window size (1400x900 preferred, max 90% of screen)
  const { width, height } = getConstrainedWindowSize(1400, 900);

  const isWindows = process.platform === 'win32';

  diffWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    center: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Diff Viewer',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    // Windows: frameless with custom controls
    // macOS/Linux: native title bar
    ...(isWindows ? { frame: false } : {}),
  });

  // Remove menu bar on Linux/Windows
  if (process.platform !== 'darwin') {
    diffWindow.setMenu(null);
  }

  // Show when ready
  diffWindow.once('ready-to-show', () => {
    diffWindow?.show();
  });

  // Send maximize state changes to renderer
  diffWindow.on('maximize', () => {
    diffWindow?.webContents.send('window-maximized-change', true);
  });

  diffWindow.on('unmaximize', () => {
    diffWindow?.webContents.send('window-maximized-change', false);
  });

  // Load the diff window
  if (DIFF_WINDOW_VITE_DEV_SERVER_URL) {
    // In development, load the diff window HTML directly
    const devUrl = DIFF_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/diff-window.html';
    diffWindow.loadURL(devUrl);
  } else {
    diffWindow.loadFile(
      path.join(__dirname, `../renderer/${DIFF_WINDOW_VITE_NAME}/diff-window.html`)
    );
  }

  // Clean up reference when closed
  diffWindow.on('closed', () => {
    diffWindow = null;
    pendingInitData = null;
  });

  return diffWindow;
}

export function getDiffWindow(): BrowserWindow | null {
  return diffWindow;
}

export function closeDiffWindow(): void {
  if (diffWindow && !diffWindow.isDestroyed()) {
    diffWindow.close();
    diffWindow = null;
  }
}

export function setupDiffWindowIpcHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  // Handler to open the diff window
  ipcMain.handle(
    'diff-window:open',
    async (_event, initData: DiffWindowInitData): Promise<{ success: boolean; error?: string }> => {
      try {
        createDiffWindow(getMainWindow, initData);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to open diff window';
        console.error('[DiffWindow] Error opening window:', message);
        return { success: false, error: message };
      }
    }
  );

  // Handler for diff window to get initial data
  ipcMain.handle('diff-window:get-initial-data', async (): Promise<DiffWindowInitData | null> => {
    return pendingInitData;
  });

  // Handler to close the diff window
  ipcMain.on('diff-window:close', () => {
    closeDiffWindow();
  });

  // Handler to notify main window of review data changes (from diff window)
  ipcMain.on('diff-window:review-data-changed', (_event, reviewData: ReviewData) => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('diff-window:review-data-update', reviewData);
    }
  });

  // Handler to send review data updates to diff window (from main window)
  ipcMain.on('diff-window:send-review-data-update', (_event, reviewData: ReviewData) => {
    if (diffWindow && !diffWindow.isDestroyed()) {
      diffWindow.webContents.send('diff-window:review-data-update', reviewData);
    }
  });
}
