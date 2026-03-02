import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import type { UpdateStatus } from '../shared/types';

// Configure logging
autoUpdater.logger = console;

// Disable auto-download - we want to control when downloads happen
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Configure update source to match forge.config.ts publisher
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'meganide',
  repo: 'termpad',
});

// Auto-update is supported on Windows, macOS, and Linux AppImage.
// .deb/.rpm packages are managed by system package managers and can't be auto-updated.
function detectAutoUpdateSupport(): boolean {
  if (process.platform !== 'linux') return true;
  return !!process.env.APPIMAGE;
}

let mainWindowGetter: (() => BrowserWindow | null) | null = null;
let currentStatus: UpdateStatus = {
  status: 'idle',
  currentVersion: '',
  availableVersion: null,
  progress: null,
  error: null,
  supportsAutoUpdate: detectAutoUpdateSupport(),
};

function getMainWindow(): BrowserWindow | null {
  return mainWindowGetter?.() ?? null;
}

function sendStatusToRenderer() {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status-changed', currentStatus);
  }
}

function updateStatus(updates: Partial<UpdateStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  sendStatusToRenderer();
}

export function initAutoUpdater(windowGetter: () => BrowserWindow | null): void {
  mainWindowGetter = windowGetter;

  // Set current version
  currentStatus.currentVersion = autoUpdater.currentVersion.version;

  // Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update available:', info.version);
    updateStatus({
      status: 'available',
      availableVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  // No update available
  autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
    console.log('[AutoUpdater] No update available');
    updateStatus({
      status: 'idle',
      availableVersion: null,
    });
  });

  // Download progress
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    updateStatus({
      status: 'downloading',
      progress: {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      },
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    updateStatus({
      status: 'ready',
      progress: null,
    });
  });

  // Error
  autoUpdater.on('error', (error: Error) => {
    console.error('[AutoUpdater] Error:', error.message);
    updateStatus({
      status: 'error',
      error: error.message,
      progress: null,
    });
  });
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    updateStatus({ status: 'checking', error: null });
    await autoUpdater.checkForUpdates();
    return currentStatus;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus({ status: 'error', error: message });
    return currentStatus;
  }
}

export async function downloadUpdate(): Promise<void> {
  if (currentStatus.status !== 'available') {
    throw new Error('No update available to download');
  }
  updateStatus({
    status: 'downloading',
    progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
  });
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  if (currentStatus.status !== 'ready') {
    throw new Error('No update ready to install');
  }
  // This will quit the app and install the update
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function dismissUpdate(): void {
  updateStatus({
    status: 'idle',
    availableVersion: null,
    progress: null,
    error: null,
  });
}
