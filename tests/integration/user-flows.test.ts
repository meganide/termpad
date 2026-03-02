import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/appStore';
import { useWorkspaceStore } from '@/features/workspace/store';
import { useTerminal } from '@/hooks/useTerminal';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useWorktreeWatchers } from '@/hooks/useWorktreeWatchers';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
  createMockRepositoryWithWorktreeSessions,
} from '../utils';

describe('User Flows Integration', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('new user onboarding flow', () => {
    it('should initialize app with empty state', async () => {
      vi.mocked(window.storage.loadState).mockResolvedValue({
        version: 1,
        settings: {
          worktreeBasePath: null,
          gitPollIntervalMs: 5000,
          notifications: {
            enabled: true,
            backgroundOnly: true,
            cooldownMs: 8000,
          },
          preferredEditor: 'cursor',
        },
        projects: [],
        window: {
          width: 1400,
          height: 900,
          x: 100,
          y: 100,
          isMaximized: false,
          sidebarWidth: 280,
        },
      });

      await act(async () => {
        await useAppStore.getState().initialize();
      });

      expect(useAppStore.getState().isInitialized).toBe(true);
      expect(useAppStore.getState().repositories).toHaveLength(0);
      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');
    });

    it('should add first project successfully', async () => {
      useAppStore.setState({ isInitialized: true });

      const project = createMockRepository({
        id: 'my-first-project',
        name: 'My First Project',
        path: '/home/user/projects/my-project',
      });

      useAppStore.getState().addRepository(project);

      expect(useAppStore.getState().repositories).toHaveLength(1);
      expect(useAppStore.getState().repositories[0].name).toBe('My First Project');
      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should add worktree session to project', () => {
      useAppStore.setState({ isInitialized: true });

      const project = createMockRepository({ id: 'project-1', name: 'Test Project' });
      useAppStore.getState().addRepository(project);

      const session = createMockWorktreeSession({
        id: 'worktree-session',
        label: 'Feature Branch',
        path: project.path + '/feature',
      });

      useAppStore.getState().addWorktreeSession('project-1', session);

      const updatedProject = useAppStore.getState().repositories[0];
      expect(updatedProject.worktreeSessions).toHaveLength(1);
      expect(updatedProject.worktreeSessions[0].label).toBe('Feature Branch');
    });
  });

  describe('project management flow', () => {
    it('should complete full add -> expand -> collapse -> remove project flow', async () => {
      useAppStore.setState({ isInitialized: true });

      // Add project
      const project = createMockRepository({ id: 'project-1', isExpanded: false });
      useAppStore.getState().addRepository(project);
      expect(useAppStore.getState().repositories).toHaveLength(1);

      // Expand project
      useAppStore.getState().toggleRepositoryExpanded('project-1');
      expect(useAppStore.getState().repositories[0].isExpanded).toBe(true);

      // Collapse project
      useAppStore.getState().toggleRepositoryExpanded('project-1');
      expect(useAppStore.getState().repositories[0].isExpanded).toBe(false);

      // Remove project
      await act(async () => {
        await useAppStore.getState().removeRepository('project-1');
      });
      expect(useAppStore.getState().repositories).toHaveLength(0);
    });

    it('should manage multiple projects independently', async () => {
      useAppStore.setState({ isInitialized: true });

      // Add multiple projects
      const projects = [
        createMockRepository({ id: 'frontend', name: 'Frontend' }),
        createMockRepository({ id: 'backend', name: 'Backend' }),
        createMockRepository({ id: 'mobile', name: 'Mobile' }),
      ];

      projects.forEach((p) => useAppStore.getState().addRepository(p));
      expect(useAppStore.getState().repositories).toHaveLength(3);

      // Expand one project
      useAppStore.getState().toggleRepositoryExpanded('frontend');
      const frontendProject = useAppStore.getState().repositories.find((p) => p.id === 'frontend');
      const backendProject = useAppStore.getState().repositories.find((p) => p.id === 'backend');
      expect(frontendProject?.isExpanded).toBe(true);
      expect(backendProject?.isExpanded).toBe(false);

      // Remove middle project
      await act(async () => {
        await useAppStore.getState().removeRepository('backend');
      });
      expect(useAppStore.getState().repositories).toHaveLength(2);
      expect(useAppStore.getState().repositories.find((p) => p.id === 'backend')).toBeUndefined();
    });
  });

  describe('terminal session flow', () => {
    const flushPromises = async () => {
      await act(async () => {
        await Promise.resolve();
      });
    };

    it('should complete spawn -> write -> read -> kill terminal flow', async () => {
      useAppStore.setState({ isInitialized: true });

      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 1);
      useAppStore.getState().addRepository(project);
      const sessionId = project.worktreeSessions[0].id;
      const sessionPath = project.worktreeSessions[0].path;

      // Capture data handler
      let dataHandler: ((data: string) => void) | null = null;
      vi.mocked(window.terminal.onData).mockImplementation((sid, handler) => {
        dataHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() =>
        useTerminal({
          sessionId,
          cwd: sessionPath,
        })
      );

      // Spawn terminal
      await act(async () => {
        await result.current.spawn();
      });

      expect(window.terminal.spawn).toHaveBeenCalledWith(sessionId, sessionPath, undefined);
      expect(useAppStore.getState().terminals.has(sessionId)).toBe(true);
      expect(useAppStore.getState().terminals.get(sessionId)?.status).toBe('starting');

      // Write to terminal
      act(() => {
        result.current.write('npm test');
      });
      expect(window.terminal.write).toHaveBeenCalledWith(sessionId, 'npm test');

      // Press enter
      act(() => {
        result.current.write('\r');
      });
      expect(window.terminal.write).toHaveBeenCalledWith(sessionId, '\r');
      // Status remains 'starting' until output patterns are detected
      expect(useAppStore.getState().terminals.get(sessionId)?.status).toBe('starting');

      // Setup data callback
      const receivedData: string[] = [];
      act(() => {
        result.current.onData((data) => receivedData.push(data));
      });

      // Simulate data from terminal
      act(() => {
        dataHandler?.('PASS  All tests passed');
      });
      expect(receivedData).toContain('PASS  All tests passed');

      // Kill terminal
      await act(async () => {
        await result.current.kill();
      });

      expect(window.terminal.kill).toHaveBeenCalledWith(sessionId);
      expect(useAppStore.getState().terminals.has(sessionId)).toBe(false);
    });

    it('should handle terminal with git status monitoring', async () => {
      useAppStore.setState({ isInitialized: true });

      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        ahead: 0,
        behind: 0,
      });

      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 1);
      useAppStore.getState().addRepository(project);
      const sessionId = project.worktreeSessions[0].id;
      const sessionPath = project.worktreeSessions[0].path;

      // Start terminal hook
      const terminalHook = renderHook(() =>
        useTerminal({
          sessionId,
          cwd: sessionPath,
        })
      );

      await act(async () => {
        await terminalHook.result.current.spawn();
      });

      // Start git status hook
      renderHook(() =>
        useGitStatus({
          sessionId,
          path: sessionPath,
        })
      );

      await flushPromises();

      // Verify git status was fetched
      expect(window.terminal.getGitStatus).toHaveBeenCalledWith(sessionPath);

      // Verify terminal has git status
      const terminal = useAppStore.getState().terminals.get(sessionId);
      expect(terminal?.gitStatus?.branch).toBe('main');
      expect(terminal?.gitStatus?.isDirty).toBe(false);
    });

    it('should switch between multiple terminal sessions', async () => {
      useAppStore.setState({ isInitialized: true });

      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 3);
      useAppStore.getState().addRepository(project);

      // Spawn all terminals
      const hooks = project.worktreeSessions.map((session) =>
        renderHook(() =>
          useTerminal({
            sessionId: session.id,
            cwd: session.path,
          })
        )
      );

      await act(async () => {
        await Promise.all(hooks.map((h) => h.result.current.spawn()));
      });

      // Switch active terminal
      useAppStore.getState().setActiveTerminal(project.worktreeSessions[0].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[0].id);

      useAppStore.getState().setActiveTerminal(project.worktreeSessions[1].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[1].id);

      useAppStore.getState().setActiveTerminal(project.worktreeSessions[2].id);
      expect(useAppStore.getState().activeTerminalId).toBe(project.worktreeSessions[2].id);

      // Clear active terminal
      useAppStore.getState().setActiveTerminal(null);
      expect(useAppStore.getState().activeTerminalId).toBeNull();
    });
  });

  describe('worktree discovery flow', () => {
    it('should discover and add worktree sessions automatically', () => {
      useAppStore.setState({ isInitialized: true });

      let worktreeAddedHandler:
        | ((projectId: string, worktree: { path: string; branch: string }) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeAdded).mockImplementation((handler) => {
        worktreeAddedHandler = handler;
        return vi.fn();
      });

      const project = createMockRepository({
        id: 'project-1',

        path: '/home/user/project',
      });
      useAppStore.getState().addRepository(project);

      // Setup watcher hook
      renderHook(() => useWorktreeWatchers());

      // Simulate worktree being added externally
      act(() => {
        worktreeAddedHandler?.('project-1', {
          path: '/home/user/worktrees/feature-auth',
          branch: 'feature-auth',
        });
      });

      const updatedProject = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(1);
      expect(updatedProject?.worktreeSessions[0].branchName).toBe('feature-auth');
      expect(updatedProject?.worktreeSessions[0].isExternal).toBe(true);
    });

    it('should remove session when worktree is deleted externally', () => {
      useAppStore.setState({ isInitialized: true });

      let worktreeRemovedHandler:
        | ((projectId: string, worktreePath: string, isExternal: boolean) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeRemoved).mockImplementation((handler) => {
        worktreeRemovedHandler = handler;
        return vi.fn();
      });

      const session = createMockWorktreeSession({
        id: 'worktree-session',

        path: '/home/user/worktrees/feature-x',
        branchName: 'feature-x',
      });

      const project = createMockRepository({
        id: 'project-1',

        sessions: [session],
      });
      useAppStore.getState().addRepository(project);

      renderHook(() => useWorktreeWatchers());

      // Simulate worktree being removed externally
      act(() => {
        worktreeRemovedHandler?.('project-1', '/home/user/worktrees/feature-x', true);
      });

      const updatedProject = useAppStore.getState().repositories.find((p) => p.id === 'project-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(0);
    });
  });

  describe('settings flow', () => {
    it('should update settings and persist', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      // Update git poll interval
      useAppStore.getState().updateSettings({ gitPollIntervalMs: 10000 });
      expect(useAppStore.getState().settings.gitPollIntervalMs).toBe(10000);

      // Update worktree base path
      useAppStore.getState().updateSettings({ worktreeBasePath: '/custom/worktrees' });
      expect(useAppStore.getState().settings.worktreeBasePath).toBe('/custom/worktrees');

      // Verify all persisted
      expect(window.storage.saveState).toHaveBeenCalledTimes(2);
    });

    it('should update sidebar width and persist', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      const initialWidth = useAppStore.getState().window.sidebarWidth;
      expect(initialWidth).toBe(300);

      useAppStore.getState().updateSidebarWidth(350);
      expect(useAppStore.getState().window.sidebarWidth).toBe(350);

      useAppStore.getState().updateSidebarWidth(200);
      expect(useAppStore.getState().window.sidebarWidth).toBe(200);

      expect(window.storage.saveState).toHaveBeenCalledTimes(2);
    });
  });

  describe('workspace task flow', () => {
    it('should switch between workspace tabs and maintain content', () => {
      // Add content to task 1
      useWorkspaceStore
        .getState()
        .updateTaskContent('task-1', '# Task 1 Notes\nSome important notes');
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe(
        '# Task 1 Notes\nSome important notes'
      );

      // Switch to task 2
      useWorkspaceStore.getState().setActiveTab('task-2');
      expect(useWorkspaceStore.getState().activeTab).toBe('task-2');

      // Add content to task 2
      useWorkspaceStore.getState().updateTaskContent('task-2', '# Task 2 Notes\nDifferent notes');
      expect(useWorkspaceStore.getState().taskStates['task-2'].content).toBe(
        '# Task 2 Notes\nDifferent notes'
      );

      // Switch back to task 1 - content should be preserved
      useWorkspaceStore.getState().setActiveTab('task-1');
      expect(useWorkspaceStore.getState().activeTab).toBe('task-1');
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toBe(
        '# Task 1 Notes\nSome important notes'
      );
    });

    it('should persist workspace state to localStorage', () => {
      useWorkspaceStore.getState().setActiveTab('task-2');
      useWorkspaceStore.getState().updateTaskContent('task-2', 'Persisted content');

      const storedData = localStorage.getItem('termpad-workspace');
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData as string);
      expect(parsed.state.activeTab).toBe('task-2');
      expect(parsed.state.taskStates['task-2'].content).toBe('Persisted content');
    });
  });

  describe('app reload/restore flow', () => {
    it('should restore app state after simulated reload', async () => {
      useAppStore.setState({ isInitialized: true });

      // Setup initial state
      const project = createMockRepositoryWithWorktreeSessions(
        { id: 'project-1', name: 'My Project' },
        2
      );
      useAppStore.getState().addRepository(project);
      useAppStore.getState().updateSettings({ gitPollIntervalMs: 8000 });
      useAppStore.getState().updateSidebarWidth(320);

      // Capture the saved state
      const savedState = vi.mocked(window.storage.saveState).mock.calls.slice(-1)[0][0];

      // Reset stores (simulating reload)
      resetAllStores();
      expect(useAppStore.getState().repositories).toHaveLength(0);

      // Mock loadState to return saved state
      vi.mocked(window.storage.loadState).mockResolvedValue(savedState);

      // Initialize (simulating app start)
      await act(async () => {
        await useAppStore.getState().initialize();
      });

      // Verify state is restored
      expect(useAppStore.getState().repositories).toHaveLength(1);
      expect(useAppStore.getState().repositories[0].name).toBe('My Project');
      expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(2);
      expect(useAppStore.getState().settings.gitPollIntervalMs).toBe(8000);
      expect(useAppStore.getState().window.sidebarWidth).toBe(320);
    });
  });

  describe('complete development workflow', () => {
    const flushPromises = async () => {
      await act(async () => {
        await Promise.resolve();
      });
    };

    it('should complete full development workflow: project -> terminal -> git -> worktree', async () => {
      useAppStore.setState({ isInitialized: true });

      // Setup mocks for git operations
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
        ahead: 0,
        behind: 0,
      });

      let worktreeAddedHandler:
        | ((projectId: string, worktree: { path: string; branch: string }) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeAdded).mockImplementation((handler) => {
        worktreeAddedHandler = handler;
        return vi.fn();
      });

      // 1. Add project
      const project = createMockRepository({
        id: 'my-project',
        name: 'My Awesome Project',
        path: '/home/user/projects/awesome',
      });
      useAppStore.getState().addRepository(project);

      // 2. Add main session
      const mainSession = createMockWorktreeSession({
        id: 'main-session',

        label: 'Main',
        path: project.path,
      });
      useAppStore.getState().addWorktreeSession('my-project', mainSession);

      // 3. Setup watchers
      renderHook(() => useWorktreeWatchers());
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('my-project', project.path);

      // 4. Spawn terminal
      const terminalHook = renderHook(() =>
        useTerminal({
          sessionId: 'main-session',
          cwd: project.path,
        })
      );

      await act(async () => {
        await terminalHook.result.current.spawn();
      });

      expect(useAppStore.getState().terminals.has('main-session')).toBe(true);

      // 5. Monitor git status
      renderHook(() =>
        useGitStatus({
          sessionId: 'main-session',
          path: project.path,
        })
      );

      await flushPromises();
      expect(useAppStore.getState().terminals.get('main-session')?.gitStatus?.branch).toBe('main');

      // 6. Set as active terminal
      useAppStore.getState().setActiveTerminal('main-session');
      expect(useAppStore.getState().activeTerminalId).toBe('main-session');

      // 7. Simulate worktree being created (e.g., user ran `git worktree add`)
      act(() => {
        worktreeAddedHandler?.('my-project', {
          path: '/home/user/worktrees/feature-branch',
          branch: 'feature-branch',
        });
      });

      const updatedProject = useAppStore.getState().repositories.find((p) => p.id === 'my-project');
      expect(updatedProject?.worktreeSessions).toHaveLength(2);
      expect(updatedProject?.worktreeSessions[1].branchName).toBe('feature-branch');

      // 8. Switch to worktree session (the second session, which was added by worktreeAddedHandler)
      const worktreeSession = updatedProject?.worktreeSessions[1];
      useAppStore.getState().setActiveTerminal(worktreeSession!.id);
      expect(useAppStore.getState().activeTerminalId).toBe(worktreeSession!.id);

      // 9. Update workspace notes
      useWorkspaceStore
        .getState()
        .updateTaskContent('task-1', '## Feature Branch Work\n- Implement auth\n- Add tests');

      // 10. Verify final state
      expect(useAppStore.getState().repositories).toHaveLength(1);
      expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(2);
      expect(useAppStore.getState().terminals.size).toBe(1); // Only main was spawned
      expect(useWorkspaceStore.getState().taskStates['task-1'].content).toContain(
        'Feature Branch Work'
      );
    });
  });

  describe('error recovery flows', () => {
    it('should handle project removal with terminal failures gracefully', async () => {
      useAppStore.setState({ isInitialized: true });

      vi.mocked(window.terminal.kill).mockRejectedValue(new Error('Terminal already dead'));

      const project = createMockRepositoryWithWorktreeSessions({ id: 'project-1' }, 2);
      useAppStore.getState().addRepository(project);

      // Register terminals
      project.worktreeSessions.forEach((session) => {
        useAppStore.getState().registerTerminal(session.id);
      });

      // Remove project - should succeed despite terminal kill failures
      await act(async () => {
        await useAppStore.getState().removeRepository('project-1');
      });

      expect(useAppStore.getState().repositories).toHaveLength(0);
    });

    it('should continue with app initialization even if storage fails', async () => {
      vi.mocked(window.storage.loadState).mockRejectedValue(new Error('Storage corrupted'));

      await act(async () => {
        await useAppStore.getState().initialize();
      });

      // Should be initialized with defaults
      expect(useAppStore.getState().isInitialized).toBe(true);
      expect(useAppStore.getState().repositories).toHaveLength(0);
    });
  });

  describe('concurrent operations flow', () => {
    it('should handle multiple rapid project additions', () => {
      useAppStore.setState({ isInitialized: true });

      // Rapid project additions
      for (let i = 0; i < 10; i++) {
        useAppStore
          .getState()
          .addRepository(createMockRepository({ id: `project-${i}`, name: `Project ${i}` }));
      }

      expect(useAppStore.getState().repositories).toHaveLength(10);

      // Verify each project has correct name
      for (let i = 0; i < 10; i++) {
        const project = useAppStore.getState().repositories.find((p) => p.id === `project-${i}`);
        expect(project?.name).toBe(`Project ${i}`);
      }
    });

    it('should handle rapid settings updates', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      // Rapid settings updates
      for (let i = 1; i <= 5; i++) {
        useAppStore.getState().updateSettings({ gitPollIntervalMs: i * 1000 });
      }

      // Final value should be 5000
      expect(useAppStore.getState().settings.gitPollIntervalMs).toBe(5000);

      // Each update should have persisted
      expect(window.storage.saveState).toHaveBeenCalledTimes(5);
    });
  });
});
