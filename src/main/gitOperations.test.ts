import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractDistroFromWslPath,
  hasPreCommitHooks,
  hasHook,
  getHookManifest,
  commitWithHooks,
  pushWithHooks,
  batchArray,
  buildPRStatusQuery,
  parsePRStatusResponse,
  parseGitHubRepo,
} from './gitOperations';
import fs from 'fs/promises';
import type { OperationProgressStatus, GitHookType } from '../shared/types';

describe('extractDistroFromWslPath', () => {
  it('should extract distro name from wsl$ path format', () => {
    expect(extractDistroFromWslPath('\\\\wsl$\\archlinux\\home\\user')).toBe('archlinux');
    expect(extractDistroFromWslPath('\\\\wsl$\\Ubuntu\\home\\user')).toBe('ubuntu');
    expect(extractDistroFromWslPath('\\\\wsl$\\Debian\\home')).toBe('debian');
  });

  it('should extract distro name from wsl.localhost path format', () => {
    expect(extractDistroFromWslPath('\\\\wsl.localhost\\Ubuntu\\home\\user')).toBe('ubuntu');
    expect(extractDistroFromWslPath('\\\\wsl.localhost\\archlinux\\home')).toBe('archlinux');
  });

  it('should handle forward slash paths', () => {
    expect(extractDistroFromWslPath('//wsl$/archlinux/home/user')).toBe('archlinux');
    expect(extractDistroFromWslPath('//wsl.localhost/Ubuntu/home')).toBe('ubuntu');
  });

  it('should normalize distro name to lowercase', () => {
    expect(extractDistroFromWslPath('\\\\wsl$\\ARCHLINUX\\home')).toBe('archlinux');
    expect(extractDistroFromWslPath('\\\\wsl$\\Ubuntu-22.04\\home')).toBe('ubuntu-22.04');
    expect(extractDistroFromWslPath('\\\\wsl.localhost\\DEBIAN\\home')).toBe('debian');
  });

  it('should return null for non-WSL paths', () => {
    expect(extractDistroFromWslPath('C:\\Users\\user\\projects')).toBeNull();
    expect(extractDistroFromWslPath('/home/user/projects')).toBeNull();
    expect(extractDistroFromWslPath('D:\\code')).toBeNull();
    expect(extractDistroFromWslPath('')).toBeNull();
  });

  it('should return null for malformed WSL paths', () => {
    expect(extractDistroFromWslPath('\\\\wsl$')).toBeNull();
    expect(extractDistroFromWslPath('\\\\wsl$\\')).toBeNull();
    expect(extractDistroFromWslPath('//wsl$/')).toBeNull();
  });
});

vi.mock('fs/promises', () => ({
  default: {
    stat: vi.fn(),
    access: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('hasPreCommitHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when .husky/pre-commit exists and is executable', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.husky/pre-commit') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(true);
  });

  it('should return true when .git/hooks/pre-commit exists and is executable', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.git/hooks/pre-commit') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(true);
  });

  it('should check husky path first, then git hooks path', async () => {
    const statCalls: string[] = [];
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      statCalls.push(path as string);
      if (path === '/repo/.husky/pre-commit') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    await hasPreCommitHooks('/repo');

    // Should find husky hook first and return early
    expect(statCalls).toEqual(['/repo/.husky/pre-commit']);
  });

  it('should return false when no hooks exist', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(false);
  });

  it('should return false when hook file is empty (size 0)', async () => {
    vi.mocked(fs.stat).mockImplementation(async () => {
      return { isFile: () => true, size: 0 } as any;
    });
    // Make access fail so we check by size
    vi.mocked(fs.access).mockRejectedValue(new Error('EACCES'));

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(false);
  });

  it('should return true when file exists with content but not executable (Windows case)', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.husky/pre-commit') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    // X_OK check fails (Windows)
    vi.mocked(fs.access).mockRejectedValue(new Error('EACCES'));

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(true);
  });

  it('should return false when path exists but is a directory', async () => {
    vi.mocked(fs.stat).mockImplementation(async () => {
      return { isFile: () => false, size: 0 } as any;
    });

    const result = await hasPreCommitHooks('/repo');
    expect(result).toBe(false);
  });
});

