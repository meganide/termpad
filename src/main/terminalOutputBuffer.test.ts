import { describe, it, expect } from 'vitest';
import { TerminalOutputBuffer } from './terminalOutput';

describe('TerminalOutputBuffer', () => {
  it('bounds redraw output without newlines and preserves UTF-8 characters', () => {
    const buffer = new TerminalOutputBuffer(10_000, 32);
    for (let i = 0; i < 1000; i++) buffer.append('\r' + '🌍'.repeat(10));
    expect(Buffer.byteLength(buffer.getAll())).toBeLessThanOrEqual(32);
    expect(buffer.getAll()).not.toContain('�');
    expect(buffer.getLineCount()).toBe(0);
  });

  it('stores and retrieves appended data', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('hello\n');
    buffer.append('world\n');
    expect(buffer.getAll()).toBe('hello\nworld\n');
  });

  it('returns empty string when no data appended', () => {
    const buffer = new TerminalOutputBuffer();
    expect(buffer.getAll()).toBe('');
  });

  it('clears all data', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('data\n');
    buffer.clear();
    expect(buffer.getAll()).toBe('');
    expect(buffer.getLineCount()).toBe(0);
  });

  it('counts newlines correctly', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('line1\nline2\nline3\n');
    expect(buffer.getLineCount()).toBe(3);
  });

  it('trims oldest chunks when exceeding max lines', () => {
    const buffer = new TerminalOutputBuffer(5);

    // Append 3 lines
    buffer.append('line1\nline2\nline3\n');
    // Append 4 more lines (total 7, exceeds 5)
    buffer.append('line4\nline5\nline6\nline7\n');

    // First chunk (3 lines) should be trimmed
    const result = buffer.getAll();
    expect(result).toBe('line4\nline5\nline6\nline7\n');
    expect(buffer.getLineCount()).toBe(4);
  });

  it('handles data without newlines', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('no newline here');
    expect(buffer.getAll()).toBe('no newline here');
    expect(buffer.getLineCount()).toBe(0);
  });

  it('handles mixed data with ANSI escape sequences', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('\x1b[32mgreen text\x1b[0m\n');
    buffer.append('\x1b[1mbold\x1b[0m\n');
    expect(buffer.getAll()).toBe('\x1b[32mgreen text\x1b[0m\n\x1b[1mbold\x1b[0m\n');
    expect(buffer.getLineCount()).toBe(2);
  });

  it('bounds a single large chunk by the line limit', () => {
    const buffer = new TerminalOutputBuffer(3);
    // One oversized chunk must also be trimmed.
    buffer.append('a\nb\nc\nd\ne\n');
    expect(buffer.getAll()).toBe('c\nd\ne\n');
    expect(buffer.getLineCount()).toBe(3);
  });

  it('trims correctly with many small chunks', () => {
    const buffer = new TerminalOutputBuffer(3);

    buffer.append('a\n');
    buffer.append('b\n');
    buffer.append('c\n');
    // Still at 3 lines, no trimming
    expect(buffer.getAll()).toBe('a\nb\nc\n');

    // Add one more, should trim oldest
    buffer.append('d\n');
    expect(buffer.getLineCount()).toBeLessThanOrEqual(3);
    // 'a\n' should be dropped
    expect(buffer.getAll()).not.toContain('a\n');
    expect(buffer.getAll()).toContain('d\n');
  });
});
