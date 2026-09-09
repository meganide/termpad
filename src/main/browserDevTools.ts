import { BrowserWindow, WebContentsView } from 'electron';
import type { WebContents } from 'electron';
import type { BrowserDevToolsBounds } from '../shared/types';

export function registerBrowserDevTools(
  host: WebContents,
  guests: Map<number, WebContents>,
  pendingInspections: Map<number, { x: number; y: number }>
) {
  const inspectors = new Map<
    number,
    { view: WebContentsView; ready: Promise<void>; close: () => void }
  >();

  host.ipc.handle('browser:close-devtools', (event, sourceId: number) => {
    if (event.senderFrame !== host.mainFrame) throw new Error('Invalid browser host.');
    inspectors.get(sourceId)?.close();
  });
  host.once('destroyed', () => {
    for (const inspector of inspectors.values()) inspector.close();
  });

  host.ipc.handle(
    'browser:open-devtools',
    (event, sourceId: number, bounds: BrowserDevToolsBounds) => {
      const source = guests.get(sourceId);
      if (event.senderFrame !== host.mainFrame || !source || source.isDestroyed()) {
        throw new Error('Browser page is no longer available.');
      }
      if (
        !bounds ||
        typeof bounds.visible !== 'boolean' ||
        ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
        bounds.width < 0 ||
        bounds.height < 0
      )
        throw new Error('Invalid inspector bounds.');
      const window = BrowserWindow.fromWebContents(host);
      if (!window || window.isDestroyed())
        throw new Error('Browser window is no longer available.');

      let inspector = inspectors.get(sourceId);
      if (!inspector && !bounds.visible) return;
      if (!inspector) {
        // DevTools is a Chromium internal page. Host it in a native content view,
        // separate from the remote-page webview and its navigation restrictions.
        const view = new WebContentsView({
          webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
        });
        view.setVisible(false);
        window.contentView.addChildView(view);
        view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        let finished = false;
        let resolveReady!: () => void;
        let rejectReady!: (error: Error) => void;
        const ready = new Promise<void>((resolve, reject) => {
          resolveReady = resolve;
          rejectReady = reject;
        });
        const close = () => {
          if (inspectors.get(sourceId)?.view !== view) return;
          inspectors.delete(sourceId);
          clearTimeout(timeout);
          source.removeListener('devtools-opened', opened);
          source.removeListener('destroyed', close);
          view.webContents.removeListener('render-process-gone', failed);
          view.webContents.removeListener('did-fail-load', loadFailed);
          view.setVisible(false);
          if (!source.isDestroyed()) source.closeDevTools();
          if (!window.isDestroyed()) window.contentView.removeChildView(view);
          if (!view.webContents.isDestroyed()) view.webContents.close();
          if (!finished) {
            finished = true;
            rejectReady(new Error('DevTools closed before it loaded.'));
          }
        };
        const failed = () => {
          if (!finished) {
            finished = true;
            rejectReady(
              new Error('DevTools could not finish loading. Close the pane and try again.')
            );
          }
          close();
        };
        const loadFailed = (
          _event: Electron.Event,
          code: number,
          _description: string,
          _url: string,
          isMainFrame: boolean
        ) => {
          if (isMainFrame && code !== -3) failed();
        };
        const opened = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          const position = pendingInspections.get(sourceId);
          if (position) {
            pendingInspections.delete(sourceId);
            source.inspectElement(position.x, position.y);
          }
          resolveReady();
        };
        const timeout = setTimeout(failed, 15000);
        inspector = { view, ready, close };
        inspectors.set(sourceId, inspector);
        source.once('devtools-opened', opened);
        source.once('destroyed', close);
        view.webContents.on('render-process-gone', failed);
        view.webContents.on('did-fail-load', loadFailed);
        try {
          source.closeDevTools();
          source.setDevToolsWebContents(view.webContents);
          // The native view is already placed in our right-hand pane. Disabling
          // Chromium's own docking avoids it trying to create or rearrange a window.
          source.openDevTools({ mode: 'detach', activate: false });
        } catch {
          failed();
          return ready;
        }
      }
      const zoom = host.getZoomFactor();
      const [windowWidth, windowHeight] = window.getContentSize();
      const x = Math.max(0, Math.min(windowWidth, Math.round(bounds.x * zoom)));
      const y = Math.max(0, Math.min(windowHeight, Math.round(bounds.y * zoom)));
      const width = Math.max(0, Math.min(windowWidth - x, Math.round(bounds.width * zoom)));
      const height = Math.max(0, Math.min(windowHeight - y, Math.round(bounds.height * zoom)));
      inspector.view.setBounds({ x, y, width, height });
      inspector.view.setVisible(bounds.visible && width > 0 && height > 0);
      return inspector.ready;
    }
  );

  return { hasInspector: (sourceId: number) => inspectors.has(sourceId) };
}
