import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores, createMockRepositoryWithWorktreeSessions } from '../../../../tests/utils';
import { NotesPanel } from './NotesPanel';

const REPOSITORY_ID = 'repo-1';
const WORKTREE_ID = `session-${REPOSITORY_ID}-0`;

const seedRepository = (notes: { repository?: string; worktree?: string } = {}) => {
  const repository = createMockRepositoryWithWorktreeSessions({ id: REPOSITORY_ID }, 1);
  useAppStore.setState({
    repositories: [
      {
        ...repository,
        notes: notes.repository,
        worktreeSessions: repository.worktreeSessions.map((ws) => ({
          ...ws,
          notes: notes.worktree,
        })),
      },
    ],
  });
};

const renderPanel = () =>
  render(
    <NotesPanel
      repositoryId={REPOSITORY_ID}
      worktreeSessionId={WORKTREE_ID}
      repositoryName="Termpad"
      worktreeLabel="feature-x"
      titleSlot={null}
    />
  );

describe('NotesPanel', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders an editor for each scope', () => {
    seedRepository();
    renderPanel();

    expect(screen.getByRole('textbox', { name: 'Repository: Termpad' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Worktree: feature-x' })).toBeInTheDocument();
  });

  it('collapses one scope so the other can be worked on exclusively', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    const repositoryHeader = screen.getByRole('button', { name: /Repository: Termpad/ });
    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'true');

    await user.click(repositoryHeader);

    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: 'Repository: Termpad' })).not.toBeInTheDocument();
    // The sibling scope is untouched
    expect(screen.getByRole('textbox', { name: 'Worktree: feature-x' })).toBeInTheDocument();
  });

  it('expands a collapsed scope again', async () => {
    const user = userEvent.setup();
    seedRepository();
    renderPanel();

    const worktreeHeader = screen.getByRole('button', { name: /Worktree: feature-x/ });
    await user.click(worktreeHeader);
    await user.click(worktreeHeader);

    expect(worktreeHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox', { name: 'Worktree: feature-x' })).toBeInTheDocument();
  });
});
