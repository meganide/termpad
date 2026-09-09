import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findPortTerminal,
  isTermpadDescendant,
  listPorts,
  parseLsof,
  parseSs,
  stopPort,
} from './ports';

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    default: { ...actual, promisify: () => mocks.run },
    promisify: () => mocks.run,
  };
});
vi.mock('../utils/shellEnv', () => ({ getShellEnv: () => ({}) }));

const platform = process.platform;
const selected = {
  pid: 42424,
  name: 'node',
  port: 3000,
  address: '*',
  startedAt: 'Wed Sep  9 10:00:00 2026',
  canStop: true,
  cpuPercent: null,
  memoryBytes: null,
  origin: 'outside' as const,
};
const ps = `42424 1 - - ${selected.startedAt}\n`;
const lsof = 'p42424\ncnode\nf20\nn*:3000\nf21\nn*:3000\n';
let kill: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  kill = vi.spyOn(process, 'kill').mockReturnValue(true);
  mocks.run.mockReset().mockImplementation(async (file: string) => {
    if (file === 'ps') return { stdout: ps };
    if (file === 'lsof') return { stdout: lsof };
    if (file === 'sh') return { stdout: '' };
    throw new Error(`Unexpected command: ${file}`);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process, 'platform', { value: platform });
});

describe('port discovery', () => {
  it('parses IPv4, IPv6, wildcards, and process names with spaces', () => {
    expect(
      parseLsof('p21\ncMy Server\nn127.0.0.1:3000\nn[::1]:8080\nn*:9000\nn*:99999\nninvalid\n')
    ).toEqual([
      { pid: 21, name: 'My Server', address: '127.0.0.1', port: 3000 },
      { pid: 21, name: 'My Server', address: '::1', port: 8080 },
      { pid: 21, name: 'My Server', address: '*', port: 9000 },
    ]);
  });
  it('parses every ss socket owner and excludes sockets without a PID', () => {
    expect(
      parseSs(
        'LISTEN 0 511 [::]:3000 [::]:* users:(("node",pid=21,fd=20),("node",pid=22,fd=20))\nLISTEN 0 10 *:22 *:*\n'
      )
    ).toEqual([
      { pid: 21, name: 'node', address: '::', port: 3000 },
      { pid: 22, name: 'node', address: '::', port: 3000 },
    ]);
  });
  it('deduplicates sockets and filters processes absent from the current user snapshot', async () => {
    mocks.run.mockImplementation(async (file: string) => ({
      stdout: file === 'sh' ? '' : file === 'ps' ? ps : lsof + 'p9876\ncother\nn*:4000\n',
    }));
    expect(await listPorts()).toEqual({ ports: [selected], warnings: [] });
  });
  it('treats lsof exit 1 with no diagnostics as an empty scan', async () => {
    mocks.run.mockImplementation(async (file: string) => {
      if (file === 'ps') return { stdout: ps };
      throw { code: 1, stdout: '', stderr: '' };
    });
    expect((await listPorts()).ports).toEqual([]);
  });
  it('surfaces scan failures instead of reporting no listeners', async () => {
    mocks.run.mockRejectedValue(new Error('Permission denied'));
    await expect(listPorts()).rejects.toThrow('Permission denied');
  });
  it('falls back to ss on Linux when lsof is unavailable', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    mocks.run.mockImplementation(async (file: string) => {
      if (file === 'ps') return { stdout: ps };
      if (file === 'lsof') throw { code: 'ENOENT' };
      if (file === 'sh') return { stdout: '' };
      return { stdout: 'LISTEN 0 511 *:3000 *:* users:(("node",pid=42424,fd=20))' };
    });
    expect((await listPorts()).ports).toEqual([selected]);
  });
  it('scans Windows and running WSL distributions with distinct PID namespaces', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'powershell.exe')
        return {
          stdout: JSON.stringify({ ports: [selected], processes: [{ pid: 42424, ppid: 1 }] }),
        };
      if (args[0] === '--list') return { stdout: 'Ubuntu\r\n' };
      if (args[3] === 'id') return { stdout: '1000\n' };
      if (args[3] === 'ps') return { stdout: ps };
      if (args[3] === 'lsof') return { stdout: lsof };
      if (args[3] === 'sh') return { stdout: '' };
      if (args[3] === 'kill') return { stdout: '' };
      throw new Error('Unexpected WSL command');
    });
    expect((await listPorts()).ports).toEqual([selected, { ...selected, distro: 'Ubuntu' }]);
    expect(await stopPort({ ...selected, distro: 'Ubuntu' }, true)).toEqual({ success: true });
    expect(mocks.run).toHaveBeenLastCalledWith(
      'wsl.exe',
      ['--distribution', 'Ubuntu', '--exec', 'kill', '-KILL', '42424'],
      expect.any(Object)
    );
    expect(kill).not.toHaveBeenCalled();
  });
});

