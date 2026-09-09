import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PerformanceMonitor,
  parseCpuTime,
  parseProcessSamples,
  registerPerformanceHandlers,
} from './performance';
import type { IpcMain, WebContents } from 'electron';

const mocks = vi.hoisted(() => ({ run: vi.fn(), metrics: vi.fn(), contents: vi.fn() }));
vi.mock('util', async (original) => ({
  ...(await original<typeof import('util')>()),
  default: { ...(await original<typeof import('util')>()), promisify: () => mocks.run },
  promisify: () => mocks.run,
}));
vi.mock('electron', () => ({
  app: { getAppMetrics: mocks.metrics },
  webContents: { getAllWebContents: mocks.contents },
}));
vi.mock('../utils/shellEnv', () => ({ getShellEnv: () => ({}) }));
const platform = process.platform;
const startedAt = 'Wed Sep 9 10:00:00 2026';
const line = (pid: number, ppid: number, cpu = '0:00.00', name = 'node', start = startedAt) =>
  `${pid} ${ppid} 1024 ${cpu} ${start} ${name}\n`;
const terminal = { id: 'session:tab', pid: 42420 };
let output: string;
let kill: ReturnType<typeof vi.spyOn>;
let monitor: PerformanceMonitor;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  kill = vi.spyOn(process, 'kill').mockReturnValue(true);
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  output =
    line(process.pid, 1) +
    line(42420, process.pid, '0:01.00', 'zsh') +
    line(42421, 42420) +
    line(42422, 1, '0:20.00', 'outside');
  mocks.run.mockReset().mockImplementation(async () => ({ stdout: output }));
  mocks.metrics.mockReturnValue([{ pid: process.pid, type: 'Browser' }]);
  mocks.contents.mockReturnValue([]);
  monitor = new PerformanceMonitor(
    () => [terminal],
    () => undefined
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process, 'platform', { value: platform });
});

