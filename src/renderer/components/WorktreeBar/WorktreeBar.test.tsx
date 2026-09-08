import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorktreeBar } from './WorktreeBar';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores } from '../../../../tests/utils';

const props = { sessionId: 'worktree', sessionPath: '/repo/feature work', branchName: 'feature' };

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  vi.mocked(window.electronAPI.openFolder).mockReset().mockResolvedValue({ success: true });
});

describe('WorktreeBar', () => {
  it('always offers the folder action without changing the preferred editor', async () => {
    useAppStore.setState((state) => ({
      settings: { ...state.settings, preferredEditor: 'vscode' },
    }));
    const { rerender } = render(<WorktreeBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open worktree folder' }));
    await waitFor(() =>
      expect(window.electronAPI.openFolder).toHaveBeenCalledWith(props.sessionPath)
    );
    expect(useAppStore.getState().settings.preferredEditor).toBe('vscode');
    expect(window.electronAPI.openInEditor).not.toHaveBeenCalled();
    rerender(<WorktreeBar {...props} sessionPath="/repo/other" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open worktree folder' }));
    expect(window.electronAPI.openFolder).toHaveBeenLastCalledWith('/repo/other');
  });

  it('keeps only editors in the dropdown and remembers the selected editor', async () => {
    const user = userEvent.setup();
    render(<WorktreeBar {...props} />);
    await user.click(screen.getByTestId('split-button-dropdown'));
    expect(screen.queryByRole('menuitem', { name: 'Folder' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    await user.click(screen.getByRole('menuitem', { name: 'VS Code' }));
    expect(useAppStore.getState().settings.preferredEditor).toBe('vscode');
    expect(window.electronAPI.openInEditor).toHaveBeenCalledWith(props.sessionPath, 'vscode');
    await user.click(screen.getByRole('button', { name: 'Open in VS Code' }));
    expect(window.electronAPI.openInEditor).toHaveBeenCalledTimes(2);
  });

  it('uses Cursor for legacy folder preferences while keeping Folder independently available', () => {
    useAppStore.setState((state) => ({
      settings: { ...state.settings, preferredEditor: 'folder' },
    }));
    render(<WorktreeBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open in Cursor' }));
    expect(window.electronAPI.openInEditor).toHaveBeenCalledWith(props.sessionPath, 'cursor');
    expect(screen.getByRole('button', { name: 'Open worktree folder' })).toBeEnabled();
  });

  it.each([
    { sessionId: null, sessionPath: undefined },
    { sessionId: 'worktree', sessionPath: undefined },
  ])('disables both controls without an available worktree path', (selection) => {
    render(<WorktreeBar {...selection} />);
    expect(screen.getByRole('button', { name: 'Open worktree folder' })).toBeDisabled();
    expect(screen.getByTestId('split-button-main')).toBeDisabled();
    expect(screen.getByTestId('split-button-dropdown')).toBeDisabled();
  });

  it.each(['result', 'rejection'])('reports folder launch failures (%s)', async (failure) => {
    const onError = vi.fn();
    if (failure === 'result')
      vi.mocked(window.electronAPI.openFolder).mockResolvedValue({
        success: false,
        error: 'Unavailable',
      });
    else vi.mocked(window.electronAPI.openFolder).mockRejectedValue(new Error('Unavailable'));
    render(<WorktreeBar {...props} onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open worktree folder' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Failed to open folder: Unavailable'));
  });

  it('shows a tooltip for the folder action', async () => {
    render(<WorktreeBar {...props} />);
    fireEvent.focus(screen.getByRole('button', { name: 'Open worktree folder' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open worktree folder');
  });
});
