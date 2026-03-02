import { Notification, BrowserWindow, IpcMain, app } from 'electron';
import type { TerminalStatus } from '../../shared/types';

const isWindows = process.platform === 'win32';

interface NotificationPayload {
  worktreeSessionId: string;
  repositoryName: string;
  branchName?: string;
  state: TerminalStatus;
  tabId?: string;
}

// Track last notification time per worktree session for cooldown
const lastNotificationTime = new Map<string, number>();

// Keep notification references to prevent garbage collection (for non-Windows)
const activeNotifications = new Set<Notification>();

// Default cooldown - can be overridden by settings from renderer
let cooldownMs = 8000;

// Custom protocol for notification clicks (Windows)
const PROTOCOL = 'termpad';

function getNotificationTitle(state: TerminalStatus): string {
  switch (state) {
    case 'waiting':
      return 'Awaiting Input';
    case 'error':
      return 'Error Occurred';
    case 'idle':
      return 'Task Complete';
    default:
      return 'Terminal Status Changed';
  }
}

function getNotificationBody(
  repositoryName: string,
  branchName?: string,
  state?: TerminalStatus
): string {
  const location = branchName ? `${branchName} (${repositoryName})` : repositoryName;
  switch (state) {
    case 'waiting':
      return `${location} is waiting for your input`;
    case 'error':
      return `${location} encountered an error`;
    case 'idle':
      return `${location} has finished`;
    default:
      return location;
  }
}

// Helper to focus window and switch to session
function focusAndSwitchSession(
  getMainWindow: () => BrowserWindow | null,
  worktreeSessionId: string,
  tabId?: string
): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  // Windows: setAlwaysOnTop is required to bring window to foreground
  if (isWindows) {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
  }

  app.focus({ steal: true });

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();

  const sendIPC = () => {
    mainWindow.webContents.send('notification:switch-worktree-session', worktreeSessionId, tabId);
  };

  if (isWindows) {
    setTimeout(sendIPC, 100);
  } else {
    sendIPC();
  }
}

// Escape special XML characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Windows notification using toastXml with protocol launch
function triggerWindowsNotification(
  title: string,
  body: string,
  worktreeSessionId: string,
  tabId: string | undefined,
  getMainWindow: () => BrowserWindow | null
): void {
  const params = new URLSearchParams({ session: worktreeSessionId });
  if (tabId) params.set('tab', tabId);
  const launchUrl = `${PROTOCOL}://notification?${params.toString()}`;

  const toastXml = `<toast launch="${escapeXml(launchUrl)}" activationType="protocol"><visual><binding template="ToastGeneric"><text>${escapeXml(title)}</text><text>${escapeXml(body)}</text></binding></visual></toast>`;

  try {
    const notification = new Notification({ toastXml });

    notification.on('failed', (_event, error) => {
      console.error('[Notification] Windows toast failed:', error);
      triggerFallbackNotification(title, body, worktreeSessionId, tabId, getMainWindow);
    });

    notification.show();
  } catch (err) {
    console.error('[Notification] Error creating toast:', err);
    triggerFallbackNotification(title, body, worktreeSessionId, tabId, getMainWindow);
  }
}

// Fallback notification for Windows when toastXml fails
function triggerFallbackNotification(
  title: string,
  body: string,
  worktreeSessionId: string,
  tabId: string | undefined,
  getMainWindow: () => BrowserWindow | null
): void {
  const notification = new Notification({ title, body, silent: true });

  notification.on('click', () => {
    focusAndSwitchSession(getMainWindow, worktreeSessionId, tabId);
  });

  notification.on('failed', (_event, error) => {
    console.error('[Notification] Fallback notification failed:', error);
  });

  notification.show();
}

// macOS/Linux notification using Electron's native API
function triggerElectronNotification(
  title: string,
  body: string,
  worktreeSessionId: string,
  tabId: string | undefined,
  getMainWindow: () => BrowserWindow | null
): void {
  const notification = new Notification({ title, body });

  notification.on('click', () => {
    activeNotifications.delete(notification);
    focusAndSwitchSession(getMainWindow, worktreeSessionId, tabId);
  });

  notification.on('failed', (_event, error) => {
    console.error('[Notification] Failed to show notification:', error);
    activeNotifications.delete(notification);
  });

  notification.on('close', () => {
    activeNotifications.delete(notification);
  });

  activeNotifications.add(notification);
  notification.show();
}

export function triggerNotification(
  payload: NotificationPayload,
  getMainWindow: () => BrowserWindow | null
): boolean {
  const { worktreeSessionId, repositoryName, branchName, state, tabId } = payload;

  // Check if notifications are supported on this platform (for non-Windows)
  if (!isWindows && !Notification.isSupported()) {
    return false;
  }

  // Check cooldown
  const now = Date.now();
  const lastTime = lastNotificationTime.get(worktreeSessionId);
  if (lastTime && now - lastTime < cooldownMs) {
    return false;
  }

  const title = getNotificationTitle(state);
  const body = getNotificationBody(repositoryName, branchName, state);

  if (isWindows) {
    triggerWindowsNotification(title, body, worktreeSessionId, tabId, getMainWindow);
  } else {
    triggerElectronNotification(title, body, worktreeSessionId, tabId, getMainWindow);
  }

  lastNotificationTime.set(worktreeSessionId, now);
  return true;
}

export function setupAdvancedNotificationHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('notification:trigger', (_, payload: NotificationPayload) => {
    return triggerNotification(payload, getMainWindow);
  });

  ipcMain.on('notification:setCooldown', (_, ms: number) => {
    cooldownMs = ms;
  });

  ipcMain.on(
    'notification:focusWorktreeSession',
    (_, worktreeSessionId: string, tabId?: string) => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        if (process.platform === 'win32') {
          mainWindow.setAlwaysOnTop(true);
          mainWindow.setAlwaysOnTop(false);
        }

        app.focus();

        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send(
          'notification:switch-worktree-session',
          worktreeSessionId,
          tabId
        );
      }
    }
  );
}
