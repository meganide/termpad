import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shows global notes beneath a static title', () => {
    seedRepository({ repository: 'Global content', worktree: 'Old content' }, true);
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Global: Termpad' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Global: Termpad' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Global: Termpad' })).toHaveTextContent(
      'Global content'
    );
  });

  it('keeps worktree notes visible beneath a static title', () => {
    seedRepository();
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Worktree: feature-x' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Worktree: feature-x' })).not.toBeInTheDocument();
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
