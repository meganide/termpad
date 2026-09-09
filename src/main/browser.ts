import type { WebContents } from 'electron';
import { BROWSER_PARTITION, isBrowserUrl } from '../shared/browser';
import { showBrowserContextMenu } from './browserContextMenu';
import { registerBrowserDevTools } from './browserDevTools';

export function configureBrowserGuests(host: WebContents): void {
  const guests = new Map<number, WebContents>();
  const pendingInspections = new Map<number, { x: number; y: number }>();
  const { hasInspector } = registerBrowserDevTools(host, guests, pendingInspections);

  host.on('will-attach-webview', (event, preferences, params) => {
    if (params.partition !== BROWSER_PARTITION || !isBrowserUrl(params.src)) {
      event.preventDefault();
      return;
    }
    // Remote pages never inherit the application preload or its privileged APIs.
    delete preferences.preload;
    preferences.nodeIntegration = false;
    preferences.nodeIntegrationInSubFrames = false;
    preferences.nodeIntegrationInWorker = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    preferences.webSecurity = true;
    preferences.webviewTag = false;
  });

  host.on('did-attach-webview', (_event, guest) => {
    guests.set(guest.id, guest);
    guest.once('destroyed', () => {
      guests.delete(guest.id);
      pendingInspections.delete(guest.id);
    });
    guest.on('context-menu', (_event, params) => {
      // The inspector has its own context menus; only add ours to browser pages.
      if (!isBrowserUrl(guest.getURL())) return;
      showBrowserContextMenu(host, guest, params, () => {
        if (hasInspector(guest.id)) {
          guest.inspectElement(params.x, params.y);
        } else {
          pendingInspections.set(guest.id, { x: params.x, y: params.y });
          host.send('browser:inspect-element', guest.id);
        }
      });
    });
    guest.on('will-navigate', (event, url) => {
      if (!isBrowserUrl(url)) event.preventDefault();
    });
    guest.on('will-redirect', (event, url) => {
      if (!isBrowserUrl(url)) event.preventDefault();
    });
    guest.setWindowOpenHandler(({ url }) => {
      if (isBrowserUrl(url) && !host.isDestroyed()) host.send('browser:new-tab', guest.id, url);
      return { action: 'deny' };
    });
    guest.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    );
    guest.session.setPermissionCheckHandler(() => false);
  });
}
