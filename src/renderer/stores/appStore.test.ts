import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
  createMockRepositoryWithWorktreeSessions,
  createMockAppState,
} from '../../../tests/utils';
import type { Repository } from '../../shared/types';

describe('appStore - repository management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have an empty repositories array by default', () => {
      const state = useAppStore.getState();
      expect(state.repositories).toEqual([]);
    });

    it('should not be initialized by default', () => {
      const state = useAppStore.getState();
      expect(state.isInitialized).toBe(false);
    });

    it('should have default settings', () => {
      const state = useAppStore.getState();
      expect(state.settings).toEqual({
        worktreeBasePath: null,
        gitPollIntervalMs: 5000,
        notifications: {
          enabled: true,
          backgroundOnly: true,
          cooldownMs: 8000,
        },
        preferredEditor: 'cursor',
        defaultShell: null,
        customShells: [],
        terminalPresets: [
          {
            id: 'new-terminal',
            name: 'Terminal',
            command: '',
            icon: 'terminal',
            isBuiltIn: true,
            order: 0,
          },
          {
            id: 'claude-default',
            name: 'Claude',
            command: 'claude',
            icon: 'sparkles',
            order: 1,
          },
          {
            id: 'gemini-default',
            name: 'Gemini',
            command: 'gemini',
            icon: 'star',
            order: 2,
          },
          {
            id: 'codex-default',
            name: 'Codex',
            command: 'codex',
            icon: 'code',
            order: 3,
          },
        ],
        defaultPresetId: null,
      });
    });

    it('should have default window state', () => {
      const state = useAppStore.getState();
      expect(state.window).toEqual({
        width: 1400,
        height: 900,
        x: 100,
        y: 100,
        isMaximized: true,
        sidebarWidth: 300,
        fileChangesPaneWidth: 400,
        userTerminalPanelRatio: 0.5,
      });
    });
  });

  describe('addRepository', () => {
    it('should add a repository to the repositories array', () => {
      const repository = createMockRepository({ id: 'repository-1', name: 'Test Repository' });

      useAppStore.getState().addRepository(repository);

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(1);
      // Store assigns portRangeStart automatically
      expect(state.repositories[0]).toEqual({ ...repository, portRangeStart: 10000 });
    });

    it('should persist state after adding a repository', () => {
      useAppStore.setState({ isInitialized: true });
      const repository = createMockRepository({ id: 'repository-1' });

      useAppStore.getState().addRepository(repository);

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
      expect(window.storage.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          // Store assigns portRangeStart automatically
          repositories: [{ ...repository, portRangeStart: 10000 }],
        })
      );
    });

    it('should add multiple repositories in order', () => {
      const repository1 = createMockRepository({ id: 'repository-1', name: 'Repository 1' });
      const repository2 = createMockRepository({ id: 'repository-2', name: 'Repository 2' });
      const repository3 = createMockRepository({ id: 'repository-3', name: 'Repository 3' });

      useAppStore.getState().addRepository(repository1);
      useAppStore.getState().addRepository(repository2);
      useAppStore.getState().addRepository(repository3);

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(3);
      expect(state.repositories[0].id).toBe('repository-1');
      expect(state.repositories[1].id).toBe('repository-2');
      expect(state.repositories[2].id).toBe('repository-3');
    });

    it('should allow adding repositories with duplicate IDs (no validation)', () => {
      const repository1 = createMockRepository({ id: 'same-id', name: 'First' });
      const repository2 = createMockRepository({ id: 'same-id', name: 'Second' });

      useAppStore.getState().addRepository(repository1);
      useAppStore.getState().addRepository(repository2);

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(2);
    });

    it('should add a repository with sessions', () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 3);

      useAppStore.getState().addRepository(repository);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(3);
    });

    it('should preserve existing repositories when adding new ones', () => {
      const existingRepository = createMockRepository({ id: 'existing' });
      useAppStore.setState({ repositories: [existingRepository] });

      const newRepository = createMockRepository({ id: 'new-repository' });
      useAppStore.getState().addRepository(newRepository);

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(2);
      expect(state.repositories[0].id).toBe('existing');
      expect(state.repositories[1].id).toBe('new-repository');
    });

    it('should add repository with all optional fields set', () => {
      const repository: Repository = {
        id: 'full-repository',
        name: 'Full Repository',
        path: '/path/to/repository',

        isBare: true,
        isExpanded: true,
        worktreeSessions: [
          createMockWorktreeSession({
            id: 'session-1',
            branchName: 'main',
            worktreeName: 'wt-1',
          }),
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      useAppStore.getState().addRepository(repository);

      const state = useAppStore.getState();
      // Sessions get auto-assigned customShortcut, so use toMatchObject
      expect(state.repositories[0]).toMatchObject({
        id: 'full-repository',
        name: 'Full Repository',
        path: '/path/to/repository',

        isBare: true,
        isExpanded: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      expect(state.repositories[0].worktreeSessions[0]).toMatchObject({
        id: 'session-1',
        branchName: 'main',
        worktreeName: 'wt-1',
      });
      expect(state.repositories[0].worktreeSessions[0].customShortcut).toBeDefined();
    });

    it('should assign incrementing portRangeStart values to repositories', () => {
      const repo1 = createMockRepository({ id: 'repo-1' });
      const repo2 = createMockRepository({ id: 'repo-2' });
      const repo3 = createMockRepository({ id: 'repo-3' });

      useAppStore.getState().addRepository(repo1);
      useAppStore.getState().addRepository(repo2);
      useAppStore.getState().addRepository(repo3);

      const state = useAppStore.getState();
      expect(state.repositories[0].portRangeStart).toBe(10000);
      expect(state.repositories[1].portRangeStart).toBe(10100);
      expect(state.repositories[2].portRangeStart).toBe(10200);
    });

    it('should assign portOffset values to worktree sessions', () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repo-1' }, 3);

      useAppStore.getState().addRepository(repository);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions[0].portOffset).toBe(0);
      expect(state.repositories[0].worktreeSessions[1].portOffset).toBe(1);
      expect(state.repositories[0].worktreeSessions[2].portOffset).toBe(2);
    });

    it('should reuse portRangeStart gaps when repositories are removed', async () => {
      const repo1 = createMockRepository({ id: 'repo-1' });
      const repo2 = createMockRepository({ id: 'repo-2' });
      const repo3 = createMockRepository({ id: 'repo-3' });

      useAppStore.getState().addRepository(repo1);
      useAppStore.getState().addRepository(repo2);
      useAppStore.getState().addRepository(repo3);

      // Remove the second repository (portRangeStart 10100)
      await useAppStore.getState().removeRepository('repo-2');

      // Add a new repository - should reuse 10100
      const repo4 = createMockRepository({ id: 'repo-4' });
      useAppStore.getState().addRepository(repo4);

      const state = useAppStore.getState();
      const repo4State = state.repositories.find((r) => r.id === 'repo-4');
      expect(repo4State?.portRangeStart).toBe(10100);
    });

    it('should preserve existing portRangeStart if already set', () => {
      const repository = createMockRepository({ id: 'repo-1', portRangeStart: 50000 });

      useAppStore.getState().addRepository(repository);

      const state = useAppStore.getState();
      expect(state.repositories[0].portRangeStart).toBe(50000);
    });
  });

  describe('removeRepository', () => {
    it('should remove a repository by ID', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().removeRepository('repository-1');

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(0);
    });

    it('should do nothing when removing a non-existent repository', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().removeRepository('non-existent');

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(1);
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should persist state after removing a repository', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      await useAppStore.getState().removeRepository('repository-1');

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should kill all terminals for the repository sessions', async () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 3);
      useAppStore.setState({ repositories: [repository] });

      // Create tabs for each session (terminal IDs are now "worktreeSessionId:tabId")
      repository.worktreeSessions.forEach((session) =>
        useAppStore.getState().createTab(session.id, 'Terminal')
      );

      await useAppStore.getState().removeRepository('repository-1');

      // killAllForWorktree is called once per worktree session (waits for all terminals to exit)
      expect(window.terminal.killAllForWorktree).toHaveBeenCalledTimes(3);
      expect(window.terminal.killAllForWorktree).toHaveBeenCalledWith('session-repository-1-0');
      expect(window.terminal.killAllForWorktree).toHaveBeenCalledWith('session-repository-1-1');
      expect(window.terminal.killAllForWorktree).toHaveBeenCalledWith('session-repository-1-2');
    });

    it('should stop watcher for git repositories', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().removeRepository('repository-1');

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
    });

    // Note: All repositories are git repos now, so watcher is always stopped on removal

    it('should clear activeTerminalId if it belongs to removed repository', async () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-repository-1-0',
      });

      await useAppStore.getState().removeRepository('repository-1');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });

    it('should preserve activeTerminalId if it belongs to another repository', async () => {
      const repository1 = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      const repository2 = createMockRepositoryWithWorktreeSessions({ id: 'repository-2' }, 1);
      useAppStore.setState({
        repositories: [repository1, repository2],
        activeTerminalId: 'session-repository-2-0',
      });

      await useAppStore.getState().removeRepository('repository-1');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-repository-2-0');
    });

    it('should handle terminal kill failure gracefully', async () => {
      vi.mocked(window.terminal.killAllForWorktree).mockRejectedValue(
        new Error('Terminal not running')
      );
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 2);
      useAppStore.setState({ repositories: [repository] });

      // Should not throw
      await useAppStore.getState().removeRepository('repository-1');

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(0);
    });

    it('should only remove the specified repository', async () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      const repository3 = createMockRepository({ id: 'repository-3' });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      await useAppStore.getState().removeRepository('repository-2');

      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(2);
      expect(state.repositories.map((p) => p.id)).toEqual(['repository-1', 'repository-3']);
    });
  });

  describe('toggleRepositoryExpanded', () => {
    it('should expand a collapsed repository', () => {
      const repository = createMockRepository({ id: 'repository-1', isExpanded: false });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().toggleRepositoryExpanded('repository-1');

      const state = useAppStore.getState();
      expect(state.repositories[0].isExpanded).toBe(true);
    });

    it('should collapse an expanded repository', () => {
      const repository = createMockRepository({ id: 'repository-1', isExpanded: true });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().toggleRepositoryExpanded('repository-1');

      const state = useAppStore.getState();
      expect(state.repositories[0].isExpanded).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      const repository = createMockRepository({ id: 'repository-1', isExpanded: false });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().toggleRepositoryExpanded('repository-1');
      expect(useAppStore.getState().repositories[0].isExpanded).toBe(true);

      useAppStore.getState().toggleRepositoryExpanded('repository-1');
      expect(useAppStore.getState().repositories[0].isExpanded).toBe(false);

      useAppStore.getState().toggleRepositoryExpanded('repository-1');
      expect(useAppStore.getState().repositories[0].isExpanded).toBe(true);
    });

    it('should persist state after toggling', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });
      vi.clearAllMocks();

      useAppStore.getState().toggleRepositoryExpanded('repository-1');

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should only affect the specified repository', () => {
      const repository1 = createMockRepository({ id: 'repository-1', isExpanded: false });
      const repository2 = createMockRepository({ id: 'repository-2', isExpanded: true });
      const repository3 = createMockRepository({ id: 'repository-3', isExpanded: false });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      useAppStore.getState().toggleRepositoryExpanded('repository-1');

      const state = useAppStore.getState();
      expect(state.repositories[0].isExpanded).toBe(true);
      expect(state.repositories[1].isExpanded).toBe(true);
      expect(state.repositories[2].isExpanded).toBe(false);
    });

    it('should handle non-existent repository ID gracefully', () => {
      const repository = createMockRepository({ id: 'repository-1', isExpanded: false });
      useAppStore.setState({ repositories: [repository] });

      // Should not throw
      useAppStore.getState().toggleRepositoryExpanded('non-existent');

      const state = useAppStore.getState();
      expect(state.repositories[0].isExpanded).toBe(false);
    });
  });

  describe('updateRepositoryScriptsConfig', () => {
    it('should create scriptsConfig with defaults when repository has none', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: 'npm install',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig).toEqual({
        setupScript: 'npm install',
        runScripts: [],
        cleanupScript: null,
        exclusiveMode: false,
        lastUsedRunScriptId: null,
      });
    });

    it('should update partial scriptsConfig while preserving existing values', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [{ id: 'run-1', name: 'Dev', command: 'npm run dev' }],
          cleanupScript: 'npm run cleanup',
          exclusiveMode: true,
          lastUsedRunScriptId: 'run-1',
        },
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: 'yarn install',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig).toEqual({
        setupScript: 'yarn install',
        runScripts: [{ id: 'run-1', name: 'Dev', command: 'npm run dev' }],
        cleanupScript: 'npm run cleanup',
        exclusiveMode: true,
        lastUsedRunScriptId: 'run-1',
      });
    });

    it('should update runScripts array', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const runScripts = [
        { id: 'run-1', name: 'Dev', command: 'npm run dev' },
        { id: 'run-2', name: 'Test', command: 'npm test' },
      ];

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        runScripts,
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig?.runScripts).toEqual(runScripts);
    });

    it('should update exclusiveMode', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        scriptsConfig: {
          setupScript: null,
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        exclusiveMode: true,
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig?.exclusiveMode).toBe(true);
    });

    it('should update lastUsedRunScriptId', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        lastUsedRunScriptId: 'run-1',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig?.lastUsedRunScriptId).toBe('run-1');
    });

    it('should update cleanupScript', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        cleanupScript: 'rm -rf node_modules',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig?.cleanupScript).toBe('rm -rf node_modules');
    });

    it('should persist state after updating scriptsConfig', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });
      vi.clearAllMocks();

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: 'npm install',
      });

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
      expect(window.storage.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          repositories: expect.arrayContaining([
            expect.objectContaining({
              id: 'repository-1',
              scriptsConfig: expect.objectContaining({
                setupScript: 'npm install',
              }),
            }),
          ]),
        })
      );
    });

    it('should only affect the specified repository', () => {
      const repository1 = createMockRepository({
        id: 'repository-1',
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        scriptsConfig: {
          setupScript: 'yarn install',
          runScripts: [],
          cleanupScript: null,
          exclusiveMode: false,
          lastUsedRunScriptId: null,
        },
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: 'pnpm install',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig?.setupScript).toBe('pnpm install');
      expect(state.repositories[1].scriptsConfig?.setupScript).toBe('yarn install');
    });

    it('should handle non-existent repository ID gracefully', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      // Should not throw
      useAppStore.getState().updateRepositoryScriptsConfig('non-existent', {
        setupScript: 'npm install',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig).toBeUndefined();
    });

    it('should allow setting scriptsConfig fields to null', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        scriptsConfig: {
          setupScript: 'npm install',
          runScripts: [],
          cleanupScript: 'npm run cleanup',
          exclusiveMode: false,
          lastUsedRunScriptId: 'run-1',
        },
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: null,
        cleanupScript: null,
        lastUsedRunScriptId: null,
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig).toEqual({
        setupScript: null,
        runScripts: [],
        cleanupScript: null,
        exclusiveMode: false,
        lastUsedRunScriptId: null,
      });
    });

    it('should update multiple fields at once', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().updateRepositoryScriptsConfig('repository-1', {
        setupScript: 'npm install',
        cleanupScript: 'npm run cleanup',
        exclusiveMode: true,
        runScripts: [{ id: 'run-1', name: 'Dev', command: 'npm run dev' }],
        lastUsedRunScriptId: 'run-1',
      });

      const state = useAppStore.getState();
      expect(state.repositories[0].scriptsConfig).toEqual({
        setupScript: 'npm install',
        cleanupScript: 'npm run cleanup',
        exclusiveMode: true,
        runScripts: [{ id: 'run-1', name: 'Dev', command: 'npm run dev' }],
        lastUsedRunScriptId: 'run-1',
      });
    });
  });

  describe('reorderRepositories', () => {
    it('should reorder repositories in the list', () => {
      const repository1 = createMockRepository({ id: 'repository-1', name: 'Repository 1' });
      const repository2 = createMockRepository({ id: 'repository-2', name: 'Repository 2' });
      const repository3 = createMockRepository({ id: 'repository-3', name: 'Repository 3' });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      // Move repository from index 0 to index 2
      useAppStore.getState().reorderRepositories(0, 2);

      const state = useAppStore.getState();
      expect(state.repositories.map((r) => r.id)).toEqual([
        'repository-2',
        'repository-3',
        'repository-1',
      ]);
    });

    it('should persist state after reordering repositories', () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      useAppStore.setState({ repositories: [repository1, repository2], isInitialized: true });
      vi.clearAllMocks();

      useAppStore.getState().reorderRepositories(0, 1);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should not modify state when fromIndex equals toIndex', () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      useAppStore.setState({ repositories: [repository1, repository2] });
      vi.clearAllMocks();

      useAppStore.getState().reorderRepositories(0, 0);

      // Should not call saveState when no change
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should move repository from end to beginning', () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      const repository3 = createMockRepository({ id: 'repository-3' });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      useAppStore.getState().reorderRepositories(2, 0);

      const state = useAppStore.getState();
      expect(state.repositories.map((r) => r.id)).toEqual([
        'repository-3',
        'repository-1',
        'repository-2',
      ]);
    });

    it('should move repository to middle position', () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      const repository3 = createMockRepository({ id: 'repository-3' });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      useAppStore.getState().reorderRepositories(0, 1);

      const state = useAppStore.getState();
      expect(state.repositories.map((r) => r.id)).toEqual([
        'repository-2',
        'repository-1',
        'repository-3',
      ]);
    });
  });

  describe('getRepositoryByWorktreeSessionId', () => {
    it('should return the repository containing the session', () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 2);
      useAppStore.setState({ repositories: [repository] });

      const result = useAppStore
        .getState()
        .getRepositoryByWorktreeSessionId('session-repository-1-0');

      expect(result).toBeDefined();
      expect(result?.id).toBe('repository-1');
    });

    it('should return undefined for non-existent session', () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      useAppStore.setState({ repositories: [repository] });

      const result = useAppStore.getState().getRepositoryByWorktreeSessionId('non-existent');

      expect(result).toBeUndefined();
    });

    it('should find session across multiple repositories', () => {
      const repository1 = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      const repository2 = createMockRepositoryWithWorktreeSessions({ id: 'repository-2' }, 2);
      useAppStore.setState({ repositories: [repository1, repository2] });

      const result = useAppStore
        .getState()
        .getRepositoryByWorktreeSessionId('session-repository-2-1');

      expect(result?.id).toBe('repository-2');
    });

    it('should return undefined when no repositories exist', () => {
      const result = useAppStore.getState().getRepositoryByWorktreeSessionId('any-session');

      expect(result).toBeUndefined();
    });
  });

  describe('getWorktreeSessionById', () => {
    it('should return the session by ID', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Test Session' });
      const repository = createMockRepository({ id: 'repository-1', worktreeSessions: [session] });
      useAppStore.setState({ repositories: [repository] });

      const result = useAppStore.getState().getWorktreeSessionById('session-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('session-1');
      expect(result?.label).toBe('Test Session');
    });

    it('should return undefined for non-existent session', () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      useAppStore.setState({ repositories: [repository] });

      const result = useAppStore.getState().getWorktreeSessionById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should find session across multiple repositories', () => {
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [createMockWorktreeSession({ id: 'session-1' })],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        worktreeSessions: [createMockWorktreeSession({ id: 'session-2', label: 'Found Me' })],
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      const result = useAppStore.getState().getWorktreeSessionById('session-2');

      expect(result?.label).toBe('Found Me');
    });

    it('should return first match when multiple sessions have same ID (edge case)', () => {
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [createMockWorktreeSession({ id: 'same-id', label: 'First' })],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        worktreeSessions: [createMockWorktreeSession({ id: 'same-id', label: 'Second' })],
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      const result = useAppStore.getState().getWorktreeSessionById('same-id');

      expect(result?.label).toBe('First');
    });

    it('should return undefined when no repositories exist', () => {
      const result = useAppStore.getState().getWorktreeSessionById('any-session');

      expect(result).toBeUndefined();
    });
  });

  describe('state immutability', () => {
    it('should not mutate existing state when adding repository', () => {
      const existingRepository = createMockRepository({ id: 'existing' });
      useAppStore.setState({ repositories: [existingRepository] });
      const originalRepositorys = useAppStore.getState().repositories;

      const newRepository = createMockRepository({ id: 'new' });
      useAppStore.getState().addRepository(newRepository);

      expect(useAppStore.getState().repositories).not.toBe(originalRepositorys);
      expect(originalRepositorys).toHaveLength(1);
    });

    it('should not mutate existing state when toggling expansion', () => {
      const repository = createMockRepository({ id: 'repository-1', isExpanded: false });
      useAppStore.setState({ repositories: [repository] });
      const originalRepositorys = useAppStore.getState().repositories;

      useAppStore.getState().toggleRepositoryExpanded('repository-1');

      expect(useAppStore.getState().repositories).not.toBe(originalRepositorys);
      expect(useAppStore.getState().repositories[0]).not.toBe(originalRepositorys[0]);
    });
  });
});

