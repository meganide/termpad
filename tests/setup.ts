import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterAll } from 'vitest';

// Suppress known jsdom/React errors with textarea events after unmount
// This is a known issue where React tries to dispatch events on unmounted components
const originalError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out the known "Cannot read properties of null (reading 'tag')" error
  // that occurs with jsdom/React when textarea events fire after unmount
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    firstArg.includes("Cannot read properties of null (reading 'tag')")
  ) {
    return;
  }
  if (
    firstArg instanceof Error &&
    firstArg.message?.includes("Cannot read properties of null (reading 'tag')")
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Handle uncaught errors that occur during jsdom event dispatch after React unmount
const errorHandler = (event: ErrorEvent) => {
  if (event.error?.message?.includes("Cannot read properties of null (reading 'tag')")) {
    event.preventDefault();
    return;
  }
};

// Add global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', errorHandler);
}

afterAll(() => {
  console.error = originalError;
  if (typeof window !== 'undefined') {
    window.removeEventListener('error', errorHandler);
  }
});

// Mock matchMedia with configurable matches
let matchMediaMatches = false;
export const setMatchMediaMatches = (matches: boolean) => {
  matchMediaMatches = matches;
};

const createMatchMediaMock = () =>
  vi.fn().mockImplementation((query: string) => ({
    matches: matchMediaMatches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();
// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Default app state for mocking
const defaultMockAppState = {
  version: 1,
  settings: {
    worktreeBasePath: null,
    gitPollIntervalMs: 5000,
    notifications: {
      enabled: true,
      backgroundOnly: true,
      cooldownMs: 8000,
    },
    preferredEditor: 'cursor' as const,
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
    ],
    defaultPresetId: null,
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
};

// Configurable mock state for storage.loadState
let mockLoadStateResult = { ...defaultMockAppState };
export const setMockLoadState = (state: typeof defaultMockAppState) => {
  mockLoadStateResult = state;
};
export const resetMockLoadState = () => {
  mockLoadStateResult = { ...defaultMockAppState };
};

// Store original getComputedStyle
const originalGetComputedStyle = window.getComputedStyle;

// Mock getComputedStyle for context menu/modal components while preserving inline style access
const getComputedStyleMock = vi.fn().mockImplementation((element: Element) => {
  // Get any actual computed styles from the original if available
  const original = originalGetComputedStyle ? originalGetComputedStyle(element) : null;
  return {
    getPropertyValue: vi.fn().mockImplementation((prop: string) => {
      // Check inline style first, then fall back to original computed style
      const htmlElement = element as HTMLElement;
      if (htmlElement.style && htmlElement.style.getPropertyValue(prop)) {
        return htmlElement.style.getPropertyValue(prop);
      }
      return original?.getPropertyValue(prop) || '';
    }),
    // Return display from inline style if available
    get display() {
      const htmlElement = element as HTMLElement;
      return htmlElement.style?.display || original?.display || '';
    },
    get left() {
      const htmlElement = element as HTMLElement;
      return htmlElement.style?.left || original?.left || '';
    },
    get top() {
      const htmlElement = element as HTMLElement;
      return htmlElement.style?.top || original?.top || '';
    },
    overflow: 'visible',
    overflowY: 'visible',
    overflowX: 'visible',
    paddingLeft: '0px',
    paddingRight: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
  };
});

// Mock window APIs directly on window object instead of replacing it
// This preserves the prototype chain needed for DOM events to work correctly
Object.defineProperty(window, 'matchMedia', {
  value: createMatchMediaMock(),
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'getComputedStyle', {
  value: getComputedStyleMock,
  configurable: true,
  writable: true,
});

// Mock Electron APIs
Object.defineProperty(window, 'electronAPI', {
  value: {
    platform: 'linux' as const,
    ping: vi.fn().mockResolvedValue('Pong'),
    windowMinimize: vi.fn(),
    windowMaximize: vi.fn(),
    windowClose: vi.fn(),
    isWindowMaximized: vi.fn().mockResolvedValue(false),
    onMaximizedChange: vi.fn().mockReturnValue(vi.fn()),
    openDevTools: vi.fn(),
    onMenuSettings: vi.fn().mockReturnValue(vi.fn()),
    onMenuKeyboardShortcuts: vi.fn().mockReturnValue(vi.fn()),
    openExternal: vi.fn().mockResolvedValue(undefined),
    openInEditor: vi.fn().mockResolvedValue({ success: true }),
    openFolder: vi.fn().mockResolvedValue({ success: true }),
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'terminal', {
  value: {
    // Lifecycle
    spawn: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
    killAllForWorktree: vi.fn().mockResolvedValue(undefined),
    waitForReady: vi.fn().mockResolvedValue(undefined),
    getBuffer: vi.fn().mockResolvedValue(''),
    saveClipboardImage: vi.fn().mockResolvedValue(null),

    // Events - return unsubscribe functions
    onData: vi.fn().mockReturnValue(vi.fn()),
    onExit: vi.fn().mockReturnValue(vi.fn()),
    onDistroSwitched: vi.fn().mockReturnValue(vi.fn()),
    onShellUnavailable: vi.fn().mockReturnValue(vi.fn()),

    // Git operations
    clearGitCache: vi.fn().mockResolvedValue(undefined),
    isGitRepo: vi.fn().mockResolvedValue(true),
    getGitStatus: vi.fn().mockResolvedValue({ branch: 'main', isDirty: false }),
    listBranches: vi
      .fn()
      .mockResolvedValue([{ name: 'main', isRemote: false, isCurrent: true, isDefault: true }]),
    fetchBranches: vi.fn().mockResolvedValue(undefined),
    createWorktree: vi.fn().mockResolvedValue({ success: true, path: '/test/worktree' }),
    removeWorktree: vi.fn().mockResolvedValue({ success: true }),
    listWorktrees: vi.fn().mockResolvedValue([]),
    getWorktreeInfo: vi.fn().mockResolvedValue(null),
    isWorktreeDirty: vi.fn().mockResolvedValue(false),
    isBareRepo: vi.fn().mockResolvedValue(false),
    forceRemoveWorktree: vi.fn().mockResolvedValue(undefined),
    detectWorktree: vi.fn().mockResolvedValue({ isWorktree: false, mainRepoPath: null }),

    // File system
    selectFolder: vi.fn().mockResolvedValue(null),
    pathExists: vi.fn().mockResolvedValue(true),
    getBasename: vi.fn((path: string) => path.split('/').pop() || ''),

    // Diff operations
    getDiff: vi
      .fn()
      .mockResolvedValue({ files: [], baseCommit: 'abc123', compareCommit: 'def456' }),
    getFileDiff: vi.fn().mockResolvedValue(null),
    getCommitHash: vi.fn().mockResolvedValue('abc123'),
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    getCurrentBranch: vi.fn().mockResolvedValue('feature-branch'),
    getWorkingTreeDiff: vi
      .fn()
      .mockResolvedValue({ files: [], headCommit: 'abc123', isDirty: false }),
    getWorkingTreeStats: vi
      .fn()
      .mockResolvedValue({ files: [], headCommit: 'abc123', isDirty: false }),
    getSingleWorkingTreeFileDiff: vi.fn().mockResolvedValue(null),

    // Clone
    cloneRepository: vi.fn().mockResolvedValue({ success: true, path: '/test/cloned' }),

    // Git init
    initGitRepo: vi.fn().mockResolvedValue({ success: true }),

    // Source control operations
    getFileStatuses: vi.fn().mockResolvedValue({ staged: [], unstaged: [], untracked: [] }),
    stageFiles: vi.fn().mockResolvedValue({ success: true }),
    stageAll: vi.fn().mockResolvedValue({ success: true }),
    unstageFiles: vi.fn().mockResolvedValue({ success: true }),
    unstageAll: vi.fn().mockResolvedValue({ success: true }),
    discardFiles: vi.fn().mockResolvedValue({ success: true }),
    discardAll: vi.fn().mockResolvedValue({ success: true }),
    commit: vi.fn().mockResolvedValue({ success: true, commitHash: 'abc123' }),
    commitWithOutput: vi
      .fn()
      .mockResolvedValue({ success: true, commitHash: 'abc123', output: [] }),
    hasPreCommitHooks: vi.fn().mockResolvedValue(false),
    getHookManifest: vi.fn().mockResolvedValue({
      'pre-commit': false,
      'commit-msg': false,
      'post-commit': false,
      'pre-push': false,
      'post-push': false,
    }),
    commitWithHooks: vi.fn().mockResolvedValue({ success: true, commitHash: 'abc123', output: [] }),
    pushWithHooks: vi.fn().mockResolvedValue({ success: true, output: [] }),
    abortOperation: vi.fn().mockResolvedValue(true),
    onCommitOutput: vi.fn().mockReturnValue(vi.fn()),
    onOperationOutput: vi.fn().mockReturnValue(vi.fn()),
    push: vi.fn().mockResolvedValue({ success: true }),
    pull: vi.fn().mockResolvedValue({ success: true }),
    getAheadBehind: vi.fn().mockResolvedValue({ ahead: 0, behind: 0, hasRemote: true }),
    getRemoteUrl: vi.fn().mockResolvedValue('https://github.com/user/repo.git'),
    addRemote: vi.fn().mockResolvedValue({ success: true }),

    // App
    getAppDataPath: vi.fn().mockResolvedValue('/mock/app/data'),
    showNotification: vi.fn(),
    onBeforeClose: vi.fn().mockReturnValue(vi.fn()),
    confirmClose: vi.fn(),
    cancelClose: vi.fn(),

    // Shell configuration
    getAvailableShells: vi.fn().mockResolvedValue([]),
    validateShellPath: vi.fn().mockResolvedValue({ valid: true }),
    getResolvedShellName: vi.fn().mockResolvedValue('bash'),

    // File operations
    removeDirectory: vi.fn().mockResolvedValue({ success: true }),
    runScript: vi.fn().mockResolvedValue({ success: true, output: '' }),
    getFileLines: vi.fn().mockResolvedValue({ lines: [] }),
    getFileLineCount: vi.fn().mockResolvedValue({ lineCount: 0 }),

    // Termpad config
    loadTermpadConfig: vi.fn().mockResolvedValue(null),
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'storage', {
  value: {
    loadState: vi.fn(() => Promise.resolve({ ...mockLoadStateResult })),
    saveState: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'watcher', {
  value: {
    startRepositoryWatch: vi.fn(),
    stopRepositoryWatch: vi.fn(),
    onWorktreeAdded: vi.fn().mockReturnValue(vi.fn()),
    onWorktreeRemoved: vi.fn().mockReturnValue(vi.fn()),
    onBranchesChanged: vi.fn().mockReturnValue(vi.fn()),
    onGitRemoved: vi.fn().mockReturnValue(vi.fn()),
    onGitRestored: vi.fn().mockReturnValue(vi.fn()),
    onRepositoryDeleted: vi.fn().mockReturnValue(vi.fn()),
    onConfigChanged: vi.fn().mockReturnValue(vi.fn()),
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'reviewStorage', {
  value: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([]),
    loadAll: vi.fn().mockResolvedValue([]),
    findByBranches: vi.fn().mockResolvedValue(null),
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window, 'notifications', {
  value: {
    trigger: vi.fn().mockResolvedValue(true),
    setCooldown: vi.fn(),
    focusWorktreeSession: vi.fn(),
    onSwitchWorktreeSession: vi.fn().mockReturnValue(vi.fn()),
  },
  configurable: true,
  writable: true,
});

// Also stub ResizeObserver globally (not just on window)
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock navigator.clipboard for userEvent compatibility
const clipboardMock = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
  write: vi.fn().mockResolvedValue(undefined),
  read: vi.fn().mockResolvedValue([]),
};

// Mock clipboard on both navigator and document.defaultView.navigator
// (userEvent accesses it through document.defaultView)
Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  configurable: true,
  writable: true,
});

// Ensure document.defaultView.navigator also has clipboard
if (typeof document !== 'undefined' && document.defaultView) {
  Object.defineProperty(document.defaultView.navigator, 'clipboard', {
    value: clipboardMock,
    configurable: true,
    writable: true,
  });
}

// Mock pointer capture methods needed by radix-ui select
// @ts-expect-error - These are DOM methods we're mocking for test compatibility
Element.prototype.setPointerCapture = vi.fn();
// @ts-expect-error - These are DOM methods we're mocking for test compatibility
Element.prototype.releasePointerCapture = vi.fn();
// @ts-expect-error - These are DOM methods we're mocking for test compatibility
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Add detachEvent and attachEvent polyfills for React's input event handling
// These are legacy IE methods that React's development build checks for
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function
(Element.prototype as any).detachEvent = function () {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function
(Element.prototype as any).attachEvent = function () {};

// Clear mocks and reset state before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  resetMockLoadState();
  setMatchMediaMatches(false);
});
