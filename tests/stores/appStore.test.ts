import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, prStatusMapEqual } from '@/stores/appStore';
import type {
  WorktreeSession,
  Repository,
  CustomShortcut,
  PRStatusMap,
} from '../../src/shared/types';

// Helper to create a CustomShortcut
function createShortcut(key: string, modifiers?: Partial<CustomShortcut>): CustomShortcut {
  return {
    key,
    ctrlKey: modifiers?.ctrlKey ?? true,
    shiftKey: modifiers?.shiftKey ?? true,
    altKey: modifiers?.altKey ?? false,
    metaKey: modifiers?.metaKey ?? false,
  };
}

// Helper to create mock sessions
function createWorktreeSession(id: string, customShortcut?: CustomShortcut): WorktreeSession {
  return {
    id,
    label: `Session ${id}`,
    path: `/test/path/${id}`,
    branchName: `branch-${id}`,
    createdAt: new Date().toISOString(),
    isExternal: false,
    customShortcut,
  };
}

// Helper to create mock repositories
function createRepository(id: string, worktreeSessions: WorktreeSession[]): Repository {
  return {
    id,
    name: `Repository ${id}`,
    path: `/test/repository/${id}`,

    isBare: false,
    isExpanded: true,
    worktreeSessions,
    createdAt: new Date().toISOString(),
  };
}

describe('appStore - shortcut functionality', () => {
  beforeEach(() => {
    // Reset store to clean state
    useAppStore.setState({
      repositories: [],
      terminals: new Map(),
      activeTerminalId: null,
      isInitialized: true,
      settings: {
        theme: 'dark',
        worktreeBasePath: null,
        gitPollIntervalMs: 5000,
      },
      window: {
        width: 1400,
        height: 900,
        x: 100,
        y: 100,
        isMaximized: false,
        sidebarWidth: 280,
      },
      version: 1,
    });
  });

  describe('updateWorktreeSessionShortcut', () => {
    it('sets custom shortcut on a session', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      const shortcut = createShortcut('5');

      useAppStore.setState({ repositories: [project] });

      useAppStore.getState().updateWorktreeSessionShortcut('s1', shortcut);

      const updatedSession = useAppStore.getState().getWorktreeSessionById('s1');
      expect(updatedSession?.customShortcut).toEqual(shortcut);
    });

    it('removes custom shortcut when set to undefined', () => {
      const shortcut = createShortcut('5');
      const session = createWorktreeSession('s1', shortcut);
      const project = createRepository('p1', [session]);

      useAppStore.setState({ repositories: [project] });

      useAppStore.getState().updateWorktreeSessionShortcut('s1', undefined);

      const updatedSession = useAppStore.getState().getWorktreeSessionById('s1');
      expect(updatedSession?.customShortcut).toBeUndefined();
    });

    it('updates correct session across multiple projects', () => {
      const session1 = createWorktreeSession('s1');
      const session2 = createWorktreeSession('s2');
      const session3 = createWorktreeSession('s3');
      const project1 = createRepository('p1', [session1, session2]);
      const project2 = createRepository('p2', [session3]);
      const shortcut = createShortcut('9');

      useAppStore.setState({ repositories: [project1, project2] });

      useAppStore.getState().updateWorktreeSessionShortcut('s3', shortcut);

      // s1 and s2 should not be affected
      expect(useAppStore.getState().getWorktreeSessionById('s1')?.customShortcut).toBeUndefined();
      expect(useAppStore.getState().getWorktreeSessionById('s2')?.customShortcut).toBeUndefined();
      // s3 should have the new shortcut
      expect(useAppStore.getState().getWorktreeSessionById('s3')?.customShortcut).toEqual(shortcut);
    });

    it('calls persistState after updating shortcut', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      const shortcut = createShortcut('3');

      useAppStore.setState({ repositories: [project] });

      // saveState should be called
      const saveStateMock = vi.mocked(window.storage.saveState);
      saveStateMock.mockClear();

      useAppStore.getState().updateWorktreeSessionShortcut('s1', shortcut);

      expect(saveStateMock).toHaveBeenCalled();
    });
  });

  describe('getWorktreeSessionById', () => {
    it('returns session from first project', () => {
      const shortcut = createShortcut('1');
      const session = createWorktreeSession('s1', shortcut);
      const project = createRepository('p1', [session]);

      useAppStore.setState({ repositories: [project] });

      const result = useAppStore.getState().getWorktreeSessionById('s1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('s1');
      expect(result?.customShortcut).toEqual(shortcut);
    });

    it('returns session from second project', () => {
      const session1 = createWorktreeSession('s1');
      const shortcut = createShortcut('2');
      const session2 = createWorktreeSession('s2', shortcut);
      const project1 = createRepository('p1', [session1]);
      const project2 = createRepository('p2', [session2]);

      useAppStore.setState({ repositories: [project1, project2] });

      const result = useAppStore.getState().getWorktreeSessionById('s2');
      expect(result).toBeDefined();
      expect(result?.id).toBe('s2');
      expect(result?.customShortcut).toEqual(shortcut);
    });

    it('returns undefined for non-existent session', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);

      useAppStore.setState({ repositories: [project] });

      const result = useAppStore.getState().getWorktreeSessionById('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('shortcut conflicts', () => {
    it('allows assigning same shortcut to different sessions (custom overrides default)', () => {
      // This test verifies that the store allows setting shortcuts
      // Conflict resolution is handled in the UI layer (AssignShortcutDialog)
      const session1 = createWorktreeSession('s1');
      const session2 = createWorktreeSession('s2');
      const project = createRepository('p1', [session1, session2]);
      const shortcut = createShortcut('1');

      useAppStore.setState({ repositories: [project] });

      // Assign Ctrl+Shift+1 to session2 (even though session1 would be default)
      useAppStore.getState().updateWorktreeSessionShortcut('s2', shortcut);

      const updated = useAppStore.getState().getWorktreeSessionById('s2');
      expect(updated?.customShortcut).toEqual(shortcut);
    });
  });
});

describe('prStatusMapEqual', () => {
  it('returns true for identical maps', () => {
    const map1: PRStatusMap = {
      'feature-branch': {
        headRefName: 'feature-branch',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    const map2: PRStatusMap = {
      'feature-branch': {
        headRefName: 'feature-branch',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    expect(prStatusMapEqual(map1, map2)).toBe(true);
  });

  it('returns false for different number of keys', () => {
    const map1: PRStatusMap = {
      'branch-a': {
        headRefName: 'branch-a',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    const map2: PRStatusMap = {};
    expect(prStatusMapEqual(map1, map2)).toBe(false);
  });

  it('returns false for different keys', () => {
    const map1: PRStatusMap = {
      'branch-a': {
        headRefName: 'branch-a',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    const map2: PRStatusMap = {
      'branch-b': {
        headRefName: 'branch-b',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    expect(prStatusMapEqual(map1, map2)).toBe(false);
  });

  it('returns false for different state values', () => {
    const map1: PRStatusMap = {
      'feature-branch': {
        headRefName: 'feature-branch',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: null,
        repository: 'owner/repo',
      },
    };
    const map2: PRStatusMap = {
      'feature-branch': {
        headRefName: 'feature-branch',
        state: 'MERGED',
        url: 'https://github.com/owner/repo/pull/1',
        number: 1,
        mergedAt: '2024-01-01T00:00:00Z',
        repository: 'owner/repo',
      },
    };
    expect(prStatusMapEqual(map1, map2)).toBe(false);
  });

  it('returns true for empty maps', () => {
    expect(prStatusMapEqual({}, {})).toBe(true);
  });
});
