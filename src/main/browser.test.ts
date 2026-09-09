import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { configureBrowserGuests } from './browser';
import { BROWSER_PARTITION } from '../shared/browser';
import { showBrowserContextMenu } from './browserContextMenu';
import { registerBrowserDevTools } from './browserDevTools';
const devTools = vi.hoisted(() => ({ hasInspector: vi.fn().mockReturnValue(false) }));
vi.mock('./browserDevTools', () => ({ registerBrowserDevTools: vi.fn(() => devTools) }));

vi.mock('./browserContextMenu', () => ({ showBrowserContextMenu: vi.fn() }));

const createHost = () =>
  Object.assign(new EventEmitter(), {
    ipc: { handle: vi.fn() },
    mainFrame: {},
    send: vi.fn(),
    isDestroyed: () => false,
  });

const createGuest = (id: number, url: string) =>
  Object.assign(new EventEmitter(), {
    id,
    getURL: () => url,
    isDestroyed: () => false,
    closeDevTools: vi.fn(),
    setDevToolsWebContents: vi.fn(),
    openDevTools: vi.fn(),
    inspectElement: vi.fn(),
    isDevToolsOpened: vi.fn().mockReturnValue(false),
    setWindowOpenHandler: vi.fn(),
    session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
  });

describe('browser guest isolation', () => {
  it('routes Inspect Element to the pane and reuses an existing native inspector', () => {
    const host = createHost();
    const source = createGuest(42, 'https://example.com');
    devTools.hasInspector.mockReturnValue(false);
    configureBrowserGuests(host as unknown as WebContents);
    host.emit('did-attach-webview', {}, source);
    source.emit('context-menu', {}, { x: 120, y: 80 });
    vi.mocked(showBrowserContextMenu).mock.calls.at(-1)![3]();
    expect(host.send).toHaveBeenCalledWith('browser:inspect-element', 42);
    const pending = vi.mocked(registerBrowserDevTools).mock.calls.at(-1)![2];
    expect(pending.get(42)).toEqual({ x: 120, y: 80 });
    devTools.hasInspector.mockReturnValue(true);
    source.emit('context-menu', {}, { x: 30, y: 50 });
    vi.mocked(showBrowserContextMenu).mock.calls.at(-1)![3]();
    expect(source.inspectElement).toHaveBeenLastCalledWith(30, 50);
    expect(host.send).toHaveBeenCalledOnce();
  });

  it('rejects local files and unexpected sessions, and removes app privileges', () => {
    const host = createHost();
    configureBrowserGuests(host as unknown as WebContents);
    const event = { preventDefault: vi.fn() };
    const preferences: Electron.WebPreferences = {
      preload: '/app/preload.js',
      nodeIntegration: true,
    };
    host.emit('will-attach-webview', event, preferences, {
      partition: BROWSER_PARTITION,
      src: 'https://example.com',
    });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(preferences.preload).toBeUndefined();
    expect(preferences).toMatchObject({
      nodeIntegration: false,
      sandbox: true,
      contextIsolation: true,
      webSecurity: true,
      webviewTag: false,
    });
    host.emit(
      'will-attach-webview',
      event,
      {},
      { partition: BROWSER_PARTITION, src: 'file:///etc/passwd' }
    );
    host.emit('will-attach-webview', event, {}, { partition: '', src: 'https://example.com' });
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
  });

  it('routes web popups to the host and blocks navigation to privileged URLs', () => {
    const host = createHost();
    const guest = Object.assign(new EventEmitter(), {
      id: 42,
      setWindowOpenHandler: vi.fn(),
      session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() },
    });
    configureBrowserGuests(host as unknown as WebContents);
    host.emit('did-attach-webview', {}, guest);
    const popup = guest.setWindowOpenHandler.mock.calls[0][0];
    expect(popup({ url: 'https://example.com' })).toEqual({ action: 'deny' });
    expect(host.send).toHaveBeenCalledWith('browser:new-tab', 42, 'https://example.com');
    popup({ url: 'file:///etc/passwd' });
    expect(host.send).toHaveBeenCalledOnce();
    const event = { preventDefault: vi.fn() };
    guest.emit('will-navigate', event, 'https://example.com');
    expect(event.preventDefault).not.toHaveBeenCalled();
    guest.emit('will-navigate', event, 'file:///etc/passwd');
    guest.emit('will-redirect', event, 'javascript:alert(1)');
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
  });
});
