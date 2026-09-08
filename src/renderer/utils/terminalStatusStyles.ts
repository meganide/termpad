import type { TerminalStatus } from '../../shared/types';

export const TERMINAL_STATUS_LABELS: Record<TerminalStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  stopped: 'Stopped',
  error: 'Error',
};

const STATUS_DOT_COLORS: Record<TerminalStatus, string> = {
  starting: 'bg-status-starting',
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  idle: 'bg-status-idle',
  stopped: 'bg-status-stopped',
  error: 'bg-status-error',
};

const STATUS_HOVER_RING_COLORS: Record<TerminalStatus, string> = {
  starting: 'hover:ring-status-starting/40',
  running: 'hover:ring-status-running/40',
  waiting: 'hover:ring-status-waiting/40',
  idle: 'hover:ring-status-idle/40',
  stopped: 'hover:ring-status-stopped/40',
  error: 'hover:ring-status-error/40',
};

export function getStatusDotColor(status: TerminalStatus): string {
  return STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.idle;
}

export function getStatusHoverRingColor(status: TerminalStatus): string {
  return STATUS_HOVER_RING_COLORS[status] ?? STATUS_HOVER_RING_COLORS.idle;
}

export function isStatusPulsing(status: TerminalStatus): boolean {
  return status === 'starting' || status === 'running';
}
