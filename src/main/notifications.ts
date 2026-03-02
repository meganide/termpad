import { Notification, BrowserWindow, IpcMain } from 'electron';

export function showNotification(title: string, body: string): void {
  const mainWindow = BrowserWindow.getAllWindows()[0];

  // Only show notification if window is not focused
  if (mainWindow && !mainWindow.isFocused()) {
    new Notification({
      title,
      body,
    }).show();
  }
}

export function setupNotificationIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.on(
    'app:showNotification',
    (_: unknown, title: string, body: string) => {
      showNotification(title, body);
    },
  );
}
