import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores, createMockRepositoryWithWorktreeSessions } from '../../../../tests/utils';
import { NotesPanel } from './NotesPanel';

const REPOSITORY_ID = 'repo-1';
const WORKTREE_ID = `session-${REPOSITORY_ID}-0`;

const seedRepository = (notes: { repository?: string; worktree?: string } = {}, global = false) => {
  const repository = createMockRepositoryWithWorktreeSessions({ id: REPOSITORY_ID }, 1);
  useAppStore.setState({
    repositories: [
      {
        ...repository,
        notes: notes.repository,
        worktreeSessions: repository.worktreeSessions.map((ws) => ({
          ...ws,
          isMainWorktree: global,
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

  it('renders only the worktree notes in a linked worktree', () => {
    seedRepository({ repository: 'Global content', worktree: 'Worktree content' });
    renderPanel();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Worktree: feature-x' })).toHaveTextContent(
      'Worktree content'
    );
    expect(screen.queryByText('Global content')).not.toBeInTheDocument();
  });

  it('renders and collapses only the global notes in the primary checkout', async () => {
    const user = userEvent.setup();
    seedRepository({ repository: 'Global content', worktree: 'Old content' }, true);
    renderPanel();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Global: Termpad' })).toHaveTextContent(
      'Global content'
    );
    const repositoryHeader = screen.getByRole('button', { name: /Global: Termpad/ });
    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'true');

    await user.click(repositoryHeader);

    expect(repositoryHeader).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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

  it('flushes pending edits to the old scope when switching worktrees', () => {
    seedRepository({ repository: 'Global content', worktree: 'Worktree content' });
    Object.defineProperty(document, 'queryCommandState', {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(document, 'queryCommandValue', { configurable: true, value: () => '' });
    const { rerender } = renderPanel();
    const editor = screen.getByRole('textbox');
    editor.textContent = 'Just typed';
    fireEvent.input(editor);
    rerender(
      <NotesPanel
        repositoryId={REPOSITORY_ID}
        worktreeSessionId="primary"
        repositoryName="Termpad"
        worktreeLabel="main"
        titleSlot={null}
      />
    );
    expect(useAppStore.getState().repositories[0].worktreeSessions[0].notes).toBe('Just typed');
    expect(screen.getByRole('textbox', { name: 'Global: Termpad' })).toHaveTextContent(
      'Global content'
    );
    expect(useAppStore.getState().repositories[0].notes).toBe('Global content');
  });
});
