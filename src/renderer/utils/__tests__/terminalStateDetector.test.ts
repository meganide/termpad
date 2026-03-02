import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectWaitingState,
  determineTerminalState,
  OutputBuffer,
  WAITING_PATTERNS,
  ACTIVITY_TIMEOUT_MS,
} from '../terminalStateDetector';

describe('ACTIVITY_TIMEOUT_MS', () => {
  it('should be 4 seconds', () => {
    expect(ACTIVITY_TIMEOUT_MS).toBe(4000);
  });
});

describe('detectWaitingState', () => {
  describe('generic yes/no prompts', () => {
    it('should detect (y/n) prompt', () => {
      expect(detectWaitingState('Do you want to continue? (y/n)')).toBe(true);
    });

    it('should detect [Y/n] prompt', () => {
      expect(detectWaitingState('Proceed with installation? [Y/n]')).toBe(true);
    });

    it('should detect [y/N] prompt', () => {
      expect(detectWaitingState('Overwrite file? [y/N]')).toBe(true);
    });

    it('should detect (yes/no) prompt', () => {
      expect(detectWaitingState('Are you sure? (yes/no)')).toBe(true);
    });
  });

  describe('generic confirmation prompts', () => {
    it('should detect Continue? prompt', () => {
      expect(detectWaitingState('Continue?')).toBe(true);
    });

    it('should detect Proceed? prompt', () => {
      expect(detectWaitingState('Proceed?')).toBe(true);
    });

    it('should detect Confirm? prompt', () => {
      expect(detectWaitingState('Confirm?')).toBe(true);
    });

    it('should detect Press Enter prompt', () => {
      expect(detectWaitingState('Press Enter to continue')).toBe(true);
    });

    it('should detect Press any key prompt', () => {
      expect(detectWaitingState('Press any key to continue...')).toBe(true);
    });

    it('should detect waiting for input message', () => {
      expect(detectWaitingState('The system is waiting for input')).toBe(true);
    });

    it('should detect Do you want to prompt', () => {
      expect(detectWaitingState('Do you want to proceed?')).toBe(true);
    });

    it('should detect Would you like to prompt', () => {
      expect(detectWaitingState('Would you like to save the file?')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(detectWaitingState('WOULD YOU LIKE TO CONTINUE?')).toBe(true);
      expect(detectWaitingState('would you like to continue?')).toBe(true);
    });
  });

  describe('Claude Code specific prompts', () => {
    it('should detect "Yes, allow once"', () => {
      expect(detectWaitingState('Yes, allow once')).toBe(true);
    });

    it('should detect "Yes, allow always"', () => {
      expect(detectWaitingState('Yes, allow always')).toBe(true);
    });

    it('should detect "No, deny"', () => {
      expect(detectWaitingState('No, deny')).toBe(true);
    });

    it('should detect "Allow once"', () => {
      expect(detectWaitingState('Allow once')).toBe(true);
    });

    it('should detect "Allow always"', () => {
      expect(detectWaitingState('Allow always')).toBe(true);
    });

    it('should detect "Esc to cancel" (AskUserQuestion)', () => {
      expect(detectWaitingState('Select an option\nEsc to cancel')).toBe(true);
    });

    it('should detect "Tab to add additional instructions" (AskUserQuestion)', () => {
      expect(detectWaitingState('Choose:\nTab to add additional instructions')).toBe(true);
    });

    it('should detect "chat about this" (AskUserQuestion)', () => {
      expect(detectWaitingState('Options available\nchat about this')).toBe(true);
    });

    it('should detect "enter to select" (AskUserQuestion)', () => {
      expect(detectWaitingState('Pick one:\nenter to select')).toBe(true);
      expect(detectWaitingState('Pick one:\nEnter to select')).toBe(true);
    });
  });

  describe('non-waiting output', () => {
    it('should return false for random text', () => {
      expect(detectWaitingState('Some random text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(detectWaitingState('')).toBe(false);
    });

    it('should return false for code output', () => {
      expect(detectWaitingState('function test() { return true; }')).toBe(false);
    });
  });

  describe('ANSI code stripping', () => {
    it('should strip CSI sequences', () => {
      const output = '\x1b[32mContinue?\x1b[0m';
      expect(detectWaitingState(output)).toBe(true);
    });

    it('should strip OSC sequences', () => {
      const output = '\x1b]0;Title\x07Continue?';
      expect(detectWaitingState(output)).toBe(true);
    });

    it('should strip control characters', () => {
      const output = '\x01\x02Continue?\x03';
      expect(detectWaitingState(output)).toBe(true);
    });
  });

  describe('uses last 300 characters', () => {
    it('should detect patterns in recent output', () => {
      const longPrefix = 'x'.repeat(1000);
      const output = longPrefix + 'Continue?';
      expect(detectWaitingState(output)).toBe(true);
    });

    it('should not detect patterns outside last 300 characters', () => {
      const output = 'Continue?' + 'x'.repeat(400);
      expect(detectWaitingState(output)).toBe(false);
    });
  });
});

describe('determineTerminalState', () => {
  describe('waiting state (highest priority)', () => {
    it('should return waiting immediately when waiting pattern detected', () => {
      const now = Date.now();
      const lastOutputTime = now - 1000; // 1 second ago (recent activity)
      // Waiting has highest priority, even with recent activity
      expect(determineTerminalState(lastOutputTime, 'Continue?', now)).toBe('waiting');
    });

    it('should return waiting for y/n prompt regardless of activity', () => {
      const now = Date.now();
      const lastOutputTime = now - 500; // very recent
      expect(determineTerminalState(lastOutputTime, 'Proceed? (y/n)', now)).toBe('waiting');
    });
  });

  describe('running state (activity-based)', () => {
    it('should return running if output received within timeout and no patterns', () => {
      const now = Date.now();
      const lastOutputTime = now - 1000; // 1 second ago
      expect(determineTerminalState(lastOutputTime, 'Working on task...', now)).toBe('running');
    });

    it('should return running at exactly timeout boundary minus 1ms', () => {
      const now = Date.now();
      const lastOutputTime = now - ACTIVITY_TIMEOUT_MS + 1;
      expect(determineTerminalState(lastOutputTime, 'still working', now)).toBe('running');
    });
  });

  describe('idle state (timeout-based)', () => {
    it('should return idle if timeout passed and no patterns', () => {
      const now = Date.now();
      const lastOutputTime = now - ACTIVITY_TIMEOUT_MS - 1000; // 5 seconds ago (past the 4s timeout)
      expect(determineTerminalState(lastOutputTime, 'random text', now)).toBe('idle');
    });

    it('should return idle if lastOutputTime is 0 (no output yet)', () => {
      const now = Date.now();
      expect(determineTerminalState(0, '', now)).toBe('idle');
    });

    it('should return idle at exactly timeout boundary', () => {
      const now = Date.now();
      const lastOutputTime = now - ACTIVITY_TIMEOUT_MS;
      expect(determineTerminalState(lastOutputTime, 'no patterns here', now)).toBe('idle');
    });
  });
});

describe('exported pattern arrays', () => {
  it('WAITING_PATTERNS should be an array of RegExp', () => {
    expect(Array.isArray(WAITING_PATTERNS)).toBe(true);
    expect(WAITING_PATTERNS.length).toBeGreaterThan(0);
    expect(WAITING_PATTERNS.every((p) => p instanceof RegExp)).toBe(true);
  });
});

describe('OutputBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create buffer with default values', () => {
      const buffer = new OutputBuffer();
      expect(buffer.getBuffer()).toBe('');
      expect(buffer.getLastDataTime()).toBe(0);
    });

    it('should accept custom maxSize', () => {
      const buffer = new OutputBuffer(5000);
      expect(buffer.getBuffer()).toBe('');
    });
  });

  describe('append', () => {
    it('should append data to buffer', () => {
      const buffer = new OutputBuffer();
      buffer.append('Hello');
      expect(buffer.getBuffer()).toBe('Hello');
    });

    it('should append multiple data', () => {
      const buffer = new OutputBuffer();
      buffer.append('Hello');
      buffer.append(' World');
      expect(buffer.getBuffer()).toBe('Hello World');
    });

    it('should update lastDataTime', () => {
      vi.setSystemTime(new Date(1000));
      const buffer = new OutputBuffer();
      buffer.append('test');
      expect(buffer.getLastDataTime()).toBe(1000);
    });

    it('should trim buffer when exceeding maxSize', () => {
      const buffer = new OutputBuffer(10);
      buffer.append('12345');
      buffer.append('67890');
      buffer.append('abcde');
      expect(buffer.getBuffer()).toBe('67890abcde');
      expect(buffer.getBuffer().length).toBeLessThanOrEqual(10);
    });
  });

  describe('getBuffer', () => {
    it('should return current buffer contents', () => {
      const buffer = new OutputBuffer();
      buffer.append('test content');
      expect(buffer.getBuffer()).toBe('test content');
    });
  });

  describe('clear', () => {
    it('should clear buffer contents and lastDataTime', () => {
      vi.setSystemTime(new Date(1000));
      const buffer = new OutputBuffer();
      buffer.append('test content');
      buffer.clear();
      expect(buffer.getBuffer()).toBe('');
      expect(buffer.getLastDataTime()).toBe(0);
    });
  });

  describe('getLastDataTime', () => {
    it('should return 0 initially', () => {
      const buffer = new OutputBuffer();
      expect(buffer.getLastDataTime()).toBe(0);
    });

    it('should return timestamp of last append', () => {
      vi.setSystemTime(new Date(5000));
      const buffer = new OutputBuffer();
      buffer.append('test');
      expect(buffer.getLastDataTime()).toBe(5000);
    });
  });

  describe('detectState', () => {
    it('should return running if output was recent and no patterns', () => {
      vi.setSystemTime(new Date(10000));
      const buffer = new OutputBuffer();
      buffer.append('some output without patterns');
      // Still within the 4s window
      vi.setSystemTime(new Date(11000));
      expect(buffer.detectState()).toBe('running');
    });

    it('should return waiting if waiting pattern present', () => {
      vi.setSystemTime(new Date(10000));
      const buffer = new OutputBuffer();
      buffer.append('Continue?');
      // Even with recent output, waiting takes priority
      vi.setSystemTime(new Date(12000));
      expect(buffer.detectState()).toBe('waiting');
    });

    it('should return idle if timeout passed and no patterns', () => {
      vi.setSystemTime(new Date(10000));
      const buffer = new OutputBuffer();
      buffer.append('random text');
      // After 20s timeout
      vi.setSystemTime(new Date(10000 + ACTIVITY_TIMEOUT_MS + 1000));
      expect(buffer.detectState()).toBe('idle');
    });

    it('should return idle if no output ever received', () => {
      const buffer = new OutputBuffer();
      expect(buffer.detectState()).toBe('idle');
    });

    it('should use overrideLastOutputTime when provided', () => {
      vi.setSystemTime(new Date(10000));
      const buffer = new OutputBuffer();
      buffer.append('some output');
      // Last data time is 10000, but override with 0 to simulate "ignore this output"
      vi.setSystemTime(new Date(11000));
      // Without override, would be 'running' since 11000 - 10000 = 1000ms < 4000ms timeout
      expect(buffer.detectState(11000)).toBe('running');
      // With override of 0, should be 'idle' since effective last output time is 0
      expect(buffer.detectState(11000, 0)).toBe('idle');
    });

    it('should use actual lastDataTime when overrideLastOutputTime is undefined', () => {
      vi.setSystemTime(new Date(10000));
      const buffer = new OutputBuffer();
      buffer.append('some output');
      vi.setSystemTime(new Date(11000));
      // When overrideLastOutputTime is undefined, should use actual lastDataTime
      expect(buffer.detectState(11000, undefined)).toBe('running');
    });
  });
});