describe('appStore - session management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('addWorktreeSession', () => {
    it('should add a session to a repository', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session = createMockWorktreeSession({ id: 'session-1', label: 'New Session' });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
      // Session gets auto-assigned customShortcut, so check key fields
      expect(state.repositories[0].worktreeSessions[0].id).toBe('session-1');
      expect(state.repositories[0].worktreeSessions[0].label).toBe('New Session');
      expect(state.repositories[0].worktreeSessions[0].customShortcut).toBeDefined();
    });

    it('should persist state after adding a session', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      const session = createMockWorktreeSession({ id: 'session-1' });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
      expect(window.storage.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          repositories: [
            expect.objectContaining({
              id: 'repository-1',
              worktreeSessions: [
                expect.objectContaining({
                  id: 'session-1',
                  customShortcut: expect.any(Object),
                }),
              ],
            }),
          ],
        })
      );
    });

    it('should add multiple sessions to a repository in order', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session1 = createMockWorktreeSession({ id: 'session-1', label: 'Session 1' });
      const session2 = createMockWorktreeSession({ id: 'session-2', label: 'Session 2' });
      const session3 = createMockWorktreeSession({ id: 'session-3', label: 'Session 3' });

      useAppStore.getState().addWorktreeSession('repository-1', session1);
      useAppStore.getState().addWorktreeSession('repository-1', session2);
      useAppStore.getState().addWorktreeSession('repository-1', session3);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(3);
      expect(state.repositories[0].worktreeSessions[0].id).toBe('session-1');
      expect(state.repositories[0].worktreeSessions[1].id).toBe('session-2');
      expect(state.repositories[0].worktreeSessions[2].id).toBe('session-3');
    });

    it('should add worktree session to the correct repository when multiple repositories exist', () => {
      const repository1 = createMockRepository({ id: 'repository-1' });
      const repository2 = createMockRepository({ id: 'repository-2' });
      const repository3 = createMockRepository({ id: 'repository-3' });
      useAppStore.setState({ repositories: [repository1, repository2, repository3] });

      const worktreeSession = createMockWorktreeSession({ id: 'session-1' });
      useAppStore.getState().addWorktreeSession('repository-2', worktreeSession);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(0);
      expect(state.repositories[1].worktreeSessions).toHaveLength(1);
      // Session gets auto-assigned customShortcut, so use toMatchObject
      expect(state.repositories[1].worktreeSessions[0]).toMatchObject({
        id: 'session-1',
        label: worktreeSession.label,
      });
      expect(state.repositories[2].worktreeSessions).toHaveLength(0);
    });

    it('should not modify other repositories when adding session', () => {
      const existingSession = createMockWorktreeSession({ id: 'existing-session' });
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [existingSession],
      });
      const repository2 = createMockRepository({ id: 'repository-2' });
      useAppStore.setState({ repositories: [repository1, repository2] });

      const newSession = createMockWorktreeSession({ id: 'new-session' });
      useAppStore.getState().addWorktreeSession('repository-2', newSession);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
      expect(state.repositories[0].worktreeSessions[0].id).toBe('existing-session');
    });

    it('should handle adding session to non-existent repository gracefully', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session = createMockWorktreeSession({ id: 'session-1' });
      // Should not throw
      useAppStore.getState().addWorktreeSession('non-existent', session);

      // State should be unchanged for existing repository
      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(0);
    });

    it('should preserve existing sessions when adding new one', () => {
      const existingSession = createMockWorktreeSession({
        id: 'existing-session',
        label: 'Existing',
      });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [existingSession],
      });
      useAppStore.setState({ repositories: [repository] });

      const newSession = createMockWorktreeSession({ id: 'new-session', label: 'New' });
      useAppStore.getState().addWorktreeSession('repository-1', newSession);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(2);
      expect(state.repositories[0].worktreeSessions[0].id).toBe('existing-session');
      expect(state.repositories[0].worktreeSessions[1].id).toBe('new-session');
    });

    it('should add worktree session with branch info', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const worktreeSession = createMockWorktreeSession({
        id: 'worktree-session',
        label: 'Feature Branch',
        branchName: 'feature/test',
        worktreeName: 'wt-feature-test',
      });
      useAppStore.getState().addWorktreeSession('repository-1', worktreeSession);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions[0].label).toBe('Feature Branch');
      expect(state.repositories[0].worktreeSessions[0].branchName).toBe('feature/test');
      expect(state.repositories[0].worktreeSessions[0].worktreeName).toBe('wt-feature-test');
    });

    it('should add worktree session with all optional fields set', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const worktreeSession = createMockWorktreeSession({
        id: 'full-session',
        label: 'Full Session',
        path: '/custom/path',
        branchName: 'feature/full',
        worktreeName: 'wt-full',
        isExternal: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
      useAppStore.getState().addWorktreeSession('repository-1', worktreeSession);

      const state = useAppStore.getState();
      // Session gets auto-assigned customShortcut, so use toMatchObject for original fields
      expect(state.repositories[0].worktreeSessions[0]).toMatchObject({
        id: 'full-session',
        label: 'Full Session',
        path: '/custom/path',
        branchName: 'feature/full',
        worktreeName: 'wt-full',
        isExternal: true,
      });
      // Verify customShortcut was auto-assigned
      expect(state.repositories[0].worktreeSessions[0].customShortcut).toBeDefined();
    });

    it('should allow adding sessions with duplicate IDs (no validation)', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session1 = createMockWorktreeSession({ id: 'same-id', label: 'First' });
      const session2 = createMockWorktreeSession({ id: 'same-id', label: 'Second' });

      useAppStore.getState().addWorktreeSession('repository-1', session1);
      useAppStore.getState().addWorktreeSession('repository-1', session2);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(2);
    });

    it('should assign incrementing portOffset values to worktree sessions', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const session3 = createMockWorktreeSession({ id: 'session-3' });

      useAppStore.getState().addWorktreeSession('repository-1', session1);
      useAppStore.getState().addWorktreeSession('repository-1', session2);
      useAppStore.getState().addWorktreeSession('repository-1', session3);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions[0].portOffset).toBe(0);
      expect(state.repositories[0].worktreeSessions[1].portOffset).toBe(1);
      expect(state.repositories[0].worktreeSessions[2].portOffset).toBe(2);
    });

    it('should reuse portOffset gaps when worktree sessions are removed', () => {
      const existingSession1 = createMockWorktreeSession({ id: 'session-1', portOffset: 0 });
      const existingSession2 = createMockWorktreeSession({ id: 'session-2', portOffset: 1 });
      const existingSession3 = createMockWorktreeSession({ id: 'session-3', portOffset: 2 });
      const repository = createMockRepository({
        id: 'repository-1',
        portRangeStart: 10000,
        worktreeSessions: [existingSession1, existingSession2, existingSession3],
      });
      useAppStore.setState({ repositories: [repository] });

      // Remove the second session (portOffset 1)
      useAppStore.getState().removeWorktreeSession('repository-1', 'session-2');

      // Add a new session - should reuse portOffset 1
      const newSession = createMockWorktreeSession({ id: 'session-4' });
      useAppStore.getState().addWorktreeSession('repository-1', newSession);

      const state = useAppStore.getState();
      const newSessionState = state.repositories[0].worktreeSessions.find(
        (s) => s.id === 'session-4'
      );
      expect(newSessionState?.portOffset).toBe(1);
    });

    it('should preserve existing portOffset if already set', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session = createMockWorktreeSession({ id: 'session-1', portOffset: 99 });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions[0].portOffset).toBe(99);
    });
  });

  describe('removeWorktreeSession', () => {
    it('should remove a session from a repository', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(0);
    });

    it('should persist state after removing a session', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
      expect(window.storage.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          repositories: [
            expect.objectContaining({
              id: 'repository-1',
              worktreeSessions: [],
            }),
          ],
        })
      );
    });

    it('should only remove the specified session', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1', label: 'Session 1' });
      const session2 = createMockWorktreeSession({ id: 'session-2', label: 'Session 2' });
      const session3 = createMockWorktreeSession({ id: 'session-3', label: 'Session 3' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2, session3],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-2');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(2);
      expect(state.repositories[0].worktreeSessions.map((s) => s.id)).toEqual([
        'session-1',
        'session-3',
      ]);
    });

    it('should remove session from the correct repository when multiple repositories exist', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        worktreeSessions: [session2],
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      useAppStore.getState().removeWorktreeSession('repository-2', 'session-2');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
      expect(state.repositories[1].worktreeSessions).toHaveLength(0);
    });

    it('should not modify other repositories when removing session', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const session3 = createMockWorktreeSession({ id: 'session-3' });
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        worktreeSessions: [session3],
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
      expect(state.repositories[1].worktreeSessions).toHaveLength(1);
      expect(state.repositories[1].worktreeSessions[0].id).toBe('session-3');
    });

    it('should handle removing non-existent session gracefully', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      // Should not throw
      useAppStore.getState().removeWorktreeSession('repository-1', 'non-existent');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
    });

    it('should handle removing session from non-existent repository gracefully', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      // Should not throw
      useAppStore.getState().removeWorktreeSession('non-existent', 'session-1');

      // State should be unchanged
      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
    });

    it('should remove multiple sessions sequentially', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const session3 = createMockWorktreeSession({ id: 'session-3' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2, session3],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');
      useAppStore.getState().removeWorktreeSession('repository-1', 'session-3');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(1);
      expect(state.repositories[0].worktreeSessions[0].id).toBe('session-2');
    });

    it('should remove all sessions leaving empty array', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');
      useAppStore.getState().removeWorktreeSession('repository-1', 'session-2');

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions).toHaveLength(0);
      expect(state.repositories[0].worktreeSessions).toEqual([]);
    });
  });

  describe('reorderWorktreeSessions', () => {
    it('should reorder sessions within a repository', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1', label: 'Session 1' });
      const session2 = createMockWorktreeSession({ id: 'session-2', label: 'Session 2' });
      const session3 = createMockWorktreeSession({ id: 'session-3', label: 'Session 3' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2, session3],
      });
      useAppStore.setState({ repositories: [repository] });

      // Move session from index 0 to index 2
      useAppStore.getState().reorderWorktreeSessions('repository-1', 0, 2);

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions.map((s) => s.id)).toEqual([
        'session-2',
        'session-3',
        'session-1',
      ]);
    });

    it('should persist state after reordering sessions', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      useAppStore.getState().reorderWorktreeSessions('repository-1', 0, 1);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should not modify state when fromIndex equals toIndex', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      useAppStore.setState({ repositories: [repository] });
      vi.clearAllMocks();

      useAppStore.getState().reorderWorktreeSessions('repository-1', 0, 0);

      // Should not call saveState when no change
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should only affect the specified repository', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const session3 = createMockWorktreeSession({ id: 'session-3' });
      const session4 = createMockWorktreeSession({ id: 'session-4' });
      const repository1 = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',
        worktreeSessions: [session3, session4],
      });
      useAppStore.setState({ repositories: [repository1, repository2] });

      useAppStore.getState().reorderWorktreeSessions('repository-1', 0, 1);

      const state = useAppStore.getState();
      // Repository 1 should be reordered
      expect(state.repositories[0].worktreeSessions.map((s) => s.id)).toEqual([
        'session-2',
        'session-1',
      ]);
      // Repository 2 should be unchanged
      expect(state.repositories[1].worktreeSessions.map((s) => s.id)).toEqual([
        'session-3',
        'session-4',
      ]);
    });
  });

  describe('session lifecycle - add and remove', () => {
    it('should support full session lifecycle within a repository', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      // Add sessions
      const mainSession = createMockWorktreeSession({
        id: 'main-session',
        label: 'Main',
      });
      const worktreeSession1 = createMockWorktreeSession({
        id: 'wt-session-1',
        label: 'Feature A',
      });
      const worktreeSession2 = createMockWorktreeSession({
        id: 'wt-session-2',
        label: 'Feature B',
      });

      useAppStore.getState().addWorktreeSession('repository-1', mainSession);
      useAppStore.getState().addWorktreeSession('repository-1', worktreeSession1);
      useAppStore.getState().addWorktreeSession('repository-1', worktreeSession2);

      expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(3);

      // Remove worktree sessions
      useAppStore.getState().removeWorktreeSession('repository-1', 'wt-session-1');
      expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(2);

      useAppStore.getState().removeWorktreeSession('repository-1', 'wt-session-2');
      expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(1);

      // Main session remains
      expect(useAppStore.getState().repositories[0].worktreeSessions[0].id).toBe('main-session');
    });

    it('should allow session to be found after adding', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      const session = createMockWorktreeSession({
        id: 'new-session',
        label: 'New Session',
      });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      // Should be findable via getWorktreeSessionById
      const found = useAppStore.getState().getWorktreeSessionById('new-session');
      expect(found).toBeDefined();
      expect(found?.label).toBe('New Session');

      // Should be findable via getRepositoryByWorktreeSessionId
      const repository2 = useAppStore.getState().getRepositoryByWorktreeSessionId('new-session');
      expect(repository2).toBeDefined();
      expect(repository2?.id).toBe('repository-1');
    });

    it('should not find session after removing', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      // Should be findable initially
      expect(useAppStore.getState().getWorktreeSessionById('session-1')).toBeDefined();

      // Remove session
      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');

      // Should not be findable after removal
      expect(useAppStore.getState().getWorktreeSessionById('session-1')).toBeUndefined();
    });
  });

  describe('state immutability - sessions', () => {
    it('should not mutate existing state when adding session', () => {
      const existingSession = createMockWorktreeSession({ id: 'existing-session' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [existingSession],
      });
      useAppStore.setState({ repositories: [repository] });
      const originalRepositorys = useAppStore.getState().repositories;
      const originalSessions = originalRepositorys[0].worktreeSessions;

      const newSession = createMockWorktreeSession({ id: 'new-session' });
      useAppStore.getState().addWorktreeSession('repository-1', newSession);

      expect(useAppStore.getState().repositories).not.toBe(originalRepositorys);
      expect(useAppStore.getState().repositories[0]).not.toBe(originalRepositorys[0]);
      expect(useAppStore.getState().repositories[0].worktreeSessions).not.toBe(originalSessions);
      expect(originalSessions).toHaveLength(1);
    });

    it('should not mutate existing state when removing session', () => {
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session1, session2],
      });
      useAppStore.setState({ repositories: [repository] });
      const originalRepositorys = useAppStore.getState().repositories;
      const originalSessions = originalRepositorys[0].worktreeSessions;

      useAppStore.getState().removeWorktreeSession('repository-1', 'session-1');

      expect(useAppStore.getState().repositories).not.toBe(originalRepositorys);
      expect(useAppStore.getState().repositories[0]).not.toBe(originalRepositorys[0]);
      expect(useAppStore.getState().repositories[0].worktreeSessions).not.toBe(originalSessions);
      expect(originalSessions).toHaveLength(2);
    });
  });
});

