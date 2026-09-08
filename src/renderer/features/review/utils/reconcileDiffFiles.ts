import type { DiffFile } from '../../../../shared/reviewTypes';

function equalFile(a: DiffFile, b: DiffFile): boolean {
  if (
    a.path !== b.path ||
    a.oldPath !== b.oldPath ||
    a.status !== b.status ||
    a.additions !== b.additions ||
    a.deletions !== b.deletions ||
    a.isBinary !== b.isBinary ||
    a.hunks.length !== b.hunks.length
  )
    return false;
  return a.hunks.every((hunk, i) => {
    const other = b.hunks[i];
    return (
      hunk.header === other.header &&
      hunk.oldStart === other.oldStart &&
      hunk.newStart === other.newStart &&
      hunk.oldLines === other.oldLines &&
      hunk.newLines === other.newLines &&
      hunk.lines.length === other.lines.length &&
      hunk.lines.every((line, j) => {
        const next = other.lines[j];
        return (
          line.type === next.type &&
          line.content === next.content &&
          line.oldLineNumber === next.oldLineNumber &&
          line.newLineNumber === next.newLineNumber
        );
      })
    );
  });
}

/** IPC clones objects. Restore identity for unchanged files in linear time. */
export function reconcileDiffFiles(previous: DiffFile[], incoming: DiffFile[]): DiffFile[] {
  const byPath = new Map(previous.map((file) => [file.path, file]));
  const files = incoming.map((file) => {
    const old = byPath.get(file.path);
    return old && equalFile(old, file) ? old : file;
  });
  return files.length === previous.length && files.every((file, i) => file === previous[i])
    ? previous
    : files;
}
