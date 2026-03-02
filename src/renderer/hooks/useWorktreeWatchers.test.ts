import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useWorktreeWatchers } from './useWorktreeWatchers';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';
import type { WorktreeInfo } from '../../shared/types';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

/**
 * Helper to create a mock WorktreeInfo object.
 */
function createMockWorktree(overrides: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    path: overrides.path || '/test/worktree',
    branch: overrides.branch || 'feature-branch',
    head: overrides.head || 'abc123',
    isMain: overrides.isMain ?? false,
    isBare: overrides.isBare ?? false,
    isLocked: overrides.isLocked ?? false,
    prunable: overrides.prunable ?? false,
  };
}

describe('useWorktreeWatchers', () => {
  // Capture event handlers
  let capturedWorktreeAddedHandler:
    | ((repositoryId: string, worktree: WorktreeInfo) => void)
    | null = null;
  let capturedWorktreeRemovedHandler:
    | ((repositoryId: string, worktreePath: string, isExternal: boolean) => void)
    | null = null;
  let capturedRepositoryDeletedHandler: ((repositoryId: string, repoPath: string) => void) | null =
    null;
  let unsubAdded: ReturnType<typeof vi.fn>;
  let unsubRemoved: ReturnType<typeof vi.fn>;
  let unsubDeleted: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    // Reset captured handlers
    capturedWorktreeAddedHandler = null;
    capturedWorktreeRemovedHandler = null;
    capturedRepositoryDeletedHandler = null;

    // Create unsubscribe mocks
    unsubAdded = vi.fn();
    unsubRemoved = vi.fn();
    unsubDeleted = vi.fn();

    // Capture event handlers when registered
    vi.mocked(window.watcher.onWorktreeAdded).mockImplementation((handler) => {
      capturedWorktreeAddedHandler = handler;
      return unsubAdded as unknown as () => void;
    });

    vi.mocked(window.watcher.onWorktreeRemoved).mockImplementation((handler) => {
      capturedWorktreeRemovedHandler = handler;
      return unsubRemoved as unknown as () => void;
    });

    vi.mocked(window.watcher.onRepositoryDeleted).mockImplementation((handler) => {
      capturedRepositoryDeletedHandler = handler;
      return unsubDeleted as unknown as () => void;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('does not start watchers when not initialized', () => {
      const repository = createMockRepository({ id: 'repository-1' });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: false,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).not.toHaveBeenCalled();
      expect(window.watcher.onWorktreeAdded).not.toHaveBeenCalled();
      expect(window.watcher.onWorktreeRemoved).not.toHaveBeenCalled();
    });

    it('starts watchers for repositories when initialized', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith(
        'repository-1',
        '/test/repository'
      );
    });

    // Note: All repositories are git repos now, so "non-git" tests are no longer applicable

    it('sets up event listeners when initialized', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.onWorktreeAdded).toHaveBeenCalledTimes(1);
      expect(window.watcher.onWorktreeRemoved).toHaveBeenCalledTimes(1);
      expect(window.watcher.onRepositoryDeleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('watching multiple repositories', () => {
    it('starts watchers for all repositories', () => {
      const repository1 = createMockRepository({
        id: 'repo-1',
        path: '/test/repo1',
      });
      const repository2 = createMockRepository({
        id: 'repo-2',
        path: '/test/repo2',
      });
      const repository3 = createMockRepository({ id: 'repo-3', path: '/test/repo3' });

      useAppStore.setState({
        repositories: [repository1, repository2, repository3],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(3);
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('repo-1', '/test/repo1');
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('repo-2', '/test/repo2');
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('repo-3', '/test/repo3');
    });

    it('does not restart watcher for already watched repository', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const { rerender } = renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(1);

      // Trigger re-render without changing repositories
      rerender();

      // Should not start again
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('repository changes', () => {
    it('starts watcher when new git repository is added', () => {
      const initialRepository = createMockRepository({
        id: 'repository-1',

        path: '/test/r1',
      });
      useAppStore.setState({
        repositories: [initialRepository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(1);

      // Add new repository
      const newRepository = createMockRepository({
        id: 'repository-2',

        path: '/test/r2',
      });
      act(() => {
        useAppStore.setState({
          repositories: [initialRepository, newRepository],
        });
      });

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(2);
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('repository-2', '/test/r2');
    });

    it('stops watcher when git repository is removed', () => {
      const repository1 = createMockRepository({
        id: 'repository-1',

        path: '/test/r1',
      });
      const repository2 = createMockRepository({
        id: 'repository-2',

        path: '/test/r2',
      });
      useAppStore.setState({
        repositories: [repository1, repository2],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(2);

      // Remove repository-1
      act(() => {
        useAppStore.setState({
          repositories: [repository2],
        });
      });

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
    });

    // Note: repositories cannot become non-git now, so that test case is no longer applicable
  });

  describe('onWorktreeAdded event', () => {
    it('adds session when worktree is discovered', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        path: '/test/repository',
        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      // Simulate worktree added event
      const worktree = createMockWorktree({
        path: '/test/repository/worktrees/feature',
        branch: 'feature-branch',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      expect(addWorktreeSessionSpy).toHaveBeenCalledWith(
        'repository-1',
        expect.objectContaining({
          label: 'feature-branch',
          path: '/test/repository/worktrees/feature',
          branchName: 'feature-branch',
          worktreeName: 'feature',
          isExternal: true,
        })
      );
    });

    it('does not add session if repository does not exist', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree();

      act(() => {
        capturedWorktreeAddedHandler?.('nonexistent-repository', worktree);
      });

      expect(addWorktreeSessionSpy).not.toHaveBeenCalled();
    });

    it('does not add session if session with same path already exists', () => {
      const existingSession = createMockWorktreeSession({
        id: 'existing-session',
        path: '/test/repository/worktrees/feature',
      });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [existingSession],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree({
        path: '/test/repository/worktrees/feature',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      expect(addWorktreeSessionSpy).not.toHaveBeenCalled();
    });

    it('uses branch name as worktreeName when path ends with empty string', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      // Path ending with slash would give empty string from split('/').pop()
      const worktree = createMockWorktree({
        path: '/test/repository/worktrees/feature/',
        branch: 'fallback-branch',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      // Since the path ends with '/', split('/').pop() returns '', so branch is used
      expect(addWorktreeSessionSpy).toHaveBeenCalledWith(
        'repository-1',
        expect.objectContaining({
          worktreeName: 'fallback-branch',
        })
      );
    });

    it('generates unique session IDs', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree1 = createMockWorktree({
        path: '/test/worktree1',
        branch: 'branch1',
      });
      const worktree2 = createMockWorktree({
        path: '/test/worktree2',
        branch: 'branch2',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree1);
      });

      // Update state to include first session
      const firstSession = addWorktreeSessionSpy.mock.calls[0][1];
      act(() => {
        useAppStore.setState({
          repositories: [{ ...repository, worktreeSessions: [firstSession] }],
        });
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree2);
      });

      const firstId = addWorktreeSessionSpy.mock.calls[0][1].id;
      const secondId = addWorktreeSessionSpy.mock.calls[1][1].id;

      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();
      expect(firstId).not.toBe(secondId);
    });

    it('sets createdAt timestamp on new session', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree();

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      const session = addWorktreeSessionSpy.mock.calls[0][1];
      expect(session.createdAt).toBeDefined();
      // Check it's a valid ISO date string
      expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
    });

    it('logs when adding session for discovered worktree', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree({
        branch: 'new-feature',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useWorktreeWatchers] Adding session for discovered worktree: new-feature'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('onWorktreeRemoved event', () => {
    it('removes session when worktree is deleted', () => {
      const session = createMockWorktreeSession({
        id: 'session-1',
        path: '/test/repository/worktrees/feature',
      });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const removeWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'removeWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedWorktreeRemovedHandler?.(
          'repository-1',
          '/test/repository/worktrees/feature',
          false
        );
      });

      expect(removeWorktreeSessionSpy).toHaveBeenCalledWith('repository-1', 'session-1');
    });

    it('does not remove session if repository does not exist', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      const removeWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'removeWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedWorktreeRemovedHandler?.('nonexistent-repository', '/some/path', false);
      });

      expect(removeWorktreeSessionSpy).not.toHaveBeenCalled();
    });

    it('does not remove session if no session matches the path', () => {
      const session = createMockWorktreeSession({
        id: 'session-1',
        path: '/test/repository/worktrees/feature',
      });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const removeWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'removeWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedWorktreeRemovedHandler?.('repository-1', '/different/path', false);
      });

      expect(removeWorktreeSessionSpy).not.toHaveBeenCalled();
    });

    it('logs when removing session for deleted worktree', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const session = createMockWorktreeSession({
        id: 'session-1',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedWorktreeRemovedHandler?.('repository-1', '/test/worktree', false);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useWorktreeWatchers] Removing session for deleted worktree: /test/worktree'
      );

      consoleSpy.mockRestore();
    });

    it('shows toast when worktree is deleted externally', () => {
      const session = createMockWorktreeSession({
        id: 'session-1',
        label: 'feature-branch',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedWorktreeRemovedHandler?.('repository-1', '/test/worktree', true);
      });

      expect(toast.info).toHaveBeenCalledWith('Worktree "feature-branch" was removed', {
        description: 'The folder was deleted from outside the application.',
        duration: 5000,
      });
    });

    it('does not show toast when worktree is deleted internally', () => {
      const session = createMockWorktreeSession({
        id: 'session-1',
        label: 'feature-branch',
        path: '/test/worktree',
      });
      const repository = createMockRepository({
        id: 'repository-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      vi.mocked(toast.info).mockClear();

      act(() => {
        capturedWorktreeRemovedHandler?.('repository-1', '/test/worktree', false);
      });

      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe('onRepositoryDeleted event', () => {
    it('removes repository when folder is deleted externally', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'My Project',
        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const removeRepositorySpy = vi.spyOn(useAppStore.getState(), 'removeRepository');

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedRepositoryDeletedHandler?.('repository-1', '/test/repository');
      });

      expect(removeRepositorySpy).toHaveBeenCalledWith('repository-1');
    });

    it('shows toast notification with repository name', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'My Project',
        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedRepositoryDeletedHandler?.('repository-1', '/test/repository');
      });

      expect(toast.info).toHaveBeenCalledWith('Repository "My Project" was removed', {
        description: 'The folder was deleted from outside the application.',
        duration: 5000,
      });
    });

    it('stops watcher for deleted repository', () => {
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'My Project',
        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedRepositoryDeletedHandler?.('repository-1', '/test/repository');
      });

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
    });

    it('ignores deletion event for unknown repository', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      const removeRepositorySpy = vi.spyOn(useAppStore.getState(), 'removeRepository');

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedRepositoryDeletedHandler?.('nonexistent-repository', '/some/path');
      });

      expect(removeRepositorySpy).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('logs when repository folder is deleted externally', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const repository = createMockRepository({
        id: 'repository-1',
        name: 'My Project',
        path: '/test/repository',
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      act(() => {
        capturedRepositoryDeletedHandler?.('repository-1', '/test/repository');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useWorktreeWatchers] Repository folder deleted externally: /test/repository'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from events on unmount', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      const { unmount } = renderHook(() => useWorktreeWatchers());

      unmount();

      expect(unsubAdded).toHaveBeenCalledTimes(1);
      expect(unsubRemoved).toHaveBeenCalledTimes(1);
      expect(unsubDeleted).toHaveBeenCalledTimes(1);
    });

    it('stops all watchers on unmount', () => {
      const repository1 = createMockRepository({ id: 'repository-1', path: '/p1' });
      const repository2 = createMockRepository({ id: 'repository-2', path: '/p2' });
      useAppStore.setState({
        repositories: [repository1, repository2],
        isInitialized: true,
      });

      const { unmount } = renderHook(() => useWorktreeWatchers());

      unmount();

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-1');
      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledWith('repository-2');
    });

    it('clears watched repositories ref on unmount', () => {
      const repository = createMockRepository({ id: 'repository-1', path: '/p1' });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const { unmount } = renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(1);

      unmount();

      // Remount and check watcher is started again (ref was cleared)
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      // Should start watching again since ref was cleared
      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(2);
    });

    it('does not unsubscribe from events when not initialized', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: false,
      });

      const { unmount } = renderHook(() => useWorktreeWatchers());

      unmount();

      // Events were never subscribed to, so unsubscribe won't be called
      expect(unsubAdded).not.toHaveBeenCalled();
      expect(unsubRemoved).not.toHaveBeenCalled();
      expect(unsubDeleted).not.toHaveBeenCalled();
    });
  });

  describe('initialization state changes', () => {
    it('sets up watchers when isInitialized becomes true', () => {
      const repository = createMockRepository({ id: 'repository-1', path: '/test' });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: false,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).not.toHaveBeenCalled();
      expect(window.watcher.onWorktreeAdded).not.toHaveBeenCalled();

      // Now set initialized
      act(() => {
        useAppStore.setState({ isInitialized: true });
      });

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledWith('repository-1', '/test');
      expect(window.watcher.onWorktreeAdded).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles empty repositories array', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      expect(window.watcher.startRepositoryWatch).not.toHaveBeenCalled();
    });

    it('handles repository with empty sessions array', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree({ path: '/new/worktree', branch: 'new-branch' });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      // Should add session successfully
      const state = useAppStore.getState();
      const updatedRepository = state.repositories.find((p) => p.id === 'repository-1');
      expect(updatedRepository?.worktreeSessions.length).toBe(1);
    });

    it('handles multiple repositories with same path sessions', () => {
      const session = createMockWorktreeSession({ path: '/shared/path' });
      const repository1 = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [session],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository1, repository2],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      // Adding worktree to project-2 with same path should work
      const worktree = createMockWorktree({ path: '/shared/path' });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-2', worktree);
      });

      const state = useAppStore.getState();
      const updatedRepository2 = state.repositories.find((p) => p.id === 'repository-2');
      expect(updatedRepository2?.worktreeSessions.length).toBe(1);
    });

    it('handles worktree with special characters in path', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree({
        path: '/test/path with spaces/and-dashes/feature_branch',
        branch: 'feature/special-branch',
      });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      expect(addWorktreeSessionSpy).toHaveBeenCalledWith(
        'repository-1',
        expect.objectContaining({
          path: '/test/path with spaces/and-dashes/feature_branch',
          worktreeName: 'feature_branch',
        })
      );
    });

    it('handles rapid repository additions and removals', () => {
      useAppStore.setState({
        repositories: [],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      // Add multiple repositories rapidly
      for (let i = 0; i < 5; i++) {
        const repository = createMockRepository({
          id: `repository-${i}`,

          path: `/test/p${i}`,
        });
        act(() => {
          useAppStore.setState({
            repositories: [...useAppStore.getState().repositories, repository],
          });
        });
      }

      expect(window.watcher.startRepositoryWatch).toHaveBeenCalledTimes(5);

      // Remove all repositories rapidly
      for (let i = 4; i >= 0; i--) {
        act(() => {
          useAppStore.setState({
            repositories: useAppStore
              .getState()
              .repositories.filter((p) => p.id !== `repository-${i}`),
          });
        });
      }

      expect(window.watcher.stopRepositoryWatch).toHaveBeenCalledTimes(5);
    });

    it('handles concurrent worktree events for different repositories', () => {
      const repository1 = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      const repository2 = createMockRepository({
        id: 'repository-2',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository1, repository2],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      const worktree1 = createMockWorktree({ path: '/p1/worktree', branch: 'branch1' });
      const worktree2 = createMockWorktree({ path: '/p2/worktree', branch: 'branch2' });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree1);
        capturedWorktreeAddedHandler?.('repository-2', worktree2);
      });

      const state = useAppStore.getState();
      expect(state.repositories.find((p) => p.id === 'repository-1')?.worktreeSessions.length).toBe(
        1
      );
      expect(state.repositories.find((p) => p.id === 'repository-2')?.worktreeSessions.length).toBe(
        1
      );
    });
  });

  describe('generateId function', () => {
    it('generates IDs with timestamp and random suffix', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      renderHook(() => useWorktreeWatchers());

      const worktree = createMockWorktree();

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      const sessionId = addWorktreeSessionSpy.mock.calls[0][1].id;
      // ID format is timestamp-randomstring
      expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('state access patterns', () => {
    it('uses fresh state when handling events', () => {
      const repository = createMockRepository({
        id: 'repository-1',

        worktreeSessions: [],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      renderHook(() => useWorktreeWatchers());

      // Add a session directly to store
      const existingSession = createMockWorktreeSession({
        id: 'existing',
        path: '/test/worktree',
      });
      act(() => {
        useAppStore.setState({
          repositories: [{ ...repository, worktreeSessions: [existingSession] }],
        });
      });

      const addWorktreeSessionSpy = vi.spyOn(useAppStore.getState(), 'addWorktreeSession');

      // Try to add worktree with same path - should check fresh state
      const worktree = createMockWorktree({ path: '/test/worktree' });

      act(() => {
        capturedWorktreeAddedHandler?.('repository-1', worktree);
      });

      // Should not add because session already exists in fresh state
      expect(addWorktreeSessionSpy).not.toHaveBeenCalled();
    });
  });
});
