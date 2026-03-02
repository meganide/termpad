import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '@/components/Sidebar';
import { useAppStore } from '@/stores/appStore';
import { resetAllStores } from '../utils';

describe('Sidebar', () => {
  const defaultProps = {
    width: 260,
    onWidthChange: vi.fn(),
    onAddRepository: vi.fn(),
    onNewWorktree: vi.fn(),
    onRepositoryDelete: vi.fn(),
    onWorktreeRemove: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHome: vi.fn(),
  };

  beforeEach(() => {
    // Reset store to initial state with test repositories
    useAppStore.setState({
      repositories: [
        {
          id: '1',
          name: 'Test Repository',
          path: '/test/repository',

          isBare: false,
          isExpanded: true,
          worktreeSessions: [],
          createdAt: new Date().toISOString(),
        },
      ],
      terminals: new Map(),
      activeTerminalId: null,
      isInitialized: true,
      settings: { theme: 'dark', worktreeBasePath: null, gitPollIntervalMs: 5000 },
      window: { sidebarWidth: 260, width: 1400, height: 900, x: 100, y: 100, isMaximized: false },
    });
  });

  it('renders repository list', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Test Repository')).toBeInTheDocument();
  });

  it('renders add repository button in footer', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Add repository')).toBeInTheDocument();
  });

  it('shows empty state when no repositories', () => {
    useAppStore.setState({ repositories: [] });
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('No repositories yet')).toBeInTheDocument();
  });

  it('shows session label', () => {
    useAppStore.setState({
      repositories: [
        {
          id: '1',
          name: 'Test Repository',
          path: '/test/repository',

          isBare: false,
          isExpanded: true,
          worktreeSessions: [
            {
              id: 'session-1',

              label: 'feature-branch',
              path: '/test/repository/feature-branch',
              branchName: 'feature/awesome',
              createdAt: new Date().toISOString(),
              isExternal: false,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
      terminals: new Map(),
      activeTerminalId: null,
      isInitialized: true,
      settings: { theme: 'dark', worktreeBasePath: null, gitPollIntervalMs: 5000 },
      window: { sidebarWidth: 260, width: 1400, height: 900, x: 100, y: 100, isMaximized: false },
    });
    render(<Sidebar {...defaultProps} />);

    // Session label should be visible
    expect(screen.getByText('feature-branch')).toBeInTheDocument();
  });

  it('shows keyboard shortcut below session name', () => {
    useAppStore.setState({
      repositories: [
        {
          id: '1',
          name: 'Test Repository',
          path: '/test/repository',

          isBare: false,
          isExpanded: true,
          worktreeSessions: [
            {
              id: 'session-1',

              label: 'feature-branch',
              path: '/test/repository/feature-branch',
              branchName: 'feature/test',
              createdAt: new Date().toISOString(),
              isExternal: false,
              customShortcut: {
                key: '1',
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                metaKey: false,
              },
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
      terminals: new Map(),
      activeTerminalId: null,
      isInitialized: true,
      settings: { theme: 'dark', worktreeBasePath: null, gitPollIntervalMs: 5000 },
      window: { sidebarWidth: 260, width: 1400, height: 900, x: 100, y: 100, isMaximized: false },
    });
    render(<Sidebar {...defaultProps} />);

    // Session with customShortcut should show the shortcut key
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows ellipsis menu button for session', () => {
    useAppStore.setState({
      repositories: [
        {
          id: '1',
          name: 'Test Repository',
          path: '/test/repository',

          isBare: false,
          isExpanded: true,
          worktreeSessions: [
            {
              id: 'session-1',

              label: 'feature-branch',
              path: '/test/repository/feature-branch',
              branchName: 'feature/test',
              createdAt: new Date().toISOString(),
              isExternal: false,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
      terminals: new Map(),
      activeTerminalId: null,
      isInitialized: true,
      settings: { theme: 'dark', worktreeBasePath: null, gitPollIntervalMs: 5000 },
      window: { sidebarWidth: 260, width: 1400, height: 900, x: 100, y: 100, isMaximized: false },
    });
    render(<Sidebar {...defaultProps} />);

    // Ellipsis menu button should be visible
    expect(screen.getByRole('button', { name: 'Session menu' })).toBeInTheDocument();
  });

  describe('keyboard navigation integration', () => {
    beforeEach(() => {
      resetAllStores();
      useAppStore.setState({
        focusArea: 'sidebar',
        sidebarFocusedItemId: '1',
        repositories: [
          {
            id: '1',
            name: 'Test Repository',
            path: '/test/repository',

            isBare: false,
            isExpanded: true,
            worktreeSessions: [
              {
                id: 'session-1',

                label: 'feature-branch',
                path: '/test/repository/feature-branch',
                branchName: 'feature/test',
                createdAt: new Date().toISOString(),
                isExternal: false,
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ],
        terminals: new Map(),
        activeTerminalId: null,
        isInitialized: true,
        settings: { theme: 'dark', worktreeBasePath: null, gitPollIntervalMs: 5000 },
        window: { sidebarWidth: 260, width: 1400, height: 900, x: 100, y: 100, isMaximized: false },
      });
    });

    it('should show focus ring on focused repository', () => {
      const { container } = render(<Sidebar {...defaultProps} />);

      // The focused repository should have ring classes
      const repositoryHeader = container.querySelector('.ring-1');
      expect(repositoryHeader).not.toBeNull();
    });

    it('should show focus ring on focused session', () => {
      useAppStore.setState({ sidebarFocusedItemId: 'session-1' });
      const { container } = render(<Sidebar {...defaultProps} />);

      // The focused session should have ring classes
      const sessionItem = container.querySelector('.ring-1');
      expect(sessionItem).not.toBeNull();
    });

    it('should not show focus ring when terminal is focused', () => {
      useAppStore.setState({ focusArea: 'terminal' });
      const { container } = render(<Sidebar {...defaultProps} />);

      // No focus ring when sidebar is not focused
      const focusedItem = container.querySelector('.ring-1');
      expect(focusedItem).toBeNull();
    });

    it('should navigate to next item on ArrowDown', () => {
      render(<Sidebar {...defaultProps} />);

      // Dispatch arrow down key event
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });

      // Focus should move to addWorktree button (next item after repository in expanded state)
      expect(useAppStore.getState().sidebarFocusedItemId).toBe('__add_worktree__:1');
    });
  });
});