describe('appStore - terminal state management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('setActiveTerminal', () => {
    it('should set the active terminal ID', () => {
      useAppStore.getState().setActiveTerminal('session-1');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-1');
    });

    it('should update active terminal ID to a different value', () => {
      useAppStore.getState().setActiveTerminal('session-1');
      useAppStore.getState().setActiveTerminal('session-2');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-2');
    });

    it('should set active terminal ID to null', () => {
      useAppStore.getState().setActiveTerminal('session-1');
      useAppStore.getState().setActiveTerminal(null);

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });

    it('should be null by default', () => {
      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });

    it('should restore activeTabId when switching to a worktree with tabs', () => {
      // Setup: worktree A has 2 tabs, worktree B has 3 tabs
      const worktreeATabs = [
        { id: 'tab-a1', name: 'claude', createdAt: '2024-01-01', order: 0 },
        { id: 'tab-a2', name: 'shell', createdAt: '2024-01-01', order: 1 },
      ];
      const worktreeBTabs = [
        { id: 'tab-b1', name: 'claude', createdAt: '2024-01-01', order: 0 },
        { id: 'tab-b2', name: 'test', createdAt: '2024-01-01', order: 1 },
        { id: 'tab-b3', name: 'build', createdAt: '2024-01-01', order: 2 },
      ];

      useAppStore.setState({
        worktreeTabs: [
          { worktreeSessionId: 'session-a', tabs: worktreeATabs, activeTabId: 'tab-a2' },
          { worktreeSessionId: 'session-b', tabs: worktreeBTabs, activeTabId: 'tab-b1' },
        ],
      });

      // Switch to worktree A
      useAppStore.getState().setActiveTerminal('session-a');

      let state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-a');
      expect(state.activeTabId).toBe('tab-a2'); // Should restore worktree A's active tab

      // Switch to worktree B
      useAppStore.getState().setActiveTerminal('session-b');

      state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-b');
      expect(state.activeTabId).toBe('tab-b1'); // Should restore worktree B's active tab

      // Switch back to worktree A
      useAppStore.getState().setActiveTerminal('session-a');

      state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-a');
      expect(state.activeTabId).toBe('tab-a2'); // Should still have worktree A's active tab
    });

    it('should set activeTabId to null when switching to worktree with no tabs', () => {
      useAppStore.setState({
        worktreeTabs: [{ worktreeSessionId: 'session-a', tabs: [], activeTabId: null }],
        activeTabId: 'some-old-tab',
      });

      useAppStore.getState().setActiveTerminal('session-a');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-a');
      expect(state.activeTabId).toBeNull();
    });

    it('should set activeTabId to null when switching to worktree not in worktreeTabs', () => {
      useAppStore.setState({
        worktreeTabs: [],
        activeTabId: 'some-old-tab',
      });

      useAppStore.getState().setActiveTerminal('session-new');

      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBe('session-new');
      expect(state.activeTabId).toBeNull();
    });

    it('should preserve tabs when switching between worktrees', () => {
      // Setup: worktree A has 2 tabs, worktree B has 3 tabs
      const worktreeATabs = [
        { id: 'tab-a1', name: 'claude', createdAt: '2024-01-01', order: 0 },
        { id: 'tab-a2', name: 'shell', createdAt: '2024-01-01', order: 1 },
      ];
      const worktreeBTabs = [
        { id: 'tab-b1', name: 'claude', createdAt: '2024-01-01', order: 0 },
        { id: 'tab-b2', name: 'test', createdAt: '2024-01-01', order: 1 },
        { id: 'tab-b3', name: 'build', createdAt: '2024-01-01', order: 2 },
      ];

      useAppStore.setState({
        worktreeTabs: [
          { worktreeSessionId: 'session-a', tabs: worktreeATabs, activeTabId: 'tab-a1' },
          { worktreeSessionId: 'session-b', tabs: worktreeBTabs, activeTabId: 'tab-b1' },
        ],
      });

      // Verify tabs for each worktree remain isolated
      useAppStore.getState().setActiveTerminal('session-a');
      expect(useAppStore.getState().getTabsForWorktree('session-a')).toHaveLength(2);
      expect(useAppStore.getState().getTabsForWorktree('session-b')).toHaveLength(3);

      useAppStore.getState().setActiveTerminal('session-b');
      expect(useAppStore.getState().getTabsForWorktree('session-a')).toHaveLength(2);
      expect(useAppStore.getState().getTabsForWorktree('session-b')).toHaveLength(3);
    });

    it('should update worktree activeTabId when setActiveTab is called', () => {
      const worktreeATabs = [
        { id: 'tab-a1', name: 'claude', createdAt: '2024-01-01', order: 0 },
        { id: 'tab-a2', name: 'shell', createdAt: '2024-01-01', order: 1 },
      ];

      useAppStore.setState({
        worktreeTabs: [
          { worktreeSessionId: 'session-a', tabs: worktreeATabs, activeTabId: 'tab-a1' },
        ],
      });

      useAppStore.getState().setActiveTerminal('session-a');
      useAppStore.getState().setActiveTab('tab-a2');

      // Verify both global and worktree-specific activeTabId are updated
      const state = useAppStore.getState();
      expect(state.activeTabId).toBe('tab-a2');

      const worktreeTabState = state.worktreeTabs?.find(
        (wt) => wt.worktreeSessionId === 'session-a'
      );
      expect(worktreeTabState?.activeTabId).toBe('tab-a2');
    });
  });

  describe('registerTerminal', () => {
    it('should register a new terminal with starting status and default fields', () => {
      useAppStore.getState().registerTerminal('session-1');

      const state = useAppStore.getState();
      expect(state.terminals.has('session-1')).toBe(true);
      const terminal = state.terminals.get('session-1');
      expect(terminal?.id).toBe('session-1');
      expect(terminal?.status).toBe('starting');
      expect(terminal?.hasReceivedOutput).toBe(false);
      expect(typeof terminal?.lastActivityTime).toBe('number');
    });

    it('should not overwrite an existing registered terminal', () => {
      // Register with stopped status
      useAppStore.getState().registerTerminal('session-1');

      // Update status to something else
      useAppStore.getState().updateTerminalStatus('session-1', 'running');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('running');

      // Re-register should NOT overwrite
      useAppStore.getState().registerTerminal('session-1');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('running');
    });

    it('should register multiple terminals', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().registerTerminal('session-2');
      useAppStore.getState().registerTerminal('session-3');

      const state = useAppStore.getState();
      expect(state.terminals.size).toBe(3);
      expect(state.terminals.has('session-1')).toBe(true);
      expect(state.terminals.has('session-2')).toBe(true);
      expect(state.terminals.has('session-3')).toBe(true);
    });
  });

  describe('unregisterTerminal', () => {
    it('should remove a registered terminal', () => {
      useAppStore.getState().registerTerminal('session-1');
      expect(useAppStore.getState().terminals.has('session-1')).toBe(true);

      useAppStore.getState().unregisterTerminal('session-1');

      const state = useAppStore.getState();
      expect(state.terminals.has('session-1')).toBe(false);
    });

    it('should handle unregistering a non-existent terminal gracefully', () => {
      // Should not throw
      useAppStore.getState().unregisterTerminal('non-existent');

      const state = useAppStore.getState();
      expect(state.terminals.size).toBe(0);
    });

    it('should only remove the specified terminal', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().registerTerminal('session-2');
      useAppStore.getState().registerTerminal('session-3');

      useAppStore.getState().unregisterTerminal('session-2');

      const state = useAppStore.getState();
      expect(state.terminals.size).toBe(2);
      expect(state.terminals.has('session-1')).toBe(true);
      expect(state.terminals.has('session-2')).toBe(false);
      expect(state.terminals.has('session-3')).toBe(true);
    });
  });

  describe('updateTerminalStatus', () => {
    it('should update the status of an existing terminal', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      const state = useAppStore.getState();
      expect(state.terminals.get('session-1')?.status).toBe('running');
    });

    it('should set status to idle', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateTerminalStatus('session-1', 'idle');

      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('idle');
    });

    it('should set status to waiting_input', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('waiting');
    });

    it('should set status to stopped', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      useAppStore.getState().updateTerminalStatus('session-1', 'stopped');

      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('stopped');
    });

    it('should set status to error', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateTerminalStatus('session-1', 'error');

      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('error');
    });

    it('should auto-register non-existent terminal on status update', () => {
      // Auto-register terminals that don't exist (handles app restart scenario)
      useAppStore.getState().updateTerminalStatus('non-existent', 'running');

      const state = useAppStore.getState();
      expect(state.terminals.size).toBe(1);
      expect(state.terminals.get('non-existent')?.status).toBe('running');
    });

    it('should preserve gitStatus when updating status', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });

      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('running');
      expect(terminal?.gitStatus).toEqual({
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });
    });

    it('should update status multiple times', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateTerminalStatus('session-1', 'idle');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('idle');

      useAppStore.getState().updateTerminalStatus('session-1', 'running');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('running');

      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('waiting');

      useAppStore.getState().updateTerminalStatus('session-1', 'idle');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('idle');
    });
  });

  describe('updateGitStatus', () => {
    it('should update the git status of an existing terminal', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.gitStatus).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });

    it('should update git status with dirty state', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'feature/test',
        isDirty: true,
        additions: 10,
        deletions: 3,
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.gitStatus).toEqual({
        branch: 'feature/test',
        isDirty: true,
        additions: 10,
        deletions: 3,
      });
    });

    it('should set git status to undefined', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.getState().updateGitStatus('session-1', undefined);

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.gitStatus).toBeUndefined();
    });

    it('should create terminal entry for non-existent terminal', () => {
      // Should create a minimal terminal entry with git status
      useAppStore.getState().updateGitStatus('non-existent', {
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      const state = useAppStore.getState();
      expect(state.terminals.size).toBe(1);
      const terminal = state.terminals.get('non-existent');
      expect(terminal?.status).toBe('stopped');
      expect(terminal?.gitStatus).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });

    it('should preserve status when updating git status', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('running');
      expect(terminal?.gitStatus).toEqual({
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });
    });

    it('should update git status multiple times', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'main',
        isDirty: true,
        additions: 5,
        deletions: 2,
      });

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'develop',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
      expect(useAppStore.getState().terminals.get('session-1')?.gitStatus).toEqual({
        branch: 'develop',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });
    });
  });

  describe('startTerminal', () => {
    it('should register terminal with starting status and spawn via IPC', async () => {
      const session = createMockWorktreeSession({ id: 'session-1', path: '/test/path' });
      const repository = createMockRepository({ id: 'repository-1', worktreeSessions: [session] });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().startTerminal('session-1');

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('starting');
      expect(window.terminal.spawn).toHaveBeenCalledWith('session-1', '/test/path', 'claude');
    });

    it('should do nothing for non-existent session', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().startTerminal('non-existent');

      expect(useAppStore.getState().terminals.size).toBe(0);
      expect(window.terminal.spawn).not.toHaveBeenCalled();
    });

    it('should use session path for terminal spawn', async () => {
      const session = createMockWorktreeSession({
        id: 'session-1',
        path: '/custom/repository/path',
      });
      const repository = createMockRepository({ id: 'repository-1', worktreeSessions: [session] });
      useAppStore.setState({ repositories: [repository] });

      await useAppStore.getState().startTerminal('session-1');

      expect(window.terminal.spawn).toHaveBeenCalledWith(
        'session-1',
        '/custom/repository/path',
        'claude'
      );
    });

    it('should overwrite existing terminal state on start', async () => {
      const session = createMockWorktreeSession({ id: 'session-1', path: '/test/path' });
      const repository = createMockRepository({ id: 'repository-1', worktreeSessions: [session] });
      useAppStore.setState({ repositories: [repository] });

      // Register and set to error state
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'error');
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('error');

      // Start should reset to starting
      await useAppStore.getState().startTerminal('session-1');

      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('starting');
    });
  });

  describe('terminals Map immutability', () => {
    it('should create new Map instance when registering terminal', () => {
      useAppStore.getState().registerTerminal('session-1');
      const originalTerminals = useAppStore.getState().terminals;

      useAppStore.getState().registerTerminal('session-2');

      expect(useAppStore.getState().terminals).not.toBe(originalTerminals);
    });

    it('should create new Map instance when unregistering terminal', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().registerTerminal('session-2');
      const originalTerminals = useAppStore.getState().terminals;

      useAppStore.getState().unregisterTerminal('session-1');

      expect(useAppStore.getState().terminals).not.toBe(originalTerminals);
    });

    it('should create new Map instance when updating status', () => {
      useAppStore.getState().registerTerminal('session-1');
      const originalTerminals = useAppStore.getState().terminals;

      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      expect(useAppStore.getState().terminals).not.toBe(originalTerminals);
    });

    it('should create new Map instance when updating git status', () => {
      useAppStore.getState().registerTerminal('session-1');
      const originalTerminals = useAppStore.getState().terminals;

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'main',
        isDirty: false,
        additions: 0,
        deletions: 0,
      });

      expect(useAppStore.getState().terminals).not.toBe(originalTerminals);
    });
  });

  describe('terminal state default values', () => {
    it('should have empty terminals Map by default', () => {
      const state = useAppStore.getState();
      expect(state.terminals).toBeInstanceOf(Map);
      expect(state.terminals.size).toBe(0);
    });

    it('should have null activeTerminalId by default', () => {
      const state = useAppStore.getState();
      expect(state.activeTerminalId).toBeNull();
    });
  });

  describe('localStorage migration', () => {
    beforeEach(() => {
      localStorage.clear();
      vi.clearAllMocks();
    });

    it('should migrate from localStorage when no repositories exist', async () => {
      const legacyRepository = {
        id: 'legacy-proj',
        name: 'Legacy Repository',
        path: '/legacy/path',

        isExpanded: true,
        worktreeSessions: [
          {
            id: 'legacy-session',
            label: 'main',
            path: '/legacy/path',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      const legacyData = {
        state: {
          repositories: [legacyRepository],
          settings: { worktreeBasePath: '/custom', gitPollIntervalMs: 10000 },
          window: { width: 1200, height: 800, x: 50, y: 50, isMaximized: true, sidebarWidth: 300 },
        },
      };

      localStorage.setItem('termpad-app-state', JSON.stringify(legacyData));
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      // Should have migrated the repository with default values for missing fields
      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(1);
      expect(state.repositories[0].id).toBe('legacy-proj');
      expect(state.repositories[0].isBare).toBe(false); // Default value added
      expect(state.repositories[0].worktreeSessions[0].isExternal).toBe(false); // Default value added

      // Should have saved the migrated state
      expect(window.storage.saveState).toHaveBeenCalled();

      // Should have removed localStorage
      expect(localStorage.getItem('termpad-app-state')).toBeNull();

      // Should have logged migration messages
      expect(consoleSpy).toHaveBeenCalledWith('[Store] Migrating from localStorage...');
      expect(consoleSpy).toHaveBeenCalledWith('[Store] Migration complete');

      consoleSpy.mockRestore();
    });

    it('should not migrate when repositories already exist', async () => {
      const existingRepository = createMockRepository({ id: 'existing-proj' });
      const legacyRepository = {
        id: 'legacy-proj',
        name: 'Legacy Repository',
        path: '/legacy/path',

        isExpanded: true,
        worktreeSessions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: { repositories: [legacyRepository] },
        })
      );

      vi.mocked(window.storage.loadState).mockResolvedValue(
        createMockAppState({ repositories: [existingRepository] })
      );

      await useAppStore.getState().initialize();

      // Should use existing repositories, not migrate
      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(1);
      expect(state.repositories[0].id).toBe('existing-proj');

      // localStorage should still exist (not cleared)
      expect(localStorage.getItem('termpad-app-state')).not.toBeNull();
    });

    it('should not migrate when localStorage is empty', async () => {
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      await useAppStore.getState().initialize();

      // Should not have any repositories
      const state = useAppStore.getState();
      expect(state.repositories).toHaveLength(0);

      // saveState should only be called once (for migration)
      // If no migration, no extra saveState call
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should not migrate when localStorage has empty repositories', async () => {
      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: { repositories: [] },
        })
      );

      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      await useAppStore.getState().initialize();

      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should handle localStorage parse error gracefully', async () => {
      localStorage.setItem('termpad-app-state', 'invalid json');

      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      // Should handle error gracefully
      const state = useAppStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.repositories).toHaveLength(0);

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Store] Failed to migrate localStorage:',
        expect.any(SyntaxError)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should migrate settings from localStorage', async () => {
      const legacyData = {
        state: {
          repositories: [
            {
              id: 'proj-1',
              name: 'Repository',
              path: '/path',

              isExpanded: true,
              worktreeSessions: [],
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          settings: {
            worktreeBasePath: '/custom/worktrees',
            gitPollIntervalMs: 15000,
          },
          window: {
            width: 1600,
            height: 1000,
            x: 200,
            y: 200,
            isMaximized: false,
            sidebarWidth: 350,
          },
        },
      };

      localStorage.setItem('termpad-app-state', JSON.stringify(legacyData));
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      expect(state.settings.worktreeBasePath).toBe('/custom/worktrees');
      expect(state.settings.gitPollIntervalMs).toBe(15000);
      expect(state.window.width).toBe(1600);
      expect(state.window.sidebarWidth).toBe(350);
    });

    it('should add isBare false to repositories without it', async () => {
      const legacyRepository = {
        id: 'proj-1',
        name: 'Repository',
        path: '/path',

        isExpanded: true,
        // isBare is missing
        worktreeSessions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: { repositories: [legacyRepository] },
        })
      );
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      expect(state.repositories[0].isBare).toBe(false);
    });

    it('should preserve existing isBare value during migration', async () => {
      const legacyRepository = {
        id: 'proj-1',
        name: 'Bare Repo',
        path: '/path',

        isBare: true, // Already set
        isExpanded: true,
        worktreeSessions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: { repositories: [legacyRepository] },
        })
      );
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      expect(state.repositories[0].isBare).toBe(true);
    });

    it('should add isExternal false to sessions without it', async () => {
      const legacyRepository = {
        id: 'proj-1',
        name: 'Repository',
        path: '/path',

        isExpanded: true,
        worktreeSessions: [
          {
            id: 'session-1',
            label: 'main',
            path: '/path',
            createdAt: '2024-01-01T00:00:00.000Z',
            // isExternal is missing
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: { repositories: [legacyRepository] },
        })
      );
      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      expect(state.repositories[0].worktreeSessions[0].isExternal).toBe(false);
    });

    it('should use default settings when localStorage has no settings', async () => {
      const legacyRepository = {
        id: 'proj-1',
        name: 'Repository',
        path: '/path',

        isExpanded: true,
        worktreeSessions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: {
            repositories: [legacyRepository],
            // No settings property
          },
        })
      );

      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      // Should use default settings from loaded state
      expect(state.settings.worktreeBasePath).toBeNull();
    });

    it('should use default window when localStorage has no window', async () => {
      const legacyRepository = {
        id: 'proj-1',
        name: 'Repository',
        path: '/path',

        isExpanded: true,
        worktreeSessions: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      localStorage.setItem(
        'termpad-app-state',
        JSON.stringify({
          state: {
            repositories: [legacyRepository],
            settings: { worktreeBasePath: null },
            // No window property
          },
        })
      );

      vi.mocked(window.storage.loadState).mockResolvedValue(createMockAppState());

      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await useAppStore.getState().initialize();

      const state = useAppStore.getState();
      // Should use default window from loaded state
      expect(state.window.width).toBe(1400);
    });
  });
});

