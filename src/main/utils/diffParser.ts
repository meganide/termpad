import type {
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLineType,
  DiffFileStatus,
} from '../../shared/reviewTypes';

/**
 * Parse a unified diff output from git into structured DiffFile objects.
 */
export function parseDiff(diffOutput: string): DiffFile[] {
  if (!diffOutput.trim()) {
    return [];
  }

  const files: DiffFile[] = [];
  const lines = diffOutput.split('\n');
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Start of a new file diff
    if (line.startsWith('diff --git ')) {
      if (currentFile) {
        if (currentHunk && currentHunk.lines.length > 0) {
          currentFile.hunks.push(currentHunk);
        }
        files.push(currentFile);
      }

      const { path, oldPath, status } = parseFileDiffHeader(lines, i);
      currentFile = {
        path,
        oldPath,
        status,
        additions: 0,
        deletions: 0,
        isBinary: false,
        hunks: [],
      };
      currentHunk = null;
      i++;
      continue;
    }

    // Binary file
    if (line.startsWith('Binary files ') || line.includes('GIT binary patch')) {
      if (currentFile) {
        currentFile.isBinary = true;
      }
      i++;
      continue;
    }

    // Hunk header
    if (line.startsWith('@@')) {
      if (currentFile && currentHunk && currentHunk.lines.length > 0) {
        currentFile.hunks.push(currentHunk);
      }

      const hunkInfo = parseHunkHeader(line);
      if (hunkInfo) {
        currentHunk = {
          ...hunkInfo,
          header: line,
          lines: [],
        };
        oldLineNum = hunkInfo.oldStart;
        newLineNum = hunkInfo.newStart;
      }
      i++;
      continue;
    }

    // Skip file metadata lines
    if (
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('old mode ') ||
      line.startsWith('new mode ') ||
      line.startsWith('new file mode ') ||
      line.startsWith('deleted file mode ') ||
      line.startsWith('similarity index ') ||
      line.startsWith('rename from ') ||
      line.startsWith('rename to ') ||
      line.startsWith('copy from ') ||
      line.startsWith('copy to ')
    ) {
      i++;
      continue;
    }

    // Parse diff lines within a hunk
    if (currentHunk && currentFile) {
      const diffLine = parseDiffLine(line, oldLineNum, newLineNum);
      if (diffLine) {
        currentHunk.lines.push(diffLine);

        if (diffLine.type === 'add') {
          currentFile.additions++;
          newLineNum++;
        } else if (diffLine.type === 'delete') {
          currentFile.deletions++;
          oldLineNum++;
        } else {
          oldLineNum++;
          newLineNum++;
        }
      }
    }

    i++;
  }

  // Push the last file and hunk
  if (currentFile) {
    if (currentHunk && currentHunk.lines.length > 0) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(currentFile);
  }

  return files;
}

/**
 * Parse the file header portion of a diff to extract path and status.
 */
function parseFileDiffHeader(
  lines: string[],
  startIndex: number,
): { path: string; oldPath?: string; status: DiffFileStatus } {
  const diffLine = lines[startIndex];
  // Extract paths from "diff --git a/path b/path"
  const match = diffLine.match(/^diff --git a\/(.+?) b\/(.+)$/);

  let path = '';
  let oldPath: string | undefined;
  let status: DiffFileStatus = 'modified';

  if (match) {
    oldPath = match[1];
    path = match[2];

    if (oldPath !== path) {
      status = 'renamed';
    }
  }

  // Look ahead for status indicators
  for (let j = startIndex + 1; j < Math.min(startIndex + 10, lines.length); j++) {
    const line = lines[j];

    if (line.startsWith('diff --git ')) {
      break;
    }

    if (line.startsWith('new file mode')) {
      status = 'added';
      oldPath = undefined;
    } else if (line.startsWith('deleted file mode')) {
      status = 'deleted';
    } else if (line.startsWith('rename from ')) {
      status = 'renamed';
      oldPath = line.substring('rename from '.length);
    } else if (line.startsWith('rename to ')) {
      path = line.substring('rename to '.length);
    } else if (line.startsWith('Binary files ') || line.includes('GIT binary patch')) {
      // Don't change status, just note it's binary
      break;
    }
  }

  return { path, oldPath: status === 'renamed' ? oldPath : undefined, status };
}

/**
 * Parse a hunk header line like "@@ -1,5 +1,7 @@" or "@@ -0,0 +1,10 @@"
 */
function parseHunkHeader(
  line: string,
): { oldStart: number; oldLines: number; newStart: number; newLines: number } | null {
  // Match patterns like:
  // @@ -1,5 +1,7 @@
  // @@ -0,0 +1,10 @@ (new file)
  // @@ -1 +1 @@ (single line)
  // @@ -1,5 +1,7 @@ optional context text
  const match = line.match(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
  );

  if (!match) {
    return null;
  }

  return {
    oldStart: parseInt(match[1], 10),
    oldLines: match[2] ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newLines: match[4] ? parseInt(match[4], 10) : 1,
  };
}

/**
 * Parse a single line of diff content.
 */
function parseDiffLine(
  line: string,
  oldLineNum: number,
  newLineNum: number,
): DiffLine | null {
  // Empty lines in diff are treated as context
  if (line === '') {
    return {
      type: 'context',
      oldLineNumber: oldLineNum,
      newLineNumber: newLineNum,
      content: '',
    };
  }

  const prefix = line[0];
  const content = line.substring(1);

  let type: DiffLineType;
  let oldLineNumber: number | undefined;
  let newLineNumber: number | undefined;

  switch (prefix) {
    case '+':
      type = 'add';
      newLineNumber = newLineNum;
      break;
    case '-':
      type = 'delete';
      oldLineNumber = oldLineNum;
      break;
    case ' ':
      type = 'context';
      oldLineNumber = oldLineNum;
      newLineNumber = newLineNum;
      break;
    case '\\':
      // "\ No newline at end of file" - skip this line
      return null;
    default:
      // Unknown line type, skip
      return null;
  }

  return {
    type,
    oldLineNumber,
    newLineNumber,
    content,
  };
}

/**
 * Parse git diff --stat output to get file statistics.
 */
export function parseDiffStat(
  statOutput: string,
): { path: string; additions: number; deletions: number }[] {
  const results: { path: string; additions: number; deletions: number }[] = [];
  const lines = statOutput.trim().split('\n');

  for (const line of lines) {
    // Skip summary line (e.g., "3 files changed, 10 insertions(+), 5 deletions(-)")
    if (line.includes('file') && line.includes('changed')) {
      continue;
    }

    // Match lines like " src/file.ts | 10 ++++---"
    const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+([+-]+)?/);
    if (match) {
      const path = match[1].trim();
      const plusCount = (match[3] || '').split('+').length - 1;
      const minusCount = (match[3] || '').split('-').length - 1;

      results.push({
        path,
        additions: plusCount,
        deletions: minusCount,
      });
    }
  }

  return results;
}

/**
 * Extract the file path from a git diff file header.
 */
export function extractFilePath(diffHeader: string): string | null {
  const match = diffHeader.match(/^diff --git a\/(.+?) b\/(.+)$/);
  return match ? match[2] : null;
}