describe('port origin', () => {
  it('follows nested children while keeping sibling processes outside Termpad', () => {
    const parents = new Map([
      [21, 22],
      [22, process.pid],
      [23, 1],
      [24, 25],
      [25, 24],
    ]);
    expect(isTermpadDescendant(21, parents)).toBe(true);
    expect(isTermpadDescendant(23, parents)).toBe(false);
    expect(isTermpadDescendant(24, parents)).toBe(false);
    expect(isTermpadDescendant(99999, parents)).toBe(false);
  });

  it('classifies native descendants without needing environment inspection', async () => {
    mocks.run.mockImplementation(async (file: string) => {
      if (file === 'ps')
        return {
          stdout: `42424 777 - - ${selected.startedAt}\n777 ${process.pid} - - ${selected.startedAt}`,
        };
      if (file === 'lsof') return { stdout: lsof };
      throw new Error('No marker probe needed');
    });
    expect((await listPorts()).ports[0].origin).toBe('termpad');
  });

  it.each(['darwin', 'linux'])(
    'recognizes detached processes by their inherited marker on %s',
    async (platform) => {
      Object.defineProperty(process, 'platform', { value: platform });
      mocks.run.mockImplementation(async (file: string) => ({
        stdout: file === 'ps' ? ps : file === 'sh' ? '42424\n' : lsof,
      }));
      expect((await listPorts()).ports[0].origin).toBe('termpad');
      expect(mocks.run).toHaveBeenCalledWith(
        'sh',
        ['-c', expect.any(String), 'termpad-port-origin', '42424'],
        expect.any(Object)
      );
    }
  );

  it('classifies native Windows listeners by their parent process tree', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string) => {
      if (file === 'wsl.exe') throw { code: 'ENOENT' };
      return {
        stdout: JSON.stringify({
          ports: [selected],
          processes: [
            { pid: 42424, ppid: 777 },
            { pid: 777, ppid: process.pid },
          ],
        }),
      };
    });
    expect((await listPorts()).ports[0].origin).toBe('termpad');
  });

  it('uses WSL markers instead of confusing matching Windows and Linux PIDs', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    let marked = false;
    mocks.run.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'powershell.exe')
        return { stdout: JSON.stringify({ ports: [], processes: [] }) };
      if (args[0] === '--list') return { stdout: 'Ubuntu\r\n' };
      if (args[3] === 'id') return { stdout: '1000\n' };
      if (args[3] === 'ps') return { stdout: `42424 ${process.pid} - - ${selected.startedAt}` };
      if (args[3] === 'sh') return { stdout: marked ? '42424\n' : '' };
      return { stdout: lsof };
    });
    expect((await listPorts()).ports[0].origin).toBe('outside');
    marked = true;
    expect((await listPorts()).ports[0].origin).toBe('termpad');
  });
});

describe('owning terminal', () => {
  it('finds the nearest terminal ancestor and rejects unrelated or cyclic ancestry', () => {
    const parents = new Map([
      [21, 22],
      [22, 23],
      [25, 26],
      [26, 25],
    ]);
    const terminals = [{ id: 'ws:tab', pid: 23 }];
    expect(findPortTerminal(21, parents, terminals)).toBe('ws:tab');
    expect(findPortTerminal(24, parents, terminals)).toBeUndefined();
    expect(findPortTerminal(25, parents, terminals)).toBeUndefined();
  });

  it('returns the exact native terminal ID for nested server processes', async () => {
    mocks.run.mockImplementation(async (file: string) => ({
      stdout:
        file === 'ps'
          ? `42424 777 - - ${selected.startedAt}\n777 ${process.pid} - - ${selected.startedAt}`
          : lsof,
    }));
    const result = await listPorts([{ id: 'ws:agent-tab', pid: 777 }]);
    expect(result.ports[0].terminalId).toBe('ws:agent-tab');
  });

  it('resolves WSL terminal markers only while that terminal is active', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'powershell.exe')
        return { stdout: JSON.stringify({ ports: [], processes: [] }) };
      if (args[0] === '--list') return { stdout: 'Ubuntu\r\n' };
      if (args[3] === 'id') return { stdout: '1000\n' };
      if (args[3] === 'ps') return { stdout: ps };
      if (args[3] === 'sh') return { stdout: '42424 user:ws:tab\n' };
      return { stdout: lsof };
    });
    expect((await listPorts([{ id: 'user:ws:tab', pid: 777 }])).ports[0].terminalId).toBe(
      'user:ws:tab'
    );
    expect((await listPorts()).ports[0].terminalId).toBeUndefined();
  });
});

