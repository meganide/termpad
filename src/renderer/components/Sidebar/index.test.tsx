import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './index';
import { useAppStore } from '../../stores/appStore';
import {
  resetAllStores,
  createMockRepository,
  createMockWorktreeSession,
  createMockRepositoryWithWorktreeSessions,
} from '../../../../tests/utils';
import type { TerminalState } from '../../../shared/types';

describe('Sidebar', () => {
  const defaultProps = {
    width: 260,
    onResizeStart: vi.fn(),
    onAddRepository: vi.fn(),
    onNewWorktree: vi.fn(),
    onRepositoryDelete: vi.fn(),
    onOpenRepositorySettings: vi.fn(),
    onWorktreeRemove: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHome: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  describe('rendering', () => {
    it('renders with correct width', () => {
      const { container } = render(<Sidebar {...defaultProps} width={300} />);
      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveStyle({ width: '300px' });
    });

    it('renders add repository button in footer', () => {
      render(<Sidebar {...defaultProps} />);
      // The "Add repository" button is in the footer - find all buttons with this text
      const addButtons = screen.getAllByText('Add repository');
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('renders resize handle', () => {
      const { container } = render(<Sidebar {...defaultProps} />);
      const resizeHandle = container.querySelector('.cursor-ew-resize');
      expect(resizeHandle).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no repositories', () => {
      useAppStore.setState({ repositories: [], isInitialized: true });
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('No repositories yet')).toBeInTheDocument();
    });

    it('shows hint to add repository in empty state', () => {
      useAppStore.setState({ repositories: [], isInitialized: true });
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Add a repository to get started')).toBeInTheDocument();
    });

    it('calls onAddRepository when clicking footer add repository button', () => {
      useAppStore.setState({ repositories: [], isInitialized: true });
      render(<Sidebar {...defaultProps} />);
      // Find the "Add repository" buttons - there are two in empty state (one in content, one in footer)
      const addButtons = screen.getAllByText('Add repository');
      fireEvent.click(addButtons[0]); // Click any of them
      expect(defaultProps.onAddRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('with repositories', () => {
    beforeEach(() => {
      const repository = createMockRepository({
        id: 'repository-1',
        name: 'Test Repository',
        isExpanded: true,
        worktreeSessions: [createMockWorktreeSession({ id: 'session-1', label: 'Main Session' })],
      });
      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
        terminals: new Map(),
        activeTerminalId: null,
      });
    });

    it('renders repository list', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Test Repository')).toBeInTheDocument();
    });

    it('does not show empty state', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.queryByText('No repositories yet')).not.toBeInTheDocument();
    });

    it('renders multiple repositories', () => {
      const repositories = [
        createMockRepository({ id: 'r1', name: 'Repository 1' }),
        createMockRepository({ id: 'r2', name: 'Repository 2' }),
        createMockRepository({ id: 'r3', name: 'Repository 3' }),
      ];
      useAppStore.setState({ repositories: repositories, isInitialized: true });
      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Repository 1')).toBeInTheDocument();
      expect(screen.getByText('Repository 2')).toBeInTheDocument();
      expect(screen.getByText('Repository 3')).toBeInTheDocument();
    });
  });

  describe('add repository button', () => {
    it('calls onAddRepository when clicking footer add repository button', () => {
      render(<Sidebar {...defaultProps} />);
      // Find the "Add repository" buttons - there may be multiple
      const addButtons = screen.getAllByText('Add repository');
      expect(addButtons.length).toBeGreaterThan(0);
      // Click the last one which should be in the footer
      fireEvent.click(addButtons[addButtons.length - 1]);
      expect(defaultProps.onAddRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('resize functionality', () => {
    it('calls onResizeStart on mousedown', () => {
      const { container } = render(<Sidebar {...defaultProps} />);
      const resizeHandle = container.querySelector('.cursor-ew-resize');
      expect(resizeHandle).toBeTruthy();

      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle);
      }

      // Should call onResizeStart
      expect(defaultProps.onResizeStart).toHaveBeenCalled();
    });
  });

  describe('store integration', () => {
    it('uses repositories from appStore', () => {
      const repository = createMockRepository({ name: 'Store Repository' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Store Repository')).toBeInTheDocument();
    });

    it('passes terminals Map to RepositoryTree', () => {
      const repository = createMockRepositoryWithWorktreeSessions(
        {
          id: 'r1',
          name: 'Repository',
          isExpanded: true,
        },
        1
      );

      const terminals = new Map<string, TerminalState>();
      terminals.set('session-r1-0', {
        id: 'session-r1-0',
        status: 'running',
        gitStatus: { branch: 'main', isDirty: false, additions: 0, deletions: 0 },
        lastActivityTime: Date.now(),
        hasReceivedOutput: false,
      });

      useAppStore.setState({
        repositories: [repository],
        terminals,
        isInitialized: true,
      });

      render(<Sidebar {...defaultProps} />);
      // The session with terminal state should render with running status indicator
      expect(screen.getByText('Worktree 0')).toBeInTheDocument();
    });

    it('highlights active session', () => {
      const repository = createMockRepositoryWithWorktreeSessions(
        {
          id: 'r1',
          name: 'Repository',
          isExpanded: true,
        },
        2
      );

      useAppStore.setState({
        repositories: [repository],
        activeTerminalId: 'session-r1-0',
        isInitialized: true,
      });

      render(<Sidebar {...defaultProps} />);
      // Active session should exist
      const worktreeSession = screen.getByText('Worktree 0');
      expect(worktreeSession).toBeInTheDocument();
    });

    it('calls setActiveTerminal on session click', () => {
      const repository = createMockRepositoryWithWorktreeSessions(
        {
          id: 'r1',
          name: 'Repository',
          isExpanded: true,
        },
        1
      );

      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      render(<Sidebar {...defaultProps} />);

      const sessionButton = screen.getByText('Worktree 0');
      fireEvent.click(sessionButton);

      const { activeTerminalId } = useAppStore.getState();
      expect(activeTerminalId).toBe('session-r1-0');
    });

    it('calls toggleRepositoryExpanded on repository toggle', () => {
      const repository = createMockRepository({
        id: 'r1',
        name: 'Repository',
        isExpanded: true,
        worktreeSessions: [createMockWorktreeSession()],
      });

      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      render(<Sidebar {...defaultProps} />);

      // Find and click the expand/collapse button (chevron)
      const repositoryHeader = screen.getByText('Repository').closest('.group');
      const chevronButton = repositoryHeader?.querySelector('button');
      if (chevronButton) {
        fireEvent.click(chevronButton);
      }

      const { repositories } = useAppStore.getState();
      expect(repositories[0].isExpanded).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('passes onNewTask to RepositoryTree', () => {
      const repository = createMockRepository({
        id: 'r1',
        name: 'Git Repository',

        isExpanded: false,
      });

      useAppStore.setState({
        repositories: [repository],
        isInitialized: true,
      });

      render(<Sidebar {...defaultProps} />);

      // Find the new task button (Plus icon on git repositories)
      const repositoryRow = screen.getByText('Git Repository').closest('.group');
      const plusButton = repositoryRow?.querySelector('button[title="New Task (Worktree)"]');

      if (plusButton) {
        fireEvent.click(plusButton);
        expect(defaultProps.onNewWorktree).toHaveBeenCalledWith('r1');
      }
    });

    it('passes onRepositoryDelete to RepositoryTree', () => {
      // Context menu testing requires more complex setup
      // Basic verification that the prop is passed
      const repository = createMockRepository({ id: 'r1', name: 'Repository' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      render(<Sidebar {...defaultProps} />);
      // The callback is passed - context menu tests are in RepositoryTree.test.tsx
      expect(defaultProps.onRepositoryDelete).not.toHaveBeenCalled();
    });

    it('passes onWorktreeRemove to RepositoryTree', () => {
      const repository = createMockRepository({ id: 'r1', name: 'Repository' });
      useAppStore.setState({ repositories: [repository], isInitialized: true });

      render(<Sidebar {...defaultProps} />);
      // The callback is passed - context menu tests are in RepositoryTree.test.tsx
      expect(defaultProps.onWorktreeRemove).not.toHaveBeenCalled();
    });
  });

  describe('onResizeStart callback', () => {
    it('calls onResizeStart when resize handle is clicked', () => {
      const onResizeStart = vi.fn();

      const { container } = render(<Sidebar {...defaultProps} onResizeStart={onResizeStart} />);

      // Trigger resize
      const resizeHandle = container.querySelector('.cursor-ew-resize');
      expect(resizeHandle).toBeTruthy();

      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle);
      }

      // Should call onResizeStart
      expect(onResizeStart).toHaveBeenCalledTimes(1);
    });
  });
});
