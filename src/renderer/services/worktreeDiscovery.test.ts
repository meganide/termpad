import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverWorktreesForRepository, discoverAllWorktrees } from './worktreeDiscovery';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';
import type { WorktreeInfo } from '../../shared/types';

// Helper to create mock worktree info
function createMockWorktree(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    path: '/test/worktrees/feature',
    branch: 'feature-branch',
    head: 'abc123',
    isMain: false,
    isBare: false,
    isLocked: false,
    prunable: false,
    ...overrides,
  };
}

describe('worktreeDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    vi.mocked(window.terminal.listWorktrees).mockResolvedValue([]);
  });

  describe('discoverWorktreesForRepository', () => {
    it('should skip if project does not exist', async () => {
      useAppStore.setState({ repositories: [] });

      await discoverWorktreesForRepository('non-existent', '/some/path');

      expect(window.terminal.listWorktrees).not.toHaveBeenCalled();
    });

    // Note: All repositories are git repos now, so the "skip if not git" test is no longer applicable

    it('should call listWorktrees for project', async () => {
      const repository = createMockRepository({ id: 'proj-1', path: '/test/project' });
      useAppStore.setState({ repositories: [repository] });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      expect(window.terminal.listWorktrees).toHaveBeenCalledWith('/test/project');
    });

    it('should skip main worktrees', async () => {
      const mainSession = createMockWorktreeSession({ id: 'main-session', path: '/test/project' });
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
        worktreeSessions: [mainSession],
      });
      useAppStore.setState({ repositories: [repository] });

      const mainWorktree = createMockWorktree({ isMain: true, path: '/test/project' });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([mainWorktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      // Should not add session for main worktree
      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      expect(updatedRepository?.worktreeSessions).toHaveLength(1); // Only the initial main session
    });

    it('should skip worktrees that already have sessions', async () => {
      const existingSession = createMockWorktreeSession({
        id: 'existing-session',
        path: '/test/worktrees/feature',
      });
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
        worktreeSessions: [existingSession],
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({ path: '/test/worktrees/feature' });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      // Should not add duplicate session
      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      expect(updatedRepository?.worktreeSessions).toHaveLength(1);
    });

    it('should add session for discovered worktree', async () => {
      const mainSession = createMockWorktreeSession({
        id: 'main-session',
        path: '/test/project',
      });
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
        worktreeSessions: [mainSession],
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({
        path: '/test/worktrees/feature',
        branch: 'feature-branch',
      });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      expect(updatedRepository?.worktreeSessions).toHaveLength(2);

      const newSession = updatedRepository?.worktreeSessions.find(
        (s) => s.path === '/test/worktrees/feature'
      );
      expect(newSession).toBeDefined();
      expect(newSession?.isExternal).toBe(true);
      expect(newSession?.label).toBe('feature-branch');
      expect(newSession?.branchName).toBe('feature-branch');
      expect(newSession?.isExternal).toBe(true);
    });

    it('should use path segment as worktreeName', async () => {
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({
        path: '/test/worktrees/my-worktree',
        branch: 'branch-name',
      });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      const newSession = updatedRepository?.worktreeSessions.find((s) => s);
      expect(newSession?.worktreeName).toBe('my-worktree');
    });

    it('should use branch name as fallback for worktreeName when path ends with empty', async () => {
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({
        path: '/test/worktrees/', // trailing slash results in empty string from split('/').pop()
        branch: 'fallback-branch',
      });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      const newSession = updatedRepository?.worktreeSessions.find((s) => s);
      // Should use branch name as fallback
      expect(newSession?.worktreeName).toBe('fallback-branch');
    });

    it('should add multiple sessions for multiple worktrees', async () => {
      const mainSession = createMockWorktreeSession({ id: 'main-session', path: '/test/project' });
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
        worktreeSessions: [mainSession],
      });
      useAppStore.setState({ repositories: [repository] });

      const worktrees = [
        createMockWorktree({ path: '/test/wt/feature-1', branch: 'feature-1' }),
        createMockWorktree({ path: '/test/wt/feature-2', branch: 'feature-2' }),
        createMockWorktree({ path: '/test/wt/bugfix', branch: 'bugfix' }),
      ];
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue(worktrees);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      // Initial main session + 3 worktree sessions
      expect(updatedRepository?.worktreeSessions).toHaveLength(4);
    });

    it('should set createdAt timestamp on new sessions', async () => {
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({ path: '/test/wt/feature', branch: 'feature' });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      const beforeTime = new Date().toISOString();
      await discoverWorktreesForRepository('proj-1', '/test/project');
      const afterTime = new Date().toISOString();

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      const newSession = updatedRepository?.worktreeSessions.find((s) => s);

      expect(newSession?.createdAt).toBeDefined();
      expect(newSession?.createdAt && newSession.createdAt >= beforeTime).toBe(true);
      expect(newSession?.createdAt && newSession.createdAt <= afterTime).toBe(true);
    });

    it('should handle listWorktrees error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const mainSession = createMockWorktreeSession({ id: 'main-session', path: '/test/project' });
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
        worktreeSessions: [mainSession],
      });
      useAppStore.setState({ repositories: [repository] });

      vi.mocked(window.terminal.listWorktrees).mockRejectedValue(new Error('Git error'));

      await discoverWorktreesForRepository('proj-1', '/test/project');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to discover worktrees'),
        expect.any(Error)
      );

      // Should not crash, project should be unchanged
      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      expect(updatedRepository?.worktreeSessions).toHaveLength(1); // Only main session

      consoleErrorSpy.mockRestore();
    });

    it('should generate unique session IDs', async () => {
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
      });
      useAppStore.setState({ repositories: [repository] });

      const worktrees = [
        createMockWorktree({ path: '/test/wt/feature-1', branch: 'feature-1' }),
        createMockWorktree({ path: '/test/wt/feature-2', branch: 'feature-2' }),
      ];
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue(worktrees);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      const worktreeSessions = updatedRepository?.worktreeSessions.filter((s) => s);

      expect(worktreeSessions).toHaveLength(2);
      expect(worktreeSessions?.[0]?.id).not.toBe(worktreeSessions?.[1]?.id);
    });
  });

  describe('discoverAllWorktrees', () => {
    it('should discover worktrees for all git projects', async () => {
      const repository1 = createMockRepository({
        id: 'proj-1',

        path: '/test/project1',
      });
      const repository2 = createMockRepository({
        id: 'proj-2',

        path: '/test/project2',
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      const worktree1 = createMockWorktree({ path: '/test/wt1/feature', branch: 'feature' });
      const worktree2 = createMockWorktree({ path: '/test/wt2/bugfix', branch: 'bugfix' });

      vi.mocked(window.terminal.listWorktrees)
        .mockResolvedValueOnce([worktree1])
        .mockResolvedValueOnce([worktree2]);

      await discoverAllWorktrees();

      expect(window.terminal.listWorktrees).toHaveBeenCalledTimes(2);
      expect(window.terminal.listWorktrees).toHaveBeenCalledWith('/test/project1');
      expect(window.terminal.listWorktrees).toHaveBeenCalledWith('/test/project2');
    });

    // Note: All repositories are git repos now, so no "skip non-git" test is needed

    it('should handle empty repositories array', async () => {
      useAppStore.setState({ repositories: [] });

      await discoverAllWorktrees();

      expect(window.terminal.listWorktrees).not.toHaveBeenCalled();
    });

    it('should run all discoveries in parallel', async () => {
      const repositories = [
        createMockRepository({ id: 'proj-1', path: '/test/p1' }),
        createMockRepository({ id: 'proj-2', path: '/test/p2' }),
        createMockRepository({ id: 'proj-3', path: '/test/p3' }),
      ];
      useAppStore.setState({ repositories });

      const callOrder: string[] = []; // eslint-disable-line prefer-const
      vi.mocked(window.terminal.listWorktrees).mockImplementation(async (path) => {
        callOrder.push(path as string);
        // Small delay to verify parallel execution
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [];
      });

      await discoverAllWorktrees();

      // All three should have been called
      expect(callOrder).toHaveLength(3);
      expect(window.terminal.listWorktrees).toHaveBeenCalledTimes(3);
    });

    it('should continue discovering other repositories if one fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const mainSession1 = createMockWorktreeSession({ id: 'main-1', path: '/test/p1' });
      const mainSession2 = createMockWorktreeSession({ id: 'main-2', path: '/test/p2' });
      const repositories = [
        createMockRepository({
          id: 'proj-1',

          path: '/test/p1',
          worktreeSessions: [mainSession1],
        }),
        createMockRepository({
          id: 'proj-2',

          path: '/test/p2',
          worktreeSessions: [mainSession2],
        }),
      ];
      useAppStore.setState({ repositories });

      vi.mocked(window.terminal.listWorktrees)
        .mockRejectedValueOnce(new Error('Error for p1'))
        .mockResolvedValueOnce([
          createMockWorktree({ path: '/test/wt/feature', branch: 'feature' }),
        ]);

      await discoverAllWorktrees();

      // Both should be called despite first one failing
      expect(window.terminal.listWorktrees).toHaveBeenCalledTimes(2);

      // Second project should have its worktree added
      const state = useAppStore.getState();
      const repository2 = state.repositories.find((p) => p.id === 'proj-2');
      expect(repository2?.worktreeSessions).toHaveLength(2); // main + worktree

      consoleErrorSpy.mockRestore();
    });

    it('should handle all repositories failing gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const repositories = [
        createMockRepository({ id: 'proj-1', path: '/test/p1' }),
        createMockRepository({ id: 'proj-2', path: '/test/p2' }),
      ];
      useAppStore.setState({ repositories });

      vi.mocked(window.terminal.listWorktrees).mockRejectedValue(new Error('Git unavailable'));

      // Should not throw
      await expect(discoverAllWorktrees()).resolves.toBeUndefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs with timestamp pattern', async () => {
      const repository = createMockRepository({
        id: 'proj-1',

        path: '/test/project',
      });
      useAppStore.setState({ repositories: [repository] });

      const worktree = createMockWorktree({ path: '/test/wt/feature', branch: 'feature' });
      vi.mocked(window.terminal.listWorktrees).mockResolvedValue([worktree]);

      await discoverWorktreesForRepository('proj-1', '/test/project');

      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'proj-1');
      const newSession = updatedRepository?.worktreeSessions.find((s) => s);

      // ID should match timestamp-random pattern
      expect(newSession?.id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });
});
