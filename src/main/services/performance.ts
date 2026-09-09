import { execFile } from 'child_process';
import { promisify } from 'util';
import { app, webContents, type IpcMain, type WebContents } from 'electron';
import {
  performanceProcessKey,
  type PerformanceProcess,
  type PerformanceSnapshot,
} from '../../shared/performance';
import type { PortTerminalProcess } from '../../shared/ports';
import { findPortTerminal, isTermpadDescendant, markedTermpadProcesses } from './ports';

const execFileAsync = promisify(execFile);
const options = { timeout: 10_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true };
export interface ProcessSample {
  pid: number;
  ppid: number;
  distro?: string;
  terminalId?: string;
  startedAt: string;
  name: string;
  memoryBytes: number;
  cpuSeconds: number;
}

export function parseCpuTime(value: string): number {
  const [days, clock] = value.includes('-') ? value.split('-') : ['0', value];
  return (
    Number(days) * 86400 + clock.split(':').reduce((total, part) => total * 60 + Number(part), 0)
  );
}

export function parseProcessSamples(output: string): ProcessSample[] {
  return output.split('\n').flatMap((line) => {
    const match = line
      .trim()
      .match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d:.-]+)\s+(\S+\s+\S+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/);
    if (!match) return [];
    return [
      {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        memoryBytes: Number(match[3]) * 1024,
        cpuSeconds: parseCpuTime(match[4]),
        startedAt: match[5].replace(/\s+/g, ' '),
        name: match[6],
      },
    ];
  });
}