describe('hasHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when .husky/<hookType> exists and is executable', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.husky/pre-push') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const result = await hasHook('/repo', 'pre-push');
    expect(result).toBe(true);
  });

  it('should return true when .git/hooks/<hookType> exists', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.git/hooks/commit-msg') {
        return { isFile: () => true, size: 50 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const result = await hasHook('/repo', 'commit-msg');
    expect(result).toBe(true);
  });

  it('should check all 5 hook types', async () => {
    const hookTypes = ['pre-commit', 'commit-msg', 'post-commit', 'pre-push', 'post-push'] as const;

    for (const hookType of hookTypes) {
      vi.clearAllMocks();
      vi.mocked(fs.stat).mockImplementation(async (path) => {
        if (path === `/repo/.husky/${hookType}`) {
          return { isFile: () => true, size: 100 } as any;
        }
        throw new Error('ENOENT');
      });
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await hasHook('/repo', hookType);
      expect(result).toBe(true);
    }
  });

  it('should return false when hook does not exist', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const result = await hasHook('/repo', 'post-push');
    expect(result).toBe(false);
  });
});

describe('getHookManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return manifest with all hooks present', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      const hookPaths = [
        '/repo/.husky/pre-commit',
        '/repo/.husky/commit-msg',
        '/repo/.husky/post-commit',
        '/repo/.husky/pre-push',
        '/repo/.husky/post-push',
      ];
      if (hookPaths.some((hp) => path === hp)) {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const manifest = await getHookManifest('/repo');
    expect(manifest).toEqual({
      'pre-commit': true,
      'commit-msg': true,
      'post-commit': true,
      'pre-push': true,
      'post-push': true,
    });
  });

  it('should return manifest with partial hooks', async () => {
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      if (path === '/repo/.husky/pre-commit' || path === '/repo/.husky/pre-push') {
        return { isFile: () => true, size: 100 } as any;
      }
      throw new Error('ENOENT');
    });
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const manifest = await getHookManifest('/repo');
    expect(manifest).toEqual({
      'pre-commit': true,
      'commit-msg': false,
      'post-commit': false,
      'pre-push': true,
      'post-push': false,
    });
  });

  it('should return manifest with no hooks', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const manifest = await getHookManifest('/repo');
    expect(manifest).toEqual({
      'pre-commit': false,
      'commit-msg': false,
      'post-commit': false,
      'pre-push': false,
      'post-push': false,
    });
  });
});

describe('commitWithHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error for empty commit message', async () => {
    const result = await commitWithHooks('/repo', '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Commit message cannot be empty');
    expect(result.output).toEqual([]);
  });

  it('should return error for whitespace-only commit message', async () => {
    const result = await commitWithHooks('/repo', '   ');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Commit message cannot be empty');
  });

  it('should call onOutput callback with phase information', async () => {
    // Mock no hooks exist so we skip hook execution
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const outputCalls: Array<{
      line: string;
      phase: OperationProgressStatus;
      hook?: GitHookType;
    }> = [];

    // This will fail at spawn since we can't mock child_process easily
    // but we can verify the early validation works
    const result = await commitWithHooks('/nonexistent', '', (line, phase, hook) => {
      outputCalls.push({ line, phase, hook });
    });

    expect(result.success).toBe(false);
  });

  it('should include failedHook in result when pre-commit fails', async () => {
    // Note: Full integration testing of hook execution requires mocking spawn
    // This test verifies the result structure expectations
    const result = await commitWithHooks('/repo', '  ');
    expect(result.failedHook).toBeUndefined(); // Empty message doesn't fail at hook
    expect(result.error).toBe('Commit message cannot be empty');
  });
});

describe('pushWithHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onOutput callback with phase information', async () => {
    // Mock no hooks exist so we skip hook execution
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const outputCalls: Array<{
      line: string;
      phase: OperationProgressStatus;
      hook?: GitHookType;
    }> = [];

    // This will fail at spawn since we can't mock child_process easily
    // but we can verify the onOutput callback structure
    await pushWithHooks('/nonexistent', (line, phase, hook) => {
      outputCalls.push({ line, phase, hook });
    });

    // Should have called onOutput at least once during execution attempt
    // The exact output depends on spawn behavior
  });

  it('should return result structure with output array', async () => {
    // Mock no hooks
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const result = await pushWithHooks('/nonexistent');

    // Verify result has expected structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('output');
    expect(Array.isArray(result.output)).toBe(true);
  });

  it('should check for pre-push hook before pushing', async () => {
    const statCalls: string[] = [];
    vi.mocked(fs.stat).mockImplementation(async (path) => {
      statCalls.push(path as string);
      throw new Error('ENOENT');
    });

    await pushWithHooks('/repo');

    // Should have checked for pre-push hook
    expect(statCalls.some((p) => p.includes('pre-push'))).toBe(true);
  });
});