describe('PerformanceMonitor', () => {
  it('parses Unix CPU time, start times, and executable paths with spaces', () => {
    expect(parseCpuTime('1-02:03:04.50')).toBe(93784.5);
    expect(
      parseProcessSamples(line(24, 2, '12:05.20', '/Applications/My App/node'))[0]
    ).toMatchObject({
      pid: 24,
      memoryBytes: 1048576,
      cpuSeconds: 725.2,
      name: '/Applications/My App/node',
      startedAt,
    });
    expect(parseProcessSamples('invalid')).toEqual([]);
  });
  it('only includes Termpad processes and attributes nested children to their terminal', async () => {
    const result = await monitor.list();
    expect(result.processes.map((entry) => entry.pid)).toEqual([process.pid, 42420, 42421]);
    expect(result.processes[1]).toMatchObject({ kind: 'terminal', terminalId: terminal.id });
    expect(result.processes[2]).toMatchObject({ kind: 'process', terminalId: terminal.id });
    expect(result.processes[0].canStop).toBe(false);
  });
  it('measures CPU between samples and starts fresh after long gaps or reused PIDs', async () => {
    expect((await monitor.list()).processes[2].cpuPercent).toBeNull();
    vi.mocked(Date.now).mockReturnValue(3000);
    output = output.replace(line(42421, 42420), line(42421, 42420, '0:01.00'));
    expect((await monitor.list()).processes[2].cpuPercent).toBe(50);
    vi.mocked(Date.now).mockReturnValue(30000);
    expect((await monitor.list()).processes[2].cpuPercent).toBeNull();
  });
  it('keeps observed detached children but drops reused PIDs belonging to outside processes', async () => {
    await monitor.list();
    output = line(42421, 1);
    expect((await monitor.list()).processes[0].terminalId).toBe(terminal.id);
    output = line(42421, 1, '0:00.00', 'outside', 'Wed Sep 9 11:00:00 2026');
    expect((await monitor.list()).processes).toEqual([]);
  });
  it('revalidates identity and rejects unrelated or protected processes before stopping', async () => {
    const snapshot = await monitor.list();
    await monitor.stop(snapshot.processes[2]);
    expect(kill).toHaveBeenCalledWith(42421, 'SIGTERM');
    await expect(monitor.stop(snapshot.processes[0])).rejects.toThrow('Close this item');
    await expect(monitor.stop({ ...snapshot.processes[2], pid: 42422 })).rejects.toThrow(
      'exited or changed'
    );
    output = output.replace(
      line(42421, 42420),
      line(42421, 42420, '0:00.00', 'node', 'Wed Sep 9 11:00:00 2026')
    );
    await expect(monitor.stop(snapshot.processes[2])).rejects.toThrow('exited or changed');
    expect(kill).toHaveBeenCalledTimes(1);
  });
  it('maps browser guests only from the main host', async () => {
    const host = {} as WebContents;
    const guest = (id: number, owner: WebContents) => ({
      id,
      hostWebContents: owner,
      isDestroyed: () => false,
      getType: () => 'webview',
      getOSProcessId: () => 44444,
    });
    mocks.contents.mockReturnValue([guest(1, host), guest(2, {} as WebContents)]);
    const result = await new PerformanceMonitor(
      () => [],
      () => host
    ).list();
    expect(result.browsers).toEqual([{ webContentsId: 1, pid: 44444 }]);
  });
  it('uses Windows CPU counters and numeric taskkill arguments', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string) => ({
      stdout:
        file === 'wsl.exe'
          ? ''
          : JSON.stringify([
              {
                pid: 42421,
                ppid: terminal.pid,
                memoryBytes: 100,
                cpuSeconds: 2,
                startedAt,
                name: 'node.exe',
              },
            ]),
    }));
    const result = await monitor.list();
    expect(result.processes[0]).toMatchObject({ terminalId: terminal.id, memoryBytes: 100 });
    await monitor.stop(result.processes[0], true);
    expect(mocks.run).toHaveBeenLastCalledWith(
      'taskkill.exe',
      ['/PID', '42421', '/F'],
      expect.any(Object)
    );
  });
  it('keeps Windows and WSL PIDs separate and only stops the selected namespace', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'powershell.exe')
        return {
          stdout: JSON.stringify([
            {
              pid: 42421,
              ppid: terminal.pid,
              memoryBytes: 100,
              cpuSeconds: 2,
              startedAt,
              name: 'node.exe',
            },
          ]),
        };
      if (args[0] === '--list') return { stdout: 'Ubuntu\n' };
      if (args.includes('ps')) return { stdout: line(42421, 1) + line(99, 1) };
      if (args.includes('sh')) return { stdout: `42421 ${terminal.id}\n99 outside:tab\n` };
      return { stdout: '' };
    });
    const snapshot = await monitor.list();
    expect(snapshot.processes).toHaveLength(2);
    expect(snapshot.processes[1]).toMatchObject({
      pid: 42421,
      distro: 'Ubuntu',
      terminalId: terminal.id,
    });
    await monitor.stop(snapshot.processes[1]);
    expect(mocks.run).toHaveBeenLastCalledWith(
      'wsl.exe',
      ['--distribution', 'Ubuntu', '--exec', 'kill', '-TERM', '42421'],
      expect.any(Object)
    );
    await expect(
      monitor.stop({ ...snapshot.processes[1], distro: 'Unrecognized' })
    ).rejects.toThrow('exited or changed');
    expect(kill).not.toHaveBeenCalled();
  });
  it('keeps app helpers protected while their exit is in progress', async () => {
    mocks.metrics.mockReturnValue([{ pid: process.pid }, { pid: 42421 }]);
    await monitor.list();
    mocks.metrics.mockReturnValue([{ pid: process.pid }]);
    const result = await monitor.list();
    expect(result.processes[2]).toMatchObject({ kind: 'app', canStop: false });
  });
  it('rejects IPC requests from other renderers', () => {
    const handlers = new Map();
    const ipc = {
      handle: (name: string, handler: unknown) => handlers.set(name, handler),
    } as unknown as IpcMain;
    registerPerformanceHandlers(
      ipc,
      () => [],
      () => ({}) as WebContents
    );
    expect(() => handlers.get('performance:list')({ sender: {} })).toThrow('main window');
    expect(() => handlers.get('performance:stop')({ sender: {} }, {})).toThrow('main window');
  });
  it('surfaces scan failures and allows retry', async () => {
    mocks.run.mockRejectedValueOnce(new Error('ps failed'));
    await expect(monitor.list()).rejects.toThrow('ps failed');
    expect((await monitor.list()).processes.length).toBe(3);
  });
});
