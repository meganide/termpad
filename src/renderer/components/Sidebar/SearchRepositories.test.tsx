import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './index';
import { useAppStore } from '../../stores/appStore';
import {
  createMockRepository,
  createMockWorktreeSession,
  resetAllStores,
} from '../../../../tests/utils';

const props = {
  width: 300,
  onResizeStart: vi.fn(),
  onAddRepository: vi.fn(),
  onNewWorktree: vi.fn(),
  onRepositoryDelete: vi.fn(),
  onOpenRepositorySettings: vi.fn(),
  onWorktreeRemove: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenHome: vi.fn(),
  onSessionSelect: vi.fn(),
  onToggleOverview: vi.fn(),
  isOverviewMode: false,
  hasAgents: false,
};

function search(query: string) {
  const input = screen.getByRole('textbox', { name: 'Search repositories and worktrees' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe('Sidebar repository search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useAppStore.setState({
      isInitialized: true,
      focusArea: 'app',
      sidebarFocusedItemId: null,
      sidebarStatusFocus: null,
      repositories: [
        createMockRepository({
          id: 'portal',
          name: 'Portal',
          isExpanded: false,
          worktreeSessions: [
            createMockWorktreeSession({ id: 'main', label: 'Main worktree' }),
            createMockWorktreeSession({
              id: 'fix',
              label: 'Fix scrolling',
              worktreeName: 'scroll-tree',
              branchName: 'feature/overflow',
            }),
          ],
        }),
        createMockRepository({ id: 'docs', name: 'Documentation', isExpanded: false }),
      ],
    });
  });

  it('matches repository names without case or surrounding whitespace and reveals all their worktrees', () => {
    render(<Sidebar {...props} />);
    search('  PORT  ');
    expect(screen.getByText('Portal')).toBeInTheDocument();
    expect(screen.getByText('Main worktree')).toBeInTheDocument();
    expect(screen.getByText('Fix scrolling')).toBeInTheDocument();
    expect(screen.queryByText('Documentation')).not.toBeInTheDocument();
  });

  it.each(['scrolling', 'SCROLL-TREE', 'feature/overflow'])(
    'finds worktrees by label, worktree name, or branch: %s',
    (query) => {
      render(<Sidebar {...props} />);
      search(query);
      expect(screen.getByText('Portal')).toBeInTheDocument();
      expect(screen.getByText('Fix scrolling')).toBeInTheDocument();
      expect(screen.queryByText('Main worktree')).not.toBeInTheDocument();
      expect(screen.queryByText('Documentation')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Fix scrolling'));
      expect(props.onSessionSelect).toHaveBeenCalledWith('fix');
    }
  );

  it('allows results to collapse without changing the original expansion state', () => {
    render(<Sidebar {...props} />);
    search('scroll');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Portal' }));
    expect(screen.queryByText('Fix scrolling')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Portal' }));
    expect(screen.getByText('Fix scrolling')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear repository search' }));
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.queryByText('Fix scrolling')).not.toBeInTheDocument();
    expect(useAppStore.getState().repositories[0].isExpanded).toBe(false);
    expect(useAppStore.getState().repositories[0].worktreeSessions).toHaveLength(2);
  });

  it('shows no results and respects the active repository filter', () => {
    render(<Sidebar {...props} />);
    search('missing');
    expect(screen.getByRole('status')).toHaveTextContent('No matching repositories or worktrees');
    search('Portal');
    fireEvent.click(screen.getByRole('button', { name: 'Only show active repositories' }));
    expect(screen.getByRole('status')).toHaveTextContent('turn off the active repositories filter');
    fireEvent.click(screen.getByRole('button', { name: 'Only show active repositories' }));
    expect(screen.getByText('Portal')).toBeInTheDocument();
  });

  it('lets users type freely, navigate only matching worktrees, and clear with Escape', () => {
    useAppStore.getState().createTab('main', 'Terminal');
    useAppStore.setState({
      sidebarFocusedItemId: 'main',
      sidebarStatusFocus: { worktreeSessionId: 'main', indicatorIndex: 0 },
    });
    render(<Sidebar {...props} />);
    const input = search('scroll');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(useAppStore.getState().focusArea).toBe('app');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(useAppStore.getState().sidebarFocusedItemId).toBe('portal');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(useAppStore.getState().sidebarFocusedItemId).toBe('fix');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useAppStore.getState().activeTerminalId).toBe('fix');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });
});
