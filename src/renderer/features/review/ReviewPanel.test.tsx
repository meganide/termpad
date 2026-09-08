import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPanel } from './ReviewPanel';
import { useReviewLayoutStore } from '../../stores/reviewLayoutStore';
import type { DiffFile, WorkingTreeDiffResult } from '../../../shared/reviewTypes';

const file = (path: string, content = 'changed'): DiffFile => ({
  path,
  status: 'added',
  additions: 1,
  deletions: 0,
  isBinary: false,
  hunks: [
    {
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      header: '@@ -0,0 +1 @@',
      lines: [{ type: 'add', newLineNumber: 1, content }],
    },
  ],
});
const props = { repoPath: '/repo', active: true, expanded: false, onToggleExpanded: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  useReviewLayoutStore.setState({ treeWidth: 192 });
  vi.mocked(window.terminal.listBranches).mockResolvedValue([
    { name: 'feature', isCurrent: true, isRemote: false, isDefault: false },
    { name: 'main', isCurrent: false, isRemote: false, isDefault: true },
    { name: 'master', isCurrent: false, isRemote: false, isDefault: true },
  ]);
  vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(null);
  vi.mocked(window.terminal.getWorkingTreeDiff).mockImplementation(async (_path, base) => ({
    files: [file(base === 'HEAD' ? 'local.txt' : 'branch.txt')],
    headCommit: 'abc',
    isDirty: true,
  }));
});

