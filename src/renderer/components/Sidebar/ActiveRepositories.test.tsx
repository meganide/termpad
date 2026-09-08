import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { Sidebar } from './index';
import type { RepositoryTree } from './RepositoryTree';
import { useAppStore } from '../../stores/appStore';
import {
  createMockRepository,
  createMockWorktreeSession,
  resetAllStores,
} from '../../../../tests/utils';

vi.mock('./RepositoryTree', () => ({
  RepositoryTree: ({
    repositories,
    onReorderRepositories,
  }: ComponentProps<typeof RepositoryTree>) => (
    <div>
      {repositories.map((repository) => (
        <div key={repository.id}>{repository.name}</div>
      ))}
      <button onClick={() => onReorderRepositories(0, 1)}>Move first repo down</button>
    </div>
  ),
}));

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
  onToggleOverview: vi.fn(),
  isOverviewMode: false,
  hasAgents: true,
};

describe('Sidebar active repository filter', () => {
  beforeEach(() => {
    resetAllStores();
    useAppStore.setState({
      isInitialized: true,
      focusArea: 'app',
      sidebarFocusedItemId: null,
      sidebarStatusFocus: null,
      repositories: ['inactive', 'main', 'user'].map((id) =>
        createMockRepository({
          id,
          name: `${id} repo`,
          worktreeSessions: [createMockWorktreeSession({ id: `${id}-session` })],
        })
      ),
    });
  });

  it('toggles and saves the filter, counting tabs in either terminal panel', () => {
    useAppStore.getState().createTab('main-session', 'Terminal');
    useAppStore.getState().createUserTab('user-session');
    render(<Sidebar {...props} />);
    const toggle = screen.getByRole('button', { name: 'Only show active repositories' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('inactive repo')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('inactive repo')).not.toBeInTheDocument();
    expect(screen.getByText('main repo')).toBeInTheDocument();
    expect(screen.getByText('user repo')).toBeInTheDocument();
    expect(window.storage.saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ showOnlyActiveRepositories: true }),
      })
    );

    fireEvent.click(toggle);
    expect(screen.getByText('inactive repo')).toBeInTheDocument();
  });

  it('updates when terminals open and close and lets users leave the empty state', () => {
    useAppStore.getState().updateSettings({ showOnlyActiveRepositories: true });
    render(<Sidebar {...props} />);
    expect(screen.getByText('No active repositories')).toBeInTheDocument();

    let tabId: string;
    act(() => {
      tabId = useAppStore.getState().createTab('main-session', 'Terminal').id;
    });
    expect(screen.getByText('main repo')).toBeInTheDocument();
    act(() => {
      useAppStore.getState().closeTab(tabId);
    });
    expect(screen.getByText('No active repositories')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all repositories' }));
    expect(screen.getByText('inactive repo')).toBeInTheDocument();
  });

  it('reorders the intended repositories when earlier repositories are hidden', () => {
    useAppStore.getState().createTab('main-session', 'Terminal');
    useAppStore.getState().createUserTab('user-session');
    useAppStore.getState().updateSettings({ showOnlyActiveRepositories: true });
    render(<Sidebar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move first repo down' }));
    expect(useAppStore.getState().repositories.map((repository) => repository.id)).toEqual([
      'inactive',
      'user',
      'main',
    ]);
  });

  it('skips hidden repositories during keyboard navigation', () => {
    useAppStore.getState().createTab('main-session', 'Terminal');
    useAppStore.getState().updateSettings({ showOnlyActiveRepositories: true });
    useAppStore.setState({ focusArea: 'sidebar' });
    render(<Sidebar {...props} />);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(useAppStore.getState().sidebarFocusedItemId).toBe('main');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(useAppStore.getState().sidebarFocusedItemId).toBe('__add_repository__');
  });
});
