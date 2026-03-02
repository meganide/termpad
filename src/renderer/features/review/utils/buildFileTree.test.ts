import { describe, it, expect } from 'vitest';
import { buildFileTree } from './buildFileTree';
import type { DiffFile } from '../../../../shared/reviewTypes';

function makeDiffFile(path: string, additions = 10, deletions = 5): DiffFile {
  return {
    path,
    status: 'modified',
    additions,
    deletions,
    isBinary: false,
    hunks: [],
  };
}

describe('buildFileTree', () => {
  it('handles a single file at root level', () => {
    const files = [makeDiffFile('README.md', 5, 2)];
    const tree = buildFileTree(files);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      totalAdditions: 5,
      totalDeletions: 2,
    });
    expect(tree[0].file).toBeDefined();
    expect(tree[0].children).toHaveLength(0);
  });

  it('handles a single file in a folder', () => {
    const files = [makeDiffFile('src/index.ts', 10, 3)];
    const tree = buildFileTree(files);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      name: 'src',
      path: 'src',
      type: 'folder',
      totalAdditions: 10,
      totalDeletions: 3,
    });
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0]).toMatchObject({
      name: 'index.ts',
      path: 'src/index.ts',
      type: 'file',
    });
  });

  it('handles multiple files in the same folder', () => {
    const files = [
      makeDiffFile('src/a.ts', 5, 1),
      makeDiffFile('src/b.ts', 3, 2),
      makeDiffFile('src/c.ts', 2, 0),
    ];
    const tree = buildFileTree(files);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('src');
    expect(tree[0].children).toHaveLength(3);
    expect(tree[0].totalAdditions).toBe(10);
    expect(tree[0].totalDeletions).toBe(3);
    // Files should be sorted alphabetically
    expect(tree[0].children.map((c) => c.name)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('handles nested folders', () => {
    const files = [makeDiffFile('src/components/ui/Button.tsx', 20, 5)];
    const tree = buildFileTree(files);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('src');
    expect(tree[0].type).toBe('folder');
    expect(tree[0].children).toHaveLength(1);

    const components = tree[0].children[0];
    expect(components.name).toBe('components');
    expect(components.type).toBe('folder');
    expect(components.children).toHaveLength(1);

    const ui = components.children[0];
    expect(ui.name).toBe('ui');
    expect(ui.type).toBe('folder');
    expect(ui.children).toHaveLength(1);

    const button = ui.children[0];
    expect(button.name).toBe('Button.tsx');
    expect(button.type).toBe('file');
    expect(button.file).toBeDefined();
  });

  it('handles root-level files mixed with folders', () => {
    const files = [
      makeDiffFile('README.md', 1, 0),
      makeDiffFile('src/index.ts', 5, 2),
      makeDiffFile('package.json', 2, 1),
    ];
    const tree = buildFileTree(files);

    // Should have 3 nodes at root: src folder, package.json, README.md
    expect(tree).toHaveLength(3);

    // Folders should come first, then files alphabetically
    expect(tree[0].name).toBe('src');
    expect(tree[0].type).toBe('folder');
    expect(tree[1].name).toBe('package.json');
    expect(tree[1].type).toBe('file');
    expect(tree[2].name).toBe('README.md');
    expect(tree[2].type).toBe('file');
  });

  it('sorts folders before files, both alphabetically', () => {
    const files = [
      makeDiffFile('z.ts'),
      makeDiffFile('a.ts'),
      makeDiffFile('src/x.ts'),
      makeDiffFile('lib/y.ts'),
    ];
    const tree = buildFileTree(files);

    // Root level: lib, src (folders), then a.ts, z.ts (files)
    expect(tree.map((n) => n.name)).toEqual(['lib', 'src', 'a.ts', 'z.ts']);
  });

  it('aggregates stats correctly up to parent folders', () => {
    const files = [
      makeDiffFile('src/a.ts', 10, 2),
      makeDiffFile('src/b.ts', 5, 3),
      makeDiffFile('src/sub/c.ts', 8, 1),
      makeDiffFile('src/sub/d.ts', 2, 4),
    ];
    const tree = buildFileTree(files);

    const src = tree[0];
    expect(src.name).toBe('src');
    // Total: 10+5+8+2 = 25 additions, 2+3+1+4 = 10 deletions
    expect(src.totalAdditions).toBe(25);
    expect(src.totalDeletions).toBe(10);

    const sub = src.children.find((c) => c.name === 'sub');
    expect(sub).toBeDefined();
    expect(sub?.totalAdditions).toBe(10); // 8+2
    expect(sub?.totalDeletions).toBe(5); // 1+4
  });

  it('handles empty input', () => {
    const tree = buildFileTree([]);
    expect(tree).toHaveLength(0);
  });

  it('handles files with same names in different folders', () => {
    const files = [makeDiffFile('src/index.ts', 10, 0), makeDiffFile('lib/index.ts', 5, 0)];
    const tree = buildFileTree(files);

    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe('lib');
    expect(tree[1].name).toBe('src');

    expect(tree[0].children[0].name).toBe('index.ts');
    expect(tree[0].children[0].path).toBe('lib/index.ts');
    expect(tree[1].children[0].name).toBe('index.ts');
    expect(tree[1].children[0].path).toBe('src/index.ts');
  });

  it('handles deeply nested structure with correct stats aggregation', () => {
    const files = [
      makeDiffFile('a/b/c/d/e.ts', 1, 1),
      makeDiffFile('a/b/c/f.ts', 2, 2),
      makeDiffFile('a/b/g.ts', 3, 3),
      makeDiffFile('a/h.ts', 4, 4),
    ];
    const tree = buildFileTree(files);

    const a = tree[0];
    expect(a.totalAdditions).toBe(10); // 1+2+3+4
    expect(a.totalDeletions).toBe(10);

    const b = a.children.find((child) => child.name === 'b');
    expect(b).toBeDefined();
    expect(b?.totalAdditions).toBe(6); // 1+2+3

    const c = b?.children.find((child) => child.name === 'c');
    expect(c).toBeDefined();
    expect(c?.totalAdditions).toBe(3); // 1+2

    const d = c?.children.find((child) => child.name === 'd');
    expect(d).toBeDefined();
    expect(d?.totalAdditions).toBe(1);
  });

  it('handles folder with mixed files and subfolders correctly sorted', () => {
    const files = [
      makeDiffFile('src/utils.ts'),
      makeDiffFile('src/index.ts'),
      makeDiffFile('src/components/A.tsx'),
      makeDiffFile('src/hooks/useX.ts'),
    ];
    const tree = buildFileTree(files);

    const src = tree[0];
    const childNames = src.children.map((c) => c.name);

    // Folders first (components, hooks), then files (index.ts, utils.ts)
    expect(childNames).toEqual(['components', 'hooks', 'index.ts', 'utils.ts']);
  });
});
