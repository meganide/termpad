import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Layout } from './Layout';
import { useAppStore } from '../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
} from '../../../tests/utils';

// Mock child components to simplify testing
vi.mock('./TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar">TitleBar</div>,
}));

vi.mock('./Sidebar/index', () => ({
  Sidebar: ({
    onAddRepository,
    onNewWorktree,
    onRepositoryDelete,
    onWorktreeRemove,
    onOpenSettings,
    onOpenHome,
  }: {
    onAddRepository: () => void;
    onNewWorktree: (repositoryId: string) => void;
    onRepositoryDelete: (repository: { id: string }) => void;
    onWorktreeRemove: (session: { id: string }, repository: { id: string }) => void;
    onOpenSettings: () => void;
    onOpenHome: () => void;
  }) => (
    <div data-testid="sidebar">
      <button data-testid="sidebar-add-repository" onClick={onAddRepository}>
        Add Repository
      </button>
      <button data-testid="sidebar-new-worktree" onClick={() => onNewWorktree('repo-1')}>
        New Worktree
      </button>
      <button
        data-testid="sidebar-delete-repository"
        onClick={() => onRepositoryDelete({ id: 'repo-1' })}
      >
        Delete Repository
      </button>
      <button
        data-testid="sidebar-remove-worktree"
        onClick={() => onWorktreeRemove({ id: 'session-1' }, { id: 'repo-1' })}
      >
        Remove Worktree
      </button>
      <button data-testid="sidebar-open-settings" onClick={onOpenSettings}>
        Settings
      </button>
      <button data-testid="sidebar-open-home" onClick={onOpenHome}>
        Home
      </button>
    </div>
  ),
}));

vi.mock('./Terminal/TerminalView', () => ({
  TerminalView: ({
    sessionId,
    terminalId,
    isVisible,
  }: {
    sessionId: string;
    terminalId?: string;
    isVisible: boolean;
  }) => (
    <div data-testid={`terminal-${terminalId ?? sessionId}`} data-visible={isVisible}>
      TerminalView
    </div>
  ),
}));

vi.mock('./Terminal/TabBar', () => ({
  TabBar: ({
    tabs,
    onNewTab,
  }: {
    tabs: { id: string; name: string }[];
    activeTabId: string | null;
    terminalStatuses: unknown;
    getTerminalIdForTab: (tabId: string) => string;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onTabRename: (tabId: string, name: string) => void;
    onTabReorder: (tabs: unknown[]) => void;
    onNewTab: (name?: string, command?: string) => void;
  }) => (
    <div data-testid="tab-bar" data-tab-count={tabs.length}>
      {tabs.map((tab) => (
        <div key={tab.id} data-testid={`tab-${tab.id}`}>
          {tab.name}
        </div>
      ))}
      <button aria-label="New tab" onClick={() => onNewTab()}>
        +
      </button>
    </div>
  ),
}));

vi.mock('./Terminal/StoppedTerminalPanel', () => ({
  StoppedTerminalPanel: ({
    session,
    onStart,
  }: {
    session: { id: string; label: string };
    onStart: () => void;
  }) => (
    <div data-testid={`stopped-panel-${session.id}`}>
      <span>Stopped: {session.label}</span>
      <button onClick={onStart}>Start</button>
    </div>
  ),
}));

vi.mock('./AddWorktreeScreen', () => ({
  AddWorktreeScreen: ({ repositoryId }: { repositoryId: string | null }) => (
    <div data-testid="add-worktree-screen" data-repository-id={repositoryId}>
      AddWorktreeScreen
    </div>
  ),
}));

