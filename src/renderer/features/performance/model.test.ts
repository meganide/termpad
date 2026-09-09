import { describe, expect, it } from 'vitest';
import { buildPerformanceRows, sortPerformanceRows, sumUsage } from './model';
import type { PerformanceProcess, PerformanceSnapshot } from '../../../shared/performance';
const process = (
  pid: number,
  memoryBytes: number,
  kind: PerformanceProcess['kind'] = 'process'
): PerformanceProcess => ({
  pid,
  startedAt: 'today',
  name: `process ${pid}`,
  memoryBytes,
  cpuPercent: 10,
  kind,
  canStop: true,
  terminalId: 's:t',
});
const snapshot: PerformanceSnapshot = {
  processes: [
    process(1, 100, 'terminal'),
    process(2, 200),
    { ...process(3, 300, 'app'), terminalId: undefined },
  ],
  browsers: [
    { webContentsId: 10, pid: 3 },
    { webContentsId: 11, pid: 3 },
  ],
  capturedAt: 1,
  warnings: [],
};
const tabs = [10, 11].map((id) => ({
  id: String(id),
  repositoryId: 'repo',
  webContentsId: id,
  title: 'Page',
  url: 'https://example.com',
  select: () => undefined,
  close: () => undefined,
}));
describe('performance rows', () => {
  it('aggregates terminal children and counts shared browser memory once in totals', () => {
    const rows = buildPerformanceRows(
      snapshot,
      tabs,
      new Map([['s:t', { name: 'Agent', context: 'Repo / main' }]]),
      new Map()
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ name: 'Agent', memoryBytes: 300, cpuPercent: 20 });
    expect(
      rows
        .filter((row) => row.kind === 'browser')
        .every((row) => row.detail.startsWith('Shared process'))
    ).toBe(true);
    expect(sumUsage(snapshot.processes, 'memoryBytes')).toBe(600);
  });
  it('shows blank browser tabs with unavailable usage', () => {
    const rows = buildPerformanceRows(
      snapshot,
      [{ ...tabs[0], webContentsId: undefined, url: '' }],
      new Map(),
      new Map()
    );
    expect(rows.at(-1)).toMatchObject({
      pid: null,
      memoryBytes: null,
      detail: 'New tab · no page loaded',
    });
  });
  it('sorts numbers numerically in both directions and keeps missing values last', () => {
    const rows = buildPerformanceRows(snapshot, [], new Map(), new Map());
    rows[0].memoryBytes = 50;
    rows[1].memoryBytes = null;
    expect(sortPerformanceRows(rows, 'memoryBytes', 'desc').map((row) => row.pid)).toEqual([
      3, 1, 2,
    ]);
    expect(sortPerformanceRows(rows, 'memoryBytes', 'asc').map((row) => row.pid)).toEqual([
      1, 3, 2,
    ]);
  });
  it('keeps WSL processes separate from browser renderers with the same PID', () => {
    const rows = buildPerformanceRows(
      { ...snapshot, processes: [...snapshot.processes, { ...process(3, 500), distro: 'Ubuntu' }] },
      tabs,
      new Map(),
      new Map()
    );
    expect(rows.some((row) => row.process?.distro === 'Ubuntu' && row.memoryBytes === 500)).toBe(
      true
    );
    expect(rows.filter((row) => row.browser).every((row) => row.memoryBytes === 300)).toBe(true);
  });
  it('does not treat missing measurements as zero', () => {
    expect(sumUsage([{ ...process(1, 100), cpuPercent: null }], 'cpuPercent')).toBeNull();
  });
});
