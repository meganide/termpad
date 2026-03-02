import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  AppState,
  AppSettings,
  Repository,
  RepositoryScriptsConfig,
  WorktreeSession,
  TerminalState,
  TerminalStatus,
  GitStatus,
  CustomShortcut,
  FocusArea,
  SidebarStatusFocus,
  TerminalTab,
  WorktreeTabState,
  UserTerminalTabState,
  PRStatusMap,
  TerminalPreset,
} from '../../shared/types';
import { getDefaultAppState, NEW_TERMINAL_PRESET, CLAUDE_DEFAULT_PRESET } from '../../shared/types';
import { migrateOldShortcut, getNextAvailableShortcut } from '../utils/shortcuts';
import { normalizePath } from '../utils/worktreeUtils';

// Track pending idle notifications with their timeouts
// Key: terminalId, Value: timeout handle
const pendingIdleNotifications = new Map<string, ReturnType<typeof setTimeout>>();

// Delay before triggering idle notification (5 seconds to avoid false flickers)
const IDLE_NOTIFICATION_DELAY_MS = 5000;

// Port allocation constants
const PORT_RANGE_START = 10000; // Starting port for first repository
const PORT_RANGE_SIZE = 100; // Each repository gets 100 ports

/**
 * Finds the next available port range start for a new repository.
 * Returns the smallest multiple of PORT_RANGE_SIZE >= PORT_RANGE_START
 * that is not already in use.
 */
function getNextAvailablePortRangeStart(repositories: Repository[]): number {
  const usedRangeStarts = new Set(
    repositories.map((r) => r.portRangeStart).filter((p): p is number => p !== undefined)
  );

  let candidate = PORT_RANGE_START;
  while (usedRangeStarts.has(candidate)) {
    candidate += PORT_RANGE_SIZE;
  }
  return candidate;
}

/**
 * Finds the next available port offset within a repository's worktree sessions.
 * Returns the smallest non-negative integer not already in use.
 */
function getNextAvailablePortOffset(worktreeSessions: WorktreeSession[]): number {
  const usedOffsets = new Set(
    worktreeSessions.map((ws) => ws.portOffset).filter((p): p is number => p !== undefined)
  );

  let candidate = 0;
  while (usedOffsets.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Deep equality check for PRStatusMap.
 * Compares two maps by checking if they have the same keys and equal values.
 */
export function prStatusMapEqual(a: PRStatusMap, b: PRStatusMap): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    const statusA = a[key];
    const statusB = b[key];
    if (
      statusA.headRefName !== statusB.headRefName ||
      statusA.state !== statusB.state ||
      statusA.url !== statusB.url ||
      statusA.number !== statusB.number ||
      statusA.mergedAt !== statusB.mergedAt ||
      statusA.repository !== statusB.repository
    ) {
      return false;
    }
  }

  return true;
}

interface AppStore extends AppState {
  // Terminal runtime state (not persisted)
  terminals: Map<string, TerminalState>;
  terminalsVersion: number; // Increments on terminal changes to force re-renders
  activeTerminalId: string | null;
  isInitialized: boolean;
  // Focus state for keyboard navigation (not persisted)
  focusArea: FocusArea;
  sidebarFocusedItemId: string | null;
  sidebarStatusFocus: SidebarStatusFocus | null; // Status indicator focus within sidebar
  // Tab state per worktree (runtime-only, not persisted)
  worktreeTabs: WorktreeTabState[];
  userTerminalTabs: UserTerminalTabState[];
  activeTabId: string | null;
  // User terminal tab state (runtime - selected tab for current worktree)
  activeUserTabId: string | null;
  // Paths currently being deleted (prevents polling hooks from accessing them)
  deletingPaths: Set<string>;
  // PR status state (runtime, not persisted)
  ghCliAvailable: boolean | null; // null = not checked yet
  prStatuses: PRStatusMap;
  prStatusLoading: boolean;
  prStatusLastUpdated: number | null; // Timestamp of last successful fetch
  prStatusFetchId: number; // Increments on each fetch to detect stale responses

  // Initialization
  initialize: () => Promise<void>;

  // Repository actions
  addRepository: (repository: Repository) => void;
  removeRepository: (repositoryId: string) => Promise<void>;
  toggleRepositoryExpanded: (repositoryId: string) => void;
  setRepositoryDeleting: (repository: Repository, isDeleting: boolean) => void;
  isPathDeleting: (path: string) => boolean;
  updateRepositoryScriptsConfig: (
    repositoryId: string,
    scriptsConfig: Partial<RepositoryScriptsConfig>
  ) => void;
  reorderRepositories: (fromIndex: number, toIndex: number) => void;

  // Worktree session actions
  addWorktreeSession: (projectId: string, worktreeSession: WorktreeSession) => void;
  removeWorktreeSession: (projectId: string, worktreeSessionId: string) => void;
  updateWorktreeSessionShortcut: (
    worktreeSessionId: string,
    shortcut: CustomShortcut | undefined
  ) => void;
  reorderWorktreeSessions: (projectId: string, fromIndex: number, toIndex: number) => void;

  // Terminal actions
  setActiveTerminal: (worktreeSessionId: string | null) => void;
  updateTerminalStatus: (worktreeSessionId: string, status: TerminalStatus) => void;
  updateGitStatus: (worktreeSessionId: string, gitStatus: GitStatus | undefined) => void;
  registerTerminal: (worktreeSessionId: string) => void;
  unregisterTerminal: (worktreeSessionId: string) => void;
  startTerminal: (worktreeSessionId: string) => Promise<void>;
  recordTerminalActivity: (worktreeSessionId: string) => void;
  resetTerminalState: (worktreeSessionId: string) => void;

  // Settings actions
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Terminal preset actions
  addTerminalPreset: (preset: Omit<TerminalPreset, 'id' | 'order'>) => void;
  updateTerminalPreset: (
    presetId: string,
    updates: Partial<Omit<TerminalPreset, 'id' | 'isBuiltIn'>>
  ) => void;
  deleteTerminalPreset: (presetId: string) => void;
  reorderTerminalPresets: (presets: TerminalPreset[]) => void;
  setDefaultPresetId: (presetId: string | null) => void;

  // Window actions
  updateSidebarWidth: (width: number) => void;
  updateFileChangesPaneWidth: (width: number) => void;
  updateUserTerminalPanelRatio: (ratio: number) => void;

  // Focus actions
  setFocusArea: (area: FocusArea) => void;
  setSidebarFocusedItemId: (itemId: string | null) => void;
  setSidebarStatusFocus: (focus: SidebarStatusFocus | null) => void;

  // Tab actions
  createTab: (
    worktreeSessionId: string,
    name: string,
    command?: string,
    icon?: string
  ) => TerminalTab;
  closeTab: (tabId: string) => void;
  renameTab: (tabId: string, name: string) => void;
  reorderTabs: (worktreeSessionId: string, tabs: TerminalTab[]) => void;
  setActiveTab: (tabId: string | null) => void;
  getTabsForWorktree: (worktreeSessionId: string) => TerminalTab[];
  getTerminalIdForTab: (worktreeSessionId: string, tabId: string) => string;
  getWorktreeSessionIdFromTabId: (tabId: string) => string | null;

