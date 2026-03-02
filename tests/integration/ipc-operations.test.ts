import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/appStore';
import { useTerminal } from '@/hooks/useTerminal';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useWorktreeWatchers } from '@/hooks/useWorktreeWatchers';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
  createMockRepositoryWithWorktreeSessions,
} from '../utils';

describe('IPC Operations Integration', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock document.hasFocus to return true so polling uses configured interval
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('terminal lifecycle operations', () => {
    it('should spawn terminal and register with appStore', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      const session = createMockWorktreeSession({
        id: 'session-1',
        path: '/test/path',
      });
      useAppStore.getState().addRepository({ ...repository, worktreeSessions: [session] });

      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      await act(async () => {
        await result.current.spawn();
      });

      // Terminal should be spawned via IPC (no initialCommand = plain shell)
      expect(window.terminal.spawn).toHaveBeenCalledWith('session-1', '/test/path', undefined);

      // Terminal should be registered in store with starting status
      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal).toBeDefined();
      expect(terminal?.status).toBe('starting');
    });

    it('should kill terminal and unregister from appStore', async () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      useAppStore.getState().addRepository(repository);
      const sessionId = repository.worktreeSessions[0].id;

      const { result } = renderHook(() =>
        useTerminal({
          sessionId,
          cwd: repository.worktreeSessions[0].path,
        })
      );

      // Spawn first
      await act(async () => {
        await result.current.spawn();
      });

      expect(useAppStore.getState().terminals.has(sessionId)).toBe(true);

      // Now kill
      await act(async () => {
        await result.current.kill();
      });

      expect(window.terminal.kill).toHaveBeenCalledWith(sessionId);
      expect(useAppStore.getState().terminals.has(sessionId)).toBe(false);
    });

    it('should write to terminal via IPC', () => {
      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      act(() => {
        result.current.write('ls -la');
      });

      expect(window.terminal.write).toHaveBeenCalledWith('session-1', 'ls -la');
    });

    it('should write enter key via IPC', () => {
      useAppStore.getState().registerTerminal('session-1');

      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      act(() => {
        result.current.write('\r');
      });

      // Status is only updated based on output patterns, not by writing to terminal
      // The write function just passes through to IPC
      expect(window.terminal.write).toHaveBeenCalledWith('session-1', '\r');
    });

    it('should resize terminal via IPC', () => {
      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      act(() => {
        result.current.resize(120, 40);
      });

      expect(window.terminal.resize).toHaveBeenCalledWith('session-1', 120, 40);
    });

    it('should setup data listener via IPC and return unsubscribe', () => {
      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      const dataCallback = vi.fn();
      let unsubscribe: () => void;

      act(() => {
        unsubscribe = result.current.onData(dataCallback);
      });

      expect(window.terminal.onData).toHaveBeenCalledWith('session-1', expect.any(Function));
      expect(typeof unsubscribe!).toBe('function');
    });

    it('should auto-spawn terminal when autoSpawn is true', async () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 1);
      useAppStore.getState().addRepository(repository);
      const sessionId = repository.worktreeSessions[0].id;

      await act(async () => {
        renderHook(() =>
          useTerminal({
            sessionId,
            cwd: repository.worktreeSessions[0].path,
            autoSpawn: true,
          })
        );
      });

      expect(window.terminal.spawn).toHaveBeenCalled();
    });

    it('should handle terminal exit event and update store status', async () => {
      let capturedExitHandler: ((code: number, signal?: number) => void) | null = null;
      vi.mocked(window.terminal.onExit).mockImplementation((sid, handler) => {
        capturedExitHandler = handler;
        return vi.fn();
      });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      expect(capturedExitHandler).not.toBeNull();

      // Simulate exit with code 0
      act(() => {
        capturedExitHandler!(0);
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('stopped');
    });

    it('should set error status on non-zero exit code', async () => {
      let capturedExitHandler: ((code: number, signal?: number) => void) | null = null;
      vi.mocked(window.terminal.onExit).mockImplementation((sid, handler) => {
        capturedExitHandler = handler;
        return vi.fn();
      });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.getState().updateTerminalStatus('session-1', 'running');

      renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      // Simulate exit with code 1 (error)
      act(() => {
        capturedExitHandler!(1);
      });

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.status).toBe('error');
    });
  });

  describe('storage operations', () => {
    it('should load state via storage IPC on initialize', async () => {
      const mockState = {
        version: 1,
        settings: {
          theme: 'light' as const,
          worktreeBasePath: '/custom',
          gitPollIntervalMs: 3000,
        },
        repositories: [createMockRepository({ id: 'loaded-repository', name: 'Loaded' })],
        window: {
          width: 1600,
          height: 1000,
          x: 0,
          y: 0,
          isMaximized: false,
          sidebarWidth: 300,
        },
      };

      vi.mocked(window.storage.loadState).mockResolvedValue(mockState);

      await act(async () => {
        await useAppStore.getState().initialize();
      });

      expect(window.storage.loadState).toHaveBeenCalled();
      expect(useAppStore.getState().repositories).toHaveLength(1);
      expect(useAppStore.getState().repositories[0].name).toBe('Loaded');
    });

    it('should save state via storage IPC when repository is added', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      const repository = createMockRepository({ id: 'new-repository' });
      useAppStore.getState().addRepository(repository);

      expect(window.storage.saveState).toHaveBeenCalled();
      const savedState = vi.mocked(window.storage.saveState).mock.calls[0][0];
      expect(savedState.repositories).toHaveLength(1);
      expect(savedState.repositories[0].id).toBe('new-repository');
    });

    it('should save state via storage IPC when session is added', () => {
      useAppStore.setState({ isInitialized: true });
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);
      vi.mocked(window.storage.saveState).mockClear();

      const session = createMockWorktreeSession({ id: 'session-1' });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      expect(window.storage.saveState).toHaveBeenCalled();
    });

    it('should save state via storage IPC when settings change', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      useAppStore.getState().updateSettings({ gitPollIntervalMs: 10000 });

      expect(window.storage.saveState).toHaveBeenCalled();
      const savedState = vi.mocked(window.storage.saveState).mock.calls[0][0];
      expect(savedState.settings.gitPollIntervalMs).toBe(10000);
    });

    it('should save state via storage IPC when sidebar width changes', () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      useAppStore.getState().updateSidebarWidth(400);

      expect(window.storage.saveState).toHaveBeenCalled();
      const savedState = vi.mocked(window.storage.saveState).mock.calls[0][0];
      expect(savedState.window.sidebarWidth).toBe(400);
    });

    it('should handle storage load error gracefully', async () => {
      vi.mocked(window.storage.loadState).mockRejectedValue(new Error('Storage error'));

      await act(async () => {
        await useAppStore.getState().initialize();
      });

      // Should still be initialized
      expect(useAppStore.getState().isInitialized).toBe(true);
    });
  });

  describe('git status polling operations', () => {
    const flushPromises = async () => {
      await act(async () => {
        await Promise.resolve();
      });
    };

    it('should fetch git status via IPC on mount', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
      });

      useAppStore.getState().registerTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledWith('/test/path');
    });

    it('should poll git status at configured interval', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
      });

      useAppStore.getState().registerTerminal('session-1');
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          gitPollIntervalMs: 5000,
        },
      });

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
        })
      );

      await flushPromises();

      // Initial call
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      // Advance timer and check again
      vi.advanceTimersByTime(5000);
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(2);

      // Another interval
      vi.advanceTimersByTime(5000);
      await flushPromises();

      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(3);
    });

    it('should update appStore with git status', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'feature-branch',
        isDirty: true,
        ahead: 2,
        behind: 1,
      });

      useAppStore.getState().registerTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
        })
      );

      await flushPromises();

      const terminal = useAppStore.getState().terminals.get('session-1');
      expect(terminal?.gitStatus).toEqual({
        branch: 'feature-branch',
        isDirty: true,
        ahead: 2,
        behind: 1,
      });
    });

    it('should not poll when enabled is false', async () => {
      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
          enabled: false,
        })
      );

      await flushPromises();

      expect(window.terminal.getGitStatus).not.toHaveBeenCalled();
    });

    it('should cleanup interval on unmount', async () => {
      vi.mocked(window.terminal.getGitStatus).mockResolvedValue({
        branch: 'main',
        isDirty: false,
      });

      useAppStore.getState().registerTerminal('session-1');

      const { unmount } = renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
        })
      );

      await flushPromises();
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);

      unmount();

      // Advance timer after unmount
      vi.advanceTimersByTime(10000);
      await flushPromises();

      // Should not have been called again
      expect(window.terminal.getGitStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle git status error gracefully', async () => {
      vi.mocked(window.terminal.getGitStatus).mockRejectedValue(new Error('Git error'));

      useAppStore.getState().registerTerminal('session-1');

      renderHook(() =>
        useGitStatus({
          sessionId: 'session-1',
          path: '/test/path',
        })
      );

      await flushPromises();

      // Should not throw - error is caught internally
      expect(window.terminal.getGitStatus).toHaveBeenCalled();
    });
  });

  describe('watcher operations', () => {
    beforeEach(() => {
      useAppStore.setState({ isInitialized: true });
    });

    it('should start watcher for git repositories', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith(
        'repository-1',
        repository.path
      );
    });

    // Note: All repositories are git repos now, so watcher is always started

    it('should setup worktree added listener', () => {
      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.onWorktreeAdded).toHaveBeenCalled();
    });

    it('should setup worktree removed listener', () => {
      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.onWorktreeRemoved).toHaveBeenCalled();
    });

    it('should add session when worktree is added', () => {
      let capturedHandler:
        | ((repositoryId: string, worktree: { path: string; branch: string }) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeAdded).mockImplementation((handler) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      renderHook(() => useWorktreeWatchers());

      expect(capturedHandler).not.toBeNull();

      act(() => {
        capturedHandler!('repository-1', {
          path: '/test/worktree/feature-branch',
          branch: 'feature-branch',
        });
      });

      const updatedProject = useAppStore
        .getState()
        .repositories.find((p) => p.id === 'repository-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(1);
      expect(updatedProject?.worktreeSessions[0].path).toBe('/test/worktree/feature-branch');
    });

    it('should not add duplicate session for same path', () => {
      let capturedHandler:
        | ((repositoryId: string, worktree: { path: string; branch: string }) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeAdded).mockImplementation((handler) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const session = createMockWorktreeSession({ id: 'existing', path: '/test/worktree' });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      useAppStore.getState().addRepository(repository);

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedHandler!('repository-1', {
          path: '/test/worktree',
          branch: 'feature',
        });
      });

      const updatedProject = useAppStore
        .getState()
        .repositories.find((p) => p.id === 'repository-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(1); // Still just 1
    });

    it('should remove session when worktree is removed', () => {
      let capturedHandler:
        | ((repositoryId: string, worktreePath: string, isExternal: boolean) => void)
        | null = null;
      vi.mocked(window.watcher.onWorktreeRemoved).mockImplementation((handler) => {
        capturedHandler = handler;
        return vi.fn();
      });

      const session = createMockWorktreeSession({ id: 'session-1', path: '/test/worktree' });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      useAppStore.getState().addRepository(repository);

      renderHook(() => useWorktreeWatchers());

      expect(capturedHandler).not.toBeNull();

      // onWorktreeRemoved receives (repositoryId, worktreePath, isExternal)
      act(() => {
        capturedHandler!('repository-1', '/test/worktree', false);
      });

      const updatedProject = useAppStore
        .getState()
        .repositories.find((p) => p.id === 'repository-1');
      expect(updatedProject?.worktreeSessions).toHaveLength(0);
    });

    it('should stop watcher when repository is removed', async () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      await useAppStore.getState().removeRepository('repository-1');

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
    });

    it('should cleanup all watchers on unmount', () => {
      const project1 = createMockRepository({ id: 'repository-1', path: '/path1' });
      const project2 = createMockRepository({ id: 'repository-2', path: '/path2' });
      useAppStore.getState().addRepository(project1);
      useAppStore.getState().addRepository(project2);

      const { unmount } = renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(2);

      unmount();

      // Both watchers should be stopped
      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-2');
    });
  });

  describe('combined IPC flows', () => {
    it('should handle full project lifecycle with terminal and watcher', async () => {
      useAppStore.setState({ isInitialized: true });

      // Add project
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      // Setup watchers
      renderHook(() => useWorktreeWatchers());
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalled();

      // Add session
      const session = createMockWorktreeSession({ id: 'session-1', path: '/test/path' });
      useAppStore.getState().addWorktreeSession('repository-1', session);

      // Create a tab for the session (terminal IDs are now "worktreeSessionId:tabId")
      const tab = useAppStore.getState().createTab('session-1', 'Terminal');
      const terminalId = `session-1:${tab.id}`;

      // Spawn terminal for session using the tab-aware terminal ID
      const { result } = renderHook(() =>
        useTerminal({
          sessionId: terminalId,
          cwd: '/test/path',
        })
      );

      await act(async () => {
        await result.current.spawn();
      });

      expect(window.terminal.spawn).toHaveBeenCalled();
      expect(useAppStore.getState().terminals.has(terminalId)).toBe(true);

      // Remove project - should cleanup everything
      await act(async () => {
        await useAppStore.getState().removeRepository('repository-1');
      });

      expect(window.terminal.killAllForWorktree).toHaveBeenCalled();
      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
      expect(useAppStore.getState().repositories).toHaveLength(0);
    });

    it('should coordinate storage saves across multiple operations', async () => {
      useAppStore.setState({ isInitialized: true });
      vi.mocked(window.storage.saveState).mockClear();

      // Multiple operations in sequence
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      const session1 = createMockWorktreeSession({ id: 'session-1' });
      useAppStore.getState().addWorktreeSession('repository-1', session1);

      const session2 = createMockWorktreeSession({ id: 'session-2' });
      useAppStore.getState().addWorktreeSession('repository-1', session2);

      useAppStore.getState().updateSettings({ gitPollIntervalMs: 8000 });
      useAppStore.getState().updateSidebarWidth(350);

      // Each operation should save state
      expect(window.storage.saveState).toHaveBeenCalledTimes(5);
    });

    it('should handle multiple terminals concurrently', async () => {
      const repository = createMockRepositoryWithWorktreeSessions({ id: 'repository-1' }, 3);
      useAppStore.getState().addRepository(repository);

      // Spawn all terminals
      const hooks = repository.worktreeSessions.map((session) =>
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

      expect(window.terminal.spawn).toHaveBeenCalledTimes(3);
      expect(useAppStore.getState().terminals.size).toBe(3);

      // Kill all terminals
      await act(async () => {
        await Promise.all(hooks.map((h) => h.result.current.kill()));
      });

      expect(window.terminal.kill).toHaveBeenCalledTimes(3);
      expect(useAppStore.getState().terminals.size).toBe(0);
    });

    it('should handle terminal state detection with IPC data', async () => {
      let capturedDataHandler: ((data: string) => void) | null = null;
      vi.mocked(window.terminal.onData).mockImplementation((sid, handler) => {
        capturedDataHandler = handler;
        return vi.fn();
      });

      useAppStore.getState().registerTerminal('session-1');

      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      // Setup data listener
      const dataCallback = vi.fn();
      act(() => {
        result.current.onData(dataCallback);
      });

      expect(capturedDataHandler).not.toBeNull();

      // Simulate data from terminal
      act(() => {
        capturedDataHandler!('Some output text');
      });

      expect(dataCallback).toHaveBeenCalledWith('Some output text');
    });
  });

  describe('error handling and recovery', () => {
    it('should recover from terminal spawn failure', async () => {
      vi.mocked(window.terminal.spawn).mockRejectedValueOnce(new Error('Spawn failed'));

      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      await act(async () => {
        await result.current.spawn();
      });

      // Terminal should still be registered and status should be 'error'
      expect(useAppStore.getState().terminals.has('session-1')).toBe(true);
      expect(useAppStore.getState().terminals.get('session-1')?.status).toBe('error');
    });

    it('should recover from terminal kill failure', async () => {
      vi.mocked(window.terminal.kill).mockRejectedValueOnce(new Error('Kill failed'));

      useAppStore.getState().registerTerminal('session-1');

      const { result } = renderHook(() =>
        useTerminal({
          sessionId: 'session-1',
          cwd: '/test/path',
        })
      );

      await expect(
        act(async () => {
          await result.current.kill();
        })
      ).rejects.toThrow('Kill failed');
    });

    it('should handle storage save failure gracefully', async () => {
      useAppStore.setState({ isInitialized: true });
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(window.storage.saveState).mockRejectedValueOnce(new Error('Save failed'));

      // Should not throw
      useAppStore.getState().addRepository(createMockRepository({ id: 'repository-1' }));

      // Give async operation time to complete
      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle watcher listener setup failure gracefully', () => {
      // Test that unsubscribe functions are called correctly even if some fail
      const unsubAdded = vi.fn();
      const unsubRemoved = vi.fn();
      vi.mocked(window.watcher.onWorktreeAdded).mockReturnValue(unsubAdded);
      vi.mocked(window.watcher.onWorktreeRemoved).mockReturnValue(unsubRemoved);

      useAppStore.setState({ isInitialized: true });
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.getState().addRepository(repository);

      const { unmount } = renderHook(() => useWorktreeWatchers());

      // Unmount should call unsubscribe functions
      unmount();

      expect(unsubAdded).toHaveBeenCalled();
      expect(unsubRemoved).toHaveBeenCalled();
    });
  });
});