describe('appStore - focus state management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have app as default focus area', () => {
      const state = useAppStore.getState();
      expect(state.focusArea).toBe('app');
    });

    it('should have null sidebarFocusedItemId by default', () => {
      const state = useAppStore.getState();
      expect(state.sidebarFocusedItemId).toBeNull();
    });
  });

  describe('setFocusArea', () => {
    it('should set focus area to sidebar', () => {
      useAppStore.getState().setFocusArea('sidebar');

      const state = useAppStore.getState();
      expect(state.focusArea).toBe('sidebar');
    });

    it('should set focus area to mainTerminal', () => {
      useAppStore.getState().setFocusArea('sidebar');
      useAppStore.getState().setFocusArea('mainTerminal');

      const state = useAppStore.getState();
      expect(state.focusArea).toBe('mainTerminal');
    });

    it('should set focus area to userTerminal', () => {
      useAppStore.getState().setFocusArea('sidebar');
      useAppStore.getState().setFocusArea('userTerminal');

      const state = useAppStore.getState();
      expect(state.focusArea).toBe('userTerminal');
    });

    it('should toggle between focus areas', () => {
      useAppStore.getState().setFocusArea('sidebar');
      expect(useAppStore.getState().focusArea).toBe('sidebar');

      useAppStore.getState().setFocusArea('mainTerminal');
      expect(useAppStore.getState().focusArea).toBe('mainTerminal');

      useAppStore.getState().setFocusArea('userTerminal');
      expect(useAppStore.getState().focusArea).toBe('userTerminal');

      useAppStore.getState().setFocusArea('sidebar');
      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });
  });

  describe('setSidebarFocusedItemId', () => {
    it('should set sidebarFocusedItemId to a session ID', () => {
      useAppStore.getState().setSidebarFocusedItemId('session-123');

      const state = useAppStore.getState();
      expect(state.sidebarFocusedItemId).toBe('session-123');
    });

    it('should set sidebarFocusedItemId to a repository ID', () => {
      useAppStore.getState().setSidebarFocusedItemId('repository-456');

      const state = useAppStore.getState();
      expect(state.sidebarFocusedItemId).toBe('repository-456');
    });

    it('should set sidebarFocusedItemId to null', () => {
      useAppStore.getState().setSidebarFocusedItemId('session-123');
      useAppStore.getState().setSidebarFocusedItemId(null);

      const state = useAppStore.getState();
      expect(state.sidebarFocusedItemId).toBeNull();
    });

    it('should update sidebarFocusedItemId to a different value', () => {
      useAppStore.getState().setSidebarFocusedItemId('session-1');
      expect(useAppStore.getState().sidebarFocusedItemId).toBe('session-1');

      useAppStore.getState().setSidebarFocusedItemId('session-2');
      expect(useAppStore.getState().sidebarFocusedItemId).toBe('session-2');
    });
  });

  describe('focus state independence', () => {
    it('should maintain focusArea and sidebarFocusedItemId independently', () => {
      useAppStore.getState().setFocusArea('sidebar');
      useAppStore.getState().setSidebarFocusedItemId('session-123');

      const state = useAppStore.getState();
      expect(state.focusArea).toBe('sidebar');
      expect(state.sidebarFocusedItemId).toBe('session-123');

      useAppStore.getState().setFocusArea('mainTerminal');

      const updatedState = useAppStore.getState();
      expect(updatedState.focusArea).toBe('mainTerminal');
      expect(updatedState.sidebarFocusedItemId).toBe('session-123'); // Unchanged
    });
  });

  describe('sidebarStatusFocus', () => {
    it('should have null sidebarStatusFocus by default', () => {
      const state = useAppStore.getState();
      expect(state.sidebarStatusFocus).toBeNull();
    });

    it('should set sidebarStatusFocus to a status focus object', () => {
      useAppStore.getState().setSidebarStatusFocus({
        worktreeSessionId: 'session-123',
        indicatorIndex: 0,
      });

      const state = useAppStore.getState();
      expect(state.sidebarStatusFocus).toEqual({
        worktreeSessionId: 'session-123',
        indicatorIndex: 0,
      });
    });

    it('should update sidebarStatusFocus indicator index', () => {
      useAppStore.getState().setSidebarStatusFocus({
        worktreeSessionId: 'session-123',
        indicatorIndex: 0,
      });
      useAppStore.getState().setSidebarStatusFocus({
        worktreeSessionId: 'session-123',
        indicatorIndex: 2,
      });

      const state = useAppStore.getState();
      expect(state.sidebarStatusFocus?.indicatorIndex).toBe(2);
    });

    it('should clear sidebarStatusFocus when set to null', () => {
      useAppStore.getState().setSidebarStatusFocus({
        worktreeSessionId: 'session-123',
        indicatorIndex: 1,
      });
      useAppStore.getState().setSidebarStatusFocus(null);

      const state = useAppStore.getState();
      expect(state.sidebarStatusFocus).toBeNull();
    });

    it('should maintain sidebarStatusFocus independently from focusArea', () => {
      useAppStore.getState().setFocusArea('sidebar');
      useAppStore.getState().setSidebarStatusFocus({
        worktreeSessionId: 'session-123',
        indicatorIndex: 1,
      });

      expect(useAppStore.getState().focusArea).toBe('sidebar');
      expect(useAppStore.getState().sidebarStatusFocus).toEqual({
        worktreeSessionId: 'session-123',
        indicatorIndex: 1,
      });

      useAppStore.getState().setFocusArea('mainTerminal');

      // sidebarStatusFocus should remain unchanged
      expect(useAppStore.getState().sidebarStatusFocus).toEqual({
        worktreeSessionId: 'session-123',
        indicatorIndex: 1,
      });
    });
  });
});

