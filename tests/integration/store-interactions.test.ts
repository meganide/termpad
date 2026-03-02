import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '@/stores/appStore';
import { useWorkspaceStore } from '@/features/workspace/store';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
  createMockRepositoryWithWorktreeSessions,
} from '../utils';

describe('Store Interactions', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('appStore and workspaceStore coordination', () => {
    it('should allow workspace tab changes independent of project state', () => {
      const project = createMockRepository({ id: 'project-1' });
      useAppStore.getState().addRepository(project);

      useWorkspaceStore.getState().setActiveTab('task-2');

      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');
      expect(useAppStore.getState().repositories).toHaveLength(1);
    });

    it('should maintain task content when switching tabs', () => {
      useWorkspaceStore.getState().updateTaskContent('task-1', 'Content 1');
      useWorkspaceStore.getState().updateTaskContent('task-2', 'Content 2');

      useWorkspaceStore.getState().setActiveTab('task-2');
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('Content 1');

      useWorkspaceStore.getState().setActiveTab('task-1');
      expect(useWorkspaceStore.getState().taskStates['task-2'].content).toBe('Content 2');
    });

    it('should persist workspaceStore to localStorage separately from appStore', () => {
      useAppStore.setState({ isInitialized: true });
      useWorkspaceStore.getState().setActiveTab('task-2');
      useAppStore.getState().updateSettings({ gitPollIntervalMs: 10000 });

      // Both should have persisted
      // workspaceStore persists to localStorage
      const workspaceData = localStorage.getItem('termpad-workspace');
      expect(workspaceData).toBeDefined();
      const parsed = JSON.parse(workspaceData as string);
      expect(parsed.state.activeTab).toBe('task-2');

      // appStore persists via window.storage.saveState
      expect(window.storage.saveState).toHaveBeenCalled();
    });
  });

  describe('project and session cascading operations', () => {
    it('should add sessions to projects correctly', () => {
      const project = createMockRepository({ id: 'project-1' });
      useAppStore.getState().addRepository(project);

      const session = createMockWorktreeSession({ id: 'session-1', label: 'Test Session' });
      useAppStore.getState().addWorktreeSession('project-1', session);

      const updatedProject = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(1);
      expect(updatedProject?.worktreeSessions[0].label).toBe('Test Session');
    });

    it('should remove sessions from projects correctly', () => {
      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 3);
      useAppStore.getState().addRepository(project);

      const sessionToRemove = project.worktreeSessions[1].id;
      useAppStore.getState().removeWorktreeSession('project-1', sessionToRemove);

      const updatedProject = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(2);
      expect(
        updatedProject?.worktreeSessions.find((s) => s.id === sessionToRemove)
      ).toBeUndefined();
    });

    it('should clean up terminal state when removing project', async () => {
      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 2);
      useAppStore.getState().addRepository(project);

      // Create tabs and register terminals for sessions
      // Terminal IDs are now in format "worktreeSessionId:tabId"
      project.worktreeSessions.forEach((session) => {
        const tab = useAppStore.getState().createTab(session.id, 'Terminal');
        const terminalId = `${session.id}:${tab.id}`;
        useAppStore.getState().registerTerminal(terminalId);
        useAppStore.getState().updateTerminalStatus(terminalId, 'idle');
      });

      expect(useAppStore.getState().terminals.size).toBe(2);

      await useAppStore.getState().removeRepository('project-1');

      // Project removed
      expect(useAppStore.getState().repositories).toHaveLength(0);
      // killAllForWorktree should have been called for each worktree session
      expect(window.terminal.killAllForWorktree).toHaveBeenCalledTimes(2);
      // Watcher should be stopped
      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('project-1');
    });

    it('should clear activeTerminalId when removing project with active terminal', async () => {
      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 1);
      const sessionId = project.worktreeSessions[0].id;
      useAppStore.getState().addRepository(project);
      useAppStore.getState().registerTerminal(sessionId);
      useAppStore.getState().setActiveTerminal(sessionId);

      expect(useAppStore.getState().activeTerminalId).toBe(sessionId);

      await useAppStore.getState().removeRepository('project-1');

      expect(useAppStore.getState().activeTerminalId).toBeNull();
    });

    it('should persist state after cascading project operations', async () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      const project = createMockRepository({ id: 'project-1' });
      useAppStore.getState().addRepository(project);
      expect(window.storage.saveState).toHaveBeenCalledTimes(1);

      const session = createMockWorktreeSession({ id: 'session-1' });
      useAppStore.getState().addWorktreeSession('project-1', session);
      expect(window.storage.saveState).toHaveBeenCalledTimes(2);

      useAppStore.getState().removeWorktreeSession('project-1', 'session-1');
      expect(window.storage.saveState).toHaveBeenCalledTimes(3);

      await useAppStore.getState().removeRepository('project-1');
      // removeProject calls persistState
      expect(window.storage.saveState).toHaveBeenCalledTimes(4);
    });
  });

  describe('terminal state management across stores', () => {
    it('should register terminal with default starting status and new fields', () => {
      useAppStore.getState().registerTerminal('session-1');

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal).toBeDefined();
      expect(terminal?.status).toBe('starting');
      expect(terminal?.hasReceivedOutput).toBe(false);
    });

    it('should not overwrite existing terminal state on re-registration', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'idle');

      // Re-register should not change status
      useAppStore.getState().registerTerminal('session-1');

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('idle');
    });

    it('should track terminal status transitions', () => {
      useAppStore.getState().registerTerminal('session-1');

      const transitions: string[] = [];
      const statuses: Array<'starting' | 'running' | 'waiting' | 'idle' | 'stopped' | 'error'> = [
        'idle',
        'running',
        'waiting',
        'running',
        'idle',
        'stopped',
      ];

      for (const status of statuses) {
        useAppStore.getState().updateTerminalStatus('session-1', status);
        transitions.push(useAppStore.getState().terminals.get('session-1')?.status || '');
      }

      expect(transitions).toEqual(['idle', 'running', 'waiting', 'running', 'idle', 'stopped']);
    });

    it('should update git status for terminals', () => {
      useAppStore.getState().registerTerminal('session-1');

      useAppStore.getState().updateGitStatus('session-1', {
        branch: 'feature-branch',
        isDirty: true,
        ahead: 2,
        behind: 1,
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.gitStatus).toEqual({
        branch: 'feature-branch',
        isDirty: true,
        ahead: 2,
        behind: 1,
      });
    });

    it('should handle active terminal switching between sessions', () => {
      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 3);
      useAppStore.getState().addRepository(project);

      project.worktreeSessions.forEach((session) => {
        useAppStore.getState().registerTerminal(session.id);
      });

      // Switch between terminals
      useAppStore.getState().setActiveTerminal(project.worktreeSessions[0].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[0].id);

      useAppStore.getState().setActiveTerminal(project.worktreeSessions[1].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[1].id);

      useAppStore.getState().setActiveTerminal(project.worktreeSessions[2].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[2].id);
    });

    it('should unregister terminal and clear from map', () => {
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().registerTerminal('session-2');

      expect(useAppStore.getState().terminals.size).toBe(2);

      useAppStore.getState().unregisterTerminal('session-1');

      expect(useAppStore.getState().terminals.size).toBe(1);
      expect(useAppStore.getState().terminals.has('session-1')).toBe(false);
      expect(useAppStore.getState().terminals.has('session-2')).toBe(true);
    });
  });

  describe('multi-project state coordination', () => {
    it('should manage multiple projects independently', () => {
      const project1 = createMockRepository({ id: 'project-1', name: 'Project 1' });
      const project2 = createMockRepository({ id: 'project-2', name: 'Project 2' });

      useAppStore.getState().addRepository(project1);
      useAppStore.getState().addRepository(project2);

      expect(useAppStore.getState().repositories).toHaveLength(2);

      // Toggle expansion independently
      useAppStore.getState().toggleRepositoryExpanded('project-1');
      expect(
        useAppStore.getState().repositories.find((p) => p.id === 'project-1')?.isExpanded
      ).toBe(true);
      expect(
        useAppStore.getState().repositories.find((p) => p.id === 'project-2')?.isExpanded
      ).toBe(false);
    });

    it('should add sessions to correct project', () => {
      const project1 = createMockRepository({ id: 'project-1' });
      const project2 = createMockRepository({ id: 'project-2' });

      useAppStore.getState().addRepository(project1);
      useAppStore.getState().addRepository(project2);

      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });

      useAppStore.getState().addWorktreeSession('project-1', session1);
      useAppStore.getState().addWorktreeSession('project-2', session2);

      const p1 = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      const p2 = useAppStore.getState().repositories.find((p) => p.id === 'project-2');

      expect(p1?.worktreeSessions).toHaveLength(1);
      expect(p1?.worktreeSessions[0].id).toBe('session-1');
      expect(p2?.worktreeSessions).toHaveLength(1);
      expect(p2?.worktreeSessions[0].id).toBe('session-2');
    });

    it('should find project and session by session id', () => {
      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 2);
      useAppStore.getState().addRepository(project);

      const targetSessionId = project.worktreeSessions[1].id;

      const foundProject = useAppStore.getState().getRepositoryByWorktreeSessionId(targetSessionId);
      expect(foundProject?.id).toBe('project-1');

      const foundSession = useAppStore.getState().getWorktreeSessionById(targetSessionId);
      expect(foundSession?.id).toBe(targetSessionId);
    });

    it('should return undefined for non-existent session ids', () => {
      const project = createMockRepository({ id: 'project-1' });
      useAppStore.getState().addRepository(project);

      const foundProject = useAppStore.getState().getRepositoryByWorktreeSessionId('non-existent');
      expect(foundProject).toBeUndefined();

      const foundSession = useAppStore.getState().getWorktreeSessionById('non-existent');
      expect(foundSession).toBeUndefined();
    });
  });

  describe('settings and window state coordination', () => {
    it('should update settings while preserving other settings', () => {
      const initialSettings = useAppStore.getState().settings;

      useAppStore.getState().updateSettings({ gitPollIntervalMs: 10000 });

      const updatedSettings = useAppStore.getState().settings;
      expect(updatedSettings.gitPollIntervalMs).toBe(10000);
      expect(updatedSettings.worktreeBasePath).toBe(initialSettings.worktreeBasePath);
    });

    it('should update sidebar width while preserving window dimensions', () => {
      const initialWindow = useAppStore.getState().window;

      useAppStore.getState().updateSidebarWidth(350);

      const updatedWindow = useAppStore.getState().window;
      expect(updatedWindow.sidebarWidth).toBe(350);
      expect(updatedWindow.width).toBe(initialWindow.width);
      expect(updatedWindow.height).toBe(initialWindow.height);
      expect(updatedWindow.isMaximized).toBe(initialWindow.isMaximized);
    });

    it('should persist both settings and window changes', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      useAppStore.getState().updateSettings({ gitPollIntervalMs: 10000 });
      useAppStore.getState().updateSidebarWidth(400);

      expect(window.storage.saveState).toHaveBeenCalledTimes(2);

      // Verify both changes are in the persisted state
      const lastSavedState = vi.mocked(window.storage.saveState).mock.calls[1][0];
      expect(lastSavedState.settings.gitPollIntervalMs).toBe(10000);
      expect(lastSavedState.window.sidebarWidth).toBe(400);
    });
  });

  describe('store initialization and state loading', () => {
    it('should initialize appStore with loaded state', async () => {
      const mockState = {
        version: 1,
        settings: {
          worktreeBasePath: '/custom/path',
          gitPollIntervalMs: 3000,
        },
        repositories: [createMockRepository({ id: 'loaded-repository' })],
        window: {
          width: 1600,
          height: 1000,
          x: 200,
          y: 200,
          isMaximized: true,
          sidebarWidth: 320,
        },
      };

      vi.mocked(window.storage.loadState).mockResolvedValue(mockState);

      await useAppStore.getState().initialize();

      expect(useAppStore.getState().isInitialized).toBe(true);
      expect(useAppStore.getState().settings.worktreeBasePath).toBe('/custom/path');
      expect(useAppStore.getState().repositories).toHaveLength(1);
      expect(useAppStore.getState().repositories[0].id).toBe('loaded-repository');
      expect(useAppStore.getState().window.sidebarWidth).toBe(320);
    });

    it('should reset runtime state on initialize', async () => {
      // Set up some runtime state
      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().setActiveTerminal('session-1');

      await useAppStore.getState().initialize();

      // Runtime state should be reset
      expect(useAppStore.getState().terminals.size).toBe(0);
      expect(useAppStore.getState().activeTerminalId).toBeNull();
    });

    it('should handle initialization error gracefully', async () => {
      vi.mocked(window.storage.loadState).mockRejectedValue(new Error('Load failed'));

      await useAppStore.getState().initialize();

      // Should still be initialized despite error
      expect(useAppStore.getState().isInitialized).toBe(true);
    });
  });

  describe('state immutability', () => {
    it('should create new project array on addProject', () => {
      const initialProjects = useAppStore.getState().repositories;

      useAppStore.getState().addRepository(createMockRepository({ id: 'new-project' }));

      const newProjects = useAppStore.getState().repositories;
      expect(newProjects).not.toBe(initialProjects);
    });

    it('should create new terminals map on terminal operations', () => {
      const initialTerminals = useAppStore.getState().terminals;

      useAppStore.getState().registerTerminal('session-1');

      const newTerminals = useAppStore.getState().terminals;
      expect(newTerminals).not.toBe(initialTerminals);
    });

    it('should create new workspace taskStates on content update', () => {
      const initialTaskStates = useWorkspaceStore.getState().taskStates;

      useWorkspaceStore.getState().updateTaskContent('task-1', 'new content');

      const newTaskStates = useWorkspaceStore.getState().taskStates;
      expect(newTaskStates).not.toBe(initialTaskStates);
    });

    it('should not mutate original project sessions on session add', () => {
      const project = createMockRepository({ id: 'project-1' });
      const originalSessions = [...project.worktreeSessions];
      useAppStore.getState().addRepository(project);

      useAppStore
        .getState()
        .addWorktreeSession('project-1', createMockWorktreeSession({ id: 'session-1' }));

      // Original project object should not be mutated
      expect(project.worktreeSessions).toEqual(originalSessions);
    });
  });

  describe('cross-store consistency', () => {
    it('should maintain consistent state across multiple rapid operations', () => {
      // Perform rapid operations across stores
      for (let i = 0; i < 10; i++) {
        useAppStore.getState().addRepository(createMockRepository({ id: `project-${i}` }));
        useWorkspaceStore.getState().updateTaskContent('task-1', `content-${i}`);
      }

      // Verify final states are consistent
      expect(useAppStore.getState().repositories).toHaveLength(10);
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe('content-9');
    });

    it('should handle concurrent-like operations on same project', () => {
      const project = createMockRepository({ id: 'project-1' });
      useAppStore.getState().addRepository(project);

      // Simulate multiple operations on same project
      useAppStore.getState().toggleRepositoryExpanded('project-1');
      useAppStore
        .getState()
        .addWorktreeSession('project-1', createMockWorktreeSession({ id: 'session-1' }));
      useAppStore.getState().toggleRepositoryExpanded('project-1');
      useAppStore
        .getState()
        .addWorktreeSession('project-1', createMockWorktreeSession({ id: 'session-2' }));

      const finalProject = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      expect(finalProject?.isExpanded).toBe(false); // toggled twice
      expect(finalProject?.worktreeSessions).toHaveLength(2);
    });
  });
});