async function readProcesses(): Promise<ProcessSample[]> {
  if (process.platform === 'win32') {
    const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$result = @(Get-CimInstance Win32_Process | ForEach-Object {
  if ($null -ne $_.CreationDate) {
    @{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = $_.Name;
       startedAt = $_.CreationDate.ToString('o'); memoryBytes = [double]$_.WorkingSetSize;
       cpuSeconds = ([double]$_.KernelModeTime + [double]$_.UserModeTime) / 10000000 }
  }
})
ConvertTo-Json -InputObject $result -Compress
`;
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      options
    );
    return JSON.parse(stdout.replace(/^\uFEFF/, ''));
  }
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,rss=,time=,lstart=,comm='], {
    ...options,
    env: { ...process.env, LC_ALL: 'C' },
  });
  return parseProcessSamples(stdout);
}

async function readWslProcesses(
  terminalIds: Set<string>
): Promise<{ samples: ProcessSample[]; warnings: string[] }> {
  const samples: ProcessSample[] = [];
  const warnings: string[] = [];
  if (process.platform !== 'win32' || !terminalIds.size) return { samples, warnings };
  try {
    const { stdout } = await execFileAsync('wsl.exe', ['--list', '--running', '--quiet'], {
      ...options,
      encoding: 'utf16le',
    });
    const distros = stdout
      .replace(/\0/g, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const distro of distros) {
      try {
        const { stdout: output } = await execFileAsync(
          'wsl.exe',
          [
            '--distribution',
            distro,
            '--exec',
            'env',
            'LC_ALL=C',
            'ps',
            '-axo',
            'pid=,ppid=,rss=,time=,lstart=,comm=',
          ],
          options
        );
        const entries = parseProcessSamples(output);
        const marked = await markedTermpadProcesses(
          entries.map((entry) => entry.pid),
          distro
        );
        for (const entry of entries) {
          const terminalId = marked.get(entry.pid);
          if (terminalId && terminalIds.has(terminalId))
            samples.push({ ...entry, distro, terminalId });
        }
      } catch {
        warnings.push(`Could not read processes in WSL: ${distro}.`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      warnings.push('Could not read running WSL distributions.');
  }
  return { samples, warnings };
}

export class PerformanceMonitor {
  private previous = new Map<
    string,
    { startedAt: string; cpuSeconds: number; capturedAt: number; cpuPercent: number | null }
  >();
  // Retain attribution when an observed child detaches from its terminal.
  private owned = new Map<string, { startedAt: string; terminalId?: string; isApp: boolean }>();
  private pending: Promise<PerformanceSnapshot> | null = null;

  constructor(
    private getTerminals: () => PortTerminalProcess[],
    private getHost: () => WebContents | undefined
  ) {}

  list(): Promise<PerformanceSnapshot> {
    if (!this.pending)
      this.pending = this.scan().finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  private async scan(): Promise<PerformanceSnapshot> {
    const samples = await readProcesses();
    const terminals = this.getTerminals();
    const knownTerminalIds = new Set([
      ...terminals.map((entry) => entry.id),
      ...[...this.owned.values()].flatMap((entry) => (entry.terminalId ? [entry.terminalId] : [])),
    ]);
    const wsl = await readWslProcesses(knownTerminalIds);
    const capturedAt = Date.now();
    const parents = new Map(samples.map((entry) => [entry.pid, entry.ppid]));
    const appProcesses = new Map(app.getAppMetrics().map((entry) => [entry.pid, entry]));
    const nextOwned: typeof this.owned = new Map();
    const nextPrevious: typeof this.previous = new Map();
    const processes: PerformanceProcess[] = [];
    for (const entry of [...samples, ...wsl.samples]) {
      const key = performanceProcessKey(entry);
      const priorOwner = this.owned.get(key);
      const terminalId =
        entry.terminalId ??
        (!entry.distro ? findPortTerminal(entry.pid, parents, terminals) : undefined) ??
        (priorOwner?.startedAt === entry.startedAt ? priorOwner.terminalId : undefined);
      if (
        !terminalId &&
        !isTermpadDescendant(entry.pid, parents) &&
        !appProcesses.has(entry.pid) &&
        priorOwner?.startedAt !== entry.startedAt
      )
        continue;
      // Do not display the monitor's own short-lived sampling command.
      if (
        !entry.distro &&
        entry.ppid === process.pid &&
        /(?:^|[/\\])(ps|powershell\.exe)$/.test(entry.name)
      )
        continue;
      const previous = this.previous.get(key);
      const elapsed = previous ? (capturedAt - previous.capturedAt) / 1000 : 0;
      const tooSoon = previous?.startedAt === entry.startedAt && elapsed < 0.5;
      const cpuPercent = tooSoon
        ? previous.cpuPercent
        : previous?.startedAt === entry.startedAt &&
            elapsed > 0 &&
            elapsed < 15 &&
            entry.cpuSeconds >= previous.cpuSeconds
          ? ((entry.cpuSeconds - previous.cpuSeconds) / elapsed) * 100
          : null;
      const isTerminal = !entry.distro && terminals.some((terminal) => terminal.pid === entry.pid);
      const isApp =
        !entry.distro &&
        (appProcesses.has(entry.pid) ||
          entry.pid === process.pid ||
          (priorOwner?.startedAt === entry.startedAt && priorOwner.isApp));
      processes.push({
        pid: entry.pid,
        ...(entry.distro ? { distro: entry.distro } : {}),
        startedAt: entry.startedAt,
        name:
          !entry.distro && entry.pid === process.pid
            ? 'Termpad'
            : isApp
              ? `Termpad · ${appProcesses.get(entry.pid)?.name || appProcesses.get(entry.pid)?.type || 'Helper'}`
              : entry.name,
        kind: isTerminal ? 'terminal' : isApp ? 'app' : 'process',
        terminalId,
        memoryBytes: entry.memoryBytes,
        cpuPercent,
        canStop: !isApp && entry.pid > 1,
      });
      nextOwned.set(key, { startedAt: entry.startedAt, terminalId, isApp });
      nextPrevious.set(
        key,
        tooSoon
          ? previous
          : {
              startedAt: entry.startedAt,
              cpuSeconds: entry.cpuSeconds,
              cpuPercent,
              capturedAt,
            }
      );
    }
    this.owned = nextOwned;
    this.previous = nextPrevious;
    const host = this.getHost();
    const browsers = webContents
      .getAllWebContents()
      .filter(
        (contents) =>
          !contents.isDestroyed() &&
          contents.getType() === 'webview' &&
          contents.hostWebContents === host
      )
      .map((contents) => ({ webContentsId: contents.id, pid: contents.getOSProcessId() }));
    return {
      processes,
      browsers,
      capturedAt,
      warnings: wsl.warnings,
    };
  }

  async stop(selected: PerformanceProcess, force = false): Promise<void> {
    if (
      !selected ||
      !Number.isSafeInteger(selected.pid) ||
      selected.pid <= 1 ||
      typeof selected.startedAt !== 'string' ||
      typeof force !== 'boolean'
    )
      throw new Error('Invalid process selection.');
    // Never act on a renderer-supplied PID without rechecking ownership and identity.
    // Wait out any in-flight scan so validation always starts after the request.
    if (this.pending) await this.pending;
    const snapshot = await this.list();
    const current = snapshot.processes.find(
      (entry) =>
        entry.pid === selected.pid &&
        entry.distro === selected.distro &&
        entry.startedAt === selected.startedAt
    );
    if (!current) throw new Error('This process has exited or changed. Refresh and try again.');
    if (!current.canStop || current.kind !== 'process')
      throw new Error('Close this item using its terminal or browser tab.');
    if (current.distro) {
      await execFileAsync(
        'wsl.exe',
        [
          '--distribution',
          current.distro,
          '--exec',
          'kill',
          force ? '-KILL' : '-TERM',
          String(current.pid),
        ],
        options
      );
    } else if (process.platform === 'win32') {
      await execFileAsync(
        'taskkill.exe',
        ['/PID', String(current.pid), ...(force ? ['/F'] : [])],
        options
      );
    } else process.kill(current.pid, force ? 'SIGKILL' : 'SIGTERM');
  }
}

export function registerPerformanceHandlers(
  ipcMain: IpcMain,
  getTerminals: () => PortTerminalProcess[],
  getHost: () => WebContents | undefined
): void {
  const monitor = new PerformanceMonitor(getTerminals, getHost);
  ipcMain.handle('performance:list', (event) => {
    if (event.sender !== getHost())
      throw new Error('Performance is only available in the main window.');
    return monitor.list();
  });
  ipcMain.handle('performance:stop', (event, selected: PerformanceProcess, force?: boolean) => {
    if (event.sender !== getHost())
      throw new Error('Performance is only available in the main window.');
    return monitor.stop(selected, force);
  });
}