describe('appStore - notification triggers', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Mock document.hasFocus to return false (window not focused)
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  });

  describe('updateTerminalStatus triggers notifications', () => {
    it('should trigger notification when status changes to waiting (after 5s delay)', () => {
      vi.useFakeTimers();

      const session = createMockWorktreeSession({ id: 'session-1', branchName: 'feature-branch' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      // Register terminal and mark as having received output
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');

      // Change status to waiting
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      // Should NOT notify immediately
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      expect(window.notifications.trigger).toHaveBeenCalledWith({
        worktreeSessionId: 'session-1',
        repositoryName: 'Test Repository',
        branchName: 'feature-branch',
        state: 'waiting',
        tabId: undefined,
      });

      vi.useRealTimers();
    });

    it('should cancel pending waiting notification if status changes before 5s', () => {
      vi.useFakeTimers();

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      // Advance time by only 2 seconds
      vi.advanceTimersByTime(2000);

      // Change to running before 5s delay
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      // Advance past the original 5s delay
      vi.advanceTimersByTime(4000);

      // Should NOT have notified for waiting (it was cancelled)
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should trigger notification when status changes to error', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'error');

      expect(window.notifications.trigger).toHaveBeenCalledWith({
        worktreeSessionId: 'session-1',
        repositoryName: 'Test Repository',
        branchName: undefined,
        state: 'error',
      });
    });

    it('should trigger notification when status changes from running to idle (after 5s delay)', () => {
      vi.useFakeTimers();

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');

      // First set to running, then to idle (idle only notifies from running/waiting)
      useAppStore.getState().updateTerminalStatus('session-1', 'running');
      useAppStore.getState().updateTerminalStatus('session-1', 'idle');

      // Should NOT notify immediately
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      expect(window.notifications.trigger).toHaveBeenCalledWith({
        worktreeSessionId: 'session-1',
        repositoryName: 'Test Repository',
        branchName: undefined,
        state: 'idle',
        tabId: undefined,
      });

      vi.useRealTimers();
    });

    it('should NOT trigger idle notification when transitioning from starting', () => {
      vi.useFakeTimers();

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');

      // Transition directly from starting to idle (should NOT notify)
      useAppStore.getState().updateTerminalStatus('session-1', 'idle');

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Should NOT have notified
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should cancel pending idle notification if status changes before 5s', () => {
      vi.useFakeTimers();

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');
      useAppStore.getState().updateTerminalStatus('session-1', 'idle');

      // Advance time by only 2 seconds
      vi.advanceTimersByTime(2000);

      // Change back to running before 5s delay
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      // Advance past the original 5s delay
      vi.advanceTimersByTime(4000);

      // Should NOT have notified for idle (it was cancelled)
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should NOT trigger notification when notifications are disabled', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        settings: {
          ...useAppStore.getState().settings,
          notifications: { ...useAppStore.getState().settings.notifications, enabled: false },
        },
      });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      expect(window.notifications.trigger).not.toHaveBeenCalled();
    });

    it('should NOT trigger notification when window is focused and backgroundOnly is true', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      expect(window.notifications.trigger).not.toHaveBeenCalled();
    });

    it('should trigger notification when window is focused but backgroundOnly is false (after 5s delay)', () => {
      vi.useFakeTimers();
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);

      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        settings: {
          ...useAppStore.getState().settings,
          notifications: {
            ...useAppStore.getState().settings.notifications,
            backgroundOnly: false,
          },
        },
      });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      // Should NOT notify immediately
      expect(window.notifications.trigger).not.toHaveBeenCalled();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      expect(window.notifications.trigger).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should NOT trigger notification when status changes to running', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      expect(window.notifications.trigger).not.toHaveBeenCalled();
    });

    it('should NOT trigger notification when status does not change', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().recordTerminalActivity('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      vi.clearAllMocks();

      // Update to same status
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      expect(window.notifications.trigger).not.toHaveBeenCalled();
    });

    it('should NOT trigger notification when terminal has not received output', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        worktreeSessions: [session],
      });
      useAppStore.setState({ repositories: [repository] });

      useAppStore.getState().registerTerminal('session-1');
      // NOT calling recordTerminalActivity, so hasReceivedOutput is false
      useAppStore.getState().updateTerminalStatus('session-1', 'waiting');

      expect(window.notifications.trigger).not.toHaveBeenCalled();
    });
  });
});

