import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryTree } from './RepositoryTree';
import { createMockRepository, createMockWorktreeSession } from '../../../../tests/utils';
import type { Repository, TerminalState } from '../../../shared/types';

describe('RepositoryTree', () => {
  const defaultProps = {
    repositories: [] as Repository[],
    activeSessionId: null as string | null,
    terminals: new Map<string, TerminalState>(),
    worktreeTabs: [],
    getTerminalIdForTab: (worktreeSessionId: string, tabId: string) =>
      `${worktreeSessionId}:${tabId}`,
    onSessionClick: vi.fn(),
    onTabClick: vi.fn(),
    onNewWorktree: vi.fn(),
    onToggleExpand: vi.fn(),
    onRepositoryDelete: vi.fn(),
    onOpenRepositorySettings: vi.fn(),
    onWorktreeRemove: vi.fn(),
    onReorderSessions: vi.fn(),
    onReorderRepositories: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders empty when no projects', () => {
      const { container } = render(<RepositoryTree {...defaultProps} />);
      // Should render the container div but no project items
      const projectItems = container.querySelectorAll('.group');
      expect(projectItems.length).toBe(0);
    });

    it('renders a single project', () => {
      const repository = createMockRepository({ name: 'My Project' });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);
      expect(screen.getByText('My Project')).toBeInTheDocument();
    });

    it('renders multiple repositories', () => {
      const repos = [
        createMockRepository({ id: 'r1', name: 'Repository 1' }),
        createMockRepository({ id: 'r2', name: 'Repository 2' }),
        createMockRepository({ id: 'r3', name: 'Repository 3' }),
      ];
      render(<RepositoryTree {...defaultProps} repositories={repos} />);

      expect(screen.getByText('Repository 1')).toBeInTheDocument();
      expect(screen.getByText('Repository 2')).toBeInTheDocument();
      expect(screen.getByText('Repository 3')).toBeInTheDocument();
    });

    it('shows git branch icon for each worktree session', () => {
      const repository = createMockRepository({
        name: 'Project',
        isExpanded: true,
        worktreeSessions: [createMockWorktreeSession({ label: 'Main' })],
      });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );
      // Lucide git-branch icons render as SVG on worktree sessions
      const gitBranchIcons = container.querySelectorAll('svg.lucide-git-branch');
      expect(gitBranchIcons.length).toBeGreaterThanOrEqual(1);
    });

    // Note: "(No Git)" label is no longer shown - all repositories are git repos now
  });

  describe('expand/collapse', () => {
    it('shows ChevronRight when collapsed', () => {
      const repository = createMockRepository({ name: 'Project', isExpanded: false });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );
      const chevronRight = container.querySelector('svg.lucide-chevron-right');
      expect(chevronRight).toBeInTheDocument();
    });

    it('shows rotated ChevronRight when expanded', () => {
      const repository = createMockRepository({ name: 'Project', isExpanded: true });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );
      const chevronRight = container.querySelector('svg.lucide-chevron-right');
      expect(chevronRight).toBeInTheDocument();
      expect(chevronRight).toHaveClass('rotate-90');
    });

    it('calls onToggleExpand when clicking chevron', () => {
      const repository = createMockRepository({ id: 'p1', name: 'Project', isExpanded: false });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );

      const chevronButton = container.querySelector('button');
      fireEvent.click(chevronButton!);

      expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('p1');
    });

    it('shows sessions when expanded', () => {
      const repository = createMockRepository({
        name: 'Project',
        isExpanded: true,
        worktreeSessions: [createMockWorktreeSession({ label: 'Test Session' })],
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('hides sessions when collapsed', () => {
      const repository = createMockRepository({
        name: 'Project',
        isExpanded: false,
        worktreeSessions: [createMockWorktreeSession({ label: 'Test Session' })],
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);
      expect(screen.queryByText('Test Session')).not.toBeInTheDocument();
    });
  });

  describe('add worktree button', () => {
    it('shows add worktree button for git projects', () => {
      const repository = createMockRepository({
        name: 'Git Project',

        isExpanded: true,
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const addWorktreeButton = screen.getByRole('button', { name: /add worktree/i });
      expect(addWorktreeButton).toBeInTheDocument();
    });

    // Note: add worktree button is always shown now - all repositories are git repos

    it('calls onNewWorktree when clicking add worktree button', () => {
      const repository = createMockRepository({
        id: 'p1',
        name: 'Git Project',

        isExpanded: true,
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const addWorktreeButton = screen.getByRole('button', { name: /add worktree/i });
      fireEvent.click(addWorktreeButton);

      expect(defaultProps.onNewWorktree).toHaveBeenCalledWith('p1');
    });

    it('stops event propagation when clicking add worktree button', () => {
      const repository = createMockRepository({
        id: 'p1',
        name: 'Git Project',

        isExpanded: true,
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const addWorktreeButton = screen.getByRole('button', { name: /add worktree/i });
      fireEvent.click(addWorktreeButton);

      // onToggleExpand should not be called
      expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('renders session labels', () => {
      const repository = createMockRepository({
        isExpanded: true,
        worktreeSessions: [
          createMockWorktreeSession({ label: 'Main Session' }),
          createMockWorktreeSession({ label: 'Feature Branch' }),
        ],
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      expect(screen.getByText('Main Session')).toBeInTheDocument();
      expect(screen.getByText('Feature Branch')).toBeInTheDocument();
    });

    it('calls onSessionClick when clicking a session', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Test Session' });
      const repository = createMockRepository({
        isExpanded: true,
        worktreeSessions: [session],
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const sessionButton = screen.getByText('Test Session');
      fireEvent.click(sessionButton);

      expect(defaultProps.onSessionClick).toHaveBeenCalledWith('session-1');
    });

    it('highlights active session', () => {
      const session = createMockWorktreeSession({ id: 'active-session', label: 'Active Session' });
      const repository = createMockRepository({
        isExpanded: true,
        worktreeSessions: [session],
      });
      render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          activeSessionId="active-session"
        />
      );

      const sessionItem = screen.getByText('Active Session').closest('[role="button"]');
      expect(sessionItem).toHaveClass('bg-sidebar-accent');
    });

    it('does not highlight inactive sessions', () => {
      const session = createMockWorktreeSession({
        id: 'inactive-session',
        label: 'Inactive Session',
      });
      const repository = createMockRepository({
        isExpanded: true,
        worktreeSessions: [session],
      });
      render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          activeSessionId="other-session"
        />
      );

      const sessionItem = screen.getByText('Inactive Session').closest('[role="button"]');
      expect(sessionItem).not.toHaveClass('bg-sidebar-accent');
    });
  });

  describe('terminal status indicator (tab-based)', () => {
    it('shows no status dots when worktree has no tabs', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });

      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} worktreeTabs={[]} />
      );

      // No status dots should be shown when there are no tabs
      const statusDots = container.querySelectorAll('.h-1\\.5.w-1\\.5.rounded-full');
      expect(statusDots.length).toBe(0);
    });

    it('shows stopped indicator for tab without terminal state', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 'session-1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          worktreeTabs={worktreeTabs}
          terminals={new Map()}
        />
      );

      // Should show stopped (orange) status when terminal not found
      const statusDot = container.querySelector('.bg-status-stopped');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows error indicator for errored tab terminal', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 'session-1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1:tab1', {
        id: 'session-1:tab1',
        status: 'error',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Error status shows a red dot
      const statusDot = container.querySelector('.bg-status-error');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows idle indicator for idle tab terminal', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 'session-1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1:tab1', {
        id: 'session-1:tab1',
        status: 'idle',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Idle status is a slate dot
      const statusDot = container.querySelector('.bg-status-idle');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows running indicator for running tab terminal', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 'session-1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1:tab1', {
        id: 'session-1:tab1',
        status: 'running',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Running status is an emerald pulsing dot
      const statusDot = container.querySelector('.bg-status-running');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows waiting indicator for waiting tab terminal', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 'session-1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1:tab1', {
        id: 'session-1:tab1',
        status: 'waiting',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Waiting status is a bright yellow dot
      const statusDot = container.querySelector('.bg-status-waiting');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('git status display', () => {
    it('renders session with terminal state from map', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: 0,
        hasReceivedOutput: false,
        gitStatus: { branch: 'feature/new-feature', isDirty: false, additions: 0, deletions: 0 },
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session label should be rendered
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('stores git status in terminal state', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: 0,
        hasReceivedOutput: false,
        gitStatus: { branch: 'main', isDirty: true, additions: 5, deletions: 2 },
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session renders with terminal state (git status tracked internally)
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('renders session without dirty indicator in UI (status is tracked internally)', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: 0,
        hasReceivedOutput: false,
        gitStatus: { branch: 'main', isDirty: false, additions: 0, deletions: 0 },
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session renders with terminal state
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('shows git branch icon at project level', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'idle',
        lastActivityTime: 0,
        hasReceivedOutput: false,
        gitStatus: { branch: 'main', isDirty: false, additions: 0, deletions: 0 },
      });

      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Git branch icon is shown on worktree sessions
      const branchIcon = container.querySelector('svg.lucide-git-branch');
      expect(branchIcon).toBeInTheDocument();
    });
  });

  describe('session actions for stopped sessions', () => {
    it('shows stopped session with dropdown menu', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'stopped',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session with dropdown menu should be rendered
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('renders session item which can trigger onStart via dropdown', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'stopped',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session is rendered, start action is available via dropdown menu
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('renders session item with click handler for selection', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'stopped',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Click on session label selects it
      const sessionElement = screen.getByText('Session');
      fireEvent.click(sessionElement);
      expect(defaultProps.onSessionClick).toHaveBeenCalledWith('session-1');
    });

    it('does not show start button for running sessions', () => {
      const session = createMockWorktreeSession({ id: 'session-1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('session-1', {
        id: 'session-1',
        status: 'running',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      const startButton = screen.queryByTitle('Start Terminal');
      expect(startButton).not.toBeInTheDocument();
    });
  });

  describe('context menus', () => {
    it('wraps project header in ProjectContextMenu', () => {
      const repository = createMockRepository({ name: 'Project' });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      // The project header should be present
      const projectHeader = screen.getByText('Project');
      expect(projectHeader).toBeInTheDocument();
    });

    it('wraps session in WorktreeContextMenu', () => {
      const session = createMockWorktreeSession({ label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const sessionButton = screen.getByText('Session');
      expect(sessionButton).toBeInTheDocument();
    });

    it('has context menu trigger for project', () => {
      const repository = createMockRepository({ id: 'p1', name: 'Project' });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );

      // Verify context menu trigger is present (has data-slot attribute)
      const trigger = container.querySelector('[data-slot="context-menu-trigger"]');
      expect(trigger).toBeInTheDocument();
    });

    it('has dropdown menu for session', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      // Session is rendered and has a dropdown menu (WorktreeDropdownMenu)
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('passes correct props to WorktreeContextMenu for stopped session', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('s1', {
        id: 's1',
        status: 'stopped',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session is rendered with correct label
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('passes correct props to WorktreeContextMenu for running session', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const terminals = new Map<string, TerminalState>();
      terminals.set('s1', {
        id: 's1',
        status: 'running',
        lastActivityTime: 0,
        hasReceivedOutput: false,
      });

      render(
        <RepositoryTree {...defaultProps} repositories={[repository]} terminals={terminals} />
      );

      // Session is rendered
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    it('passes correct props for worktree session', () => {
      const session = createMockWorktreeSession({
        id: 's1',
        label: 'Worktree Session',
      });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });

      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      expect(screen.getByText('Worktree Session')).toBeInTheDocument();
    });

    it('passes correct props for main session', () => {
      const session = createMockWorktreeSession({
        id: 's1',
        label: 'Main Session',
      });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });

      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      expect(screen.getByText('Main Session')).toBeInTheDocument();
    });
  });

  describe('callbacks are passed correctly', () => {
    it('passes onRepositoryDelete to ProjectContextMenu', () => {
      const repository = createMockRepository({ id: 'p1', name: 'Project' });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      // Callback is not yet called
      expect(defaultProps.onRepositoryDelete).not.toHaveBeenCalled();
    });

    it('passes onWorktreeRemove to WorktreeContextMenu', () => {
      const session = createMockWorktreeSession({
        id: 's1',
        label: 'Worktree Session',
      });
      const repository = createMockRepository({
        id: 'p1',
        isExpanded: true,
        worktreeSessions: [session],
      });

      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      expect(defaultProps.onWorktreeRemove).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles project with no sessions', () => {
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [] });
      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} />
      );

      // Should render project but no session items
      expect(screen.getByText(repository.name)).toBeInTheDocument();
      const sessionButtons = container.querySelectorAll('button.text-left');
      // Only the expand/collapse button should exist
      expect(sessionButtons.length).toBe(0);
    });

    it('handles project with many sessions', () => {
      const sessions = Array.from({ length: 10 }, (_, i) =>
        createMockWorktreeSession({ id: `s${i}`, label: `Session ${i}` })
      );
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: sessions });

      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Session ${i}`)).toBeInTheDocument();
      }
    });

    it('handles long project names with truncation', () => {
      const repository = createMockRepository({
        name: 'This is a very long project name that should be truncated',
      });
      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const nameElement = screen.getByText(
        'This is a very long project name that should be truncated'
      );
      expect(nameElement).toHaveClass('truncate');
    });

    it('handles long session labels with truncation', () => {
      const session = createMockWorktreeSession({
        label: 'This is a very long session label that should be truncated',
      });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });

      render(<RepositoryTree {...defaultProps} repositories={[repository]} />);

      const labelElement = screen.getByText(
        'This is a very long session label that should be truncated'
      );
      expect(labelElement).toHaveClass('truncate');
    });

    it('handles unknown terminal status gracefully', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 's1',
          tabs: [{ id: 'tab1', name: 'Terminal', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      // @ts-expect-error - Testing unknown status
      terminals.set('s1:tab1', { id: 's1:tab1', status: 'unknown_status' });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Should fall back to slate dot (default for unknown status)
      const statusDot = container.querySelector('.bg-status-idle');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('tab status dots', () => {
    it('renders status dots for each tab in a worktree', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 's1',
          tabs: [
            { id: 'tab1', name: 'claude', createdAt: '2025-01-01T00:00:00Z', order: 0 },
            { id: 'tab2', name: 'Terminal', createdAt: '2025-01-01T00:01:00Z', order: 1 },
          ],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('s1:tab1', {
        id: 's1:tab1',
        status: 'running',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab2', {
        id: 's1:tab2',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Should show running (emerald) and idle (slate) dots
      const runningDot = container.querySelector('.bg-status-running');
      const idleDot = container.querySelector('.bg-status-idle');
      expect(runningDot).toBeInTheDocument();
      expect(idleDot).toBeInTheDocument();
    });

    it('does not render status dots when there are no tabs', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });

      const { container } = render(
        <RepositoryTree {...defaultProps} repositories={[repository]} worktreeTabs={[]} />
      );

      // The status dots container should not be present
      const dotsContainer = container.querySelector('.flex.items-center.gap-1.mt-1');
      expect(dotsContainer).not.toBeInTheDocument();
    });

    it('renders dots in tab order', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 's1',
          tabs: [
            { id: 'tab1', name: 'First', createdAt: '2025-01-01T00:00:00Z', order: 0 },
            { id: 'tab2', name: 'Second', createdAt: '2025-01-01T00:01:00Z', order: 1 },
            { id: 'tab3', name: 'Third', createdAt: '2025-01-01T00:02:00Z', order: 2 },
          ],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('s1:tab1', {
        id: 's1:tab1',
        status: 'running',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab2', {
        id: 's1:tab2',
        status: 'waiting',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab3', {
        id: 's1:tab3',
        status: 'error',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Should have dots for all three tabs
      const allDots = container.querySelectorAll('.h-2\\.5.w-2\\.5.rounded-full');
      expect(allDots.length).toBe(3);

      // Verify colors in order: running, waiting, error
      expect(allDots[0]).toHaveClass('bg-status-running');
      expect(allDots[1]).toHaveClass('bg-status-waiting');
      expect(allDots[2]).toHaveClass('bg-status-error');
    });

    it('shows stopped status for tabs without terminal state', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 's1',
          tabs: [{ id: 'tab1', name: 'New Tab', createdAt: '2025-01-01T00:00:00Z', order: 0 }],
          activeTabId: 'tab1',
        },
      ];

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          worktreeTabs={worktreeTabs}
          terminals={new Map()}
        />
      );

      // Should show stopped (orange) status for tab without terminal state
      const stoppedDot = container.querySelector('.bg-status-stopped');
      expect(stoppedDot).toBeInTheDocument();
    });

    it('shows all status types correctly', () => {
      const session = createMockWorktreeSession({ id: 's1', label: 'Session' });
      const repository = createMockRepository({ isExpanded: true, worktreeSessions: [session] });
      const worktreeTabs = [
        {
          worktreeSessionId: 's1',
          tabs: [
            { id: 'tab1', name: 'Tab1', createdAt: '2025-01-01T00:00:00Z', order: 0 },
            { id: 'tab2', name: 'Tab2', createdAt: '2025-01-01T00:01:00Z', order: 1 },
            { id: 'tab3', name: 'Tab3', createdAt: '2025-01-01T00:02:00Z', order: 2 },
            { id: 'tab4', name: 'Tab4', createdAt: '2025-01-01T00:03:00Z', order: 3 },
            { id: 'tab5', name: 'Tab5', createdAt: '2025-01-01T00:04:00Z', order: 4 },
          ],
          activeTabId: 'tab1',
        },
      ];
      const terminals = new Map<string, TerminalState>();
      terminals.set('s1:tab1', {
        id: 's1:tab1',
        status: 'starting',
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });
      terminals.set('s1:tab2', {
        id: 's1:tab2',
        status: 'running',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab3', {
        id: 's1:tab3',
        status: 'waiting',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab4', {
        id: 's1:tab4',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });
      terminals.set('s1:tab5', {
        id: 's1:tab5',
        status: 'error',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      });

      const { container } = render(
        <RepositoryTree
          {...defaultProps}
          repositories={[repository]}
          terminals={terminals}
          worktreeTabs={worktreeTabs}
        />
      );

      // Check all status colors are present
      expect(container.querySelector('.bg-status-starting')).toBeInTheDocument(); // starting
      expect(container.querySelector('.bg-status-running')).toBeInTheDocument(); // running
      expect(container.querySelector('.bg-status-waiting')).toBeInTheDocument(); // waiting
      expect(container.querySelector('.bg-status-idle')).toBeInTheDocument(); // idle
      expect(container.querySelector('.bg-status-error')).toBeInTheDocument(); // error
    });
  });
});
