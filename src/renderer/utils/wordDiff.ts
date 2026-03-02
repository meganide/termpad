import DiffMatchPatch from 'diff-match-patch';

/**
 * Represents a segment of text in a word diff result.
 */
export interface DiffSegment {
  text: string;
  type: 'unchanged' | 'added' | 'removed';
}

// Create a single instance for reuse
const dmp = new DiffMatchPatch();

/**
 * Compute word-level (actually character-level) diff between two lines.
 * Returns an array of DiffSegment objects indicating what changed.
 *
 * @param oldLine - The original line (deleted/removed line)
 * @param newLine - The new line (added line)
 * @returns Array of DiffSegment objects
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string
): DiffSegment[] {
  // Handle edge cases
  if (!oldLine && !newLine) {
    return [];
  }

  if (!oldLine) {
    return [{ text: newLine, type: 'added' }];
  }

  if (!newLine) {
    return [{ text: oldLine, type: 'removed' }];
  }

  // Compute the diff
  const diffs = dmp.diff_main(oldLine, newLine);

  // Optionally clean up the diff for better readability
  dmp.diff_cleanupSemantic(diffs);

  // Convert diff-match-patch format to our DiffSegment format
  // diff-match-patch uses: 0 = equal, -1 = delete, 1 = insert
  return diffs.map(([operation, text]) => ({
    text,
    type: operation === 0 ? 'unchanged' : operation === -1 ? 'removed' : 'added',
  }));
}

/**
 * Extract segments for rendering on the "old" (deletion) side.
 * Returns only 'unchanged' and 'removed' segments.
 */
export function getOldLineSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.filter((seg) => seg.type !== 'added');
}

/**
 * Extract segments for rendering on the "new" (addition) side.
 * Returns only 'unchanged' and 'added' segments.
 */
export function getNewLineSegments(segments: DiffSegment[]): DiffSegment[] {
  return segments.filter((seg) => seg.type !== 'removed');
}

/**
 * Check if a diff result represents only whitespace changes.
 */
export function isWhitespaceOnlyChange(segments: DiffSegment[]): boolean {
  for (const segment of segments) {
    if (segment.type !== 'unchanged') {
      // Check if the changed text is only whitespace
      if (segment.text.trim() !== '') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Limit diff computation for very long lines to avoid performance issues.
 * If either line exceeds the threshold, returns a simple "whole line changed" result.
 */
export function computeWordDiffWithLimit(
  oldLine: string,
  newLine: string,
  maxLength = 10000
): DiffSegment[] {
  // For very long lines, skip detailed diff and mark entire line as changed
  if (oldLine.length > maxLength || newLine.length > maxLength) {
    const result: DiffSegment[] = [];
    if (oldLine) {
      result.push({ text: oldLine, type: 'removed' });
    }
    if (newLine) {
      result.push({ text: newLine, type: 'added' });
    }
    return result;
  }

  return computeWordDiff(oldLine, newLine);
}