describe('appStore - tab management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('createTab', () => {
    it('should create a new tab with provided name', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      expect(tab.id).toBeTruthy();
      expect(tab.name).toBe('Terminal');
      expect(tab.order).toBe(0);
      expect(tab.createdAt).toBeTruthy();
      expect(tab.command).toBeUndefined();
    });

    it('should create a tab with command stored separately from name', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'claude', 'claude');

      expect(tab.name).toBe('claude');
      expect(tab.command).toBe('claude');
    });

    it('should set new tab as active', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      const state = useAppStore.getState();
      expect(state.activeTabId).toBe(tab.id);
    });

    it('should add tab to worktree tabs array', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(1);
    });

    it('should create new worktree tab state if worktree does not exist', () => {
      useAppStore.getState().createTab('new-worktree', 'Terminal');

      const state = useAppStore.getState();
      const worktreeTabState = state.worktreeTabs?.find(
        (wt) => wt.worktreeSessionId === 'new-worktree'
      );
      expect(worktreeTabState).toBeDefined();
      expect(worktreeTabState?.tabs).toHaveLength(1);
    });

    it('should increment order for subsequent tabs', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      expect(tab1.order).toBe(0);
      expect(tab2.order).toBe(1);
      expect(tab3.order).toBe(2);
    });

    it('should persist state after creating tab', () => {
      useAppStore.setState({ isInitialized: true });
      useAppStore.getState().createTab('worktree-1', 'Terminal');

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should update worktree activeTabId when creating new tab', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      const state = useAppStore.getState();
      const worktreeTabState = state.worktreeTabs?.find(
        (wt) => wt.worktreeSessionId === 'worktree-1'
      );
      expect(worktreeTabState?.activeTabId).toBe(tab2.id);
      expect(state.activeTabId).toBe(tab2.id);
    });
  });

  describe('closeTab', () => {
    it('should remove the tab from worktree tabs', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().closeTab(tab.id);

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(0);
    });

    it('should do nothing when closing non-existent tab', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().closeTab('non-existent-tab');

      // Should not have persisted since no change happened
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should select right neighbor tab when closing active tab', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // Set tab2 as active
      useAppStore.getState().setActiveTab(tab2.id);

      // Close tab2
      useAppStore.getState().closeTab(tab2.id);

      // Should select tab3 (right neighbor)
      expect(useAppStore.getState().activeTabId).toBe(tab3.id);
    });

    it('should select left neighbor tab when closing rightmost active tab', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // tab3 is active (rightmost)
      expect(useAppStore.getState().activeTabId).toBe(tab3.id);

      // Close tab3
      useAppStore.getState().closeTab(tab3.id);

      // Should select tab2 (left neighbor)
      expect(useAppStore.getState().activeTabId).toBe(tab2.id);
    });

    it('should set activeTabId to null when closing last tab', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().closeTab(tab.id);

      expect(useAppStore.getState().activeTabId).toBeNull();
    });

    it('should preserve activeTabId when closing non-active tab', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // tab2 is active, close tab1
      useAppStore.getState().closeTab(tab1.id);

      expect(useAppStore.getState().activeTabId).toBe(tab2.id);
    });

    it('should persist state after closing tab', () => {
      useAppStore.setState({ isInitialized: true });
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().closeTab(tab.id);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should update worktree activeTabId when closing active tab', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().closeTab(tab2.id);

      const state = useAppStore.getState();
      const worktreeTabState = state.worktreeTabs?.find(
        (wt) => wt.worktreeSessionId === 'worktree-1'
      );
      expect(worktreeTabState?.activeTabId).toBe(tab1.id);
    });
  });

  describe('renameTab', () => {
    it('should rename the tab', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().renameTab(tab.id, 'New Name');

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('New Name');
    });

    it('should trim whitespace from name', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().renameTab(tab.id, '  New Name  ');

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('New Name');
    });

    it('should not rename to empty string', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'original', 'original');

      useAppStore.getState().renameTab(tab.id, '');

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('original');
    });

    it('should not rename to whitespace-only string', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'original', 'original');

      useAppStore.getState().renameTab(tab.id, '   ');

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('original');
    });

    it('should persist state after renaming', () => {
      useAppStore.setState({ isInitialized: true });
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().renameTab(tab.id, 'New Name');

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should rename tab in correct worktree when multiple worktrees exist', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'tab1', 'tab1');
      useAppStore.getState().createTab('worktree-2', 'tab2', 'tab2');

      useAppStore.getState().renameTab(tab1.id, 'renamed');

      const tabs1 = useAppStore.getState().getTabsForWorktree('worktree-1');
      const tabs2 = useAppStore.getState().getTabsForWorktree('worktree-2');
      expect(tabs1[0].name).toBe('renamed');
      expect(tabs2[0].name).toBe('tab2');
    });
  });

  describe('reorderTabs', () => {
    it('should update tab order values', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // Reorder: tab3, tab1, tab2
      useAppStore.getState().reorderTabs('worktree-1', [
        { ...tab3, order: 0 },
        { ...tab1, order: 1 },
        { ...tab2, order: 2 },
      ]);

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].id).toBe(tab3.id);
      expect(tabs[1].id).toBe(tab1.id);
      expect(tabs[2].id).toBe(tab2.id);
    });

    it('should handle reordering single tab', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // Reorder single tab (no-op essentially)
      useAppStore.getState().reorderTabs('worktree-1', [{ ...tab, order: 0 }]);

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(1);
      expect(tabs[0].order).toBe(0);
    });

    it('should persist state after reordering', () => {
      useAppStore.setState({ isInitialized: true });
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().reorderTabs('worktree-1', [
        { ...tab2, order: 0 },
        { ...tab1, order: 1 },
      ]);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should not affect other worktrees', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-2', 'Terminal');

      useAppStore.getState().reorderTabs('worktree-1', [
        { ...tab2, order: 0 },
        { ...tab1, order: 1 },
      ]);

      const tabs2 = useAppStore.getState().getTabsForWorktree('worktree-2');
      expect(tabs2[0].id).toBe(tab3.id);
      expect(tabs2[0].order).toBe(0);
    });
  });

  describe('setActiveTab', () => {
    it('should set the active tab', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().setActiveTab(tab1.id);

      expect(useAppStore.getState().activeTabId).toBe(tab1.id);
    });

    it('should set activeTabId to null', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().setActiveTab(null);

      expect(useAppStore.getState().activeTabId).toBeNull();
    });

    it('should do nothing when setting non-existent tab as active', () => {
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().setActiveTab('non-existent-tab');

      // Should not have persisted since no change happened
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should update both global and worktree activeTabId', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      useAppStore.getState().createTab('worktree-1', 'Terminal');

      useAppStore.getState().setActiveTab(tab1.id);

      const state = useAppStore.getState();
      expect(state.activeTabId).toBe(tab1.id);

      const worktreeTabState = state.worktreeTabs?.find(
        (wt) => wt.worktreeSessionId === 'worktree-1'
      );
      expect(worktreeTabState?.activeTabId).toBe(tab1.id);
    });

    it('should persist state when setting active tab', () => {
      useAppStore.setState({ isInitialized: true });
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      useAppStore.getState().createTab('worktree-1', 'Terminal');
      vi.clearAllMocks();

      useAppStore.getState().setActiveTab(tab1.id);

      expect(window.storage.saveState).toHaveBeenCalled();
    });
  });

  describe('getTabsForWorktree', () => {
    it('should return empty array for non-existent worktree', () => {
      const tabs = useAppStore.getState().getTabsForWorktree('non-existent');

      expect(tabs).toEqual([]);
    });

    it('should return tabs sorted by order', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab3 = useAppStore.getState().createTab('worktree-1', 'Terminal');

      // Manually set tabs with different order in state
      useAppStore.setState({
        worktreeTabs: [
          {
            worktreeSessionId: 'worktree-1',
            tabs: [
              { ...tab2, order: 5 },
              { ...tab1, order: 1 },
              { ...tab3, order: 3 },
            ],
            activeTabId: tab1.id,
          },
        ],
      });

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs[0].id).toBe(tab1.id);
      expect(tabs[1].id).toBe(tab3.id);
      expect(tabs[2].id).toBe(tab2.id);
    });

    it('should return empty array for worktree with no tabs', () => {
      useAppStore.setState({
        worktreeTabs: [
          {
            worktreeSessionId: 'worktree-1',
            tabs: [],
            activeTabId: null,
          },
        ],
      });

      const tabs = useAppStore.getState().getTabsForWorktree('worktree-1');
      expect(tabs).toEqual([]);
    });
  });

  describe('getTerminalIdForTab', () => {
    it('should return formatted terminal ID', () => {
      const terminalId = useAppStore.getState().getTerminalIdForTab('worktree-1', 'tab-123');

      expect(terminalId).toBe('worktree-1:tab-123');
    });
  });

  describe('getWorktreeSessionIdFromTabId', () => {
    it('should return worktree session ID for existing tab', () => {
      const tab = useAppStore.getState().createTab('worktree-1', 'Terminal');

      const worktreeId = useAppStore.getState().getWorktreeSessionIdFromTabId(tab.id);

      expect(worktreeId).toBe('worktree-1');
    });

    it('should return null for non-existent tab', () => {
      const worktreeId = useAppStore.getState().getWorktreeSessionIdFromTabId('non-existent');

      expect(worktreeId).toBeNull();
    });

    it('should find tab in correct worktree when multiple worktrees exist', () => {
      const tab1 = useAppStore.getState().createTab('worktree-1', 'Terminal');
      const tab2 = useAppStore.getState().createTab('worktree-2', 'Terminal');

      expect(useAppStore.getState().getWorktreeSessionIdFromTabId(tab1.id)).toBe('worktree-1');
      expect(useAppStore.getState().getWorktreeSessionIdFromTabId(tab2.id)).toBe('worktree-2');
    });
  });
});