  // User terminal tab actions
  createUserTab: (worktreeSessionId: string, name?: string, scriptId?: string) => TerminalTab;
  findUserTabsWithScript: (
    repositoryId: string,
    scriptId: string
  ) => { worktreeSessionId: string; tab: TerminalTab }[];
  closeUserTabById: (worktreeSessionId: string, tabId: string) => void;
  closeUserTab: (tabId: string) => void;
  renameUserTab: (tabId: string, name: string) => void;
  reorderUserTabs: (worktreeSessionId: string, tabs: TerminalTab[]) => void;
  setActiveUserTab: (tabId: string | null) => void;
  getUserTabsForWorktree: (worktreeSessionId: string) => TerminalTab[];
  getUserTerminalIdForTab: (worktreeSessionId: string, tabId: string) => string;

  // Scroll position actions (for tab bars)
  updateTabScrollPosition: (worktreeSessionId: string, scrollPosition: number) => void;
  updateUserTabScrollPosition: (worktreeSessionId: string, scrollPosition: number) => void;
  getTabScrollPosition: (worktreeSessionId: string) => number;
  getUserTabScrollPosition: (worktreeSessionId: string) => number;

  // Utility
  getRepositoryByWorktreeSessionId: (worktreeSessionId: string) => Repository | undefined;
  getWorktreeSessionById: (worktreeSessionId: string) => WorktreeSession | undefined;

  // PR status actions
  setGhCliAvailable: (available: boolean) => void;
  setPRStatuses: (statuses: PRStatusMap) => void;
  setPRStatusLoading: (loading: boolean) => void;
  fetchPRStatuses: () => Promise<void>;
}

const defaultState = getDefaultAppState();

