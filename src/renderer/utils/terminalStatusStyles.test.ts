import { describe, it, expect } from 'vitest';
import type { TerminalStatus } from '../../shared/types';
import {
  TERMINAL_STATUS_LABELS,
  getStatusDotColor,
  getStatusHoverRingColor,
  isStatusPulsing,
} from './terminalStatusStyles';

const ALL_STATUSES: TerminalStatus[] = [
  'starting',
  'running',
  'waiting',
  'idle',
  'stopped',
  'error',
];

describe('terminalStatusStyles', () => {
  it('has a label for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(TERMINAL_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('returns a distinct dot color for every status', () => {
    const colors = ALL_STATUSES.map(getStatusDotColor);
    expect(new Set(colors).size).toBe(ALL_STATUSES.length);
  });

  it('returns a hover ring color for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(getStatusHoverRingColor(status)).toContain('hover:ring-status-');
    }
  });

  it('falls back to idle styles for unknown statuses', () => {
    const unknown = 'bogus' as TerminalStatus;
    expect(getStatusDotColor(unknown)).toBe(getStatusDotColor('idle'));
    expect(getStatusHoverRingColor(unknown)).toBe(getStatusHoverRingColor('idle'));
  });

  it('pulses only while starting or running', () => {
    expect(isStatusPulsing('starting')).toBe(true);
    expect(isStatusPulsing('running')).toBe(true);
    expect(isStatusPulsing('waiting')).toBe(false);
    expect(isStatusPulsing('idle')).toBe(false);
    expect(isStatusPulsing('stopped')).toBe(false);
    expect(isStatusPulsing('error')).toBe(false);
  });
});