describe('process resource usage', () => {
  it.each(['darwin', 'linux'])(
    'reads CPU and converts resident KiB to bytes on %s',
    async (platform) => {
      Object.defineProperty(process, 'platform', { value: platform });
      mocks.run.mockImplementation(async (file: string) => ({
        stdout:
          file === 'ps'
            ? `42424 1 125.4 65536 ${selected.startedAt}`
            : file === 'sh'
              ? ''
              : lsof + 'n*:3001\n',
      }));
      const result = await listPorts();
      expect(result.ports).toHaveLength(2);
      for (const entry of result.ports) {
        expect(entry.cpuPercent).toBe(125.4);
        expect(entry.memoryBytes).toBe(64 * 1024 * 1024);
      }
      expect(mocks.run).toHaveBeenCalledWith(
        'ps',
        expect.any(Array),
        expect.objectContaining({ env: expect.objectContaining({ LC_ALL: 'C' }) })
      );
    }
  );

  it.each([
    ['0.0', '0', 0, 0],
    ['-', '-', null, null],
    ['NaN', '-20', null, null],
  ])(
    'keeps zero distinct from unavailable metrics (%s, %s)',
    async (cpu, rss, expectedCpu, expectedMemory) => {
      mocks.run.mockImplementation(async (file: string) => ({
        stdout:
          file === 'ps' ? `42424 1 ${cpu} ${rss} ${selected.startedAt}` : file === 'sh' ? '' : lsof,
      }));
      const entry = (await listPorts()).ports[0];
      expect(entry.cpuPercent).toBe(expectedCpu);
      expect(entry.memoryBytes).toBe(expectedMemory);
      expect(entry.startedAt).toBe(selected.startedAt);
    }
  );

  it.each([
    [25, 10, 65536, 250, 65536],
    [0, 10, 0, 0, 0],
    [null, 10, null, null, null],
    [25, 0, -1, null, null],
  ])(
    'calculates Windows CPU averages without limiting multi-core usage (%s / %s)',
    async (cpuTimeSeconds, elapsedSeconds, memoryBytes, expectedCpu, expectedMemory) => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mocks.run.mockImplementation(async (file: string) => {
        if (file === 'wsl.exe') throw { code: 'ENOENT' };
        return {
          stdout: JSON.stringify({
            ports: [{ ...selected, cpuTimeSeconds, elapsedSeconds, memoryBytes }],
            processes: [],
          }),
        };
      });
      const entry = (await listPorts()).ports[0];
      expect(entry.cpuPercent).toBe(expectedCpu);
      expect(entry.memoryBytes).toBe(expectedMemory);
      expect(entry).not.toHaveProperty('cpuTimeSeconds');
      expect(entry).not.toHaveProperty('elapsedSeconds');
    }
  );

  it('reads WSL CPU and memory from its Linux process snapshot', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mocks.run.mockImplementation(async (file: string, args: string[]) => {
      if (file === 'powershell.exe')
        return { stdout: JSON.stringify({ ports: [], processes: [] }) };
      if (args[0] === '--list') return { stdout: 'Ubuntu\r\n' };
      if (args[3] === 'id') return { stdout: '1000\n' };
      if (args[3] === 'ps') return { stdout: `42424 1 7.5 131072 ${selected.startedAt}` };
      if (args[3] === 'sh') return { stdout: '' };
      return { stdout: lsof };
    });
    expect((await listPorts()).ports[0]).toMatchObject({
      distro: 'Ubuntu',
      cpuPercent: 7.5,
      memoryBytes: 128 * 1024 * 1024,
    });
    expect(mocks.run).toHaveBeenCalledWith(
      'wsl.exe',
      expect.any(Array),
      expect.objectContaining({ env: expect.objectContaining({ LC_ALL: 'C', WSLENV: 'LC_ALL' }) })
    );
  });
});

describe('stopping a listener', () => {
  it('rechecks ownership and sends SIGTERM to the selected PID only', async () => {
    expect(await stopPort(selected)).toEqual({ success: true });
    expect(kill).toHaveBeenCalledExactlyOnceWith(42424, 'SIGTERM');
  });
  it('supports explicit force stopping', async () => {
    expect(await stopPort(selected, true)).toEqual({ success: true });
    expect(kill).toHaveBeenCalledExactlyOnceWith(42424, 'SIGKILL');
  });
  it.each([
    { ...selected, pid: -1 },
    { ...selected, port: 70000 },
    { ...selected, startedAt: 'a replacement process' },
    { ...selected, address: '127.0.0.1' },
    { ...selected, distro: 'arbitrary-distro' },
  ])('rejects invalid or stale selection %j', async (entry) => {
    expect((await stopPort(entry)).success).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
  it('protects Termpad itself even if the renderer marks it stoppable', async () => {
    mocks.run.mockImplementation(async (file: string) => ({
      stdout:
        file === 'ps'
          ? `${process.pid} 1 - - ${selected.startedAt}`
          : `p${process.pid}\ncnode\nn*:3000\n`,
    }));
    expect((await stopPort({ ...selected, pid: process.pid, canStop: true })).success).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
  it('returns permission errors without claiming success', async () => {
    kill.mockImplementation(() => {
      throw new Error('EPERM');
    });
    expect(await stopPort(selected)).toEqual({ success: false, error: 'EPERM' });
  });
});