describe('ReviewPanel', () => {
  it('switches bases and keeps drafts when switching tabs and bases', async () => {
    const { rerender } = render(<ReviewPanel {...props} />);
    await screen.findByText('local.txt', { selector: 'span' });
    fireEvent.mouseDown(screen.getByTestId('new-line-number'), { button: 0 });
    fireEvent.mouseUp(document);
    const input = await screen.findByTestId('comment-textarea');
    fireEvent.change(input, { target: { value: 'Keep this draft' } });
    rerender(<ReviewPanel {...props} active={false} />);
    rerender(<ReviewPanel {...props} active />);
    await waitFor(() =>
      expect(screen.getByTestId('comment-textarea')).toHaveValue('Keep this draft')
    );

    fireEvent.change(screen.getByLabelText('Review base branch'), { target: { value: 'main' } });
    await screen.findByText('branch.txt', { selector: 'span' });
    expect(window.terminal.getWorkingTreeDiff).toHaveBeenCalledWith('/repo', 'main');
    expect(window.reviewStorage.findByBranches).toHaveBeenCalledWith(
      '/repo',
      'main',
      'working-tree'
    );
    fireEvent.change(screen.getByLabelText('Review base branch'), { target: { value: 'HEAD' } });
    expect(screen.getByTestId('comment-textarea')).toHaveValue('Keep this draft');
  });

  it('keeps late results from another base out of the active comparison', async () => {
    let resolve!: (result: WorkingTreeDiffResult) => void;
    vi.mocked(window.terminal.getWorkingTreeDiff).mockImplementation((_path, base) =>
      base === 'HEAD'
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve({ files: [file('main.txt')], headCommit: 'main', isDirty: true })
    );
    render(<ReviewPanel {...props} />);
    await screen.findByRole('option', { name: 'main' });
    fireEvent.change(screen.getByLabelText('Review base branch'), { target: { value: 'main' } });
    await screen.findByText('main.txt', { selector: 'span' });
    await act(async () => resolve({ files: [file('late.txt')], headCommit: 'old', isDirty: true }));
    expect(screen.queryByText('late.txt', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('main.txt', { selector: 'span' })).toBeVisible();
  });

  it('refreshes changed content even when line counts match and clears a clean diff', async () => {
    render(<ReviewPanel {...props} />);
    await screen.findByText('changed');
    await waitFor(() => expect(screen.getByLabelText('Refresh review')).toBeEnabled());
    vi.mocked(window.terminal.getWorkingTreeDiff).mockResolvedValue({
      files: [file('local.txt', 'new content')],
      headCommit: 'abc',
      isDirty: true,
    });
    fireEvent.click(screen.getByLabelText('Refresh review'));
    await waitFor(() =>
      expect(screen.getByTestId('diff-line-content')).toHaveTextContent('new content')
    );
    expect(screen.queryByText('changed')).not.toBeInTheDocument();
    vi.mocked(window.terminal.getWorkingTreeDiff).mockResolvedValue({
      files: [],
      headCommit: 'abc',
      isDirty: false,
    });
    await waitFor(() => expect(screen.getByLabelText('Refresh review')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Refresh review'));
    await screen.findByText('No changes against this base');
  });

  it('isolates worktrees and opens requested files without opening a window', async () => {
    const { rerender } = render(
      <>
        <ReviewPanel {...props} />
        <ReviewPanel {...props} repoPath="/other" active={false} />
      </>
    );
    const panels = screen.getAllByTestId('review-panel');
    await within(panels[0]).findByText('local.txt', { selector: 'span' });
    expect(
      within(panels[1]).queryByText('local.txt', { selector: 'span' })
    ).not.toBeInTheDocument();
    rerender(
      <>
        <ReviewPanel {...props} request={{ id: 1, filePath: 'local.txt' }} />
        <ReviewPanel {...props} repoPath="/other" active={false} />
      </>
    );
    expect(within(panels[0]).getByRole('button', { name: 'local.txt' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('can reopen the only file after marking it viewed', async () => {
    render(<ReviewPanel {...props} />);
    await screen.findByText('local.txt', { selector: 'span' });
    fireEvent.click(screen.getByTestId('mark-viewed-checkbox'));
    await screen.findByText('All files reviewed');
    fireEvent.click(screen.getByRole('button', { name: 'local.txt' }));
    await screen.findByText('local.txt', { selector: 'span' });
  });

  it('resizes the tree and preserves its width and filter when collapsed', async () => {
    render(<ReviewPanel {...props} />);
    await screen.findByText('local.txt', { selector: 'span' });
    const tree = screen.getByTestId('file-list-sidebar');
    const body = tree.parentElement;
    if (!body) throw new Error('Missing review body');
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      left: 0,
    } as DOMRect);
    const divider = screen.getByRole('separator', { name: 'Resize file tree' });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(tree).toHaveStyle({ width: '208px' });
    fireEvent.pointerDown(divider, { pointerId: 1 });
    const selectionAttempt = new Event('selectstart', { bubbles: true, cancelable: true });
    tree.dispatchEvent(selectionAttempt);
    expect(selectionAttempt.defaultPrevented).toBe(true);
    const move = new Event('pointermove', { bubbles: true });
    Object.defineProperty(move, 'clientX', { value: 320 });
    fireEvent(divider, move);
    fireEvent.pointerUp(divider, { pointerId: 1 });
    const selectionAfterDrag = new Event('selectstart', { bubbles: true, cancelable: true });
    tree.dispatchEvent(selectionAfterDrag);
    expect(selectionAfterDrag.defaultPrevented).toBe(false);
    expect(tree).toHaveStyle({ width: '320px' });
    fireEvent.change(screen.getByTestId('file-search-input'), { target: { value: 'local' } });
    fireEvent.click(screen.getByLabelText('Collapse file tree'));
    expect(tree).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Expand file tree'));
    expect(tree).toBeVisible();
    expect(tree).toHaveStyle({ width: '320px' });
    expect(screen.getByTestId('file-search-input')).toHaveValue('local');
    vi.mocked(body.getBoundingClientRect).mockRestore();
  });

  it('shares the resized tree width across worktrees, bases, and remounts', async () => {
    const panels = (otherActive: boolean) => (
      <>
        <ReviewPanel {...props} active={!otherActive} />
        <ReviewPanel {...props} repoPath="/other" active={otherActive} />
      </>
    );
    const { rerender, unmount } = render(panels(false));
    await screen.findByText('local.txt', { selector: 'span' });
    // JSDOM has no layout; give the active tree enough room to resize.
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      left: 0,
    } as DOMRect);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize file tree' }), {
      key: 'End',
    });

    rerender(panels(true));
    const other = screen.getAllByTestId('review-panel')[1];
    await within(other).findByText('local.txt', { selector: 'span' });
    expect(within(other).getByTestId('file-list-sidebar')).toHaveStyle({ width: '480px' });
    fireEvent.keyDown(within(other).getByRole('separator', { name: 'Resize file tree' }), {
      key: 'ArrowLeft',
    });
    fireEvent.change(within(other).getByLabelText('Review base branch'), {
      target: { value: 'main' },
    });
    await within(other).findByText('branch.txt', { selector: 'span' });
    for (const divider of within(other).getAllByRole('separator', { name: 'Resize file tree' })) {
      expect(divider).toHaveAttribute('aria-valuenow', '464');
    }

    rerender(panels(false));
    expect(
      within(screen.getAllByTestId('review-panel')[0]).getByRole('separator', {
        name: 'Resize file tree',
      })
    ).toHaveAttribute('aria-valuenow', '464');
    unmount();
    render(<ReviewPanel {...props} repoPath="/third" />);
    await screen.findByText('local.txt', { selector: 'span' });
    expect(screen.getByTestId('file-list-sidebar')).toHaveStyle({ width: '464px' });
    bounds.mockRestore();
  });

  it('reports the selected base count and updates while another tab is visible', async () => {
    const onFileCountChange = vi.fn();
    render(<ReviewPanel {...props} active={false} enabled onFileCountChange={onFileCountChange} />);
    await waitFor(() => expect(onFileCountChange).toHaveBeenLastCalledWith('/repo', 'HEAD', 1));
    vi.mocked(window.terminal.getWorkingTreeDiff).mockResolvedValue({
      files: [file('a.txt'), file('b.txt')],
      headCommit: 'abc',
      isDirty: true,
    });
    const subscription = vi
      .mocked(window.watcher.onRepoChanged)
      .mock.calls.find(([path]) => path === '/repo');
    if (!subscription) throw new Error('Missing review watcher');
    const onChanged = subscription[1];
    await act(async () => onChanged());
    await waitFor(() => expect(onFileCountChange).toHaveBeenLastCalledWith('/repo', 'HEAD', 2));
  });

  it('shows tooltips for the review icon actions', async () => {
    render(<ReviewPanel {...props} />);
    await waitFor(() => expect(screen.getByLabelText('Refresh review')).toBeEnabled());
    fireEvent.focus(screen.getByLabelText('Refresh review'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Refresh review');
  });
});