describe('appStore - user terminal tab management', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('createUserTab', () => {
    it('should create a new user tab with default name "Terminal" when no name provided', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      expect(tab.id).toBeTruthy();
      expect(tab.name).toBe('Terminal');
      expect(tab.order).toBe(0);
      expect(tab.createdAt).toBeTruthy();
    });

    it('should create a user tab with provided name', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'npm run dev');

      expect(tab.name).toBe('npm run dev');
    });

    it('should set new user tab as active', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      const state = useAppStore.getState();
      expect(state.activeUserTabId).toBe(tab.id);
    });

    it('should add user tab to userTerminalTabs array', () => {
      useAppStore.getState().createUserTab('worktree-1');

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(1);
    });

    it('should create new user terminal tab state if worktree does not exist', () => {
      useAppStore.getState().createUserTab('new-worktree');

      const state = useAppStore.getState();
      const userTabState = state.userTerminalTabs?.find(
        (ut) => ut.worktreeSessionId === 'new-worktree'
      );
      expect(userTabState).toBeDefined();
      expect(userTabState?.tabs).toHaveLength(1);
    });

    it('should increment order for subsequent user tabs', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      expect(tab1.order).toBe(0);
      expect(tab2.order).toBe(1);
      expect(tab3.order).toBe(2);
    });

    it('should persist state after creating user tab', () => {
      useAppStore.setState({ isInitialized: true });
      useAppStore.getState().createUserTab('worktree-1');

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should update worktree activeTabId when creating new user tab', () => {
      useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');

      const state = useAppStore.getState();
      const userTabState = state.userTerminalTabs?.find(
        (ut) => ut.worktreeSessionId === 'worktree-1'
      );
      expect(userTabState?.activeTabId).toBe(tab2.id);
      expect(state.activeUserTabId).toBe(tab2.id);
    });
  });

  describe('closeUserTab', () => {
    it('should remove the user tab from userTerminalTabs', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().closeUserTab(tab.id);

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(0);
    });

    it('should do nothing when closing non-existent user tab', () => {
      useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().closeUserTab('non-existent-tab');

      // Should not have persisted since no change happened
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should select right neighbor user tab when closing active user tab', () => {
      useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      // Set tab2 as active
      useAppStore.getState().setActiveUserTab(tab2.id);

      // Close tab2
      useAppStore.getState().closeUserTab(tab2.id);

      // Should select tab3 (right neighbor)
      expect(useAppStore.getState().activeUserTabId).toBe(tab3.id);
    });

    it('should select left neighbor user tab when closing rightmost active user tab', () => {
      useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      // tab3 is active (rightmost)
      expect(useAppStore.getState().activeUserTabId).toBe(tab3.id);

      // Close tab3
      useAppStore.getState().closeUserTab(tab3.id);

      // Should select tab2 (left neighbor)
      expect(useAppStore.getState().activeUserTabId).toBe(tab2.id);
    });

    it('should set activeUserTabId to null when closing last user tab', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().closeUserTab(tab.id);

      expect(useAppStore.getState().activeUserTabId).toBeNull();
    });

    it('should preserve activeUserTabId when closing non-active user tab', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');

      // tab2 is active, close tab1
      useAppStore.getState().closeUserTab(tab1.id);

      expect(useAppStore.getState().activeUserTabId).toBe(tab2.id);
    });

    it('should persist state after closing user tab', () => {
      useAppStore.setState({ isInitialized: true });
      const tab = useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().closeUserTab(tab.id);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should update worktree activeTabId when closing active user tab', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().closeUserTab(tab2.id);

      const state = useAppStore.getState();
      const userTabState = state.userTerminalTabs?.find(
        (ut) => ut.worktreeSessionId === 'worktree-1'
      );
      expect(userTabState?.activeTabId).toBe(tab1.id);
    });
  });

  describe('createUserTab with scriptId', () => {
    it('should create a user tab with scriptId', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'Test Script', 'script-123');

      expect(tab.scriptId).toBe('script-123');
    });

    it('should create a user tab without scriptId when not provided', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'Test Script');

      expect(tab.scriptId).toBeUndefined();
    });
  });

  describe('findUserTabsWithScript', () => {
    it('should find tabs with matching scriptId across worktrees in a repository', () => {
      // Setup repository with worktrees
      useAppStore.getState().addRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        isBare: false,
        isExpanded: true,
        worktreeSessions: [
          {
            id: 'worktree-1',
            label: 'Main',
            path: '/test/repo',
            createdAt: new Date().toISOString(),
            isExternal: false,
          },
          {
            id: 'worktree-2',
            label: 'Feature',
            path: '/test/repo-feature',
            createdAt: new Date().toISOString(),
            isExternal: false,
          },
        ],
        createdAt: new Date().toISOString(),
      });

      // Create tabs with same scriptId in different worktrees
      useAppStore.getState().createUserTab('worktree-1', 'Script A', 'script-123');
      useAppStore.getState().createUserTab('worktree-2', 'Script A', 'script-123');
      useAppStore.getState().createUserTab('worktree-1', 'Script B', 'script-456');

      const results = useAppStore.getState().findUserTabsWithScript('repo-1', 'script-123');

      expect(results).toHaveLength(2);
      expect(results[0].worktreeSessionId).toBe('worktree-1');
      expect(results[0].tab.scriptId).toBe('script-123');
      expect(results[1].worktreeSessionId).toBe('worktree-2');
      expect(results[1].tab.scriptId).toBe('script-123');
    });

    it('should return empty array when no tabs match', () => {
      useAppStore.getState().addRepository({
        id: 'repo-1',
        name: 'Test Repo',
        path: '/test/repo',
        isBare: false,
        isExpanded: true,
        worktreeSessions: [
          {
            id: 'worktree-1',
            label: 'Main',
            path: '/test/repo',
            createdAt: new Date().toISOString(),
            isExternal: false,
          },
        ],
        createdAt: new Date().toISOString(),
      });

      useAppStore.getState().createUserTab('worktree-1', 'Script A', 'script-123');

      const results = useAppStore.getState().findUserTabsWithScript('repo-1', 'script-999');

      expect(results).toHaveLength(0);
    });

    it('should return empty array when repository does not exist', () => {
      const results = useAppStore.getState().findUserTabsWithScript('non-existent', 'script-123');

      expect(results).toHaveLength(0);
    });
  });

  describe('closeUserTabById', () => {
    it('should close a user tab by worktreeSessionId and tabId', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'Test');

      useAppStore.getState().closeUserTabById('worktree-1', tab.id);

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(0);
    });

    it('should do nothing when worktreeSessionId does not exist', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'Test');
      vi.clearAllMocks();

      useAppStore.getState().closeUserTabById('non-existent', tab.id);

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(1);
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should select right neighbor when closing active tab', () => {
      useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().setActiveUserTab(tab2.id);
      useAppStore.getState().closeUserTabById('worktree-1', tab2.id);

      expect(useAppStore.getState().activeUserTabId).toBe(tab3.id);
    });

    it('should persist state after closing', () => {
      useAppStore.setState({ isInitialized: true });
      const tab = useAppStore.getState().createUserTab('worktree-1', 'Test');
      vi.clearAllMocks();

      useAppStore.getState().closeUserTabById('worktree-1', tab.id);

      expect(window.storage.saveState).toHaveBeenCalled();
    });
  });

  describe('renameUserTab', () => {
    it('should rename the user tab', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().renameUserTab(tab.id, 'New Name');

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('New Name');
    });

    it('should trim whitespace from name', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().renameUserTab(tab.id, '  New Name  ');

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('New Name');
    });

    it('should not rename to empty string', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'original');

      useAppStore.getState().renameUserTab(tab.id, '');

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('original');
    });

    it('should not rename to whitespace-only string', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1', 'original');

      useAppStore.getState().renameUserTab(tab.id, '   ');

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].name).toBe('original');
    });

    it('should persist state after renaming', () => {
      useAppStore.setState({ isInitialized: true });
      const tab = useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().renameUserTab(tab.id, 'New Name');

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should rename user tab in correct worktree when multiple worktrees exist', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1', 'tab1');
      useAppStore.getState().createUserTab('worktree-2', 'tab2');

      useAppStore.getState().renameUserTab(tab1.id, 'renamed');

      const tabs1 = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      const tabs2 = useAppStore.getState().getUserTabsForWorktree('worktree-2');
      expect(tabs1[0].name).toBe('renamed');
      expect(tabs2[0].name).toBe('tab2');
    });
  });

  describe('reorderUserTabs', () => {
    it('should update user tab order values', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      // Reorder: tab3, tab1, tab2
      useAppStore.getState().reorderUserTabs('worktree-1', [
        { ...tab3, order: 0 },
        { ...tab1, order: 1 },
        { ...tab2, order: 2 },
      ]);

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].id).toBe(tab3.id);
      expect(tabs[1].id).toBe(tab1.id);
      expect(tabs[2].id).toBe(tab2.id);
    });

    it('should handle reordering single user tab', () => {
      const tab = useAppStore.getState().createUserTab('worktree-1');

      // Reorder single tab (no-op essentially)
      useAppStore.getState().reorderUserTabs('worktree-1', [{ ...tab, order: 0 }]);

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toHaveLength(1);
      expect(tabs[0].order).toBe(0);
    });

    it('should persist state after reordering', () => {
      useAppStore.setState({ isInitialized: true });
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().reorderUserTabs('worktree-1', [
        { ...tab2, order: 0 },
        { ...tab1, order: 1 },
      ]);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should not affect other worktrees', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-2');

      useAppStore.getState().reorderUserTabs('worktree-1', [
        { ...tab2, order: 0 },
        { ...tab1, order: 1 },
      ]);

      const tabs2 = useAppStore.getState().getUserTabsForWorktree('worktree-2');
      expect(tabs2[0].id).toBe(tab3.id);
      expect(tabs2[0].order).toBe(0);
    });
  });

  describe('setActiveUserTab', () => {
    it('should set the active user tab', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().setActiveUserTab(tab1.id);

      expect(useAppStore.getState().activeUserTabId).toBe(tab1.id);
    });

    it('should set activeUserTabId to null', () => {
      useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().setActiveUserTab(null);

      expect(useAppStore.getState().activeUserTabId).toBeNull();
    });

    it('should do nothing when setting non-existent user tab as active', () => {
      useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().setActiveUserTab('non-existent-tab');

      // Should not have persisted since no change happened
      expect(window.storage.saveState).not.toHaveBeenCalled();
    });

    it('should update both global and worktree activeTabId', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      useAppStore.getState().createUserTab('worktree-1');

      useAppStore.getState().setActiveUserTab(tab1.id);

      const state = useAppStore.getState();
      expect(state.activeUserTabId).toBe(tab1.id);

      const userTabState = state.userTerminalTabs?.find(
        (ut) => ut.worktreeSessionId === 'worktree-1'
      );
      expect(userTabState?.activeTabId).toBe(tab1.id);
    });

    it('should persist state when setting active user tab', () => {
      useAppStore.setState({ isInitialized: true });
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      useAppStore.getState().createUserTab('worktree-1');
      vi.clearAllMocks();

      useAppStore.getState().setActiveUserTab(tab1.id);

      expect(window.storage.saveState).toHaveBeenCalled();
    });
  });

  describe('getUserTabsForWorktree', () => {
    it('should return empty array for non-existent worktree', () => {
      const tabs = useAppStore.getState().getUserTabsForWorktree('non-existent');

      expect(tabs).toEqual([]);
    });

    it('should return user tabs sorted by order', () => {
      const tab1 = useAppStore.getState().createUserTab('worktree-1');
      const tab2 = useAppStore.getState().createUserTab('worktree-1');
      const tab3 = useAppStore.getState().createUserTab('worktree-1');

      // Manually set tabs with different order in state
      useAppStore.setState({
        userTerminalTabs: [
          {
            worktreeSessionId: 'worktree-1',
            tabs: [
              { ...tab2, order: 5 },
              { ...tab1, order: 1 },
              { ...tab3, order: 3 },
            ],
            activeTabId: tab1.id,
          },
        ],
      });

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs[0].id).toBe(tab1.id);
      expect(tabs[1].id).toBe(tab3.id);
      expect(tabs[2].id).toBe(tab2.id);
    });

    it('should return empty array for worktree with no user tabs', () => {
      useAppStore.setState({
        userTerminalTabs: [
          {
            worktreeSessionId: 'worktree-1',
            tabs: [],
            activeTabId: null,
          },
        ],
      });

      const tabs = useAppStore.getState().getUserTabsForWorktree('worktree-1');
      expect(tabs).toEqual([]);
    });
  });

  describe('getUserTerminalIdForTab', () => {
    it('should return formatted user terminal ID with user: prefix', () => {
      const terminalId = useAppStore.getState().getUserTerminalIdForTab('worktree-1', 'tab-123');

      expect(terminalId).toBe('user:worktree-1:tab-123');
    });
  });

  describe('setActiveTerminal with user terminals', () => {
    it('should restore user terminal activeTabId when switching worktrees', () => {
      // Create user tabs in two worktrees
      const userTab1 = useAppStore.getState().createUserTab('worktree-1', 'tab1');
      useAppStore.getState().createUserTab('worktree-1', 'tab2');
      useAppStore.getState().createUserTab('worktree-2', 'tab3');

      // Set first tab as active for worktree-1
      useAppStore.getState().setActiveUserTab(userTab1.id);

      // Switch to worktree-2
      useAppStore.getState().setActiveTerminal('worktree-2');
      expect(useAppStore.getState().activeTerminalId).toBe('worktree-2');

      // Switch back to worktree-1
      useAppStore.getState().setActiveTerminal('worktree-1');

      // Should restore worktree-1's active user tab
      expect(useAppStore.getState().activeUserTabId).toBe(userTab1.id);
    });

    it('should clear activeUserTabId when switching to worktree without user tabs', () => {
      // Create user tabs in worktree-1
      useAppStore.getState().createUserTab('worktree-1', 'tab1');

      // Switch to worktree-2 which has no user tabs
      useAppStore.getState().setActiveTerminal('worktree-2');

      expect(useAppStore.getState().activeUserTabId).toBeNull();
    });

    it('should clear activeUserTabId when setting activeTerminal to null', () => {
      useAppStore.getState().createUserTab('worktree-1', 'tab1');

      useAppStore.getState().setActiveTerminal(null);

      expect(useAppStore.getState().activeUserTabId).toBeNull();
    });
  });
});

