import { describe, it, expect } from 'vitest';
import { getImportableWorktrees, normalizePathSlashes, normalizePath } from './worktreeUtils';
import type { WorktreeInfo, WorktreeSession } from '../../shared/types';

describe('normalizePathSlashes', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePathSlashes('C:\\Users\\testuser\\project')).toBe('C:/Users/testuser/project');
  });

  it('leaves forward slashes unchanged', () => {
    expect(normalizePathSlashes('/home/user/project')).toBe('/home/user/project');
  });

  it('handles mixed slashes', () => {
    expect(normalizePathSlashes('C:\\Users/testuser\\project/src')).toBe(
      'C:/Users/testuser/project/src'
    );
  });

  it('handles paths with no slashes', () => {
    expect(normalizePathSlashes('filename.txt')).toBe('filename.txt');
  });

  it('handles empty string', () => {
    expect(normalizePathSlashes('')).toBe('');
  });

  it('handles UNC paths', () => {
    expect(normalizePathSlashes('\\\\wsl$\\Ubuntu\\home\\user')).toBe('//wsl$/Ubuntu/home/user');
  });
});

describe('normalizePath', () => {
  // Note: These tests run in jsdom (non-Windows), so paths are NOT lowercased
  // On Windows, paths would be lowercased for case-insensitive comparison

  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\testuser\\project')).toBe('C:/Users/testuser/project');
  });

  it('removes trailing slashes', () => {
    expect(normalizePath('/home/user/project/')).toBe('/home/user/project');
    expect(normalizePath('C:\\Users\\testuser\\')).toBe('C:/Users/testuser');
  });

  it('normalizes wsl$ paths to wsl.localhost', () => {
    expect(normalizePath('\\\\wsl$\\Ubuntu\\home\\user')).toBe('//wsl.localhost/Ubuntu/home/user');
    expect(normalizePath('//wsl$/archlinux/home/user')).toBe('//wsl.localhost/archlinux/home/user');
  });

  it('preserves wsl.localhost paths', () => {
    expect(normalizePath('\\\\wsl.localhost\\Ubuntu\\home\\user')).toBe(
      '//wsl.localhost/Ubuntu/home/user'
    );
    expect(normalizePath('//wsl.localhost/archlinux/home/user')).toBe(
      '//wsl.localhost/archlinux/home/user'
    );
  });

  it('handles mixed formats consistently', () => {
    // These should all normalize to the same path (without lowercasing in test env)
    const expected = '//wsl.localhost/Ubuntu/home/user';
    expect(normalizePath('\\\\wsl$\\Ubuntu\\home\\user')).toBe(expected);
    expect(normalizePath('//wsl$/Ubuntu/home/user')).toBe(expected);
    expect(normalizePath('\\\\wsl.localhost\\Ubuntu\\home\\user')).toBe(expected);
    expect(normalizePath('//wsl.localhost/Ubuntu/home/user')).toBe(expected);
  });
});

describe('getImportableWorktrees', () => {
  const createWorktree = (overrides: Partial<WorktreeInfo>): WorktreeInfo => ({
    path: '/repos/project-feature',
    branch: 'feature',
    head: 'abc123',
    isMain: false,
    isBare: false,
    isLocked: false,
    prunable: false,
    ...overrides,
  });

  const createWorktreeSession = (overrides: Partial<WorktreeSession>): WorktreeSession => ({
    id: 'session-1',
    label: 'Feature',
    path: '/repos/project-feature',
    createdAt: new Date().toISOString(),
    isExternal: false,
    ...overrides,
  });

  describe('filtering main worktree', () => {
    it('excludes main worktree', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project', branch: 'main', isMain: true }),
        createWorktree({ path: '/repos/project-feature', branch: 'feature', isMain: false }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/repos/project-feature');
    });

    it('returns empty array when only main worktree exists', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project', branch: 'main', isMain: true }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(0);
    });
  });

  describe('filtering prunable worktrees', () => {
    it('excludes prunable worktrees', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-old', branch: 'old', prunable: true }),
        createWorktree({ path: '/repos/project-feature', branch: 'feature', prunable: false }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/repos/project-feature');
    });

    it('returns empty array when all worktrees are prunable', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-old', branch: 'old', prunable: true }),
        createWorktree({ path: '/repos/project-broken', branch: 'broken', prunable: true }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(0);
    });
  });

  describe('filtering already-imported worktrees', () => {
    it('excludes worktrees that match existing session paths', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-feature-1', branch: 'feature-1' }),
        createWorktree({ path: '/repos/project-feature-2', branch: 'feature-2' }),
      ];

      const existingSessions: WorktreeSession[] = [
        createWorktreeSession({ path: '/repos/project-feature-1' }),
      ];

      const result = getImportableWorktrees(worktrees, existingSessions);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/repos/project-feature-2');
    });

    it('returns empty array when all worktrees are already imported', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-feature-1', branch: 'feature-1' }),
        createWorktree({ path: '/repos/project-feature-2', branch: 'feature-2' }),
      ];

      const existingSessions: WorktreeSession[] = [
        createWorktreeSession({ path: '/repos/project-feature-1' }),
        createWorktreeSession({ path: '/repos/project-feature-2' }),
      ];

      const result = getImportableWorktrees(worktrees, existingSessions);

      expect(result).toHaveLength(0);
    });
  });

  describe('combined filtering', () => {
    it('applies all filters together', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project', branch: 'main', isMain: true }),
        createWorktree({ path: '/repos/project-prunable', branch: 'prunable', prunable: true }),
        createWorktree({ path: '/repos/project-existing', branch: 'existing' }),
        createWorktree({ path: '/repos/project-importable', branch: 'importable' }),
      ];

      const existingSessions: WorktreeSession[] = [
        createWorktreeSession({ path: '/repos/project-existing' }),
      ];

      const result = getImportableWorktrees(worktrees, existingSessions);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/repos/project-importable');
    });

    it('returns all worktrees when none are filtered', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-feature-1', branch: 'feature-1' }),
        createWorktree({ path: '/repos/project-feature-2', branch: 'feature-2' }),
        createWorktree({ path: '/repos/project-feature-3', branch: 'feature-3' }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when worktrees array is empty', () => {
      const result = getImportableWorktrees([], []);
      expect(result).toHaveLength(0);
    });

    it('handles empty sessions array', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-feature', branch: 'feature' }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(1);
    });

    it('preserves locked worktrees (they can still be imported)', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-locked', branch: 'locked', isLocked: true }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(1);
      expect(result[0].isLocked).toBe(true);
    });

    it('handles worktrees with detached HEAD (empty branch)', () => {
      const worktrees: WorktreeInfo[] = [
        createWorktree({ path: '/repos/project-detached', branch: '' }),
      ];

      const result = getImportableWorktrees(worktrees, []);

      expect(result).toHaveLength(1);
      expect(result[0].branch).toBe('');
    });
  });
});
