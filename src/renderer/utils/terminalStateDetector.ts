import type { TerminalStatus } from '../../shared/types';

// Activity timeout - if no output for this duration, terminal is considered idle
export const ACTIVITY_TIMEOUT_MS = 4000; // 4 seconds

// Strip ANSI escape codes and control characters from terminal output
function stripAnsi(str: string): string {
  return (
    str
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // CSI sequences
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, '')
  ); // Other control chars (keep \n \r)
}

// Generic waiting patterns that work across CLI tools (Claude, Gemini, Codex, etc.)
// These detect interactive prompts that require user input
export const WAITING_PATTERNS: RegExp[] = [
  // Yes/No prompts (common across many CLI tools)
  /\(y\/n\)/i,
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /\(yes\/no\)/i,

  // Generic confirmation prompts
  /Continue\?/i,
  /Proceed\?/i,
  /Confirm\?/i,
  /Press Enter/i,
  /Press any key/i,
  /Do you want to/i,
  /Would you like to/i,
  /waiting for input/i,

  // Claude Code specific (keep for best experience with Claude)
  /Yes, allow once/i,
  /Yes, allow always/i,
  /No, deny/i,
  /Allow once/i,
  /Allow always/i,
  /Esc to cancel/i,
  /Tab to add additional instructions/i,
  /chat about this/i,
  /enter to select/i,
];

export type DetectedState = Extract<TerminalStatus, 'running' | 'waiting' | 'idle'> | null;

/**
 * Detect waiting state from terminal output patterns.
 */
export function detectWaitingState(output: string): boolean {
  // Strip ANSI codes for cleaner pattern matching
  const cleanOutput = stripAnsi(output);
  // Check most recent output (last 300 chars)
  const recentOutput = cleanOutput.slice(-300);

  for (const pattern of WAITING_PATTERNS) {
    if (pattern.test(recentOutput)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine terminal state based on activity and patterns.
 *
 * Priority order:
 * 1. Waiting patterns (highest) - user needs to respond to a prompt
 * 2. Activity-based running - output is actively streaming
 * 3. Default idle - no activity
 */
export function determineTerminalState(
  lastOutputTime: number,
  outputBuffer: string,
  now: number = Date.now()
): DetectedState {
  const timeSinceLastOutput = now - lastOutputTime;
  const isRecentActivity = lastOutputTime > 0 && timeSinceLastOutput < ACTIVITY_TIMEOUT_MS;

  // Check waiting patterns first (highest priority)
  if (detectWaitingState(outputBuffer)) {
    return 'waiting';
  }

  // If we received output recently, terminal is running
  if (isRecentActivity) {
    return 'running';
  }

  // No activity = idle
  return 'idle';
}

export class OutputBuffer {
  private buffer = '';
  private maxSize: number;
  private lastDataTime = 0;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  append(data: string): void {
    this.buffer += data;
    this.lastDataTime = Date.now();
    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  getBuffer(): string {
    return this.buffer;
  }

  clear(): void {
    this.buffer = '';
    this.lastDataTime = 0;
  }

  getLastDataTime(): number {
    return this.lastDataTime;
  }

  /**
   * Determine terminal state based on activity and patterns.
   * @param now - Current timestamp (default: Date.now())
   * @param overrideLastOutputTime - Optional override for lastDataTime (used to ignore echo)
   */
  detectState(now: number = Date.now(), overrideLastOutputTime?: number): DetectedState {
    const effectiveLastOutputTime =
      overrideLastOutputTime !== undefined ? overrideLastOutputTime : this.lastDataTime;
    return determineTerminalState(effectiveLastOutputTime, this.buffer, now);
  }
}
