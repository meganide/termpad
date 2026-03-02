import { describe, it, expect } from 'vitest';
import {
  computeWordDiff,
  computeWordDiffWithLimit,
  getOldLineSegments,
  getNewLineSegments,
  isWhitespaceOnlyChange,
  DiffSegment,
} from './wordDiff';

describe('wordDiff utilities', () => {
  describe('computeWordDiff', () => {
    it('should return empty array for two empty strings', () => {
      expect(computeWordDiff('', '')).toEqual([]);
    });

    it('should mark entire line as added when old line is empty', () => {
      const result = computeWordDiff('', 'new line');
      expect(result).toEqual([{ text: 'new line', type: 'added' }]);
    });

    it('should mark entire line as removed when new line is empty', () => {
      const result = computeWordDiff('old line', '');
      expect(result).toEqual([{ text: 'old line', type: 'removed' }]);
    });

    it('should return unchanged when lines are identical', () => {
      const result = computeWordDiff('same text', 'same text');
      expect(result).toEqual([{ text: 'same text', type: 'unchanged' }]);
    });

    it('should detect basic word changes', () => {
      const result = computeWordDiff('hello world', 'hello there');
      // Should have unchanged 'hello ' and some changes for 'world' -> 'there'
      expect(result.length).toBeGreaterThan(1);
      expect(result.some((s) => s.type === 'unchanged')).toBe(true);
      expect(result.some((s) => s.type === 'removed')).toBe(true);
      expect(result.some((s) => s.type === 'added')).toBe(true);
    });

    it('should handle single character changes', () => {
      const result = computeWordDiff('cat', 'car');
      expect(result).toContainEqual({ text: 'ca', type: 'unchanged' });
      expect(result).toContainEqual({ text: 't', type: 'removed' });
      expect(result).toContainEqual({ text: 'r', type: 'added' });
    });

    it('should handle insertion at the beginning', () => {
      const result = computeWordDiff('world', 'hello world');
      expect(result).toContainEqual({ text: 'hello ', type: 'added' });
      expect(result).toContainEqual({ text: 'world', type: 'unchanged' });
    });

    it('should handle insertion at the end', () => {
      const result = computeWordDiff('hello', 'hello world');
      expect(result).toContainEqual({ text: 'hello', type: 'unchanged' });
      expect(result).toContainEqual({ text: ' world', type: 'added' });
    });

    it('should handle deletion at the beginning', () => {
      const result = computeWordDiff('hello world', 'world');
      expect(result).toContainEqual({ text: 'hello ', type: 'removed' });
      expect(result).toContainEqual({ text: 'world', type: 'unchanged' });
    });

    it('should handle deletion at the end', () => {
      const result = computeWordDiff('hello world', 'hello');
      expect(result).toContainEqual({ text: 'hello', type: 'unchanged' });
      expect(result).toContainEqual({ text: ' world', type: 'removed' });
    });

    it('should handle whitespace-only changes', () => {
      const result = computeWordDiff('hello  world', 'hello world');
      expect(result.length).toBeGreaterThan(0);
      // The diff should contain a removed space
      const hasRemovedSpace = result.some(
        (s) => s.type === 'removed' && s.text.includes(' ')
      );
      expect(hasRemovedSpace).toBe(true);
    });

    it('should handle complete line replacement', () => {
      const result = computeWordDiff('abc', 'xyz');
      expect(result).toContainEqual({ text: 'abc', type: 'removed' });
      expect(result).toContainEqual({ text: 'xyz', type: 'added' });
    });

    it('should handle code-like changes', () => {
      const result = computeWordDiff(
        'const foo = 1;',
        'const bar = 2;'
      );
      expect(result.some((s) => s.type === 'unchanged')).toBe(true);
      expect(result.some((s) => s.type === 'removed')).toBe(true);
      expect(result.some((s) => s.type === 'added')).toBe(true);
    });

    it('should handle special characters', () => {
      const result = computeWordDiff('<div>', '<span>');
      expect(result).toContainEqual({ text: '<', type: 'unchanged' });
      expect(result).toContainEqual({ text: 'div', type: 'removed' });
      expect(result).toContainEqual({ text: 'span', type: 'added' });
      expect(result).toContainEqual({ text: '>', type: 'unchanged' });
    });

    it('should handle unicode characters', () => {
      const result = computeWordDiff('hello 世界', 'hello 世界!');
      expect(result.some((s) => s.type === 'unchanged')).toBe(true);
      expect(result.some((s) => s.type === 'added' && s.text === '!')).toBe(true);
    });
  });

  describe('getOldLineSegments', () => {
    it('should filter out added segments', () => {
      const segments: DiffSegment[] = [
        { text: 'hello ', type: 'unchanged' },
        { text: 'world', type: 'removed' },
        { text: 'there', type: 'added' },
      ];
      const result = getOldLineSegments(segments);
      expect(result).toEqual([
        { text: 'hello ', type: 'unchanged' },
        { text: 'world', type: 'removed' },
      ]);
    });

    it('should return empty array for all-added segments', () => {
      const segments: DiffSegment[] = [
        { text: 'new text', type: 'added' },
      ];
      const result = getOldLineSegments(segments);
      expect(result).toEqual([]);
    });

    it('should return all segments when none are added', () => {
      const segments: DiffSegment[] = [
        { text: 'hello', type: 'unchanged' },
        { text: ' world', type: 'removed' },
      ];
      const result = getOldLineSegments(segments);
      expect(result).toEqual(segments);
    });
  });

  describe('getNewLineSegments', () => {
    it('should filter out removed segments', () => {
      const segments: DiffSegment[] = [
        { text: 'hello ', type: 'unchanged' },
        { text: 'world', type: 'removed' },
        { text: 'there', type: 'added' },
      ];
      const result = getNewLineSegments(segments);
      expect(result).toEqual([
        { text: 'hello ', type: 'unchanged' },
        { text: 'there', type: 'added' },
      ]);
    });

    it('should return empty array for all-removed segments', () => {
      const segments: DiffSegment[] = [
        { text: 'old text', type: 'removed' },
      ];
      const result = getNewLineSegments(segments);
      expect(result).toEqual([]);
    });

    it('should return all segments when none are removed', () => {
      const segments: DiffSegment[] = [
        { text: 'hello', type: 'unchanged' },
        { text: ' world', type: 'added' },
      ];
      const result = getNewLineSegments(segments);
      expect(result).toEqual(segments);
    });
  });

  describe('isWhitespaceOnlyChange', () => {
    it('should return true for whitespace-only changes', () => {
      const segments: DiffSegment[] = [
        { text: 'hello', type: 'unchanged' },
        { text: '  ', type: 'removed' },
        { text: ' ', type: 'added' },
        { text: 'world', type: 'unchanged' },
      ];
      expect(isWhitespaceOnlyChange(segments)).toBe(true);
    });

    it('should return false for non-whitespace changes', () => {
      const segments: DiffSegment[] = [
        { text: 'hello ', type: 'unchanged' },
        { text: 'world', type: 'removed' },
        { text: 'there', type: 'added' },
      ];
      expect(isWhitespaceOnlyChange(segments)).toBe(false);
    });

    it('should return true when no changes', () => {
      const segments: DiffSegment[] = [
        { text: 'unchanged text', type: 'unchanged' },
      ];
      expect(isWhitespaceOnlyChange(segments)).toBe(true);
    });

    it('should handle tabs and newlines as whitespace', () => {
      const segments: DiffSegment[] = [
        { text: 'hello', type: 'unchanged' },
        { text: '\t', type: 'added' },
      ];
      expect(isWhitespaceOnlyChange(segments)).toBe(true);
    });
  });

  describe('computeWordDiffWithLimit', () => {
    it('should work normally for short lines', () => {
      const result = computeWordDiffWithLimit('hello', 'world', 100);
      expect(result).toContainEqual({ text: 'hello', type: 'removed' });
      expect(result).toContainEqual({ text: 'world', type: 'added' });
    });

    it('should return simple diff for lines exceeding limit', () => {
      const longOld = 'a'.repeat(200);
      const longNew = 'b'.repeat(200);
      const result = computeWordDiffWithLimit(longOld, longNew, 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: longOld, type: 'removed' });
      expect(result[1]).toEqual({ text: longNew, type: 'added' });
    });

    it('should return simple diff when only old line exceeds limit', () => {
      const longOld = 'a'.repeat(200);
      const shortNew = 'short';
      const result = computeWordDiffWithLimit(longOld, shortNew, 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: longOld, type: 'removed' });
      expect(result[1]).toEqual({ text: shortNew, type: 'added' });
    });

    it('should return simple diff when only new line exceeds limit', () => {
      const shortOld = 'short';
      const longNew = 'b'.repeat(200);
      const result = computeWordDiffWithLimit(shortOld, longNew, 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: shortOld, type: 'removed' });
      expect(result[1]).toEqual({ text: longNew, type: 'added' });
    });

    it('should use default limit of 10000', () => {
      // Normal lines should work with default limit
      const result = computeWordDiffWithLimit('hello', 'world');
      expect(result.some((s) => s.type === 'removed')).toBe(true);
      expect(result.some((s) => s.type === 'added')).toBe(true);
    });

    it('should handle empty old line with long new line', () => {
      const longNew = 'b'.repeat(200);
      const result = computeWordDiffWithLimit('', longNew, 100);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: longNew, type: 'added' });
    });

    it('should handle long old line with empty new line', () => {
      const longOld = 'a'.repeat(200);
      const result = computeWordDiffWithLimit(longOld, '', 100);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: longOld, type: 'removed' });
    });
  });
});