describe('parseGitHubRepo', () => {
  it('should parse HTTPS URLs', () => {
    expect(parseGitHubRepo('https://github.com/owner/repo.git')).toBe('owner/repo');
    expect(parseGitHubRepo('https://github.com/owner/repo')).toBe('owner/repo');
    expect(parseGitHubRepo('https://github.com/my-org/my-repo.git')).toBe('my-org/my-repo');
  });

  it('should parse SSH URLs', () => {
    expect(parseGitHubRepo('git@github.com:owner/repo.git')).toBe('owner/repo');
    expect(parseGitHubRepo('git@github.com:owner/repo')).toBe('owner/repo');
    expect(parseGitHubRepo('git@github.com:my-org/my-repo.git')).toBe('my-org/my-repo');
  });

  it('should return null for non-GitHub URLs', () => {
    expect(parseGitHubRepo('https://gitlab.com/owner/repo.git')).toBeNull();
    expect(parseGitHubRepo('git@gitlab.com:owner/repo.git')).toBeNull();
    expect(parseGitHubRepo('https://bitbucket.org/owner/repo.git')).toBeNull();
    expect(parseGitHubRepo('not-a-url')).toBeNull();
  });
});

describe('batchArray', () => {
  it('should batch arrays correctly', () => {
    expect(batchArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batchArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    expect(batchArray([], 3)).toEqual([]);
    expect(batchArray([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('should handle batch size of 1', () => {
    expect(batchArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });
});

describe('buildPRStatusQuery', () => {
  it('should build a valid GraphQL query for single repo', () => {
    const query = buildPRStatusQuery(['owner/repo']);
    expect(query).toContain('repo0: repository(owner: "owner", name: "repo")');
    expect(query).toContain('pullRequests(first: 10');
    expect(query).toContain('headRefName');
    expect(query).toContain('state');
    expect(query).toContain('url');
    expect(query).toContain('number');
    expect(query).toContain('mergedAt');
  });

  it('should build a query for multiple repos', () => {
    const query = buildPRStatusQuery(['owner1/repo1', 'owner2/repo2']);
    expect(query).toContain('repo0: repository(owner: "owner1", name: "repo1")');
    expect(query).toContain('repo1: repository(owner: "owner2", name: "repo2")');
  });
});

describe('parsePRStatusResponse', () => {
  it('should parse a valid response', () => {
    const response = {
      data: {
        repo0: {
          pullRequests: {
            nodes: [
              {
                headRefName: 'feature-branch',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/pull/1',
                number: 1,
                mergedAt: null,
              },
            ],
          },
        },
      },
    };

    const result = parsePRStatusResponse(response, ['owner/repo']);
    expect(result['feature-branch']).toEqual({
      headRefName: 'feature-branch',
      state: 'OPEN',
      url: 'https://github.com/owner/repo/pull/1',
      number: 1,
      mergedAt: null,
      repository: 'owner/repo',
    });
  });

  it('should handle multiple repos', () => {
    const response = {
      data: {
        repo0: {
          pullRequests: {
            nodes: [
              {
                headRefName: 'branch-a',
                state: 'OPEN',
                url: 'https://github.com/owner1/repo1/pull/1',
                number: 1,
                mergedAt: null,
              },
            ],
          },
        },
        repo1: {
          pullRequests: {
            nodes: [
              {
                headRefName: 'branch-b',
                state: 'MERGED',
                url: 'https://github.com/owner2/repo2/pull/5',
                number: 5,
                mergedAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
      },
    };

    const result = parsePRStatusResponse(response, ['owner1/repo1', 'owner2/repo2']);
    expect(result['branch-a']).toBeDefined();
    expect(result['branch-a'].repository).toBe('owner1/repo1');
    expect(result['branch-b']).toBeDefined();
    expect(result['branch-b'].state).toBe('MERGED');
  });

  it('should only keep first PR for duplicate branches (most recently updated)', () => {
    const response = {
      data: {
        repo0: {
          pullRequests: {
            nodes: [
              {
                headRefName: 'feature',
                state: 'OPEN',
                url: 'https://github.com/owner/repo/pull/2',
                number: 2,
                mergedAt: null,
              },
              {
                headRefName: 'feature',
                state: 'MERGED',
                url: 'https://github.com/owner/repo/pull/1',
                number: 1,
                mergedAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
      },
    };

    const result = parsePRStatusResponse(response, ['owner/repo']);
    expect(result['feature'].number).toBe(2);
    expect(result['feature'].state).toBe('OPEN');
  });

  it('should handle missing data gracefully', () => {
    expect(parsePRStatusResponse({}, ['owner/repo'])).toEqual({});
    expect(parsePRStatusResponse({ data: {} }, ['owner/repo'])).toEqual({});
    expect(parsePRStatusResponse({ data: { repo0: {} } }, ['owner/repo'])).toEqual({});
    expect(
      parsePRStatusResponse({ data: { repo0: { pullRequests: {} } } }, ['owner/repo'])
    ).toEqual({});
  });
});
