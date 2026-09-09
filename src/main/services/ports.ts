import { execFile } from 'child_process';
import { promisify } from 'util';
import type { IpcMain } from 'electron';
import type { ListeningPort, PortScanResult, PortTerminalProcess } from '../../shared/ports';
import { getShellEnv } from '../utils/shellEnv';

const execFileAsync = promisify(execFile);
const options = { timeout: 10_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true };

async function run(file: string, args: string[], distro?: string): Promise<string> {
  const env: Record<string, string> = { ...getShellEnv(), LC_ALL: 'C' };
  // WSL only inherits named Windows environment variables through WSLENV.
  if (distro) env.WSLENV = [env.WSLENV, 'LC_ALL'].filter(Boolean).join(':');
  const result = await execFileAsync(
    distro ? 'wsl.exe' : file,
    distro ? ['--distribution', distro, '--exec', file, ...args] : args,
    { ...options, env }
  );
  return result.stdout;
}

type Socket = Pick<ListeningPort, 'pid' | 'name' | 'port' | 'address'>;

function socket(pid: number, name: string, endpoint: string): Socket | null {
  const match = endpoint.match(/^(.*):(\d+)$/);
  if (!match || !Number.isSafeInteger(pid) || pid <= 1) return null;
  const port = Number(match[2]);
  if (port < 1 || port > 65535) return null;
  return { pid, name, port, address: match[1].replace(/^\[|\]$/g, '') };
}

export function parseLsof(output: string): Socket[] {
  const ports: Socket[] = [];
  let pid = 0;
  let name = '';
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      pid = Number(line.slice(1));
      name = '';
    } else if (line.startsWith('c')) {
      name = line.slice(1);
    } else if (line.startsWith('n')) {
      const entry = socket(pid, name, line.slice(1));
      if (entry) ports.push(entry);
    }
  }
  return ports;
}

export function parseSs(output: string): Socket[] {
  const ports: Socket[] = [];
  for (const line of output.trim().split('\n')) {
    const columns = line.trim().split(/\s+/);
    if (columns[0] !== 'LISTEN') continue;
    for (const match of line.matchAll(/\("([^"]+)",pid=(\d+),/g)) {
      const entry = socket(Number(match[2]), match[1], columns[3]);
      if (entry) ports.push(entry);
    }
  }
  return ports;
}

// Walk the full parent chain: dev servers often run under a package manager or agent.
export function isTermpadDescendant(pid: number, parents: Map<number, number>): boolean {
  const visited = new Set<number>();
  while (pid > 1 && !visited.has(pid)) {
    if (pid === process.pid) return true;
    visited.add(pid);
    pid = parents.get(pid) ?? 0;
  }
  return false;
}

export function findPortTerminal(
  pid: number,
  parents: Map<number, number>,
  terminals: PortTerminalProcess[]
): string | undefined {
  const roots = new Map(terminals.map((terminal) => [terminal.pid, terminal.id]));
  const visited = new Set<number>();
  while (pid > 1 && !visited.has(pid)) {
    const terminalId = roots.get(pid);
    if (terminalId) return terminalId;
    visited.add(pid);
    pid = parents.get(pid) ?? 0;
  }
  return undefined;
}

async function markedTermpadProcesses(
  pids: number[],
  distro?: string
): Promise<Map<number, string>> {
  if (!pids.length) return new Map();
  // Filter environment contents in the subprocess: only PIDs and terminal IDs cross
  // into the main process. WORKSPACE_PATH recognizes older Termpad terminals.
  const readEnvironment =
    process.platform === 'darwin' && !distro
      ? `ps -Eww -p "$port_pid" -o command= 2>/dev/null`
      : String.raw`tr '\000' '\n' 2>/dev/null < "/proc/$port_pid/environ"`;
  const script = String.raw`for port_pid do
    ${readEnvironment} | awk -v pid="$port_pid" '
      {
        for (i = 1; i <= NF; i++) {
          if ($i == "TERMPAD_TERMINAL=1" || $i ~ /^TERMPAD_WORKSPACE_PATH=/) marked = 1
          if ($i ~ /^TERMPAD_TERMINAL_ID=[A-Za-z0-9:_-]+$/) {
            id = $i; sub(/^TERMPAD_TERMINAL_ID=/, "", id)
          }
        }
      }
      END { if (marked) printf "%s %s\n", pid, id }
    '
  done`;
  const output = await run(
    'sh',
    ['-c', script, 'termpad-port-origin', ...pids.map(String)],
    distro
  );
  const marked = new Map<number, string>();
  for (const line of output.trim().split('\n')) {
    const match = line.match(/^(\d+)(?: ([A-Za-z0-9:_-]+))?\s*$/);
    if (match) marked.set(Number(match[1]), match[2] ?? '');
  }
  return marked;
}

function nonNegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function scanUnix(
  terminals: PortTerminalProcess[],
  distro?: string
): Promise<ListeningPort[]> {
  const uid = distro ? (await run('id', ['-u'], distro)).trim() : String(process.getuid?.());
  if (!/^\d+$/.test(uid)) throw new Error('Could not determine the current user.');
  // Start times distinguish a selected process from a subsequently reused PID.
  // This also filters ss output to processes owned by this user, even when run as root.
  const processes = await run('ps', ['-u', uid, '-o', 'pid=,ppid=,%cpu=,rss=,lstart='], distro);
  const starts = new Map<number, string>();
  const usage = new Map<number, { cpuPercent: number | null; memoryBytes: number | null }>();
  const parents = new Map<number, number>();
  for (const line of processes.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (match) {
      starts.set(Number(match[1]), match[5]);
      const rssKiB = nonNegativeNumber(match[4]);
      usage.set(Number(match[1]), {
        cpuPercent: nonNegativeNumber(match[3]),
        memoryBytes: rssKiB === null ? null : nonNegativeNumber(rssKiB * 1024),
      });
      parents.set(Number(match[1]), Number(match[2]));
    }
  }
  let sockets: Socket[];
  try {
    sockets = parseLsof(
      await run('lsof', ['-nP', '-a', '-u', uid, '-iTCP', '-sTCP:LISTEN', '-Fpcn'], distro)
    );
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string };
    // lsof returns 1 (with no diagnostic) when there are no matching sockets.
    if (failure.code === 1 && !failure.stderr?.trim()) {
      sockets = parseLsof(failure.stdout || '');
    } else if (process.platform === 'linux' || distro) {
      sockets = parseSs(await run('ss', ['-H', '-ltnp'], distro));
    } else {
      throw error;
    }
  }
  const owned = sockets.filter((entry) => starts.has(entry.pid));
  // Windows PIDs and WSL PIDs are separate namespaces; use inherited markers in WSL.
  const descendants = new Set(
    owned
      .filter((entry) => !distro && isTermpadDescendant(entry.pid, parents))
      .map((entry) => entry.pid)
  );
  const terminalIds = new Map(
    owned.map((entry) => [
      entry.pid,
      distro ? undefined : findPortTerminal(entry.pid, parents, terminals),
    ])
  );
  const marked = await markedTermpadProcesses(
    [
      ...new Set(
        owned
          .filter(
            (entry) =>
              !descendants.has(entry.pid) || (terminals.length > 0 && !terminalIds.get(entry.pid))
          )
          .map((entry) => entry.pid)
      ),
    ],
    distro
  );
  for (const [pid, id] of marked) {
    if (terminals.some((terminal) => terminal.id === id)) terminalIds.set(pid, id);
  }
  return sockets
    .filter((entry) => starts.has(entry.pid))
    .map((entry) => ({
      ...entry,
      startedAt: starts.get(entry.pid) ?? '',
      cpuPercent: usage.get(entry.pid)?.cpuPercent ?? null,
      memoryBytes: usage.get(entry.pid)?.memoryBytes ?? null,
      ...(distro ? { distro } : {}),
      canStop: !!distro || entry.pid !== process.pid,
      origin: descendants.has(entry.pid) || marked.has(entry.pid) ? 'termpad' : 'outside',
      ...(terminalIds.get(entry.pid) ? { terminalId: terminalIds.get(entry.pid) } : {}),
    }));
}

