import { describe, it, expect } from 'vitest';
import { parseDiff, parseDiffStat, extractFilePath } from './diffParser';

describe('parseDiff', () => {
  it('should return empty array for empty input', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('   ')).toEqual([]);
  });

  it('should parse a simple file modification', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;
 export { x, z };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/file.ts');
    expect(result[0].status).toBe('modified');
    expect(result[0].additions).toBe(1);
    expect(result[0].deletions).toBe(0);
    expect(result[0].isBinary).toBe(false);
    expect(result[0].hunks).toHaveLength(1);

    const hunk = result[0].hunks[0];
    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldLines).toBe(3);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newLines).toBe(4);
    expect(hunk.lines).toHaveLength(4);

    // Check line types
    expect(hunk.lines[0].type).toBe('context');
    expect(hunk.lines[0].content).toBe('const x = 1;');
    expect(hunk.lines[0].oldLineNumber).toBe(1);
    expect(hunk.lines[0].newLineNumber).toBe(1);

    expect(hunk.lines[1].type).toBe('add');
    expect(hunk.lines[1].content).toBe('const y = 2;');
    expect(hunk.lines[1].oldLineNumber).toBeUndefined();
    expect(hunk.lines[1].newLineNumber).toBe(2);
  });

  it('should parse additions and deletions', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,4 +1,4 @@
 const x = 1;
-const y = 2;
+const y = 3;
 const z = 3;
 export { x, z };`;

    const result = parseDiff(diff);

    expect(result[0].additions).toBe(1);
    expect(result[0].deletions).toBe(1);

    const hunk = result[0].hunks[0];
    expect(hunk.lines[1].type).toBe('delete');
    expect(hunk.lines[1].content).toBe('const y = 2;');
    expect(hunk.lines[1].oldLineNumber).toBe(2);
    expect(hunk.lines[1].newLineNumber).toBeUndefined();

    expect(hunk.lines[2].type).toBe('add');
    expect(hunk.lines[2].content).toBe('const y = 3;');
    expect(hunk.lines[2].oldLineNumber).toBeUndefined();
    expect(hunk.lines[2].newLineNumber).toBe(2);
  });

  it('should parse a new file', () => {
    const diff = `diff --git a/src/newfile.ts b/src/newfile.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/newfile.ts
@@ -0,0 +1,3 @@
+const x = 1;
+const y = 2;
+export { x, y };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/newfile.ts');
    expect(result[0].status).toBe('added');
    expect(result[0].additions).toBe(3);
    expect(result[0].deletions).toBe(0);
    expect(result[0].oldPath).toBeUndefined();
  });

  it('should parse a deleted file', () => {
    const diff = `diff --git a/src/oldfile.ts b/src/oldfile.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/oldfile.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-const x = 1;
-const y = 2;
-export { x, y };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/oldfile.ts');
    expect(result[0].status).toBe('deleted');
    expect(result[0].additions).toBe(0);
    expect(result[0].deletions).toBe(3);
  });

  it('should parse a renamed file', () => {
    const diff = `diff --git a/src/oldname.ts b/src/newname.ts
similarity index 100%
rename from src/oldname.ts
rename to src/newname.ts`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/newname.ts');
    expect(result[0].oldPath).toBe('src/oldname.ts');
    expect(result[0].status).toBe('renamed');
  });

  it('should parse a renamed file with changes', () => {
    const diff = `diff --git a/src/oldname.ts b/src/newname.ts
similarity index 90%
rename from src/oldname.ts
rename to src/newname.ts
index 1234567..abcdefg 100644
--- a/src/oldname.ts
+++ b/src/newname.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 export { x };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/newname.ts');
    expect(result[0].oldPath).toBe('src/oldname.ts');
    expect(result[0].status).toBe('renamed');
    expect(result[0].additions).toBe(1);
  });

  it('should parse binary file', () => {
    const diff = `diff --git a/images/logo.png b/images/logo.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/images/logo.png differ`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('images/logo.png');
    expect(result[0].isBinary).toBe(true);
    expect(result[0].hunks).toHaveLength(0);
  });

  it('should parse multiple files', () => {
    const diff = `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
 export { x };
diff --git a/src/file2.ts b/src/file2.ts
index 1234567..abcdefg 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -1,3 +1,2 @@
 const a = 1;
-const b = 2;
 export { a };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('src/file1.ts');
    expect(result[0].additions).toBe(1);
    expect(result[0].deletions).toBe(0);

    expect(result[1].path).toBe('src/file2.ts');
    expect(result[1].additions).toBe(0);
    expect(result[1].deletions).toBe(1);
  });

  it('should parse multiple hunks in one file', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@
 const x = 1;
+const y = 2;
 const z = 3;

@@ -10,3 +11,4 @@
 function foo() {
   return 1;
+  // comment
 }`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(2);

    expect(result[0].hunks[0].oldStart).toBe(1);
    expect(result[0].hunks[0].newStart).toBe(1);

    expect(result[0].hunks[1].oldStart).toBe(10);
    expect(result[0].hunks[1].newStart).toBe(11);
  });

  it('should handle files with special characters in path', () => {
    const diff = `diff --git a/src/[utils]/file.ts b/src/[utils]/file.ts
index 1234567..abcdefg 100644
--- a/src/[utils]/file.ts
+++ b/src/[utils]/file.ts
@@ -1 +1,2 @@
 const x = 1;
+const y = 2;`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/[utils]/file.ts');
  });

  it('should handle "No newline at end of file" marker', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,2 +1,2 @@
 const x = 1;
-const y = 2;
\\ No newline at end of file
+const y = 3;
\\ No newline at end of file`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].additions).toBe(1);
    expect(result[0].deletions).toBe(1);
    // The "\ No newline" lines should be skipped
    expect(result[0].hunks[0].lines).toHaveLength(3);
  });

  it('should parse hunk headers with context text', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,4 @@ function foo() {
 const x = 1;
+const y = 2;
 const z = 3;
 export { x, z };`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].hunks[0].header).toBe('@@ -1,3 +1,4 @@ function foo() {');
  });

  it('should handle single line changes (no comma in hunk header)', () => {
    const diff = `diff --git a/src/file.ts b/src/file.ts
index 1234567..abcdefg 100644
--- a/src/file.ts
+++ b/src/file.ts
@@ -1 +1 @@
-const x = 1;
+const x = 2;`;

    const result = parseDiff(diff);

    expect(result).toHaveLength(1);
    expect(result[0].hunks[0].oldStart).toBe(1);
    expect(result[0].hunks[0].oldLines).toBe(1);
    expect(result[0].hunks[0].newStart).toBe(1);
    expect(result[0].hunks[0].newLines).toBe(1);
  });
});

describe('parseDiffStat', () => {
  it('should parse git diff --stat output', () => {
    const stat = ` src/file1.ts | 10 ++++---
 src/file2.ts |  5 +++++
 3 files changed, 12 insertions(+), 3 deletions(-)`;

    const result = parseDiffStat(stat);

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('src/file1.ts');
    expect(result[0].additions).toBe(4);
    expect(result[0].deletions).toBe(3);

    expect(result[1].path).toBe('src/file2.ts');
    expect(result[1].additions).toBe(5);
    expect(result[1].deletions).toBe(0);
  });

  it('should handle empty stat output', () => {
    expect(parseDiffStat('')).toEqual([]);
  });
});

describe('extractFilePath', () => {
  it('should extract file path from diff header', () => {
    expect(extractFilePath('diff --git a/src/file.ts b/src/file.ts')).toBe('src/file.ts');
  });

  it('should extract new path from rename', () => {
    expect(extractFilePath('diff --git a/old/file.ts b/new/file.ts')).toBe('new/file.ts');
  });

  it('should return null for invalid header', () => {
    expect(extractFilePath('not a diff header')).toBeNull();
  });
});
