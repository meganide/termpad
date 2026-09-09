export type PortOrigin = 'termpad' | 'outside';

export interface ListeningPort {
  pid: number;
  name: string;
  port: number;
  address: string;
  startedAt: string;
  distro?: string;
  canStop: boolean;
  origin: PortOrigin;
  terminalId?: string;
  /** OS CPU average; 100% represents one logical CPU. Null when unavailable. */
  cpuPercent: number | null;
  /** Resident memory / working set, in bytes; excludes child processes. */
  memoryBytes: number | null;
}

export interface PortScanResult {
  ports: ListeningPort[];
  warnings: string[];
}

export interface PortsAPI {
  list(): Promise<PortScanResult>;
  stop(port: ListeningPort, force?: boolean): Promise<{ success: boolean; error?: string }>;
}

export interface PortTerminalProcess {
  id: string;
  pid: number;
}
