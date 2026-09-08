import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalAPI } from '../shared/types';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<void>>(),
  exposed: new Map<string, unknown>(),
  send: vi.fn(),
}));
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => mocks.exposed.set(name, api),
  },
  ipcRenderer: {
    on: (name: string, callback: (...args: unknown[]) => Promise<void>) =>
      mocks.handlers.set(name, callback),
    send: mocks.send,
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
}));

beforeEach(async () => {
  vi.resetModules();
  mocks.handlers.clear();
  mocks.exposed.clear();
  mocks.send.mockClear();
  await import('./preload');
});

describe('terminal IPC acknowledgements', () => {
  it('waits for consumers and routes the original generation and frame', async () => {
    const terminal = mocks.exposed.get('terminal') as TerminalAPI;
    let resolve!: () => void;
    terminal.onData(
      'one',
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const unrelated = vi.fn();
    terminal.onData('two', unrelated);
    const frame = mocks.handlers.get('terminal:data')!(null, 'one', 'output', 42, 7);
    await Promise.resolve();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(unrelated).not.toHaveBeenCalled();
    resolve();
    await frame;
    expect(mocks.send).toHaveBeenCalledWith('terminal:ack', 'one', 42, 7);
  });

  it('releases output when consumers unsubscribe or reject', async () => {
    const terminal = mocks.exposed.get('terminal') as TerminalAPI;
    const unsubscribe = terminal.onData('one', async () => {
      throw Error('disposed');
    });
    await mocks.handlers.get('terminal:data')!(null, 'one', 'output', 1, 1);
    unsubscribe();
    await mocks.handlers.get('terminal:data')!(null, 'one', 'output', 1, 2);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
});
