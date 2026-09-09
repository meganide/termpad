import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBrowserDevTools } from './browserDevTools';

const mocks = vi.hoisted(() => ({ create: vi.fn(), window: vi.fn() }));
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: mocks.window },
  WebContentsView: class {
    constructor(options: unknown) {
      return mocks.create(options);
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const host = Object.assign(new EventEmitter(), {
    ipc: { handle: vi.fn() },
    mainFrame: {},
    getZoomFactor: () => 1,
  });
  const source = Object.assign(new EventEmitter(), {
    isDestroyed: vi.fn().mockReturnValue(false),
    closeDevTools: vi.fn(),
    setDevToolsWebContents: vi.fn(),
    openDevTools: vi.fn(),
    inspectElement: vi.fn(),
  });
  const contents = Object.assign(new EventEmitter(), {
    setWindowOpenHandler: vi.fn(),
    isDestroyed: () => false,
    close: vi.fn(),
  });
  const view = { webContents: contents, setVisible: vi.fn(), setBounds: vi.fn() };
  const window = {
    isDestroyed: () => false,
    getContentSize: () => [1000, 800],
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
  };
  mocks.create.mockReturnValue(view);
  mocks.window.mockReturnValue(window);
  const pending = new Map([[42, { x: 20, y: 30 }]]);
  const manager = registerBrowserDevTools(
    host as unknown as WebContents,
    new Map([[42, source as unknown as WebContents]]),
    pending
  );
  const handler = (name: string) =>
    host.ipc.handle.mock.calls.find(([channel]) => channel === name)![1];
  const event = { senderFrame: host.mainFrame };
  const bounds = { x: 600, y: 100, width: 400, height: 600, visible: true };
  const open = (value = bounds) =>
    handler('browser:open-devtools')(event, 42, value) as Promise<void>;
  const close = () => handler('browser:close-devtools')(event, 42);
  return {
    host,
    source,
    contents,
    view,
    window,
    manager,
    pending,
    handler,
    event,
    bounds,
    open,
    close,
  };
}

describe('native browser DevTools', () => {
  it('attaches a native inspector, waits for it to load, resizes and hides without reloading', async () => {
    const { source, contents, view, window, pending, bounds, open, close } = setup();
    const ready = open();
    expect(window.contentView.addChildView).toHaveBeenCalledWith(view);
    expect(source.setDevToolsWebContents).toHaveBeenCalledWith(contents);
    expect(source.openDevTools).toHaveBeenCalledWith({ mode: 'detach', activate: false });
    expect(view.setBounds).toHaveBeenCalledWith({ x: 600, y: 100, width: 400, height: 600 });
    expect(view.setVisible).toHaveBeenLastCalledWith(true);
    source.emit('devtools-opened');
    await ready;
    expect(source.inspectElement).toHaveBeenCalledWith(20, 30);
    expect(pending.size).toBe(0);
    await open({ ...bounds, visible: false });
    expect(view.setVisible).toHaveBeenLastCalledWith(false);
    await open({ ...bounds, x: 800 });
    expect(view.setBounds).toHaveBeenLastCalledWith({ x: 800, y: 100, width: 200, height: 600 });
    expect(mocks.create).toHaveBeenCalledOnce();
    close();
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view);
    expect(contents.close).toHaveBeenCalledOnce();
  });

  it('rejects foreign frames, unknown pages and invalid bounds before creating views', () => {
    const { handler, event, bounds, open } = setup();
    const call = handler('browser:open-devtools');
    expect(() => call({ senderFrame: {} }, 42, bounds)).toThrow();
    expect(() => call(event, 99, bounds)).toThrow();
    expect(() => open({ ...bounds, width: NaN })).toThrow();
    expect(() => open({ ...bounds, height: -1 })).toThrow();
    open({ ...bounds, visible: false });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('reports startup failure and destroys the failed view rather than keeping a gray pane', async () => {
    const { open, contents, manager } = setup();
    const ready = open();
    const assertion = expect(ready).rejects.toThrow('could not finish loading');
    contents.emit('did-fail-load', {}, -2, 'failed', 'devtools://devtools/', true);
    await assertion;
    expect(manager.hasInspector(42)).toBe(false);
    expect(contents.close).toHaveBeenCalledOnce();
  });

  it('times out if the frontend never finishes loading', async () => {
    const { open, manager } = setup();
    const ready = open();
    const assertion = expect(ready).rejects.toThrow('could not finish loading');
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(manager.hasInspector(42)).toBe(false);
  });

  it('cleans up on page destruction and allows reopening after close', async () => {
    const { open, close, source, contents } = setup();
    let ready = open();
    source.emit('devtools-opened');
    await ready;
    close();
    ready = open();
    source.emit('devtools-opened');
    await ready;
    expect(mocks.create).toHaveBeenCalledTimes(2);
    source.isDestroyed.mockReturnValue(true);
    source.emit('destroyed');
    expect(contents.close).toHaveBeenCalledTimes(2);
  });
});