// Helper to generate unique tab ID
const generateTabId = (): string => {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to persist state to main process
const persistState = async (state: AppStore) => {
  // Don't save during initialization - prevents empty state from overwriting saved data
  if (!state.isInitialized) {
    return;
  }
  const appState: AppState = {
    version: state.version,
    settings: state.settings,
    repositories: state.repositories,
    window: state.window,
  };
  try {
    await window.storage.saveState(appState);
  } catch (error) {
    console.error('[Store] Failed to persist state:', error);
    // Show error toast with retry option
    toast.error('Failed to save settings', {
      description: 'Changes may be lost on restart.',
      duration: 10000,
      action: {
        label: 'Retry',
        onClick: () => {
          // Re-attempt save with current state
          persistState(state);
        },
      },
    });
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  // Default state from getDefaultAppState
  version: defaultState.version,
  settings: defaultState.settings,
  repositories: defaultState.repositories,
  window: defaultState.window,
  worktreeTabs: [],
  userTerminalTabs: [],
  // Runtime state (not persisted)
  terminals: new Map(),
  terminalsVersion: 0,
  activeTerminalId: null,
  activeTabId: null,
  activeUserTabId: null,
  isInitialized: false,
  gitInvalidRepositories: new Set(),
  focusArea: 'app',
  sidebarFocusedItemId: null,
  sidebarStatusFocus: null,
  deletingPaths: new Set(),
  // PR status state (runtime, not persisted)
  ghCliAvailable: null,
  prStatuses: {},
  prStatusLoading: false,
  prStatusLastUpdated: null,
  prStatusFetchId: 0,

  // Initialize store from main process storage
  initialize: async () => {
    try {
      let state = await window.storage.loadState();

      // Ensure state has required fields (handle corrupted/incomplete storage)
      if (!state.repositories) {
        console.warn('[Store] Loaded state missing repositories, using defaults');
        state = { ...getDefaultAppState(), ...state, repositories: [] };
      }

      // Check if this is a fresh load (no repositories) and localStorage has data
      // This handles migration from the old localStorage-based persistence
      if (state.repositories.length === 0) {
        const localStorageKey = 'termpad-app-state';
        const localData = localStorage.getItem(localStorageKey);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            // Support both old 'projects' and new 'repositories' keys in localStorage
            const oldRepos = parsed.state?.repositories || parsed.state?.projects;
            if (oldRepos?.length > 0) {
              console.log('[Store] Migrating from localStorage...');
              // Migrate localStorage data
              const migratedState: AppState = {
                version: 1,
                settings: parsed.state.settings || state.settings,
                repositories: oldRepos.map((p: Repository) => ({
                  ...p,
                  isBare: p.isBare ?? false,
                  worktreeSessions: p.worktreeSessions.map((s: WorktreeSession) => ({
                    ...s,
                    isExternal: s.isExternal ?? false,
                  })),
                })),
                window: parsed.state.window || state.window,
              };
              await window.storage.saveState(migratedState);
              localStorage.removeItem(localStorageKey);
              state = migratedState;
              console.log('[Store] Migration complete');
            }
          } catch (e) {
            console.error('[Store] Failed to migrate localStorage:', e);
          }
        }
      }

      // Migrate old string shortcuts to CustomShortcut objects
      let needsSave = false;
      const migratedRepositories = state.repositories.map((p: Repository) => ({
        ...p,
        worktreeSessions: p.worktreeSessions.map((s: WorktreeSession) => {
          // Check if customShortcut is a string (old format)
          if (typeof s.customShortcut === 'string') {
            needsSave = true;
            return {
              ...s,
              customShortcut: migrateOldShortcut(s.customShortcut),
            };
          }
          return s;
        }),
      }));

      if (needsSave) {
        console.log('[Store] Migrating old string shortcuts to CustomShortcut objects...');
        state = { ...state, repositories: migratedRepositories };
        await window.storage.saveState(state);
        console.log('[Store] Shortcut migration complete');
      }

      // Assign default shortcuts to worktree sessions without any customShortcut
      let shortcutMigrationNeeded = false;
      // Build up repositories with shortcuts assigned incrementally
      const repositoriesWithShortcuts: Repository[] = [];
      for (const p of state.repositories) {
        const worktreeSessionsWithShortcuts: WorktreeSession[] = [];
        for (const s of p.worktreeSessions) {
          if (!s.customShortcut) {
            shortcutMigrationNeeded = true;
            // Get next available shortcut considering already-assigned ones
            const shortcut = getNextAvailableShortcut([
              ...repositoriesWithShortcuts,
              { worktreeSessions: worktreeSessionsWithShortcuts } as Repository,
            ]);
            worktreeSessionsWithShortcuts.push({ ...s, customShortcut: shortcut });
          } else {
            worktreeSessionsWithShortcuts.push(s);
          }
        }
        repositoriesWithShortcuts.push({ ...p, worktreeSessions: worktreeSessionsWithShortcuts });
      }

      if (shortcutMigrationNeeded) {
        console.log(
          '[Store] Assigning default shortcuts to worktree sessions without shortcuts...'
        );
        state = { ...state, repositories: repositoriesWithShortcuts };
        await window.storage.saveState(state);
        console.log('[Store] Default shortcut assignment complete');
      }

      // Assign port ranges to repositories and port offsets to worktree sessions
      let portMigrationNeeded = false;
      const repositoriesWithPorts: Repository[] = [];
      for (const p of state.repositories) {
        // Assign portRangeStart if missing
        let portRangeStart = p.portRangeStart;
        if (portRangeStart === undefined) {
          portMigrationNeeded = true;
          portRangeStart = getNextAvailablePortRangeStart(repositoriesWithPorts);
        }

        // Assign portOffset to worktree sessions if missing
        const worktreeSessionsWithPorts: WorktreeSession[] = [];
        for (const s of p.worktreeSessions) {
          if (s.portOffset === undefined) {
            portMigrationNeeded = true;
            const portOffset = getNextAvailablePortOffset(worktreeSessionsWithPorts);
            worktreeSessionsWithPorts.push({ ...s, portOffset });
          } else {
            worktreeSessionsWithPorts.push(s);
          }
        }
        repositoriesWithPorts.push({
          ...p,
          portRangeStart,
          worktreeSessions: worktreeSessionsWithPorts,
        });
      }

      if (portMigrationNeeded) {
        console.log('[Store] Assigning port ranges and offsets to repositories and worktrees...');
        state = { ...state, repositories: repositoriesWithPorts };
        await window.storage.saveState(state);
        console.log('[Store] Port assignment complete');
      }

      // Migrate nonconcurrentMode to exclusiveMode in scriptsConfig
      let exclusiveModeMigrationNeeded = false;
      const repositoriesWithExclusiveMode = state.repositories.map((p: Repository) => {
        if (p.scriptsConfig && 'nonconcurrentMode' in p.scriptsConfig) {
          exclusiveModeMigrationNeeded = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { nonconcurrentMode, ...rest } = p.scriptsConfig as any;
          return {
            ...p,
            scriptsConfig: {
              ...rest,
              exclusiveMode: nonconcurrentMode,
            } as RepositoryScriptsConfig,
          };
        }
        return p;
      });

      if (exclusiveModeMigrationNeeded) {
        console.log('[Store] Migrating nonconcurrentMode to exclusiveMode...');
        state = { ...state, repositories: repositoriesWithExclusiveMode };
        await window.storage.saveState(state);
        console.log('[Store] Exclusive mode migration complete');
      }

      // Migrate existing users without terminal presets
      const hasTerminalPresets =
        state.settings?.terminalPresets && state.settings.terminalPresets.length > 0;
      if (!hasTerminalPresets) {
        console.log('[Store] Adding default terminal presets for existing user...');
        state = {
          ...state,
          settings: {
            ...state.settings,
            terminalPresets: [NEW_TERMINAL_PRESET, CLAUDE_DEFAULT_PRESET],
            defaultPresetId: null, // null = "Terminal" is default
          },
        };
        await window.storage.saveState(state);
        console.log('[Store] Terminal presets migration complete');
      }

      set({
        ...state,
        // Tab state is runtime-only, don't restore from storage
        worktreeTabs: [],
        userTerminalTabs: [],
        terminals: new Map(),
        terminalsVersion: 0,
        activeTerminalId: null,
        activeTabId: null,
        activeUserTabId: null,
        isInitialized: true,
      });
    } catch (error) {
      console.error('[Store] Failed to initialize:', error);
      toast.error('Failed to load saved data', {
        description: 'Your previous sessions may not be available. Starting with fresh settings.',
        duration: 10000,
      });
      // Reset to default state to ensure consistency
      const defaults = getDefaultAppState();
      set({
        ...defaults,
        // Runtime-only state
        worktreeTabs: [],
        userTerminalTabs: [],
        terminals: new Map(),
        terminalsVersion: 0,
        activeTerminalId: null,
        activeTabId: null,
        activeUserTabId: null,
        isInitialized: true,
      });
    }
  },

  // Repository actions
  addRepository: (repository) => {
    set((state) => {
      // Assign portRangeStart if not already set
      const portRangeStart =
        repository.portRangeStart ?? getNextAvailablePortRangeStart(state.repositories);

      // Auto-assign shortcuts and portOffset to worktree sessions
      let assignedShortcuts: { worktreeSessions: { customShortcut?: CustomShortcut }[] }[] =
        state.repositories.map((p) => ({ worktreeSessions: p.worktreeSessions }));

      // Track assigned port offsets for this repository
      const worktreeSessionsWithPortOffsets: WorktreeSession[] = [];

      const worktreeSessionsWithShortcutsAndPorts = repository.worktreeSessions.map(
        (worktreeSession) => {
          // Assign portOffset if not already set
          const portOffset =
            worktreeSession.portOffset ??
            getNextAvailablePortOffset(worktreeSessionsWithPortOffsets);

          // Assign shortcut if not already set
          let updatedWorktreeSession: WorktreeSession = { ...worktreeSession, portOffset };
          if (!worktreeSession.customShortcut) {
            const shortcut = getNextAvailableShortcut([
              ...assignedShortcuts,
              { worktreeSessions: [] },
            ]);
            updatedWorktreeSession = { ...updatedWorktreeSession, customShortcut: shortcut };
            assignedShortcuts = [
              ...assignedShortcuts,
              { worktreeSessions: [updatedWorktreeSession] },
            ];
          }

          worktreeSessionsWithPortOffsets.push(updatedWorktreeSession);
          return updatedWorktreeSession;
        }
      );

      return {
        repositories: [
          ...state.repositories,
          {
            ...repository,
            portRangeStart,
            worktreeSessions: worktreeSessionsWithShortcutsAndPorts,
          },
        ],
      };
    });
    persistState(get());
  },

  removeRepository: async (repositoryId) => {
    const state = get();
    const repository = state.repositories.find((p) => p.id === repositoryId);
    if (!repository) return;

    // Collect all terminal IDs that need to be cleaned up
    const terminalIdsToRemove: string[] = [];

    // Kill all terminals for this repository (including all tabs for each worktree)
    // and wait for them to fully exit - critical on Windows for file lock release
    for (const worktreeSession of repository.worktreeSessions) {
      const tabs = state.getTabsForWorktree(worktreeSession.id);
      for (const tab of tabs) {
        const terminalId = state.getTerminalIdForTab(worktreeSession.id, tab.id);
        terminalIdsToRemove.push(terminalId);
      }
      // Kill all terminals for this worktree and wait for them to exit
      try {
        await window.terminal.killAllForWorktree(worktreeSession.id);
      } catch {
        // No terminals running for this worktree
      }
    }

    // Clear the cached simple-git instance for this repository
    await window.terminal.clearGitCache(repository.path);

    // Stop watcher for this repository (may already be stopped by DeleteRepositoryDialog)
    await window.watcher.stopRepositoryWatch(repositoryId);

    // Get worktree session IDs to clean up
    const worktreeSessionIds = repository.worktreeSessions.map((s) => s.id);

    // Remove from state, including terminals Map and worktreeTabs cleanup
    set((state) => {
      // Clean up terminals Map - only remove terminals for this repository
      const terminals = new Map(state.terminals);
      for (const terminalId of terminalIdsToRemove) {
        terminals.delete(terminalId);
      }

      // Clean up worktreeTabs - remove entries for deleted worktrees
      const worktreeTabs = (state.worktreeTabs || []).filter(
        (wt) => !worktreeSessionIds.includes(wt.worktreeSessionId)
      );

      return {
        repositories: state.repositories.filter((p) => p.id !== repositoryId),
        terminals,
        terminalsVersion: state.terminalsVersion + 1,
        worktreeTabs,
        activeTerminalId:
          state.activeTerminalId &&
          repository.worktreeSessions.some((s) => s.id === state.activeTerminalId)
            ? null
            : state.activeTerminalId,
      };
    });

    await persistState(get());
  },

  toggleRepositoryExpanded: (repositoryId) => {
    set((state) => ({
      repositories: state.repositories.map((p) =>
        p.id === repositoryId ? { ...p, isExpanded: !p.isExpanded } : p
      ),
    }));
    persistState(get());
  },

  setRepositoryDeleting: (repository, isDeleting) => {
    set((state) => {
      const deletingPaths = new Set(state.deletingPaths);
      // Add/remove the main repo path and all worktree paths (normalized for consistent matching)
      const paths = [repository.path, ...repository.worktreeSessions.map((ws) => ws.path)];
      for (const path of paths) {
        const normalizedPath = normalizePath(path);
        if (isDeleting) {
          deletingPaths.add(normalizedPath);
        } else {
          deletingPaths.delete(normalizedPath);
        }
      }
      return { deletingPaths };
    });
  },

  isPathDeleting: (path) => {
    // Normalize path for consistent matching (handles different slash styles and casing)
    const normalized = normalizePath(path);
    return get().deletingPaths.has(normalized);
  },

  updateRepositoryScriptsConfig: (repositoryId, scriptsConfig) => {
    set((state) => ({
      repositories: state.repositories.map((p) =>
        p.id === repositoryId
          ? {
              ...p,
              scriptsConfig: {
                setupScript: null,
                runScripts: [],
                cleanupScript: null,
                exclusiveMode: false,
                lastUsedRunScriptId: null,
                ...p.scriptsConfig,
                ...scriptsConfig,
              },
            }
          : p
      ),
    }));
    persistState(get());
  },

  reorderRepositories: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      const repositories = [...state.repositories];
      const [moved] = repositories.splice(fromIndex, 1);
      repositories.splice(toIndex, 0, moved);
      return { repositories };
    });
    persistState(get());
  },

  // Worktree session actions
  addWorktreeSession: (repositoryId, worktreeSession) => {
    set((state) => {
      // Find the repository to get existing worktree sessions for port offset calculation
      const repository = state.repositories.find((p) => p.id === repositoryId);

      // Assign portOffset if not already set
      const portOffset =
        worktreeSession.portOffset ??
        (repository ? getNextAvailablePortOffset(repository.worktreeSessions) : 0);

      // Auto-assign a default shortcut if not provided
      const worktreeSessionWithShortcutAndPort: WorktreeSession = {
        ...worktreeSession,
        portOffset,
        customShortcut:
          worktreeSession.customShortcut ?? getNextAvailableShortcut(state.repositories),
      };

      return {
        repositories: state.repositories.map((p) =>
          p.id === repositoryId
            ? {
                ...p,
                worktreeSessions: [...p.worktreeSessions, worktreeSessionWithShortcutAndPort],
              }
            : p
        ),
      };
    });
    persistState(get());
  },

  removeWorktreeSession: (repositoryId, worktreeSessionId) => {
    set((state) => ({
      repositories: state.repositories.map((p) =>
        p.id === repositoryId
          ? { ...p, worktreeSessions: p.worktreeSessions.filter((s) => s.id !== worktreeSessionId) }
          : p
      ),
    }));
    persistState(get());
  },

  updateWorktreeSessionShortcut: (worktreeSessionId, shortcut) => {
    set((state) => ({
      repositories: state.repositories.map((p) => ({
        ...p,
        worktreeSessions: p.worktreeSessions.map((s) =>
          s.id === worktreeSessionId ? { ...s, customShortcut: shortcut } : s
        ),
      })),
    }));
    persistState(get());
  },

  reorderWorktreeSessions: (repositoryId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    // Guard: prevent reordering main worktree or moving above it
    const state = get();
    const repository = state.repositories.find((r) => r.id === repositoryId);
    if (repository) {
      const sourceSession = repository.worktreeSessions[fromIndex];
      const targetSession = repository.worktreeSessions[toIndex];
      // Don't move main worktree
      if (sourceSession?.isMainWorktree) return;
      // Don't move anything to index 0 if main worktree is there
      if (toIndex === 0 && repository.worktreeSessions[0]?.isMainWorktree) return;
      // Don't move anything above main worktree (if dragging to its position)
      if (targetSession?.isMainWorktree) return;
    }
    set((state) => ({
      repositories: state.repositories.map((p) => {
        if (p.id !== repositoryId) return p;
        const worktreeSessions = [...p.worktreeSessions];
        const [moved] = worktreeSessions.splice(fromIndex, 1);
        worktreeSessions.splice(toIndex, 0, moved);
        return { ...p, worktreeSessions };
      }),
    }));
    persistState(get());
  },

  // Terminal actions
  setActiveTerminal: (worktreeSessionId) => {
    // When switching worktrees, restore that worktree's activeTabId (for both claude and user terminals)
    const state = get();
    let activeTabIdToRestore: string | null = null;
    let activeUserTabIdToRestore: string | null = null;

    if (worktreeSessionId) {
      const worktreeTabState = (state.worktreeTabs || []).find(
        (wt) => wt.worktreeSessionId === worktreeSessionId
      );
      if (worktreeTabState) {
        activeTabIdToRestore = worktreeTabState.activeTabId;
      }

      const userTerminalTabState = (state.userTerminalTabs || []).find(
        (ut) => ut.worktreeSessionId === worktreeSessionId
      );
      if (userTerminalTabState) {
        activeUserTabIdToRestore = userTerminalTabState.activeTabId;
      }
    }

    set({
      activeTerminalId: worktreeSessionId,
      activeTabId: activeTabIdToRestore,
      activeUserTabId: activeUserTabIdToRestore,
    });
  },

  updateTerminalStatus: (terminalId, status) => {
    const state = get();
    const existing = state.terminals.get(terminalId);
    const previousStatus = existing?.status;

    // Extract worktree session ID and tab ID from terminal ID
    // Terminal ID format is either "worktreeSessionId" (legacy) or "worktreeSessionId:tabId" (tab model)
    const colonIndex = terminalId.indexOf(':');
    const actualWorktreeSessionId = colonIndex >= 0 ? terminalId.slice(0, colonIndex) : terminalId;
    const tabId = colonIndex >= 0 ? terminalId.slice(colonIndex + 1) : undefined;

    // Cancel any pending idle notification when status changes
    const pendingTimeout = pendingIdleNotifications.get(terminalId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingIdleNotifications.delete(terminalId);
    }

    // Helper to trigger notification
    const triggerNotification = (notificationStatus: TerminalStatus) => {
      const currentState = get();
      const repository = currentState.getRepositoryByWorktreeSessionId(actualWorktreeSessionId);
      const worktreeSession = currentState.getWorktreeSessionById(actualWorktreeSessionId);
      if (repository && worktreeSession) {
        console.log(
          '[Store] Triggering notification for:',
          repository.name,
          worktreeSession.branchName,
          'status:',
          notificationStatus,
          'tabId:',
          tabId
        );
        window.notifications.trigger({
          worktreeSessionId: actualWorktreeSessionId,
          repositoryName: repository.name,
          branchName: worktreeSession.branchName,
          state: notificationStatus,
          tabId,
        });
      }
    };

    // Determine if we should notify
    // Immediate notifications: 'error' only
    // Delayed notifications: 'waiting', 'idle' (5s delay to avoid flicker spam)
    //   - idle: only from running/waiting (not from starting/stopped)
    //   - waiting: from any state
    const baseNotificationConditions =
      state.settings.notifications.enabled &&
      previousStatus !== status &&
      existing?.hasReceivedOutput &&
      (!state.settings.notifications.backgroundOnly || !document.hasFocus());

    const immediateNotifiableStates: TerminalStatus[] = ['error'];
    const shouldNotifyImmediately =
      baseNotificationConditions && immediateNotifiableStates.includes(status);

    // For idle: only notify if transitioning from running or waiting (not from starting/stopped)
    const idleNotifiableFromStates: TerminalStatus[] = ['running', 'waiting'];
    const shouldScheduleIdleNotification =
      baseNotificationConditions &&
      status === 'idle' &&
      previousStatus !== undefined &&
      idleNotifiableFromStates.includes(previousStatus);

    // For waiting: notify from any state (after delay)
    const shouldScheduleWaitingNotification = baseNotificationConditions && status === 'waiting';

    // Debug logging for notification decision
    const allNotifiableStates: TerminalStatus[] = ['waiting', 'error', 'idle'];
    if (allNotifiableStates.includes(status) && previousStatus !== status) {
      console.log('[Store] Notification check:', {
        terminalId,
        actualWorktreeSessionId,
        tabId,
        status,
        previousStatus,
        enabled: state.settings.notifications.enabled,
        hasReceivedOutput: existing?.hasReceivedOutput,
        backgroundOnly: state.settings.notifications.backgroundOnly,
        hasFocus: document.hasFocus(),
        shouldNotifyImmediately,
        shouldScheduleIdleNotification,
        shouldScheduleWaitingNotification,
      });
    }

    // Trigger immediate notification for error
    if (shouldNotifyImmediately) {
      triggerNotification(status);
    }

    // Schedule delayed notification for waiting/idle (5s delay to avoid flicker spam)
    const delayedNotificationStatus = shouldScheduleWaitingNotification
      ? 'waiting'
      : shouldScheduleIdleNotification
        ? 'idle'
        : null;

    if (delayedNotificationStatus) {
      const timeoutId = setTimeout(() => {
        // Check if terminal is still in the expected state before sending notification
        const currentState = get();
        const currentTerminal = currentState.terminals.get(terminalId);
        if (currentTerminal?.status === delayedNotificationStatus) {
          // Re-check background conditions at notification time
          const shouldStillNotify =
            currentState.settings.notifications.enabled &&
            (!currentState.settings.notifications.backgroundOnly || !document.hasFocus());
          if (shouldStillNotify) {
            console.log(
              `[Store] Delayed ${delayedNotificationStatus} notification triggered after 5s for:`,
              terminalId
            );
            triggerNotification(delayedNotificationStatus);
          }
        }
        pendingIdleNotifications.delete(terminalId);
      }, IDLE_NOTIFICATION_DELAY_MS);
      pendingIdleNotifications.set(terminalId, timeoutId);
    }

    set((state) => {
      const terminals = new Map(state.terminals);
      const existingTerminal = terminals.get(terminalId);
      if (existingTerminal) {
        terminals.set(terminalId, { ...existingTerminal, status });
      } else {
        // Auto-register terminal if it doesn't exist (handles app restart scenario
        // where terminals are still running but haven't been registered yet)
        terminals.set(terminalId, {
          id: terminalId,
          status,
          lastActivityTime: Date.now(),
          hasReceivedOutput: false,
        });
      }
      return { terminals, terminalsVersion: state.terminalsVersion + 1 };
    });
  },

  updateGitStatus: (worktreeSessionId, gitStatus) =>
    set((state) => {
      const terminals = new Map(state.terminals);
      const existing = terminals.get(worktreeSessionId);
      if (existing) {
        terminals.set(worktreeSessionId, { ...existing, gitStatus });
      } else {
        // Create a minimal entry for git status even if terminal isn't running
        terminals.set(worktreeSessionId, {
          id: worktreeSessionId,
          status: 'stopped',
          gitStatus,
          lastActivityTime: 0,
          hasReceivedOutput: false,
        });
      }
      return { terminals, terminalsVersion: state.terminalsVersion + 1 };
    }),

  registerTerminal: (worktreeSessionId) =>
    set((state) => {
      const terminals = new Map(state.terminals);
      // Only register if not already registered (preserve existing status)
      if (!terminals.has(worktreeSessionId)) {
        terminals.set(worktreeSessionId, {
          id: worktreeSessionId,
          status: 'starting',
          lastActivityTime: Date.now(),
          hasReceivedOutput: false,
        });
        return { terminals, terminalsVersion: state.terminalsVersion + 1 };
      }
      return {};
    }),

  unregisterTerminal: (worktreeSessionId) =>
    set((state) => {
      const terminals = new Map(state.terminals);
      if (terminals.has(worktreeSessionId)) {
        // Clear any pending notification for this terminal
        const pendingTimeout = pendingIdleNotifications.get(worktreeSessionId);
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingIdleNotifications.delete(worktreeSessionId);
        }
        terminals.delete(worktreeSessionId);
        return { terminals, terminalsVersion: state.terminalsVersion + 1 };
      }
      return {};
    }),

  startTerminal: async (worktreeSessionId) => {
    const worktreeSession = get().getWorktreeSessionById(worktreeSessionId);
    if (!worktreeSession) return;

    // Register terminal with 'starting' status (ready to spawn)
    set((state) => {
      const terminals = new Map(state.terminals);
      terminals.set(worktreeSessionId, {
        id: worktreeSessionId,
        status: 'starting',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      return { terminals, terminalsVersion: state.terminalsVersion + 1 };
    });

    // Spawn via IPC (auto-run claude for main worktree terminals)
    await window.terminal.spawn(worktreeSessionId, worktreeSession.path, 'claude');
  },

  recordTerminalActivity: (worktreeSessionId) =>
    set((state) => {
      const terminals = new Map(state.terminals);
      const existing = terminals.get(worktreeSessionId);
      if (existing) {
        terminals.set(worktreeSessionId, {
          ...existing,
          lastActivityTime: Date.now(),
          hasReceivedOutput: true,
        });
      } else {
        // Auto-register terminal if it doesn't exist (handles app restart scenario)
        terminals.set(worktreeSessionId, {
          id: worktreeSessionId,
          status: 'idle',
          lastActivityTime: Date.now(),
          hasReceivedOutput: true,
        });
      }
      return { terminals, terminalsVersion: state.terminalsVersion + 1 };
    }),

  resetTerminalState: (worktreeSessionId) =>
    set((state) => {
      const terminals = new Map(state.terminals);
      const existing = terminals.get(worktreeSessionId);
      if (existing) {
        terminals.set(worktreeSessionId, {
          ...existing,
          status: 'starting',
          lastActivityTime: Date.now(),
          hasReceivedOutput: false,
        });
        return { terminals, terminalsVersion: state.terminalsVersion + 1 };
      }
      return {};
    }),

  // Settings actions
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    persistState(get());
  },

  // Terminal preset actions
  addTerminalPreset: (preset) => {
    const id = `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => {
      const existingPresets = state.settings.terminalPresets || [];
      const maxOrder = existingPresets.reduce((max, p) => Math.max(max, p.order), -1);
      const newPreset: TerminalPreset = {
        ...preset,
        id,
        order: maxOrder + 1,
      };
      return {
        settings: {
          ...state.settings,
          terminalPresets: [...existingPresets, newPreset],
        },
      };
    });
    persistState(get());
  },

  updateTerminalPreset: (presetId, updates) => {
    set((state) => {
      const existingPresets = state.settings.terminalPresets || [];
      const updatedPresets = existingPresets.map((preset) => {
        if (preset.id !== presetId) return preset;
        // Don't allow updating built-in presets
        if (preset.isBuiltIn) return preset;
        return { ...preset, ...updates };
      });
      return {
        settings: {
          ...state.settings,
          terminalPresets: updatedPresets,
        },
      };
    });
    persistState(get());
  },

  deleteTerminalPreset: (presetId) => {
    set((state) => {
      const existingPresets = state.settings.terminalPresets || [];
      const presetToDelete = existingPresets.find((p) => p.id === presetId);
      // Don't allow deleting built-in presets
      if (presetToDelete?.isBuiltIn) return {};

      const updatedPresets = existingPresets.filter((p) => p.id !== presetId);
      // If deleting the default preset, reset defaultPresetId to null
      const newDefaultPresetId =
        state.settings.defaultPresetId === presetId ? null : state.settings.defaultPresetId;

      return {
        settings: {
          ...state.settings,
          terminalPresets: updatedPresets,
          defaultPresetId: newDefaultPresetId,
        },
      };
    });
    persistState(get());
  },

  reorderTerminalPresets: (presets) => {
    set((state) => {
      // Update order values based on array position, but keep "Terminal" at order 0
      const reorderedPresets = presets.map((preset, index) => ({
        ...preset,
        order: preset.isBuiltIn ? 0 : index,
      }));
      return {
        settings: {
          ...state.settings,
          terminalPresets: reorderedPresets,
        },
      };
    });
    persistState(get());
  },

  setDefaultPresetId: (presetId) => {
    set((state) => ({
      settings: {
        ...state.settings,
        defaultPresetId: presetId,
      },
    }));
    persistState(get());
  },

  // Window actions
  updateSidebarWidth: (width) => {
    set((state) => ({
      window: { ...state.window, sidebarWidth: width },
    }));
    persistState(get());
  },

  updateFileChangesPaneWidth: (width) => {
    set((state) => ({
      window: { ...state.window, fileChangesPaneWidth: width },
    }));
    persistState(get());
  },

  updateUserTerminalPanelRatio: (ratio) => {
    set((state) => ({
      window: { ...state.window, userTerminalPanelRatio: ratio },
    }));
    persistState(get());
  },

  // Focus actions
  setFocusArea: (area) => set({ focusArea: area }),
  setSidebarFocusedItemId: (itemId) => set({ sidebarFocusedItemId: itemId }),
  setSidebarStatusFocus: (focus) => set({ sidebarStatusFocus: focus }),

  // Tab actions
  createTab: (worktreeSessionId, name, command, icon) => {
    const tabId = generateTabId();
    const state = get();
    const existingTabState = state.worktreeTabs?.find(
      (wt) => wt.worktreeSessionId === worktreeSessionId
    );
    const existingTabs = existingTabState?.tabs || [];
    const maxOrder = existingTabs.reduce((max, tab) => Math.max(max, tab.order), -1);

    const newTab: TerminalTab = {
      id: tabId,
      name: name || 'Terminal',
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
      command, // Command to auto-run on terminal start (undefined = plain shell)
      icon, // Icon name from preset (undefined = default terminal icon)
    };

    set((state) => {
      const worktreeTabs = state.worktreeTabs || [];
      const existingIndex = worktreeTabs.findIndex(
        (wt) => wt.worktreeSessionId === worktreeSessionId
      );

      let newWorktreeTabs: WorktreeTabState[];
      if (existingIndex >= 0) {
        newWorktreeTabs = worktreeTabs.map((wt, i) =>
          i === existingIndex ? { ...wt, tabs: [...wt.tabs, newTab], activeTabId: tabId } : wt
        );
      } else {
        newWorktreeTabs = [
          ...worktreeTabs,
          { worktreeSessionId, tabs: [newTab], activeTabId: tabId },
        ];
      }

      return {
        worktreeTabs: newWorktreeTabs,
        activeTabId: tabId,
      };
    });

    persistState(get());
    return newTab;
  },

  closeTab: (tabId) => {
    const state = get();
    let worktreeSessionId: string | null = null;
    let tabs: TerminalTab[] = [];

    // Find which worktree this tab belongs to
    for (const wt of state.worktreeTabs || []) {
      if (wt.tabs.some((t) => t.id === tabId)) {
        worktreeSessionId = wt.worktreeSessionId;
        tabs = wt.tabs;
        break;
      }
    }

    if (!worktreeSessionId) return;

    // Kill the terminal process to clean up resources
    const terminalId = state.getTerminalIdForTab(worktreeSessionId, tabId);
    window.terminal.kill(terminalId).catch(() => {
      // Ignore errors - terminal may already be dead
    });

    // Determine new active tab (prefer right, then left)
    let newActiveTabId: string | null = null;
    const currentTabState = (state.worktreeTabs || []).find(
      (wt) => wt.worktreeSessionId === worktreeSessionId
    );
    if (currentTabState?.activeTabId === tabId) {
      if (tabs.length > 1) {
        // Sort tabs by order to determine adjacent tabs
        const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
        const sortedIndex = sortedTabs.findIndex((t) => t.id === tabId);
        if (sortedIndex < sortedTabs.length - 1) {
          newActiveTabId = sortedTabs[sortedIndex + 1].id;
        } else if (sortedIndex > 0) {
          newActiveTabId = sortedTabs[sortedIndex - 1].id;
        }
      }
    } else {
      newActiveTabId = currentTabState?.activeTabId || null;
    }

    set((state) => {
      const worktreeTabs = (state.worktreeTabs || []).map((wt) => {
        if (wt.worktreeSessionId !== worktreeSessionId) return wt;
        return {
          ...wt,
          tabs: wt.tabs.filter((t) => t.id !== tabId),
          activeTabId: newActiveTabId,
        };
      });

      return {
        worktreeTabs,
        activeTabId: state.activeTabId === tabId ? newActiveTabId : state.activeTabId,
      };
    });

    persistState(get());
  },

  renameTab: (tabId, name) => {
    // Don't allow empty names - keep the previous name
    if (!name.trim()) return;

    set((state) => ({
      worktreeTabs: (state.worktreeTabs || []).map((wt) => ({
        ...wt,
        tabs: wt.tabs.map((t) => (t.id === tabId ? { ...t, name: name.trim() } : t)),
      })),
    }));

    persistState(get());
  },

  reorderTabs: (worktreeSessionId, tabs) => {
    // Update order values based on array position
    const reorderedTabs = tabs.map((tab, index) => ({ ...tab, order: index }));

    set((state) => ({
      worktreeTabs: (state.worktreeTabs || []).map((wt) =>
        wt.worktreeSessionId === worktreeSessionId ? { ...wt, tabs: reorderedTabs } : wt
      ),
    }));

    persistState(get());
  },

  setActiveTab: (tabId) => {
    if (tabId === null) {
      set({ activeTabId: null });
      return;
    }

    // Find which worktree this tab belongs to and update both activeTabId and worktree's activeTabId
    const state = get();
    let worktreeSessionId: string | null = null;
    for (const wt of state.worktreeTabs || []) {
      if (wt.tabs.some((t) => t.id === tabId)) {
        worktreeSessionId = wt.worktreeSessionId;
        break;
      }
    }

    if (!worktreeSessionId) return;

    set((state) => ({
      activeTabId: tabId,
      worktreeTabs: (state.worktreeTabs || []).map((wt) =>
        wt.worktreeSessionId === worktreeSessionId ? { ...wt, activeTabId: tabId } : wt
      ),
    }));

    persistState(get());
  },

  getTabsForWorktree: (worktreeSessionId) => {
    const state = get();
    const tabState = (state.worktreeTabs || []).find(
      (wt) => wt.worktreeSessionId === worktreeSessionId
    );
    // Return tabs sorted by order
    return tabState ? [...tabState.tabs].sort((a, b) => a.order - b.order) : [];
  },

  getTerminalIdForTab: (worktreeSessionId, tabId) => {
    return `${worktreeSessionId}:${tabId}`;
  },

  getWorktreeSessionIdFromTabId: (tabId) => {
    const state = get();
    for (const wt of state.worktreeTabs || []) {
      if (wt.tabs.some((t) => t.id === tabId)) {
        return wt.worktreeSessionId;
      }
    }
    return null;
  },

  // User terminal tab actions
  createUserTab: (worktreeSessionId, name, scriptId) => {
    const tabId = generateTabId();
    const state = get();
    const existingTabState = state.userTerminalTabs?.find(
      (ut) => ut.worktreeSessionId === worktreeSessionId
    );
    const existingTabs = existingTabState?.tabs || [];
    const maxOrder = existingTabs.reduce((max, tab) => Math.max(max, tab.order), -1);

    const newTab: TerminalTab = {
      id: tabId,
      name: name || 'Terminal',
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
      scriptId,
    };

    set((state) => {
      const userTerminalTabs = state.userTerminalTabs || [];
      const existingIndex = userTerminalTabs.findIndex(
        (ut) => ut.worktreeSessionId === worktreeSessionId
      );

      let newUserTerminalTabs: UserTerminalTabState[];
      if (existingIndex >= 0) {
        newUserTerminalTabs = userTerminalTabs.map((ut, i) =>
          i === existingIndex ? { ...ut, tabs: [...ut.tabs, newTab], activeTabId: tabId } : ut
        );
      } else {
        newUserTerminalTabs = [
          ...userTerminalTabs,
          { worktreeSessionId, tabs: [newTab], activeTabId: tabId },
        ];
      }

      return {
        userTerminalTabs: newUserTerminalTabs,
        activeUserTabId: tabId,
      };
    });

    persistState(get());
    return newTab;
  },

  closeUserTab: (tabId) => {
    const state = get();
    let worktreeSessionId: string | null = null;
    let tabs: TerminalTab[] = [];

    // Find which worktree this tab belongs to
    for (const ut of state.userTerminalTabs || []) {
      if (ut.tabs.some((t) => t.id === tabId)) {
        worktreeSessionId = ut.worktreeSessionId;
        tabs = ut.tabs;
        break;
      }
    }

    if (!worktreeSessionId) return;

    // Kill the terminal process to clean up resources
    const terminalId = state.getUserTerminalIdForTab(worktreeSessionId, tabId);
    window.terminal.kill(terminalId).catch(() => {
      // Ignore errors - terminal may already be dead
    });

    // Determine new active tab (prefer right, then left)
    let newActiveTabId: string | null = null;
    const currentTabState = (state.userTerminalTabs || []).find(
      (ut) => ut.worktreeSessionId === worktreeSessionId
    );
    if (currentTabState?.activeTabId === tabId) {
      if (tabs.length > 1) {
        // Sort tabs by order to determine adjacent tabs
        const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
        const sortedIndex = sortedTabs.findIndex((t) => t.id === tabId);
        if (sortedIndex < sortedTabs.length - 1) {
          newActiveTabId = sortedTabs[sortedIndex + 1].id;
        } else if (sortedIndex > 0) {
          newActiveTabId = sortedTabs[sortedIndex - 1].id;
        }
      }
    } else {
      newActiveTabId = currentTabState?.activeTabId || null;
    }

    set((state) => {
      const userTerminalTabs = (state.userTerminalTabs || []).map((ut) => {
        if (ut.worktreeSessionId !== worktreeSessionId) return ut;
        return {
          ...ut,
          tabs: ut.tabs.filter((t) => t.id !== tabId),
          activeTabId: newActiveTabId,
        };
      });

      return {
        userTerminalTabs,
        activeUserTabId: state.activeUserTabId === tabId ? newActiveTabId : state.activeUserTabId,
      };
    });

    persistState(get());
  },

  findUserTabsWithScript: (repositoryId, scriptId) => {
    const state = get();
    const repository = state.repositories.find((r) => r.id === repositoryId);
    if (!repository) return [];

    const results: { worktreeSessionId: string; tab: TerminalTab }[] = [];
    for (const worktreeSession of repository.worktreeSessions) {
      const tabState = (state.userTerminalTabs || []).find(
        (ut) => ut.worktreeSessionId === worktreeSession.id
      );
      if (tabState) {
        for (const tab of tabState.tabs) {
          if (tab.scriptId === scriptId) {
            results.push({ worktreeSessionId: worktreeSession.id, tab });
          }
        }
      }
    }
    return results;
  },

  closeUserTabById: (worktreeSessionId, tabId) => {
    const state = get();
    const tabState = (state.userTerminalTabs || []).find(
      (ut) => ut.worktreeSessionId === worktreeSessionId
    );
    if (!tabState) return;

    // Kill the terminal process to clean up resources
    const terminalId = state.getUserTerminalIdForTab(worktreeSessionId, tabId);
    window.terminal.kill(terminalId).catch(() => {
      // Ignore errors - terminal may already be dead
    });

    const tabs = tabState.tabs;

    // Determine new active tab (prefer right, then left)
    let newActiveTabId: string | null = null;
    if (tabState.activeTabId === tabId) {
      if (tabs.length > 1) {
        // Sort tabs by order to determine adjacent tabs
        const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
        const sortedIndex = sortedTabs.findIndex((t) => t.id === tabId);
        if (sortedIndex < sortedTabs.length - 1) {
          newActiveTabId = sortedTabs[sortedIndex + 1].id;
        } else if (sortedIndex > 0) {
          newActiveTabId = sortedTabs[sortedIndex - 1].id;
        }
      }
    } else {
      newActiveTabId = tabState.activeTabId || null;
    }

    set((state) => {
      const userTerminalTabs = (state.userTerminalTabs || []).map((ut) => {
        if (ut.worktreeSessionId !== worktreeSessionId) return ut;
        return {
          ...ut,
          tabs: ut.tabs.filter((t) => t.id !== tabId),
          activeTabId: newActiveTabId,
        };
      });

      return {
        userTerminalTabs,
        activeUserTabId: state.activeUserTabId === tabId ? newActiveTabId : state.activeUserTabId,
      };
    });

    persistState(get());
  },

  renameUserTab: (tabId, name) => {
    // Don't allow empty names - keep the previous name
    if (!name.trim()) return;

    set((state) => ({
      userTerminalTabs: (state.userTerminalTabs || []).map((ut) => ({
        ...ut,
        tabs: ut.tabs.map((t) => (t.id === tabId ? { ...t, name: name.trim() } : t)),
      })),
    }));

    persistState(get());
  },

  reorderUserTabs: (worktreeSessionId, tabs) => {
    // Update order values based on array position
    const reorderedTabs = tabs.map((tab, index) => ({ ...tab, order: index }));

    set((state) => ({
      userTerminalTabs: (state.userTerminalTabs || []).map((ut) =>
        ut.worktreeSessionId === worktreeSessionId ? { ...ut, tabs: reorderedTabs } : ut
      ),
    }));

    persistState(get());
  },

  setActiveUserTab: (tabId) => {
    if (tabId === null) {
      set({ activeUserTabId: null });
      return;
    }

    // Find which worktree this tab belongs to and update both activeUserTabId and worktree's activeTabId
    const state = get();
    let worktreeSessionId: string | null = null;
    for (const ut of state.userTerminalTabs || []) {
      if (ut.tabs.some((t) => t.id === tabId)) {
        worktreeSessionId = ut.worktreeSessionId;
        break;
      }
    }

    if (!worktreeSessionId) return;

    set((state) => ({
      activeUserTabId: tabId,
      userTerminalTabs: (state.userTerminalTabs || []).map((ut) =>
        ut.worktreeSessionId === worktreeSessionId ? { ...ut, activeTabId: tabId } : ut
      ),
    }));

    persistState(get());
  },

  getUserTabsForWorktree: (worktreeSessionId) => {
    const state = get();
    const tabState = (state.userTerminalTabs || []).find(
      (ut) => ut.worktreeSessionId === worktreeSessionId
    );
    // Return tabs sorted by order
    return tabState ? [...tabState.tabs].sort((a, b) => a.order - b.order) : [];
  },

  getUserTerminalIdForTab: (worktreeSessionId, tabId) => {
    return `user:${worktreeSessionId}:${tabId}`;
  },

  // Scroll position actions (for tab bars)
  updateTabScrollPosition: (worktreeSessionId, scrollPosition) => {
    set((state) => ({
      worktreeTabs: (state.worktreeTabs || []).map((wt) =>
        wt.worktreeSessionId === worktreeSessionId
          ? { ...wt, tabScrollPosition: scrollPosition }
          : wt
      ),
    }));
    // Note: Not persisting scroll position to disk for performance (runtime-only state)
  },

  updateUserTabScrollPosition: (worktreeSessionId, scrollPosition) => {
    set((state) => ({
      userTerminalTabs: (state.userTerminalTabs || []).map((ut) =>
        ut.worktreeSessionId === worktreeSessionId
          ? { ...ut, tabScrollPosition: scrollPosition }
          : ut
      ),
    }));
    // Note: Not persisting scroll position to disk for performance (runtime-only state)
  },

  getTabScrollPosition: (worktreeSessionId) => {
    const state = get();
    const tabState = (state.worktreeTabs || []).find(
      (wt) => wt.worktreeSessionId === worktreeSessionId
    );
    return tabState?.tabScrollPosition ?? 0;
  },

  getUserTabScrollPosition: (worktreeSessionId) => {
    const state = get();
    const tabState = (state.userTerminalTabs || []).find(
      (ut) => ut.worktreeSessionId === worktreeSessionId
    );
    return tabState?.tabScrollPosition ?? 0;
  },

  // Utility
  getRepositoryByWorktreeSessionId: (worktreeSessionId) => {
    const state = get();
    return state.repositories.find((p) =>
      p.worktreeSessions.some((s) => s.id === worktreeSessionId)
    );
  },

  getWorktreeSessionById: (worktreeSessionId) => {
    const state = get();
    for (const repository of state.repositories) {
      const worktreeSession = repository.worktreeSessions.find((s) => s.id === worktreeSessionId);
      if (worktreeSession) return worktreeSession;
    }
    return undefined;
  },

  // PR status actions
  setGhCliAvailable: (available) => set({ ghCliAvailable: available }),

  setPRStatuses: (statuses) => {
    const state = get();
    // Skip update if the statuses are equal (prevents unnecessary re-renders)
    if (prStatusMapEqual(state.prStatuses, statuses)) {
      return;
    }
    set({ prStatuses: statuses, prStatusLastUpdated: Date.now() });
  },

  setPRStatusLoading: (loading) => set({ prStatusLoading: loading }),

  fetchPRStatuses: async () => {
    const state = get();
    if (!state.isInitialized) return;

    // Increment fetch ID to track this specific fetch
    const fetchId = state.prStatusFetchId + 1;
    set({ prStatusFetchId: fetchId, prStatusLoading: true });

    try {
      // Check gh CLI availability if not yet checked
      if (state.ghCliAvailable === null) {
        const available = await window.terminal.isGhCliAvailable();
        set({ ghCliAvailable: available });
        if (!available) {
          set({ prStatusLoading: false });
          return;
        }
      } else if (!state.ghCliAvailable) {
        set({ prStatusLoading: false });
        return;
      }

      // Collect all unique GitHub repos from remote URLs
      const repos: string[] = [];
      for (const repository of state.repositories) {
        const remoteUrl = await window.terminal.getRemoteUrl(repository.path);
        if (remoteUrl) {
          // Parse GitHub owner/repo from URL
          const httpsMatch = remoteUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
          const sshMatch = remoteUrl.match(/github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
          const match = httpsMatch || sshMatch;
          if (match) {
            repos.push(match[1]);
          }
        }
      }

      // Check if this fetch is still current (not stale)
      if (get().prStatusFetchId !== fetchId) {
        return; // A newer fetch has started, ignore this one
      }

      if (repos.length === 0) {
        set({ prStatusLoading: false });
        return;
      }

      const statuses = await window.terminal.getPRStatuses(repos);

      // Check again if this fetch is still current
      if (get().prStatusFetchId !== fetchId) {
        return; // A newer fetch has started, ignore this one
      }

      // Replace entire map (don't merge) to clean up stale entries
      get().setPRStatuses(statuses);
    } catch (error) {
      console.error('[Store] Failed to fetch PR statuses:', error);
    } finally {
      // Only update loading state if this is still the current fetch
      if (get().prStatusFetchId === fetchId) {
        set({ prStatusLoading: false });
      }
    }
  },
}));
