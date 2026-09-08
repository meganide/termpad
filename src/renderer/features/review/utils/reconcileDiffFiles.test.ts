import { describe, expect, it } from 'vitest';
import { reconcileDiffFiles } from './reconcileDiffFiles';
import type { DiffFile } from '../../../../shared/reviewTypes';

const file = (path: string): DiffFile => ({
  path,
  status: 'added',
  additions: 1,
  deletions: 0,
  isBinary: false,
  hunks: [
    {
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      header: '@@ -0,0 +1 @@',
      lines: [{ type: 'add', newLineNumber: 1, content: 'before' }],
    },
  ],
});

describe('review refresh reconciliation', () => {
  it('reuses identical files but detects content changes with identical line counts', () => {
    const previous = [file('a'), file('b')];
    const incoming = JSON.parse(JSON.stringify(previous)) as DiffFile[];
    expect(reconcileDiffFiles(previous, incoming)).toBe(previous);
    incoming[1].hunks[0].lines[0].content = 'after';
    const result = reconcileDiffFiles(previous, incoming);
    expect(result[0]).toBe(previous[0]);
    expect(result[1]).toBe(incoming[1]);
    expect(result[1]).not.toBe(previous[1]);
    expect(reconcileDiffFiles(previous, [])).toEqual([]);
    expect(reconcileDiffFiles(previous, [...previous].reverse())).toEqual([...previous].reverse());
  });
});
