import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getWorkingTreeDiff } from './gitOperations';

const exec = promisify(execFile);
const fixtures: string[] = [];
beforeEach(() => {
  // Git hooks export repository-specific variables. Without clearing them, even a
  // different cwd can operate on the caller's real repository instead of the fixture.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) vi.stubEnv(key, undefined);
  }
});
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

describe('review base comparisons', () => {
  it.each(['main', 'master'])(
    'compares to HEAD or the merge base of %s, including staged and untracked edits',
    async (base) => {
      const repo = await mkdtemp(join(tmpdir(), 'termpad-review-test-'));
      fixtures.push(repo);
      const git = (...args: string[]) =>
        exec('git', [`--git-dir=${join(repo, '.git')}`, `--work-tree=${repo}`, ...args], {
          cwd: repo,
        });
      await git('init', '-b', base);
      await git('config', 'user.name', 'Review Test');
      await git('config', 'user.email', 'review@example.test');
      await writeFile(join(repo, 'existing.txt'), 'original\n');
      await git('add', '.');
      await git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Base');
      const ancestor = (await git('rev-parse', 'HEAD')).stdout.trim();
      await git('checkout', '-b', 'feature');
      await writeFile(join(repo, 'committed.txt'), 'feature commit\n');
      await git('add', '.');
      await git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Feature');
      await git('checkout', base);
      await writeFile(join(repo, 'upstream.txt'), 'upstream only\n');
      await git('add', '.');
      await git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Upstream');
      await git('checkout', 'feature');
      await writeFile(join(repo, 'existing.txt'), 'staged\n');
      await git('add', 'existing.txt');
      await writeFile(join(repo, 'existing.txt'), 'staged and unstaged\n');
      await writeFile(join(repo, 'untracked file.txt'), 'untracked\n');

      const local = await getWorkingTreeDiff(repo, 'HEAD');
      expect(local.files.map((file) => file.path).sort()).toEqual([
        'existing.txt',
        'untracked file.txt',
      ]);
      const branch = await getWorkingTreeDiff(repo, base);
      expect(branch.headCommit).toBe(ancestor);
      expect(branch.files.map((file) => file.path).sort()).toEqual([
        'committed.txt',
        'existing.txt',
        'untracked file.txt',
      ]);
      expect(
        branch.files.find((file) => file.path === 'existing.txt')?.hunks[0].lines
      ).toContainEqual({ type: 'add', newLineNumber: 1, content: 'staged and unstaged' });
      await expect(getWorkingTreeDiff(repo, 'missing-branch')).rejects.toThrow();
    }
  );
});