vi.mock('./CloseWarningDialog', () => ({
  CloseWarningDialog: ({
    open,
    activeCount,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    activeCount: number;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="close-warning-dialog">
        <span>Active: {activeCount}</span>
        <button data-testid="close-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="close-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('./RemoveWorktreeDialog', () => ({
  RemoveWorktreeDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="remove-worktree-dialog">RemoveWorktreeDialog</div> : null,
}));

vi.mock('./DeleteRepositoryDialog', () => ({
  DeleteRepositoryDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-repository-dialog">DeleteRepositoryDialog</div> : null,
}));

vi.mock('./HomeScreen', () => ({
  HomeScreen: ({ onAddRepository }: { onAddRepository: () => void }) => (
    <div data-testid="home-screen">
      HomeScreen
      <button data-testid="home-add-repository" onClick={onAddRepository}>
        Add Repository
      </button>
    </div>
  ),
}));

vi.mock('./AddRepositoryScreen', () => ({
  AddRepositoryScreen: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="add-repository-screen">
      AddRepositoryScreen
      <button data-testid="close-add-repository" onClick={onBack}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('./SettingsScreen', () => ({
  SettingsScreen: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="settings-screen">
      SettingsScreen
      <button data-testid="close-settings" onClick={onBack}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('./RepositorySettingsOverlay', () => ({
  RepositorySettingsOverlay: ({
    repositoryId,
    onClose,
  }: {
    repositoryId: string;
    onClose: () => void;
  }) => (
    <div data-testid="repository-settings-overlay" data-repository-id={repositoryId}>
      RepositorySettingsOverlay
      <button data-testid="close-repository-settings" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('./WorktreeBar/WorktreeBar', () => ({
  WorktreeBar: () => <div data-testid="worktree-bar">WorktreeBar</div>,
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../hooks/useWorktreeWatchers', () => ({
  useWorktreeWatchers: vi.fn(),
}));

vi.mock('../hooks/useWorkingTreeDiff', () => ({
  useWorkingTreeDiff: vi.fn(() => ({
    files: [],
    headCommit: null,
    isLoading: false,
    error: null,
  })),
}));

vi.mock('../features/source-control', () => ({
  SourceControlPane: ({
    repoPath,
    onViewDiff,
    onOpenInEditor,
  }: {
    repoPath: string | null;
    onViewDiff?: (file: {
      path: string;
      type: string;
      additions: number;
      deletions: number;
    }) => void;
    onOpenInEditor?: (file: {
      path: string;
      type: string;
      additions: number;
      deletions: number;
    }) => void;
  }) => (
    <div data-testid="source-control-pane">
      SourceControlPane
      <span data-testid="repo-path">{repoPath}</span>
      <button
        data-testid="view-diff"
        onClick={() =>
          onViewDiff?.({ path: 'test.ts', type: 'modified', additions: 0, deletions: 0 })
        }
      >
        View Diff
      </button>
      <button
        data-testid="open-in-editor"
        onClick={() =>
          onOpenInEditor?.({ path: 'test.ts', type: 'modified', additions: 0, deletions: 0 })
        }
      >
        Open In Editor
      </button>
    </div>
  ),
}));

vi.mock('../features/user-terminals', () => ({
  UserTerminalSection: ({
    worktreeSessionId,
    repositoryId,
  }: {
    worktreeSessionId: string;
    repositoryId: string;
  }) => (
    <div
      data-testid="user-terminal-section"
      data-worktree-session-id={worktreeSessionId}
      data-repository-id={repositoryId}
    >
      UserTerminalSection
    </div>
  ),
}));

vi.mock('../features/review/DiffReviewModal', () => ({
  DiffReviewModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="diff-review-modal">
        DiffReviewModal
        <button data-testid="close-modal" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../stores/reviewStore', () => ({
  useReviewStore: vi.fn(() => ({
    openWorkingTreeReview: vi.fn(),
    setSelectedFile: vi.fn(),
  })),
}));

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    // Set initialized state
    useAppStore.setState({ isInitialized: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading state when not initialized', () => {
      useAppStore.setState({ isInitialized: false });
      render(<Layout />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('does not show loading when initialized', () => {
      useAppStore.setState({ isInitialized: true });
      render(<Layout />);
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('calls initialize on mount', () => {
      const initialize = vi.fn();
      useAppStore.setState({ initialize, isInitialized: true });
      render(<Layout />);
      expect(initialize).toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('renders Sidebar', () => {
      render(<Layout />);
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('renders Toaster', () => {
      render(<Layout />);
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });

    it('renders HomeScreen when no repositories', () => {
      useAppStore.setState({ repositories: [] });
      render(<Layout />);
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    });
  });

  describe('terminal rendering', () => {
    it('shows TerminalView for active tab in worktree', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        activeTabId: 'tab-1',
        worktreeTabs: [
          {
            worktreeSessionId: 'session-1',
            tabs: [
              { id: 'tab-1', name: 'Terminal', createdAt: new Date().toISOString(), order: 0 },
            ],
            activeTabId: 'tab-1',
          },
        ],
        terminals: new Map([
          [
            'session-1:tab-1',
            {
              id: 'session-1:tab-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBeInTheDocument();
    });

    it('renders TabBar when worktree is selected with no tabs', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        worktreeTabs: [],
        terminals: new Map(),
      });

      render(<Layout />);
      // TabBar should be visible (with no tabs and just the + button)
      expect(screen.getByLabelText('New tab')).toBeInTheDocument();
    });

    it('renders terminal for tab in active worktree', () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        activeTabId: 'tab-1',
        worktreeTabs: [
          {
            worktreeSessionId: 'session-1',
            tabs: [
              { id: 'tab-1', name: 'Terminal', createdAt: new Date().toISOString(), order: 0 },
            ],
            activeTabId: 'tab-1',
          },
        ],
        terminals: new Map([
          [
            'session-1:tab-1',
            {
              id: 'session-1:tab-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);
      // Terminal should be rendered for the tab
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBeInTheDocument();
    });

    it('re-renders tab list when a new tab is added to worktreeTabs', async () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });

      // Initial state with one tab
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        activeTabId: 'tab-1',
        worktreeTabs: [
          {
            worktreeSessionId: 'session-1',
            tabs: [
              { id: 'tab-1', name: 'Terminal 1', createdAt: new Date().toISOString(), order: 0 },
            ],
            activeTabId: 'tab-1',
          },
        ],
        terminals: new Map([
          [
            'session-1:tab-1',
            {
              id: 'session-1:tab-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);

      // Verify initial state - one tab rendered
      expect(screen.getByTestId('tab-bar')).toHaveAttribute('data-tab-count', '1');
      expect(screen.getByTestId('tab-tab-1')).toBeInTheDocument();
      expect(screen.getByText('Terminal 1')).toBeInTheDocument();

      // Add a second tab by updating worktreeTabs
      await act(async () => {
        useAppStore.setState({
          worktreeTabs: [
            {
              worktreeSessionId: 'session-1',
              tabs: [
                { id: 'tab-1', name: 'Terminal 1', createdAt: new Date().toISOString(), order: 0 },
                { id: 'tab-2', name: 'Terminal 2', createdAt: new Date().toISOString(), order: 1 },
              ],
              activeTabId: 'tab-2',
            },
          ],
          activeTabId: 'tab-2',
          terminals: new Map([
            [
              'session-1:tab-1',
              {
                id: 'session-1:tab-1',
                status: 'idle',
                gitStatus: undefined,
                acknowledged: false,
                lastActivityTime: Date.now(),
                hasReceivedOutput: false,
              },
            ],
            [
              'session-1:tab-2',
              {
                id: 'session-1:tab-2',
                status: 'idle',
                gitStatus: undefined,
                acknowledged: false,
                lastActivityTime: Date.now(),
                hasReceivedOutput: false,
              },
            ],
          ]),
        });
      });

      // Verify the tab list re-rendered with both tabs
      expect(screen.getByTestId('tab-bar')).toHaveAttribute('data-tab-count', '2');
      expect(screen.getByTestId('tab-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('tab-tab-2')).toBeInTheDocument();
      expect(screen.getByText('Terminal 1')).toBeInTheDocument();
      expect(screen.getByText('Terminal 2')).toBeInTheDocument();
    });
  });

  describe('dialog opening', () => {
    it('opens AddRepositoryScreen when sidebar add repository is clicked', async () => {
      render(<Layout />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-add-repository'));
      });

      expect(screen.getByTestId('add-repository-screen')).toBeInTheDocument();
    });

    it('opens AddWorktreeScreen when sidebar new worktree is clicked', async () => {
      const repository = createMockRepository({ id: 'repo-1' });
      useAppStore.setState({ repositories: [repository] });
      render(<Layout />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-new-worktree'));
      });

      expect(screen.getByTestId('add-worktree-screen')).toBeInTheDocument();
      expect(screen.getByTestId('add-worktree-screen')).toHaveAttribute(
        'data-repository-id',
        'repo-1'
      );
    });

    it('opens DeleteRepositoryDialog when sidebar delete repository is clicked', async () => {
      const repository = createMockRepository({ id: 'repo-1' });
      useAppStore.setState({ repositories: [repository] });
      render(<Layout />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-delete-repository'));
      });

      expect(screen.getByTestId('delete-repository-dialog')).toBeInTheDocument();
    });

    it('opens RemoveWorktreeDialog when sidebar remove worktree is clicked', async () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({ repositories: [repository] });
      render(<Layout />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-remove-worktree'));
      });

      expect(screen.getByTestId('remove-worktree-dialog')).toBeInTheDocument();
    });
  });

  describe('theme effect', () => {
    it('always applies dark class', () => {
      render(<Layout />);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('before close handling', () => {
    it('subscribes to onBeforeClose', () => {
      render(<Layout />);
      expect(window.terminal.onBeforeClose).toHaveBeenCalled();
    });

    it('shows CloseWarningDialog when terminals are active', async () => {
      let beforeCloseHandler: (activeCount: number) => void;
      vi.mocked(window.terminal.onBeforeClose).mockImplementation(
        (handler: (activeCount: number) => void) => {
          beforeCloseHandler = handler;
          return vi.fn();
        }
      );

      render(<Layout />);

      await act(async () => {
        // Main process sends activeCount=2
        beforeCloseHandler!(2);
      });

      expect(screen.getByTestId('close-warning-dialog')).toBeInTheDocument();
    });

    it('calls confirmClose when confirm is clicked', async () => {
      let beforeCloseHandler: (activeCount: number) => void;
      vi.mocked(window.terminal.onBeforeClose).mockImplementation(
        (handler: (activeCount: number) => void) => {
          beforeCloseHandler = handler;
          return vi.fn();
        }
      );

      render(<Layout />);

      await act(async () => {
        // Main process sends activeCount=1
        beforeCloseHandler!(1);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-confirm'));
      });

      expect(window.terminal.confirmClose).toHaveBeenCalled();
    });

    it('calls cancelClose when cancel is clicked', async () => {
      let beforeCloseHandler: (activeCount: number) => void;
      vi.mocked(window.terminal.onBeforeClose).mockImplementation(
        (handler: (activeCount: number) => void) => {
          beforeCloseHandler = handler;
          return vi.fn();
        }
      );

      render(<Layout />);

      await act(async () => {
        // Main process sends activeCount=1
        beforeCloseHandler!(1);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('close-cancel'));
      });

      expect(window.terminal.cancelClose).toHaveBeenCalled();
    });

    it('does not show CloseWarningDialog when no terminals are active', async () => {
      let beforeCloseHandler: (activeCount: number) => void;
      vi.mocked(window.terminal.onBeforeClose).mockImplementation(
        (handler: (activeCount: number) => void) => {
          beforeCloseHandler = handler;
          return vi.fn();
        }
      );

      render(<Layout />);

      await act(async () => {
        // Main process sends activeCount=0
        beforeCloseHandler!(0);
      });

      expect(screen.queryByTestId('close-warning-dialog')).not.toBeInTheDocument();
    });
  });

  // Note: Auto-start terminals feature has been removed.
  // Terminals are now auto-started by TerminalView when it mounts,
  // using the correct tab-aware terminal IDs (worktreeSessionId:tabId).

  describe('focus management', () => {
    it('syncs sidebarFocusedItemId when activeTerminalId changes', () => {
      const setSidebarFocusedItemId = vi.fn();
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        terminals: new Map([
          [
            'session-1',
            {
              id: 'session-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
        setSidebarFocusedItemId,
      });

      render(<Layout />);

      expect(setSidebarFocusedItemId).toHaveBeenCalledWith('session:session-1');
    });

    it('does not sync sidebarFocusedItemId when activeTerminalId is null', () => {
      const setSidebarFocusedItemId = vi.fn();
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
        setSidebarFocusedItemId,
      });

      render(<Layout />);

      expect(setSidebarFocusedItemId).not.toHaveBeenCalled();
    });

    it('updates sidebarFocusedItemId when activeTerminalId changes to a different session', async () => {
      const setSidebarFocusedItemId = vi.fn();
      const session1 = createMockWorktreeSession({ id: 'session-1' });
      const session2 = createMockWorktreeSession({ id: 'session-2' });
      const repository = createMockRepository({
        id: 'repo-1',
        worktreeSessions: [session1, session2],
      });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        terminals: new Map([
          [
            'session-1',
            {
              id: 'session-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
          [
            'session-2',
            {
              id: 'session-2',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
        setSidebarFocusedItemId,
      });

      const { rerender } = render(<Layout />);

      expect(setSidebarFocusedItemId).toHaveBeenCalledWith('session:session-1');

      // Change active terminal
      await act(async () => {
        useAppStore.setState({ activeTerminalId: 'session-2' });
      });
      rerender(<Layout />);

      expect(setSidebarFocusedItemId).toHaveBeenCalledWith('session:session-2');
    });
  });

  describe('layout structure', () => {
    it('has flex column layout', () => {
      render(<Layout />);
      const container = document.querySelector('.flex.flex-col.h-screen');
      expect(container).toBeInTheDocument();
    });

    it('has background styling', () => {
      render(<Layout />);
      const container = document.querySelector('.bg-background');
      expect(container).toBeInTheDocument();
    });

    it('prevents overflow', () => {
      render(<Layout />);
      const container = document.querySelector('.overflow-hidden');
      expect(container).toBeInTheDocument();
    });
  });

  describe('source control pane resize', () => {
    const setupGitRepo = () => {
      const session = createMockWorktreeSession({ id: 'session-1', path: '/test/repo' });
      const repository = createMockRepository({
        id: 'repo-1',
        worktreeSessions: [session],
      });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        terminals: new Map([
          [
            'session-1',
            {
              id: 'session-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });
    };

    it('renders source control pane for git repos', () => {
      setupGitRepo();
      render(<Layout />);
      expect(screen.getByTestId('source-control-pane')).toBeInTheDocument();
    });

    // Note: All repositories are git repos now, so source control pane is always shown when a repo is active

    it('renders resize handle on the left side of source control pane', () => {
      setupGitRepo();
      render(<Layout />);
      const resizeHandle = document.querySelector('.cursor-ew-resize');
      expect(resizeHandle).toBeInTheDocument();
      expect(resizeHandle?.classList.contains('left-0')).toBe(true);
    });

    it('starts with default width of 400px', () => {
      setupGitRepo();
      render(<Layout />);
      const pane = screen.getByTestId('right-panel');
      expect(pane.style.width).toBe('400px');
    });

    it('allows resizing by dragging the handle', () => {
      setupGitRepo();
      render(<Layout />);

      const resizeHandle = document.querySelector('.cursor-ew-resize');
      const pane = screen.getByTestId('right-panel');

      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

      // Start resize
      act(() => {
        fireEvent.mouseDown(resizeHandle!);
      });

      // Simulate dragging to set width to 400px (1200 - 800 = 400)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 800 });
      });

      expect(pane.style.width).toBe('400px');

      // Stop resize
      act(() => {
        fireEvent.mouseUp(document);
      });
    });

    it('respects minimum width of 300px', () => {
      setupGitRepo();
      render(<Layout />);

      const resizeHandle = document.querySelector('.cursor-ew-resize');
      const pane = screen.getByTestId('right-panel');

      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

      act(() => {
        fireEvent.mouseDown(resizeHandle!);
      });

      // Try to resize to 100px (1200 - 1100 = 100), should be clamped to 300
      act(() => {
        fireEvent.mouseMove(document, { clientX: 1100 });
      });

      expect(pane.style.width).toBe('300px');

      act(() => {
        fireEvent.mouseUp(document);
      });
    });

    it('respects maximum width of 600px', () => {
      setupGitRepo();
      render(<Layout />);

      const resizeHandle = document.querySelector('.cursor-ew-resize');
      const pane = screen.getByTestId('right-panel');

      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

      act(() => {
        fireEvent.mouseDown(resizeHandle!);
      });

      // Try to resize to 700px (1200 - 500 = 700), should be clamped to 600
      act(() => {
        fireEvent.mouseMove(document, { clientX: 500 });
      });

      expect(pane.style.width).toBe('600px');

      act(() => {
        fireEvent.mouseUp(document);
      });
    });

    it('stops resizing on mouseup', () => {
      setupGitRepo();
      render(<Layout />);

      const resizeHandle = document.querySelector('.cursor-ew-resize');
      const pane = screen.getByTestId('right-panel');

      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

      act(() => {
        fireEvent.mouseDown(resizeHandle!);
      });

      act(() => {
        fireEvent.mouseMove(document, { clientX: 800 });
      });

      expect(pane.style.width).toBe('400px');

      act(() => {
        fireEvent.mouseUp(document);
      });

      // Further mouse moves should not affect width
      act(() => {
        fireEvent.mouseMove(document, { clientX: 700 });
      });

      // Width should remain at 400px since mouseup stopped resizing
      expect(pane.style.width).toBe('400px');
    });
  });

  /**
   * Regression tests for overlay screen bug fix
   *
   * Bug: When activeTerminalId was null (no repos or repos with no worktrees),
   * the HomeScreen overlay would always render due to the condition:
   *   {(activeScreen.type === 'home' || !activeTerminalId) && <HomeScreen />}
   *
   * This caused HomeScreen to block Settings, AddWorktree, and AddRepository screens
   * even when those were explicitly opened by the user.
   *
   * Fix: Changed condition to:
   *   {(activeScreen.type === 'home' || (activeScreen.type === 'main' && !activeTerminalId)) && <HomeScreen />}
   *
   * This ensures HomeScreen only auto-shows on the 'main' screen when no terminal exists,
   * but doesn't interfere when other overlay screens are explicitly requested.
   */
  describe('overlay screen behavior with no active terminal (bug fix)', () => {
    it('shows Settings screen when clicking settings button with no repositories', async () => {
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
      });

      render(<Layout />);

      // HomeScreen should be visible initially
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();

      // Click settings button in sidebar
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      // Settings screen should be visible, not HomeScreen
      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    });

    it('shows Settings screen when clicking settings button with repo but no worktrees', async () => {
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: null,
      });

      render(<Layout />);

      // HomeScreen should be visible initially
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();

      // Click settings button in sidebar
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      // Settings screen should be visible, not HomeScreen
      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    });

    it('shows AddWorktree screen when clicking add worktree with no active terminal', async () => {
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: null,
      });

      render(<Layout />);

      // HomeScreen should be visible initially
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();

      // Click new worktree button in sidebar
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-new-worktree'));
      });

      // AddWorktree screen should be visible, not HomeScreen
      expect(screen.getByTestId('add-worktree-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    });

    it('shows AddRepository screen when clicking add repository with no active terminal', async () => {
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
      });

      render(<Layout />);

      // HomeScreen should be visible initially
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();

      // Click add repository button from HomeScreen
      await act(async () => {
        fireEvent.click(screen.getByTestId('home-add-repository'));
      });

      // AddRepository screen should be visible, not HomeScreen
      expect(screen.getByTestId('add-repository-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    });

    it('returns to HomeScreen when closing Settings with no active terminal', async () => {
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
      });

      render(<Layout />);

      // Open settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();

      // Close settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-settings'));
      });

      // Should return to HomeScreen since no active terminal
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-screen')).not.toBeInTheDocument();
    });

    it('returns to HomeScreen when closing AddRepository with no active terminal', async () => {
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
      });

      render(<Layout />);

      // Open add repository
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-add-repository'));
      });

      expect(screen.getByTestId('add-repository-screen')).toBeInTheDocument();

      // Close add repository screen
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-add-repository'));
      });

      // Should return to HomeScreen since no active terminal
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('add-repository-screen')).not.toBeInTheDocument();
    });
  });

  describe('overlay screen edge cases', () => {
    it('allows opening Settings when worktree exists', async () => {
      // Test that Settings can be opened when there's a worktree (regardless of initial screen)
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        terminals: new Map([
          [
            'session-1',
            {
              id: 'session-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);

      // Click settings button
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      // Settings screen should be visible (our fix ensures overlay screens work)
      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
    });

    it('does not show HomeScreen when Settings is closed with active worktree', async () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        worktreeTabs: [
          {
            worktreeSessionId: 'session-1',
            tabs: [
              { id: 'tab-1', name: 'Terminal', createdAt: new Date().toISOString(), order: 0 },
            ],
            activeTabId: 'tab-1',
          },
        ],
        terminals: new Map([
          [
            'session-1:tab-1',
            {
              id: 'session-1:tab-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);

      // Open settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();

      // Close settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-settings'));
      });

      // With active worktree, HomeScreen should NOT automatically show
      // (it only shows when activeScreen.type === 'main' AND !activeTerminalId)
      expect(screen.queryByTestId('settings-screen')).not.toBeInTheDocument();
      expect(screen.getByTestId('worktree-bar')).toBeInTheDocument();
    });

    it('navigates Settings -> AddRepository -> Settings without showing HomeScreen', async () => {
      useAppStore.setState({
        repositories: [],
        activeTerminalId: null,
      });

      render(<Layout />);

      // Open settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();

      // Navigate to add repository from sidebar
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-add-repository'));
      });

      expect(screen.getByTestId('add-repository-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-screen')).not.toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();

      // Go back to settings
      await act(async () => {
        fireEvent.click(screen.getByTestId('close-add-repository'));
        fireEvent.click(screen.getByTestId('sidebar-open-settings'));
      });

      expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    });

    it('shows HomeScreen when explicitly clicking Home button even with active worktree', async () => {
      const session = createMockWorktreeSession({ id: 'session-1' });
      const repository = createMockRepository({ id: 'repo-1', worktreeSessions: [session] });
      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        terminals: new Map([
          [
            'session-1',
            {
              id: 'session-1',
              status: 'idle',
              gitStatus: undefined,
              lastActivityTime: Date.now(),
              hasReceivedOutput: false,
            },
          ],
        ]),
      });

      render(<Layout />);

      // Click home button
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-open-home'));
      });

      // HomeScreen should now be visible (explicit user action to go home)
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    });
  });
});
