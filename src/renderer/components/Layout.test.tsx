import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Layout } from './Layout';
import { App } from '../App';
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
    onToggleOverview,
    onOpenRepositoryOverview,
    activeOverviewRepositoryId,
    isOverviewMode,
    hasAgents,
  }: {
    onAddRepository: () => void;
    onNewWorktree: (repositoryId: string) => void;
    onRepositoryDelete: (repository: { id: string }) => void;
    onWorktreeRemove: (session: { id: string }, repository: { id: string }) => void;
    onOpenSettings: () => void;
    onOpenHome: () => void;
    onToggleOverview: () => void;
    onOpenRepositoryOverview: (repositoryId: string) => void;
    isOverviewMode: boolean;
    activeOverviewRepositoryId?: string | null;
    hasAgents: boolean;
  }) => (
    <div data-testid="sidebar" data-overview-mode={isOverviewMode} data-has-agents={hasAgents}>
      <button
        aria-pressed={activeOverviewRepositoryId === 'repo-1'}
        onClick={() => onOpenRepositoryOverview('repo-1')}
      >
        Open agent overview
      </button>
      <button data-testid="sidebar-toggle-overview" onClick={onToggleOverview}>
        Overview
      </button>
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
    isFocused,
  }: {
    sessionId: string;
    terminalId?: string;
    isVisible: boolean;
    isFocused?: boolean;
  }) => (
    <div
      data-testid={`terminal-${terminalId ?? sessionId}`}
      data-visible={isVisible}
      data-focused={isFocused}
    >
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
    titleSlot,
    onViewDiff,
    onOpenInEditor,
  }: {
    repoPath: string | null;
    titleSlot?: React.ReactNode;
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
      {titleSlot}
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

vi.mock('../features/review/ReviewPanel', () => ({
  ReviewPanel: ({
    expanded,
    onToggleExpanded,
  }: {
    expanded: boolean;
    onToggleExpanded: () => void;
  }) => (
    <div data-testid="review-panel">
      <button onClick={onToggleExpanded}>{expanded ? 'Collapse review' : 'Expand review'}</button>
    </div>
  ),
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
      // (drag updates are rAF-coalesced; mouseup applies the final width)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 1100 });
        fireEvent.mouseUp(document);
      });

      expect(pane.style.width).toBe('300px');
    });

    it('respects maximum width of 2000px', () => {
      setupGitRepo();
      render(<Layout />);

      const resizeHandle = document.querySelector('.cursor-ew-resize');
      const pane = screen.getByTestId('right-panel');

      Object.defineProperty(window, 'innerWidth', { value: 2600, writable: true });

      act(() => {
        fireEvent.mouseDown(resizeHandle!);
      });

      // Try to resize to 2100px (2600 - 500 = 2100), should be clamped to 2000
      // (drag updates are rAF-coalesced; mouseup applies the final width)
      act(() => {
        fireEvent.mouseMove(document, { clientX: 500 });
        fireEvent.mouseUp(document);
      });

      expect(pane.style.width).toBe('2000px');
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

    it('gives Changes the full panel without a terminal split', () => {
      setupGitRepo();
      render(<Layout />);

      expect(screen.getByTestId('user-terminal-panel')).not.toBeVisible();
      expect(document.querySelector('.cursor-ns-resize')).not.toBeInTheDocument();
    });

    it.each(['notes', 'todos'])('gives the %s tab the full right panel height', (tab) => {
      setupGitRepo();
      render(<Layout />);

      act(() => {
        fireEvent.click(screen.getByTestId(`right-panel-tab-${tab}`));
      });

      expect(screen.getByTestId(`${tab}-panel`)).toBeVisible();
      expect(screen.getByTestId('right-panel-top')).toHaveStyle({ height: '100%' });
      expect(screen.getByTestId('user-terminal-panel')).not.toBeVisible();
      // Nothing left to drag once the split is gone
      expect(document.querySelector('.cursor-ns-resize')).not.toBeInTheDocument();
    });

    it('shows user terminals in their own tab', () => {
      setupGitRepo();
      render(<Layout />);

      act(() => {
        fireEvent.click(screen.getByTestId('right-panel-tab-notes'));
      });
      act(() => {
        fireEvent.click(screen.getByTestId('right-panel-tab-terminals'));
      });

      expect(screen.getByTestId('user-terminal-panel')).toBeVisible();
      expect(document.querySelector('.cursor-ns-resize')).not.toBeInTheDocument();
    });

    it('opens the Terminals tab with Ctrl+U', () => {
      setupGitRepo();
      render(<Layout />);
      fireEvent.click(screen.getByTestId('right-panel-tab-notes'));
      fireEvent.keyDown(window, { key: 'u', ctrlKey: true });
      expect(screen.getByTestId('right-panel-tab-terminals')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByTestId('user-terminal-panel')).toBeVisible();
      expect(useAppStore.getState().focusArea).toBe('userTerminal');
    });

    it('expands review inline and restores the previous panel width', () => {
      setupGitRepo();
      render(<Layout />);
      const panel = screen.getByTestId('right-panel');
      const width = panel.style.width;
      fireEvent.click(screen.getByTestId('right-panel-tab-review'));
      expect(screen.getByTestId('review-panel')).toBeVisible();
      fireEvent.click(screen.getByText('Expand review'));
      expect(panel.style.width).toBe('100%');
      fireEvent.click(screen.getByText('Collapse review'));
      expect(panel.style.width).toBe(width);
      expect(screen.queryByTestId('diff-review-modal')).not.toBeInTheDocument();
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
  describe('agent overview', () => {
    const setUpTwoAgents = () => {
      const sessionA = createMockWorktreeSession({ id: 'session-1', label: 'main' });
      const sessionB = createMockWorktreeSession({ id: 'session-2', label: 'feat-login' });
      const repository = createMockRepository({
        id: 'repo-1',
        name: 'termpad',
        worktreeSessions: [sessionA, sessionB],
      });

      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-1',
        activeTabId: 'tab-1',
        worktreeTabs: [
          {
            worktreeSessionId: 'session-1',
            tabs: [{ id: 'tab-1', name: 'claude', createdAt: new Date().toISOString(), order: 0 }],
            activeTabId: 'tab-1',
          },
          {
            worktreeSessionId: 'session-2',
            tabs: [{ id: 'tab-2', name: 'codex', createdAt: new Date().toISOString(), order: 0 }],
            activeTabId: 'tab-2',
          },
        ],
        terminals: new Map(),
      });
    };

    const openOverview = async () => {
      await act(async () => {
        fireEvent.click(screen.getByTestId('sidebar-toggle-overview'));
      });
    };

    it('shows all worktree tabs in a live grid and keeps terminals mounted across mode changes', async () => {
      setUpTwoAgents();
      const extra = useAppStore.getState().createTab('session-1', 'Shell');
      useAppStore.getState().setActiveTab('tab-1');
      render(<Layout />);
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const second = screen.getByTestId(`terminal-session-1:${extra.id}`);
      await act(async () => {
        useAppStore.getState().setWorktreeGridView('session-1', true);
      });
      expect(first).toHaveAttribute('data-visible', 'true');
      expect(second).toHaveAttribute('data-visible', 'true');
      expect(first.closest('[inert]')).toBeNull();
      expect(screen.getByTestId('terminal-session-2:tab-2')).toHaveAttribute(
        'data-visible',
        'false'
      );
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'false');
      fireEvent.pointerDown(second, { pointerType: 'mouse', button: 0 });
      fireEvent.pointerUp(second, { pointerType: 'mouse', button: 0 });
      expect(useAppStore.getState().activeTabId).toBe(extra.id);
      expect(second).toHaveAttribute('data-focused', 'true');
      expect(first).toHaveAttribute('data-focused', 'false');
      await openOverview();
      fireEvent.click(screen.getByRole('button', { name: 'Close overview' }));
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(first);
      expect(screen.getByTestId(`terminal-session-1:${extra.id}`)).toBe(second);
      expect(first).toHaveAttribute('data-visible', 'true');
      expect(second).toHaveAttribute('data-visible', 'true');
      await act(async () => {
        useAppStore.getState().createTab('session-1', 'New agent');
      });
      expect(screen.getByRole('button', { name: 'Open New agent in main' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Open Shell in main' }));
      expect(first).toHaveAttribute('data-visible', 'false');
      expect(second).toHaveAttribute('data-visible', 'true');
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });

    it('shows interactive agents only in the selected repository without remounting terminals', async () => {
      setUpTwoAgents();
      useAppStore.setState((state) => ({
        repositories: [
          ...state.repositories,
          createMockRepository({
            id: 'repo-other',
            name: 'Other repo',
            worktreeSessions: [createMockWorktreeSession({ id: 'session-other' })],
          }),
        ],
        worktreeTabs: [
          ...state.worktreeTabs,
          {
            worktreeSessionId: 'session-other',
            activeTabId: 'other-tab',
            tabs: [{ id: 'other-tab', name: 'Other agent', createdAt: '', order: 0 }],
          },
        ],
      }));
      render(<Layout />);
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const second = screen.getByTestId('terminal-session-2:tab-2');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open agent overview' }));
      });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'true');
      expect(screen.getByRole('button', { name: 'Open agent overview' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(first).toHaveAttribute('data-visible', 'true');
      expect(second).toHaveAttribute('data-visible', 'true');
      expect(screen.getByTestId('terminal-session-other:other-tab')).toHaveAttribute(
        'data-visible',
        'false'
      );
      expect(first.closest('[inert]')).toBeNull();
      expect(second.closest('[inert]')).toBeNull();
      fireEvent.pointerDown(second, { pointerType: 'mouse', button: 0 });
      fireEvent.pointerUp(second, { pointerType: 'mouse', button: 0 });
      expect(useAppStore.getState().activeTerminalId).toBe('session-2');
      expect(useAppStore.getState().activeTabId).toBe('tab-2');
      expect(second).toHaveAttribute('data-focused', 'true');
      expect(first).toHaveAttribute('data-focused', 'false');
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      const terminalInput = document.createElement('textarea');
      terminalInput.className = 'xterm';
      second.appendChild(terminalInput);
      fireEvent.keyDown(terminalInput, { key: 'Escape' });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close overview' }));
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(first);
      expect(screen.getByTestId('terminal-session-2:tab-2')).toBe(second);
      expect(first).toHaveAttribute('data-visible', 'false');
      expect(second).toHaveAttribute('data-visible', 'true');
    });

    it('opens the same overview with a repository filter and shares its toggle', async () => {
      setUpTwoAgents();
      render(<Layout />);
      const repositoryButton = screen.getByRole('button', { name: 'Open agent overview' });
      fireEvent.click(repositoryButton);
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'true');
      expect(screen.getByRole('combobox', { name: 'Overview repository' })).toHaveTextContent(
        'termpad'
      );
      expect(repositoryButton).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(repositoryButton);
      expect(screen.getByText('Agent overview')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('combobox', { name: 'Overview repository' }));
      await user.click(screen.getByRole('option', { name: 'All repositories' }));
      expect(repositoryButton).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'true');

      fireEvent.click(repositoryButton);
      expect(repositoryButton).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByTestId('sidebar-toggle-overview'));
      expect(screen.queryByText('Agent overview')).not.toBeInTheDocument();
      expect(repositoryButton).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'false');
      await openOverview();
      expect(screen.getByRole('combobox', { name: 'Overview repository' })).toHaveTextContent(
        'All repositories'
      );
    });

    it('shows only the active agent terminal while closed', () => {
      setUpTwoAgents();
      render(<Layout />);

      expect(screen.getByTestId('terminal-session-1:tab-1')).toHaveAttribute(
        'data-visible',
        'true'
      );
      expect(screen.getByTestId('terminal-session-2:tab-2')).toHaveAttribute(
        'data-visible',
        'false'
      );
    });

    it('shows every agent terminal when opened', async () => {
      setUpTwoAgents();
      render(<Layout />);

      await openOverview();

      expect(screen.getByTestId('terminal-session-1:tab-1')).toHaveAttribute(
        'data-visible',
        'true'
      );
      expect(screen.getByTestId('terminal-session-2:tab-2')).toHaveAttribute(
        'data-visible',
        'true'
      );
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-overview-mode', 'true');
      expect(screen.getByRole('button', { name: 'Open agent overview' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.queryByTestId('worktree-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument();
    });

    it('hides and restores agents without closing or remounting their terminals', async () => {
      setUpTwoAgents();
      render(<Layout />);
      await openOverview();
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const second = screen.getByTestId('terminal-session-2:tab-2');
      fireEvent.contextMenu(first);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Hide from overview' }));
      expect(first).toHaveAttribute('data-visible', 'false');
      expect(second).toHaveAttribute('data-visible', 'true');
      expect(screen.getByText('(1)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hidden (1)' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close overview' }));
      expect(first).toHaveAttribute('data-visible', 'true');
      await openOverview();
      expect(first).toHaveAttribute('data-visible', 'false');
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Hidden (1)' }));
      await user.click(screen.getByRole('menuitem', { name: /claude.*termpad.*main/ }));
      expect(first).toHaveAttribute('data-visible', 'true');
      expect(screen.queryByRole('button', { name: /Hidden/ })).not.toBeInTheDocument();
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(first);
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });

    it('restores hidden agents within the current repository filter and handles an empty grid', async () => {
      setUpTwoAgents();
      const [repo] = useAppStore.getState().repositories;
      useAppStore.setState({
        repositories: [
          { ...repo, worktreeSessions: [repo.worktreeSessions[0]] },
          {
            ...repo,
            id: 'repo-2',
            name: 'Other repo',
            worktreeSessions: [repo.worktreeSessions[1]],
          },
        ],
      });
      render(<Layout />);
      await openOverview();
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const second = screen.getByTestId('terminal-session-2:tab-2');
      for (const terminal of [first, second]) {
        fireEvent.contextMenu(terminal);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Hide from overview' }));
      }
      expect(screen.getByText('All agents in this view are hidden')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Open agent overview' }));
      expect(screen.getByRole('button', { name: 'Hidden (1)' })).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Hidden (1)' }));
      await user.click(screen.getByRole('menuitem', { name: 'Show all hidden agents' }));
      expect(first).toHaveAttribute('data-visible', 'true');
      await user.click(screen.getByRole('combobox', { name: 'Overview repository' }));
      await user.click(screen.getByRole('option', { name: 'All repositories' }));
      expect(second).toHaveAttribute('data-visible', 'false');
      expect(screen.getByRole('button', { name: 'Hidden (1)' })).toBeInTheDocument();
      fireEvent.contextMenu(first);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Hide from overview' }));
      fireEvent.click(screen.getByRole('button', { name: 'Show hidden agents' }));
      expect(first).toHaveAttribute('data-visible', 'true');
      expect(second).toHaveAttribute('data-visible', 'true');
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });

    it('navigates overview agents before terminal input and opens the selected worktree', async () => {
      setUpTwoAgents();
      render(<Layout />);
      await openOverview();
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const input = document.createElement('textarea');
      input.className = 'xterm';
      first.appendChild(input);
      const terminalKey = vi.fn();
      input.addEventListener('keydown', terminalKey);
      fireEvent.keyDown(input, { key: 'ArrowRight', ctrlKey: true });
      expect(terminalKey).not.toHaveBeenCalled();
      expect(useAppStore.getState().activeTerminalId).toBe('session-2');
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
      expect(screen.queryByText('Agent overview')).not.toBeInTheDocument();
      expect(useAppStore.getState().activeTabId).toBe('tab-2');
    });

    it('uses the running-agent close confirmation for the overview close shortcut', async () => {
      setUpTwoAgents();
      useAppStore.setState({
        terminals: new Map([
          [
            'session-1:tab-1',
            {
              id: 'session-1:tab-1',
              status: 'running',
              lastActivityTime: Date.now(),
              hasReceivedOutput: true,
            },
          ],
        ]),
      });
      render(<Layout />);
      await openOverview();
      fireEvent.keyDown(window, { key: '-', ctrlKey: true });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(window.terminal.kill).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
      expect(useAppStore.getState().activeTabId).toBe('tab-1');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: '-', ctrlKey: true });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('terminal-session-1:tab-1')).not.toBeInTheDocument();
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
    });

    it('reopens the repository overview after navigating to a worktree at the app root', async () => {
      setUpTwoAgents();
      render(<App />);
      const terminal = screen.getByTestId('terminal-session-1:tab-1');
      const input = document.createElement('textarea');
      input.className = 'xterm';
      terminal.appendChild(input);
      for (let cycle = 0; cycle < 3; cycle++) {
        fireEvent.keyDown(input, { key: 'i', ctrlKey: true });
        expect(screen.getByText('Agent overview')).toBeInTheDocument();
        fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, shiftKey: true });
        expect(screen.queryByText('Agent overview')).not.toBeInTheDocument();
        expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(terminal);
      }
      fireEvent.keyDown(input, { key: 'i', ctrlKey: true });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });

    it('opens the active repository grid from terminal input with Ctrl+I', async () => {
      setUpTwoAgents();
      const [repo] = useAppStore.getState().repositories;
      useAppStore.setState({
        repositories: [
          { ...repo, worktreeSessions: [repo.worktreeSessions[0]] },
          {
            ...repo,
            id: 'repo-2',
            name: 'Other repo',
            worktreeSessions: [repo.worktreeSessions[1]],
          },
        ],
        activeTerminalId: 'session-2',
        activeTabId: 'tab-2',
      });
      render(<Layout />);
      const terminal = screen.getByTestId('terminal-session-2:tab-2');
      const input = document.createElement('textarea');
      input.className = 'xterm';
      terminal.appendChild(input);
      fireEvent.keyDown(input, { key: 'i', ctrlKey: true });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Overview repository' })).toHaveTextContent(
        'Other repo'
      );
      expect(screen.getByTestId('terminal-session-1:tab-1')).toHaveAttribute(
        'data-visible',
        'false'
      );
      expect(screen.getByTestId('terminal-session-2:tab-2')).toBe(terminal);
      expect(terminal).toHaveAttribute('data-visible', 'true');
      fireEvent.keyDown(input, { key: 'i', ctrlKey: true });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(window.terminal.kill).not.toHaveBeenCalled();
    });

    it('opens an overview agent in its worktree after expanding a review', async () => {
      setUpTwoAgents();
      render(<Layout />);
      fireEvent.click(screen.getByTestId('right-panel-tab-review'));
      fireEvent.click(screen.getByText('Expand review'));
      const terminal = screen.getByTestId('terminal-session-1:tab-1');
      expect(terminal).toHaveAttribute('data-visible', 'false');
      await openOverview();
      expect(terminal).toBeVisible();
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
      expect(screen.queryByText('Agent overview')).not.toBeInTheDocument();
      expect(terminal).toBeVisible();
      expect(terminal).toHaveAttribute('data-visible', 'true');
      expect(screen.getByTestId('right-panel').style.width).not.toBe('100%');
    });

    it('hides the right panel while open', async () => {
      setUpTwoAgents();
      render(<Layout />);

      await openOverview();

      expect(screen.getByTestId('right-panel')).toHaveStyle({ display: 'none' });
    });

    it('focuses the clicked terminal while keeping global overview open and leaves agent keys alone', async () => {
      setUpTwoAgents();
      render(<Layout />);
      await openOverview();
      const first = screen.getByTestId('terminal-session-1:tab-1');
      const second = screen.getByTestId('terminal-session-2:tab-2');
      expect(first.closest('[inert]')).toBeNull();
      expect(second.closest('[inert]')).toBeNull();
      fireEvent.pointerDown(second, { pointerType: 'mouse', button: 0 });
      fireEvent.pointerUp(second, { pointerType: 'mouse', button: 0 });
      fireEvent.click(second);
      expect(useAppStore.getState().activeTerminalId).toBe('session-2');
      expect(second).toHaveAttribute('data-focused', 'true');
      expect(first).toHaveAttribute('data-focused', 'false');
      const input = document.createElement('textarea');
      input.className = 'xterm';
      second.appendChild(input);
      for (const key of ['ArrowRight', 'Enter', 'Escape']) fireEvent.keyDown(input, { key });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
    });

    it('fills the grid across repositories and keeps terminal nodes mounted when toggled', async () => {
      setUpTwoAgents();
      const [repo] = useAppStore.getState().repositories;
      useAppStore.setState({
        repositories: [
          { ...repo, worktreeSessions: [repo.worktreeSessions[0]] },
          { ...repo, id: 'repo-2', worktreeSessions: [repo.worktreeSessions[1]] },
        ],
      });
      render(<Layout />);
      const firstTerminal = screen.getByTestId('terminal-session-1:tab-1');
      const secondTerminal = screen.getByTestId('terminal-session-2:tab-2');
      await openOverview();

      const firstTile = screen.getByTestId('agent-tile-session-1:tab-1');
      const secondTile = screen.getByTestId('agent-tile-session-2:tab-2');
      expect(firstTile.parentElement).toBe(secondTile.parentElement);
      expect(firstTile.parentElement?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
      expect(firstTile.parentElement?.style.gridTemplateRows).toBe('repeat(1, minmax(0, 1fr))');
      expect(screen.queryByRole('heading', { name: /termpad/ })).not.toBeInTheDocument();
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(firstTerminal);
      expect(screen.getByTestId('terminal-session-2:tab-2')).toBe(secondTerminal);

      await openOverview();
      expect(screen.getByTestId('terminal-session-1:tab-1')).toBe(firstTerminal);
      expect(screen.getByTestId('terminal-session-2:tab-2')).toBe(secondTerminal);
    });

    it('opens the agent from its right-click menu and closes the overview', async () => {
      setUpTwoAgents();
      render(<Layout />);

      await openOverview();
      fireEvent.contextMenu(screen.getByTestId('terminal-session-2:tab-2'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Open in worktree' }));

      expect(useAppStore.getState().activeTerminalId).toBe('session-2');
      expect(useAppStore.getState().activeTabId).toBe('tab-2');
      expect(screen.getByTestId('worktree-bar')).toBeInTheDocument();
    });

    it('closes an agent in another repository and focuses a remaining pane', async () => {
      setUpTwoAgents();
      const [repo] = useAppStore.getState().repositories;
      useAppStore.setState({
        repositories: [
          { ...repo, worktreeSessions: [repo.worktreeSessions[0]] },
          {
            ...repo,
            id: 'repo-2',
            name: 'other-repo',
            worktreeSessions: [repo.worktreeSessions[1]],
          },
        ],
      });
      const user = userEvent.setup();
      render(<Layout />);
      await openOverview();
      fireEvent.contextMenu(screen.getByTestId('agent-tile-session-2:tab-2'));
      await user.click(screen.getByRole('menuitem', { name: 'Close' }));

      expect(window.terminal.kill).toHaveBeenCalledWith('session-2:tab-2');
      expect(window.terminal.kill).not.toHaveBeenCalledWith('session-1:tab-1');
      expect(useAppStore.getState().activeTerminalId).toBe('session-1');
      expect(screen.queryByTestId('agent-tile-session-2:tab-2')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /other-repo/ })).not.toBeInTheDocument();
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('agent-tile-session-1:tab-1')).toHaveFocus();
      });
    });

    it.each(['running', 'waiting', 'starting'] as const)(
      'confirms before closing a %s terminal',
      async (status) => {
        setUpTwoAgents();
        useAppStore.setState({
          terminals: new Map([
            [
              'session-2:tab-2',
              {
                id: 'session-2:tab-2',
                status,
                lastActivityTime: Date.now(),
                hasReceivedOutput: true,
              },
            ],
          ]),
        });
        const user = userEvent.setup();
        render(<Layout />);
        await openOverview();
        fireEvent.contextMenu(screen.getByTestId('agent-tile-session-2:tab-2'));
        await user.click(screen.getByRole('menuitem', { name: 'Close' }));
        expect(window.terminal.kill).not.toHaveBeenCalled();
        const dialog = screen.getByRole('alertdialog');
        expect(within(dialog).getByText(/Process "codex" is running/)).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Close' }));
        expect(window.terminal.kill).toHaveBeenCalledWith('session-2:tab-2');
        expect(useAppStore.getState().terminals.has('session-2:tab-2')).toBe(false);
        expect(screen.queryByTestId('agent-tile-session-2:tab-2')).not.toBeInTheDocument();
        expect(screen.getByText('Agent overview')).toBeInTheDocument();
      }
    );

    it('dismisses the menu and confirmation with Escape without leaving the overview', async () => {
      setUpTwoAgents();
      useAppStore.getState().registerTerminal('session-2:tab-2');
      const user = userEvent.setup();
      render(<Layout />);
      await openOverview();
      const card = screen.getByTestId('agent-tile-session-2:tab-2');
      fireEvent.contextMenu(card);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      await waitFor(() => expect(card).toHaveFocus());

      fireEvent.contextMenu(card);
      await user.click(screen.getByRole('menuitem', { name: 'Close' }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
      expect(window.terminal.kill).not.toHaveBeenCalled();
      await waitFor(() => expect(card).toHaveFocus());
    });

    it('shows the empty overview after closing the last card', async () => {
      setUpTwoAgents();
      const user = userEvent.setup();
      render(<Layout />);
      await openOverview();
      for (const id of ['agent-tile-session-1:tab-1', 'agent-tile-session-2:tab-2']) {
        fireEvent.contextMenu(screen.getByTestId(id));
        await user.click(screen.getByRole('menuitem', { name: 'Close' }));
      }
      expect(screen.getByText('No agents yet')).toBeInTheDocument();
      expect(screen.getByText('Agent overview')).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      setUpTwoAgents();
      render(<Layout />);

      await openOverview();
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(screen.getByTestId('worktree-bar')).toBeInTheDocument();
    });

    it('toggles with Ctrl+O', async () => {
      setUpTwoAgents();
      render(<Layout />);

      await act(async () => {
        fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
      });
      expect(screen.getByText('Agent overview')).toBeInTheDocument();

      await act(async () => {
        fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
      });
      expect(screen.queryByText('Agent overview')).not.toBeInTheDocument();
    });

    it('tells the sidebar whether any agents exist', () => {
      setUpTwoAgents();
      const { unmount } = render(<Layout />);
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-has-agents', 'true');
      unmount();

      useAppStore.setState({ repositories: [], worktreeTabs: [], activeTerminalId: null });
      render(<Layout />);
      expect(screen.getByTestId('sidebar')).toHaveAttribute('data-has-agents', 'false');
    });
  });
});