describe('appStore - terminal preset actions', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('addTerminalPreset', () => {
    it('should add a new preset with generated id and order', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Custom',
        command: 'custom',
        icon: 'bot',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      expect(presets).toHaveLength(5); // 4 default + 1 new

      const newPreset = presets.find((p) => p.name === 'Custom');
      expect(newPreset).toBeDefined();
      expect(newPreset?.id).toMatch(/^preset-\d+-\w+$/);
      expect(newPreset?.command).toBe('custom');
      expect(newPreset?.icon).toBe('bot');
      expect(newPreset?.order).toBe(4); // After Codex (order 3)
    });

    it('should assign incrementing order values', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Preset 1',
        command: 'cmd1',
        icon: 'star',
      });
      useAppStore.getState().addTerminalPreset({
        name: 'Preset 2',
        command: 'cmd2',
        icon: 'heart',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset1 = presets.find((p) => p.name === 'Preset 1');
      const preset2 = presets.find((p) => p.name === 'Preset 2');

      expect(preset1?.order).toBe(4);
      expect(preset2?.order).toBe(5);
    });

    it('should persist state after adding preset', () => {
      useAppStore.setState({ isInitialized: true });
      vi.clearAllMocks();

      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'test',
        icon: 'zap',
      });

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should allow adding preset with empty command (plain shell)', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Shell',
        command: '',
        icon: 'terminal',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const shellPreset = presets.find((p) => p.name === 'Shell');
      expect(shellPreset?.command).toBe('');
    });
  });

  describe('updateTerminalPreset', () => {
    it('should update preset name', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Original',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Original');

      useAppStore.getState().updateTerminalPreset(preset!.id, { name: 'Updated' });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const updatedPreset = updatedPresets.find((p) => p.id === preset!.id);
      expect(updatedPreset?.name).toBe('Updated');
    });

    it('should update preset command', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'old-command',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');

      useAppStore.getState().updateTerminalPreset(preset!.id, { command: 'new-command' });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const updatedPreset = updatedPresets.find((p) => p.id === preset!.id);
      expect(updatedPreset?.command).toBe('new-command');
    });

    it('should update preset icon', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');

      useAppStore.getState().updateTerminalPreset(preset!.id, { icon: 'rocket' });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const updatedPreset = updatedPresets.find((p) => p.id === preset!.id);
      expect(updatedPreset?.icon).toBe('rocket');
    });

    it('should update multiple fields at once', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Original',
        command: 'cmd1',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Original');

      useAppStore.getState().updateTerminalPreset(preset!.id, {
        name: 'New Name',
        command: 'new-cmd',
        icon: 'heart',
      });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const updatedPreset = updatedPresets.find((p) => p.id === preset!.id);
      expect(updatedPreset?.name).toBe('New Name');
      expect(updatedPreset?.command).toBe('new-cmd');
      expect(updatedPreset?.icon).toBe('heart');
    });

    it('should not update built-in presets', () => {
      const presets = useAppStore.getState().settings.terminalPresets;
      const builtInPreset = presets.find((p) => p.isBuiltIn);

      useAppStore.getState().updateTerminalPreset(builtInPreset!.id, { name: 'Hacked' });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const samePreset = updatedPresets.find((p) => p.id === builtInPreset!.id);
      expect(samePreset?.name).toBe('Terminal'); // Unchanged
    });

    it('should persist state after updating preset', () => {
      useAppStore.setState({ isInitialized: true });
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');

      vi.clearAllMocks();

      useAppStore.getState().updateTerminalPreset(preset!.id, { name: 'Updated' });

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should preserve order when updating other fields', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');
      const originalOrder = preset!.order;

      useAppStore.getState().updateTerminalPreset(preset!.id, { name: 'Updated' });

      const updatedPresets = useAppStore.getState().settings.terminalPresets;
      const updatedPreset = updatedPresets.find((p) => p.id === preset!.id);
      expect(updatedPreset?.order).toBe(originalOrder);
    });
  });

  describe('deleteTerminalPreset', () => {
    it('should delete a user preset', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'ToDelete',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const presetToDelete = presets.find((p) => p.name === 'ToDelete');

      useAppStore.getState().deleteTerminalPreset(presetToDelete!.id);

      const remainingPresets = useAppStore.getState().settings.terminalPresets;
      expect(remainingPresets.find((p) => p.id === presetToDelete!.id)).toBeUndefined();
      expect(remainingPresets).toHaveLength(4); // Only default presets
    });

    it('should not delete built-in presets', () => {
      const presets = useAppStore.getState().settings.terminalPresets;
      const builtInPreset = presets.find((p) => p.isBuiltIn);

      useAppStore.getState().deleteTerminalPreset(builtInPreset!.id);

      const remainingPresets = useAppStore.getState().settings.terminalPresets;
      expect(remainingPresets.find((p) => p.id === builtInPreset!.id)).toBeDefined();
      expect(remainingPresets).toHaveLength(4); // Unchanged
    });

    it('should reset defaultPresetId to null when deleting the default preset', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'MyDefault',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const newPreset = presets.find((p) => p.name === 'MyDefault');

      // Set as default
      useAppStore.getState().setDefaultPresetId(newPreset!.id);
      expect(useAppStore.getState().settings.defaultPresetId).toBe(newPreset!.id);

      // Delete the default preset
      useAppStore.getState().deleteTerminalPreset(newPreset!.id);

      // defaultPresetId should be reset to null
      expect(useAppStore.getState().settings.defaultPresetId).toBeNull();
    });

    it('should preserve defaultPresetId when deleting a non-default preset', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Default',
        command: 'cmd1',
        icon: 'star',
      });
      useAppStore.getState().addTerminalPreset({
        name: 'NotDefault',
        command: 'cmd2',
        icon: 'heart',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const defaultPreset = presets.find((p) => p.name === 'Default');
      const notDefaultPreset = presets.find((p) => p.name === 'NotDefault');

      // Set first as default
      useAppStore.getState().setDefaultPresetId(defaultPreset!.id);

      // Delete the non-default preset
      useAppStore.getState().deleteTerminalPreset(notDefaultPreset!.id);

      // defaultPresetId should be unchanged
      expect(useAppStore.getState().settings.defaultPresetId).toBe(defaultPreset!.id);
    });

    it('should persist state after deleting preset', () => {
      useAppStore.setState({ isInitialized: true });
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');

      vi.clearAllMocks();

      useAppStore.getState().deleteTerminalPreset(preset!.id);

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should handle deleting non-existent preset gracefully', () => {
      const beforePresets = useAppStore.getState().settings.terminalPresets;

      useAppStore.getState().deleteTerminalPreset('non-existent-id');

      const afterPresets = useAppStore.getState().settings.terminalPresets;
      expect(afterPresets).toEqual(beforePresets);
    });
  });

  describe('reorderTerminalPresets', () => {
    it('should update order values based on array position', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Preset A',
        command: 'a',
        icon: 'star',
      });
      useAppStore.getState().addTerminalPreset({
        name: 'Preset B',
        command: 'b',
        icon: 'heart',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const presetA = presets.find((p) => p.name === 'Preset A')!;
      const presetB = presets.find((p) => p.name === 'Preset B')!;
      const builtIn = presets.find((p) => p.isBuiltIn)!;
      const claude = presets.find((p) => p.name === 'Claude')!;

      // Reorder: built-in, presetB, presetA, claude
      useAppStore.getState().reorderTerminalPresets([builtIn, presetB, presetA, claude]);

      const reorderedPresets = useAppStore.getState().settings.terminalPresets;
      const reorderedA = reorderedPresets.find((p) => p.name === 'Preset A');
      const reorderedB = reorderedPresets.find((p) => p.name === 'Preset B');

      // B should be before A based on new order
      expect(reorderedB!.order).toBeLessThan(reorderedA!.order);
    });

    it('should keep built-in preset at order 0', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Preset',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const builtIn = presets.find((p) => p.isBuiltIn)!;
      const userPreset = presets.find((p) => p.name === 'Preset')!;

      // Reorder: userPreset first, then built-in
      useAppStore.getState().reorderTerminalPresets([userPreset, builtIn]);

      const reorderedPresets = useAppStore.getState().settings.terminalPresets;
      const reorderedBuiltIn = reorderedPresets.find((p) => p.isBuiltIn);

      // Built-in should still be order 0
      expect(reorderedBuiltIn!.order).toBe(0);
    });

    it('should persist state after reordering', () => {
      useAppStore.setState({ isInitialized: true });
      vi.clearAllMocks();

      const presets = useAppStore.getState().settings.terminalPresets;
      useAppStore.getState().reorderTerminalPresets([...presets].reverse());

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should handle reordering with single preset', () => {
      const presets = useAppStore.getState().settings.terminalPresets;
      const builtIn = presets.find((p) => p.isBuiltIn)!;

      useAppStore.getState().reorderTerminalPresets([builtIn]);

      const reorderedPresets = useAppStore.getState().settings.terminalPresets;
      expect(reorderedPresets).toHaveLength(1);
      expect(reorderedPresets[0].order).toBe(0);
    });
  });

  describe('setDefaultPresetId', () => {
    it('should set the default preset ID', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'MyPreset',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const myPreset = presets.find((p) => p.name === 'MyPreset');

      useAppStore.getState().setDefaultPresetId(myPreset!.id);

      expect(useAppStore.getState().settings.defaultPresetId).toBe(myPreset!.id);
    });

    it('should set defaultPresetId to null', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'MyPreset',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const myPreset = presets.find((p) => p.name === 'MyPreset');

      useAppStore.getState().setDefaultPresetId(myPreset!.id);
      useAppStore.getState().setDefaultPresetId(null);

      expect(useAppStore.getState().settings.defaultPresetId).toBeNull();
    });

    it('should persist state after setting default', () => {
      useAppStore.setState({ isInitialized: true });
      useAppStore.getState().addTerminalPreset({
        name: 'Test',
        command: 'cmd',
        icon: 'star',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset = presets.find((p) => p.name === 'Test');

      vi.clearAllMocks();

      useAppStore.getState().setDefaultPresetId(preset!.id);

      expect(window.storage.saveState).toHaveBeenCalledTimes(1);
    });

    it('should allow setting built-in preset as default', () => {
      const presets = useAppStore.getState().settings.terminalPresets;
      const builtIn = presets.find((p) => p.isBuiltIn);

      useAppStore.getState().setDefaultPresetId(builtIn!.id);

      expect(useAppStore.getState().settings.defaultPresetId).toBe(builtIn!.id);
    });

    it('should allow changing default preset', () => {
      useAppStore.getState().addTerminalPreset({
        name: 'Preset1',
        command: 'cmd1',
        icon: 'star',
      });
      useAppStore.getState().addTerminalPreset({
        name: 'Preset2',
        command: 'cmd2',
        icon: 'heart',
      });

      const presets = useAppStore.getState().settings.terminalPresets;
      const preset1 = presets.find((p) => p.name === 'Preset1');
      const preset2 = presets.find((p) => p.name === 'Preset2');

      useAppStore.getState().setDefaultPresetId(preset1!.id);
      expect(useAppStore.getState().settings.defaultPresetId).toBe(preset1!.id);

      useAppStore.getState().setDefaultPresetId(preset2!.id);
      expect(useAppStore.getState().settings.defaultPresetId).toBe(preset2!.id);
    });
  });
});
