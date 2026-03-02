import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoveWorktreeDialog } from '@/components/RemoveWorktreeDialog';
import { useAppStore } from '@/stores/appStore';

beforeEach(() => {
  vi.clearAllMocks();

  useAppStore.setState({
    repositories: [],
    terminals: new Map(),
    activeTerminalId: null,
    isInitialized: true,
    settings: { theme: 'dark' },
    window: { sidebarWidth: 260 },
  });
});

describe('RemoveWorktreeDialog', () => {
  const mockRepository = {
    id: 'repository-1',
    name: 'Test Repository',
    path: '/test/repository',

    isBare: false,
    isExpanded: true,
    worktreeSessions: [],
    createdAt: new Date().toISOString(),
  };

  const mockSession = {
    id: 'session-1',

    label: 'feature-branch',
    path: '/test/project/feature-branch',
    branchName: 'feature/awesome',
    createdAt: new Date().toISOString(),
    isExternal: false,
  };

  it('shows radio options for delete mode with branch name', async () => {
    render(
      <RemoveWorktreeDialog
        open={true}
        onOpenChange={vi.fn()}
        session={mockSession}
        repository={mockRepository}
      />
    );

    // Wait for dirty check to complete and verify radio options are shown
    expect(await screen.findByText(/feature\/awesome/)).toBeInTheDocument();
    expect(await screen.findByText(/Delete completely/)).toBeInTheDocument();
    expect(await screen.findByText(/Remove from app/)).toBeInTheDocument();
  });

  it('blocks deletion of main branch', async () => {
    const mainSession = {
      ...mockSession,
      branchName: 'main',
      label: 'main',
    };

    render(
      <RemoveWorktreeDialog
        open={true}
        onOpenChange={vi.fn()}
        session={mainSession}
        repository={mockRepository}
      />
    );

    expect(await screen.findByText(/Cannot delete the/)).toBeInTheDocument();
    expect(screen.getByText(/protected branch/)).toBeInTheDocument();

    // Delete button should be disabled
    const deleteButton = screen.getByRole('button', { name: /Delete Worktree/i });
    expect(deleteButton).toBeDisabled();
  });

  it('blocks deletion of master branch', async () => {
    const masterSession = {
      ...mockSession,
      branchName: 'master',
      label: 'master',
    };

    render(
      <RemoveWorktreeDialog
        open={true}
        onOpenChange={vi.fn()}
        session={masterSession}
        repository={mockRepository}
      />
    );

    expect(await screen.findByText(/Cannot delete the/)).toBeInTheDocument();
    expect(screen.getByText(/protected branch/)).toBeInTheDocument();

    // Delete button should be disabled
    const deleteButton = screen.getByRole('button', { name: /Delete Worktree/i });
    expect(deleteButton).toBeDisabled();
  });

  it('shows dirty warning when worktree has uncommitted changes', async () => {
    // Override the global mock for this test
    vi.mocked(window.terminal.isWorktreeDirty).mockResolvedValue(true);

    render(
      <RemoveWorktreeDialog
        open={true}
        onOpenChange={vi.fn()}
        session={mockSession}
        repository={mockRepository}
      />
    );

    expect(await screen.findByText(/uncommitted changes/)).toBeInTheDocument();
  });
});
