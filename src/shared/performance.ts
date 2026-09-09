export interface PerformanceProcess {
  pid: number;
  distro?: string;
  startedAt: string;
  name: string;
  kind: 'terminal' | 'process' | 'app';
  terminalId?: string;
  cpuPercent: number | null;
  memoryBytes: number | null;
  canStop: boolean;
}

export interface PerformanceSnapshot {
  processes: PerformanceProcess[];
  browsers: { webContentsId: number; pid: number }[];
  capturedAt: number;
  warnings: string[];
}

export interface PerformanceAPI {
  list: () => Promise<PerformanceSnapshot>;
  stop: (process: PerformanceProcess, force?: boolean) => Promise<void>;
}

export const performanceProcessKey = (entry: { pid: number; distro?: string }): string =>
  JSON.stringify([entry.distro ?? '', entry.pid]);