// Use numeric PIDs and CIM ownership, without relying on localized netstat output.
const windowsScan = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$connections = @(Get-NetTCPConnection | Where-Object { $_.State -eq 'Listen' })
$processes = @(Get-CimInstance Win32_Process)
$byId = @{}
foreach ($item in $processes) { $byId[[int]$item.ProcessId] = $item }
$owners = @{}
foreach ($processId in @($connections.OwningProcess | Sort-Object -Unique)) {
  $item = $byId[[int]$processId]
  if ($null -eq $item) { continue }
  try { $owner = Invoke-CimMethod -InputObject $item -MethodName GetOwnerSid }
  catch { continue }
  if ($owner.Sid -eq $currentSid) { $owners[[int]$processId] = $item }
}
$capturedAt = Get-Date
$result = @(foreach ($connection in $connections) {
  $item = $owners[[int]$connection.OwningProcess]
  if ($null -ne $item -and $item.ProcessId -gt 1) {
    @{ pid = [int]$item.ProcessId; name = $item.Name; port = [int]$connection.LocalPort;
       address = $connection.LocalAddress; startedAt = $item.CreationDate.ToString('o');
       cpuTimeSeconds = $(if ($null -ne $item.KernelModeTime -and $null -ne $item.UserModeTime) { ([double]$item.KernelModeTime + [double]$item.UserModeTime) / 10000000 } else { $null });
       elapsedSeconds = ($capturedAt - $item.CreationDate).TotalSeconds;
       memoryBytes = $(if ($null -ne $item.WorkingSetSize) { [double]$item.WorkingSetSize } else { $null }) }
  }
})
$parents = @($processes | ForEach-Object { @{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId } })
ConvertTo-Json -InputObject @{ ports = $result; processes = $parents } -Depth 4 -Compress
`;

async function scanWindows(terminals: PortTerminalProcess[]): Promise<ListeningPort[]> {
  const output = await run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    windowsScan,
  ]);
  const result: {
    ports: (Omit<ListeningPort, 'canStop' | 'origin' | 'cpuPercent'> & {
      cpuTimeSeconds?: number | null;
      elapsedSeconds?: number | null;
    })[];
    processes: { pid: number; ppid: number }[];
  } = JSON.parse(output.replace(/^\uFEFF/, ''));
  const parents = new Map(result.processes.map((entry) => [entry.pid, entry.ppid]));
  return result.ports.map(({ cpuTimeSeconds, elapsedSeconds, ...entry }) => {
    const cpuTime = nonNegativeNumber(cpuTimeSeconds);
    const elapsed = nonNegativeNumber(elapsedSeconds);
    return {
      ...entry,
      cpuPercent:
        cpuTime !== null && elapsed !== null && elapsed > 0
          ? nonNegativeNumber((cpuTime / elapsed) * 100)
          : null,
      memoryBytes: nonNegativeNumber(entry.memoryBytes),
      canStop: entry.pid !== process.pid,
      origin: isTermpadDescendant(entry.pid, parents) ? 'termpad' : 'outside',
      ...(findPortTerminal(entry.pid, parents, terminals)
        ? { terminalId: findPortTerminal(entry.pid, parents, terminals) }
        : {}),
    };
  });
}

export async function listPorts(terminals: PortTerminalProcess[] = []): Promise<PortScanResult> {
  const ports =
    process.platform === 'win32' ? await scanWindows(terminals) : await scanUnix(terminals);
  const warnings: string[] = [];
  if (process.platform === 'win32') {
    try {
      // Only inspect running distros; opening this view must not boot stopped distros.
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
          ports.push(...(await scanUnix(terminals, distro)));
        } catch {
          warnings.push(`Could not scan WSL: ${distro}. Ensure lsof or ss is installed.`);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        warnings.push('Could not scan running WSL distributions.');
      }
    }
  }
  const unique = new Map(
    ports.map((entry) => [
      JSON.stringify([entry.distro, entry.pid, entry.port, entry.address]),
      entry,
    ])
  );
  return {
    ports: [...unique.values()].sort(
      (a, b) => a.port - b.port || a.pid - b.pid || a.address.localeCompare(b.address)
    ),
    warnings,
  };
}

export async function stopPort(
  selected: ListeningPort,
  force = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (
      !selected ||
      !Number.isSafeInteger(selected.pid) ||
      selected.pid <= 1 ||
      !Number.isInteger(selected.port) ||
      selected.port < 1 ||
      selected.port > 65535 ||
      typeof selected.startedAt !== 'string' ||
      typeof force !== 'boolean'
    ) {
      throw new Error('Invalid port selection. Refresh the list and try again.');
    }
    // Never trust a renderer-supplied PID or distro without finding it in a fresh scan.
    const { ports } = await listPorts();
    const current = ports.find(
      (entry) =>
        entry.pid === selected.pid &&
        entry.port === selected.port &&
        entry.address === selected.address &&
        entry.name === selected.name &&
        entry.startedAt === selected.startedAt &&
        entry.distro === selected.distro
    );
    if (!current)
      throw new Error('This process is no longer listening on that port. Refresh the list.');
    if (!current.canStop) throw new Error('Termpad cannot stop its own process.');
    if (current.distro) {
      await run('kill', [force ? '-KILL' : '-TERM', String(current.pid)], current.distro);
    } else if (process.platform === 'win32') {
      await run('taskkill.exe', ['/PID', String(current.pid), ...(force ? ['/F'] : [])]);
    } else {
      process.kill(current.pid, force ? 'SIGKILL' : 'SIGTERM');
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not stop the process.',
    };
  }
}

export function registerPortsHandlers(
  ipcMain: IpcMain,
  getTerminals: () => PortTerminalProcess[]
): void {
  ipcMain.handle('ports:list', () => listPorts(getTerminals()));
  ipcMain.handle('ports:stop', (_event, port: ListeningPort, force?: boolean) =>
    stopPort(port, force)
  );
}
