import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';
import { useAppStore } from '../stores/appStore';
import {
  createMockRepository,
  createMockWorktreeSession,
  resetAllStores,
} from '../../../tests/utils';
import type { TerminalState } from '../../shared/types';

const callbacks = {
  onAddRepository: vi.fn(),
  onSelectRepository: vi.fn(),
  onAddWorktree: vi.fn(),
  onSelectWorktree: vi.fn(),
};

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('HomeScreen', () => {
  it('starts repository setup from the empty workspace', () => {
    render(<HomeScreen {...callbacks} />);
    expect(screen.getByText('Add your first repository')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Repository' }));
    expect(callbacks.onAddRepository).toHaveBeenCalledOnce();
  });

  it('opens the selected worktree and offers repository actions', () => {
    const worktree = createMockWorktreeSession({
      label: 'Improve search',
      branchName: 'fix/search',
    });
    const repository = createMockRepository({ name: 'termpad', worktreeSessions: [worktree] });
    useAppStore.setState({ repositories: [repository] });
    render(<HomeScreen {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: /Improve search/ }));
    expect(callbacks.onSelectWorktree).toHaveBeenCalledWith(worktree);
    fireEvent.click(screen.getByRole('button', { name: 'Open termpad' }));
    expect(callbacks.onSelectRepository).toHaveBeenCalledWith(repository);
    fireEvent.click(screen.getByRole('button', { name: 'Add worktree to termpad' }));
    expect(callbacks.onAddWorktree).toHaveBeenCalledWith(repository.id);
  });

  it('opens worktree setup when a repository has no worktrees', () => {
    const repository = createMockRepository({ name: 'empty-project', worktreeSessions: [] });
    useAppStore.setState({ repositories: [repository] });
    render(<HomeScreen {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open empty-project' }));
    expect(callbacks.onAddWorktree).toHaveBeenCalledWith(repository.id);
    expect(callbacks.onSelectRepository).not.toHaveBeenCalled();
  });

  it('counts live terminals without including stopped Git metadata entries', () => {
    const repository = createMockRepository();
    const states: TerminalState[] = [
      'running',
      'idle',
      'waiting',
      'starting',
      'stopped',
      'error',
    ].map((status, i) => ({
      id: String(i),
      status: status as TerminalState['status'],
      lastActivityTime: 0,
      hasReceivedOutput: false,
    }));
    useAppStore.setState({
      repositories: [repository],
      terminals: new Map(states.map((state) => [state.id, state])),
    });
    render(<HomeScreen {...callbacks} />);
    const stat = screen.getByText('Open terminals').parentElement!;
    expect(within(stat).getByText('04')).toBeInTheDocument();
  });
});
