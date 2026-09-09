import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForTerminalStartup } from './terminalStartup';

describe('waitForTerminalStartup', () => {
  let output: (data: string) => void;
  let exit: (code: number) => void;
  let ready: () => void;
  const stopData = vi.fn();
  const stopExit = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(window.terminal.waitForReady).mockImplementation(
      () =>
        new Promise((resolve) => {
          ready = resolve;
        })
    );
    vi.mocked(window.terminal.onData).mockImplementation((_id, callback) => {
      output = callback;
      return stopData;
    });
    vi.mocked(window.terminal.onExit).mockImplementation((_id, callback) => {
      exit = callback;
      return stopExit;
    });
  });
  afterEach(() => vi.useRealTimers());

  it('waits for shell readiness and for preset output to settle, then removes listeners', async () => {
    const done = vi.fn();
    const pending = waitForTerminalStartup('new:tab', true).then(done);
    await vi.advanceTimersByTimeAsync(2000);
    expect(done).not.toHaveBeenCalled();
    ready();
    await vi.advanceTimersByTimeAsync(900);
    output('Starting agent');
    await vi.advanceTimersByTimeAsync(900);
    expect(done).not.toHaveBeenCalled();
    output('Prompt');
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(done).toHaveBeenCalledOnce();
    expect(stopData).toHaveBeenCalledOnce();
    expect(stopExit).toHaveBeenCalledOnce();
  });

  it('rejects when the terminal exits during startup', async () => {
    const pending = waitForTerminalStartup('new:tab', true);
    const assertion = expect(pending).rejects.toThrow('terminal closed');
    exit(1);
    ready();
    await vi.runAllTimersAsync();
    await assertion;
    expect(stopData).toHaveBeenCalledOnce();
  });

  it('times out when shell startup never completes', async () => {
    const pending = waitForTerminalStartup('new:tab', false);
    const assertion = expect(pending).rejects.toThrow('startup timed out');
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(stopExit).toHaveBeenCalledOnce();
  });
});
