import { useAppStore } from '@/stores/appStore';
import { useWorkspaceStore } from '@/features/workspace/store';
import { getDefaultAppState } from '../src/shared/types';
import type { Repository, WorktreeSession, AppSettings, AppState } from '../src/shared/types';

/**
 * Reset all Zustand stores to their initial state.
 * Call this in beforeEach() to ensure test isolation.
 */
export function resetAllStores(): void {
  const defaultState = getDefaultAppState();

  // Reset appStore to initial state
  useAppStore.setState({
    ...defaultState,
    terminals: new Map(),
    terminalsVersion: 0,
    activeTerminalId: null,
    activeTabId: null,
    activeUserTabId: null,
    worktreeTabs: [],
    userTerminalTabs: [],
    isInitialized: false,
  });

  // Reset workspaceStore to initial state
  useWorkspaceStore.setState({
    activeTab: 'task-1',
    tabs: ['task-1', 'task-2'],
    taskStates: {
      'task-1': { content: '' },
      'task-2': { content: '' },
    },
  });
}

/**
 * Create a mock repository for testing.
 */
export function createMockRepository(overrides: Partial<Repository> = {}): Repository {
  const id = overrides.id || `repository-${Date.now()}`;
  return {
    id,
    name: overrides.name || 'Test Repository',
    path: overrides.path || `/test/path/${id}`,
    isBare: overrides.isBare ?? false,
    isExpanded: overrides.isExpanded ?? false,
    worktreeSessions: overrides.worktreeSessions || [],
    createdAt: overrides.createdAt || new Date().toISOString(),
    scriptsConfig: overrides.scriptsConfig,
    portRangeStart: overrides.portRangeStart,
  };
}

/**
 * Create a mock worktree session for testing.
 */
export function createMockWorktreeSession(
  overrides: Partial<WorktreeSession> = {}
): WorktreeSession {
  const id = overrides.id || `session-${Date.now()}`;
  return {
    id,
    label: overrides.label || 'Test Worktree Session',
    path: overrides.path || `/test/path/${id}`,
    branchName: overrides.branchName,
    worktreeName: overrides.worktreeName,
    createdAt: overrides.createdAt || new Date().toISOString(),
    isExternal: overrides.isExternal ?? false,
    customShortcut: overrides.customShortcut,
    portOffset: overrides.portOffset,
  };
}

/**
 * Create a mock repository with worktree sessions for testing.
 */
export function createMockRepositoryWithWorktreeSessions(
  repositoryOverrides: Partial<Repository> = {},
  worktreeSessionCount = 1
): Repository {
  const repositoryId = repositoryOverrides.id || `repository-${Date.now()}`;
  const worktreeSessions: WorktreeSession[] = [];

  for (let i = 0; i < worktreeSessionCount; i++) {
    worktreeSessions.push(
      createMockWorktreeSession({
        id: `session-${repositoryId}-${i}`,
        label: `Worktree ${i}`,
        path: `/test/path/${repositoryId}/worktree-${i}`,
      })
    );
  }

  return createMockRepository({
    ...repositoryOverrides,
    id: repositoryId,
    worktreeSessions,
  });
}

/**
 * Wait for next tick (useful for async state updates).
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a specified number of milliseconds.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create mock app settings with default values.
 * Use this when you need to create settings for tests to ensure all required fields are included.
 */
export function createMockSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  const defaultState = getDefaultAppState();
  return {
    ...defaultState.settings,
    ...overrides,
  };
}

/**
 * Create mock app state with default values.
 * Use this when you need to create a full AppState for tests.
 */
export function createMockAppState(overrides: Partial<AppState> = {}): AppState {
  const defaultState = getDefaultAppState();
  return {
    ...defaultState,
    ...overrides,
    settings: {
      ...defaultState.settings,
      ...(overrides.settings || {}),
    },
    window: {
      ...defaultState.window,
      ...(overrides.window || {}),
    },
  };
}
