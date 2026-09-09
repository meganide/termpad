import {
  performanceProcessKey,
  type PerformanceProcess,
  type PerformanceSnapshot,
} from '../../../shared/performance';
import type { RunningBrowserTab } from '../browser/browserRegistry';

export interface PerformanceRow {
  id: string;
  name: string;
  kind: 'terminal' | 'process' | 'browser' | 'app';
  context: string;
  detail: string;
  pid: number | null;
  cpuPercent: number | null;
  memoryBytes: number | null;
  process?: PerformanceProcess;
  browser?: RunningBrowserTab;
  terminalId?: string;
}
export type SortKey = 'name' | 'kind' | 'context' | 'pid' | 'cpuPercent' | 'memoryBytes';

export function sumUsage(
  processes: PerformanceProcess[],
  key: 'cpuPercent' | 'memoryBytes'
): number | null {
  if (!processes.length || processes.every((entry) => entry[key] === null)) return null;
  return processes.reduce((sum, entry) => sum + (entry[key] ?? 0), 0);
}

export function buildPerformanceRows(
  snapshot: PerformanceSnapshot,
  tabs: RunningBrowserTab[],
  terminals: Map<string, { name: string; context: string }>,
  repositories: Map<string, string>
): PerformanceRow[] {
  const browserPids = new Map(snapshot.browsers.map((entry) => [entry.webContentsId, entry.pid]));
  const processes = new Map(
    snapshot.processes.filter((entry) => !entry.distro).map((entry) => [entry.pid, entry])
  );
  const representedPids = new Set(
    tabs.map((tab) => browserPids.get(tab.webContentsId ?? -1)).filter(Boolean)
  );
  const rows: PerformanceRow[] = snapshot.processes
    .filter((entry) => entry.distro || !representedPids.has(entry.pid))
    .map((entry) => {
      const terminal = terminals.get(entry.terminalId ?? '');
      const children =
        entry.kind === 'terminal'
          ? snapshot.processes.filter((item) => item.terminalId === entry.terminalId)
          : [entry];
      return {
        id: `process:${performanceProcessKey(entry)}:${entry.startedAt}`,
        name: entry.kind === 'terminal' ? (terminal?.name ?? entry.name) : entry.name,
        kind: entry.kind,
        context: terminal?.context ?? (entry.kind === 'app' ? 'Termpad' : 'Background'),
        detail:
          entry.kind === 'terminal'
            ? `${children.length} process${children.length === 1 ? '' : 'es'} · includes child processes`
            : [
                entry.distro ? `WSL: ${entry.distro}` : '',
                terminal ? `In ${terminal.name}` : 'Termpad process',
              ]
                .filter(Boolean)
                .join(' · '),
        pid: entry.pid,
        cpuPercent: sumUsage(children, 'cpuPercent'),
        memoryBytes: sumUsage(children, 'memoryBytes'),
        terminalId: entry.terminalId,
        process: entry,
      };
    });
  for (const tab of tabs) {
    const pid = browserPids.get(tab.webContentsId ?? -1) ?? null;
    const entry = pid === null ? undefined : processes.get(pid);
    const shared =
      pid !== null &&
      tabs.filter((item) => browserPids.get(item.webContentsId ?? -1) === pid).length > 1;
    rows.push({
      id: `browser:${tab.id}`,
      name: tab.title,
      kind: 'browser',
      context: repositories.get(tab.repositoryId) ?? 'Repository',
      detail: `${shared ? 'Shared process · ' : ''}${tab.url || 'New tab · no page loaded'}`,
      pid,
      cpuPercent: entry?.cpuPercent ?? null,
      memoryBytes: entry?.memoryBytes ?? null,
      browser: tab,
    });
  }
  return rows;
}

export function sortPerformanceRows(
  rows: PerformanceRow[],
  key: SortKey,
  direction: 'asc' | 'desc'
): PerformanceRow[] {
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left === null || right === null)
      return left === right ? a.id.localeCompare(b.id) : left === null ? 1 : -1;
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true });
    return (direction === 'asc' ? result : -result) || a.id.localeCompare(b.id);
  });
}

export function formatMemory(bytes: number | null): string {
  if (bytes === null) return '—';
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export const formatCpu = (value: number | null): string =>
  value === null ? '—' : `${value.toFixed(1)}%`;
