import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SourceControlPane } from './SourceControlPane';
import { resetAllStores } from '../../../../../tests/utils';
import type { FileStatus, FileStatusResult, AheadBehindResult } from '../../../../shared/types';

// Helper to create mock file status
const createMockFileStatus = (
  path: string,
  type: 'modified' | 'added' | 'deleted' | 'renamed' = 'modified',
  additions = 10,
  deletions = 5,
  oldPath?: string
): FileStatus => ({
  path,
  type,
  additions,
  deletions,
  oldPath,
});

describe('SourceControlPane', () => {
  const mockEmptyStatuses: FileStatusResult = {
    staged: [],
    unstaged: [],
    untracked: [],
  };

  const mockFilledStatuses: FileStatusResult = {
    staged: [createMockFileStatus('src/staged.ts', 'modified', 10, 5)],
    unstaged: [createMockFileStatus('src/unstaged.ts', 'modified', 3, 2)],
    untracked: [createMockFileStatus('src/new.ts', 'added', 20, 0)],
  };

  const mockAheadBehind: AheadBehindResult = {
    ahead: 2,
    behind: 1,
    hasRemote: true,
    remoteBranch: 'origin/main',
  };

  const mockViewDiff = vi.fn();
  const mockOpenInEditor = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    resetAllStores();
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(window.terminal.getFileStatuses).mockResolvedValue(mockFilledStatuses);
    vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('feature-branch');
    vi.mocked(window.terminal.getAheadBehind).mockResolvedValue(mockAheadBehind);
    vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue('https://github.com/user/repo.git');
    vi.mocked(window.terminal.stageFiles).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.stageAll).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.unstageFiles).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.unstageAll).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.discardFiles).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.discardAll).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.commit).mockResolvedValue({ success: true, commitHash: 'abc1234' });
    vi.mocked(window.terminal.push).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.pull).mockResolvedValue({ success: true });
    vi.mocked(window.terminal.addRemote).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Use act to flush promises without running all timers (which would cause infinite loops with polling)
  const flushPromises = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  describe('rendering', () => {
    it('renders source control pane', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('source-control-pane')).toBeInTheDocument();
    });

    it('renders header with title and refresh button', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByText('Source Control')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('renders commit section', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('commit-section')).toBeInTheDocument();
    });

    it('renders file status sections when there are changes', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByText('Staged Changes')).toBeInTheDocument();
      expect(screen.getByText('Changes')).toBeInTheDocument();
      expect(screen.getByText('Untracked')).toBeInTheDocument();
    });

    it('renders remote status bar', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('remote-status-bar')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no changes', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue(mockEmptyStatuses);

      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No changes')).toBeInTheDocument();
    });

    it('does not show file sections when empty', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue(mockEmptyStatuses);

      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.queryByText('Staged Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Changes')).not.toBeInTheDocument();
      expect(screen.queryByText('Untracked')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading state during initial load', async () => {
      let resolveStatuses: ((value: FileStatusResult) => void) | undefined;
      vi.mocked(window.terminal.getFileStatuses).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStatuses = resolve;
          })
      );

      render(<SourceControlPane repoPath="/test/repo" />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Resolve to complete test
      if (resolveStatuses) {
        resolveStatuses(mockEmptyStatuses);
      }
      await flushPromises();
    });
  });

  describe('refresh button', () => {
    it('calls refresh when clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('refresh-button'));
      await flushPromises();

      expect(window.terminal.getFileStatuses).toHaveBeenCalledTimes(2);
    });
  });

  describe('stage operations', () => {
    it('stages file when stage button is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Find and click stage button in Changes section (unstaged files)
      const stageButtons = screen.getAllByTestId('stage-button');
      fireEvent.click(stageButtons[0]);
      await flushPromises();

      expect(window.terminal.stageFiles).toHaveBeenCalledWith('/test/repo', ['src/unstaged.ts']);
    });

    it('stages all unstaged when bulk action is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Find bulk action buttons - the first "Stage All" is for Changes section
      const bulkActionButtons = screen.getAllByTestId('bulk-action-button');
      // First bulk action is for staged (Unstage All), second for unstaged (Stage All)
      const stageAllButton = bulkActionButtons.find((btn) =>
        btn.textContent?.includes('Stage All')
      );
      if (stageAllButton) {
        fireEvent.click(stageAllButton);
        await flushPromises();
      }

      expect(window.terminal.stageFiles).toHaveBeenCalled();
    });
  });

  describe('unstage operations', () => {
    it('unstages file when unstage button is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Find and click unstage button in Staged Changes section
      const unstageButtons = screen.getAllByTestId('unstage-button');
      fireEvent.click(unstageButtons[0]);
      await flushPromises();

      expect(window.terminal.unstageFiles).toHaveBeenCalledWith('/test/repo', ['src/staged.ts']);
    });

    it('unstages all when bulk action is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Find "Unstage All" button
      const bulkActionButtons = screen.getAllByTestId('bulk-action-button');
      const unstageAllButton = bulkActionButtons.find((btn) =>
        btn.textContent?.includes('Unstage All')
      );
      if (unstageAllButton) {
        fireEvent.click(unstageAllButton);
        await flushPromises();
      }

      expect(window.terminal.unstageAll).toHaveBeenCalledWith('/test/repo');
    });
  });

  describe('discard operations', () => {
    it('opens discard dialog when discard button is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Find and click discard button
      const discardButtons = screen.getAllByTestId('discard-button');
      fireEvent.click(discardButtons[0]);

      // Dialog should open
      expect(screen.getByTestId('discard-confirm-dialog')).toBeInTheDocument();
    });

    it('confirms discard and calls API', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Click discard button
      const discardButtons = screen.getAllByTestId('discard-button');
      fireEvent.click(discardButtons[0]);

      // Click confirm in dialog
      const confirmButton = screen.getByTestId('confirm-button');
      fireEvent.click(confirmButton);
      await flushPromises();

      expect(window.terminal.discardFiles).toHaveBeenCalled();
    });

    it('cancels discard dialog', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Click discard button
      const discardButtons = screen.getAllByTestId('discard-button');
      await act(async () => {
        fireEvent.click(discardButtons[0]);
      });

      // Click cancel
      const cancelButton = screen.getByTestId('cancel-button');
      await act(async () => {
        fireEvent.click(cancelButton);
      });
      await flushPromises();

      // Dialog should close
      expect(screen.queryByTestId('discard-confirm-dialog')).not.toBeInTheDocument();

      // Should not call discard
      expect(window.terminal.discardFiles).not.toHaveBeenCalled();
    });
  });

  describe('commit operations', () => {
    it('renders commit section with textarea and button', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Verify commit section renders correctly
      expect(screen.getByTestId('commit-message-input')).toBeInTheDocument();
      expect(screen.getByTestId('commit-button')).toBeInTheDocument();

      // Button should be disabled when no message
      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });

    it('updates textarea value when typing', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      const textarea = screen.getByTestId('commit-message-input') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test message' } });

      expect(textarea.value).toBe('Test message');
    });
  });

  describe('push/pull operations', () => {
    it('pushes when push button is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      const pushButton = screen.getByTestId('push-button');
      fireEvent.click(pushButton);
      await flushPromises();

      expect(window.terminal.push).toHaveBeenCalledWith('/test/repo');
    });

    it('pulls when pull button is clicked', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      const pullButton = screen.getByTestId('pull-button');
      fireEvent.click(pullButton);
      await flushPromises();

      expect(window.terminal.pull).toHaveBeenCalledWith('/test/repo');
    });
  });

  describe('add remote dialog', () => {
    it('opens add remote dialog when no remote', async () => {
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: false,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      const addRemoteButton = screen.getByTestId('add-remote-button');
      fireEvent.click(addRemoteButton);

      expect(screen.getByTestId('add-remote-dialog')).toBeInTheDocument();
    });

    it('allows entering remote URL in dialog', async () => {
      vi.mocked(window.terminal.getAheadBehind).mockResolvedValue({
        ahead: 0,
        behind: 0,
        hasRemote: false,
      });
      vi.mocked(window.terminal.getRemoteUrl).mockResolvedValue(null);

      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      // Open dialog
      fireEvent.click(screen.getByTestId('add-remote-button'));

      // Dialog should appear
      expect(screen.getByTestId('add-remote-dialog')).toBeInTheDocument();

      // Enter URL
      const urlInput = screen.getByTestId('remote-url-input') as HTMLInputElement;
      fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });

      expect(urlInput.value).toBe('https://github.com/user/repo.git');
    });
  });

  describe('callback handlers', () => {
    it('calls onViewDiff when view diff button is clicked', async () => {
      render(
        <SourceControlPane
          repoPath="/test/repo"
          onViewDiff={mockViewDiff}
          onOpenInEditor={mockOpenInEditor}
        />
      );
      await flushPromises();

      // View diff buttons should be available for modified files
      const viewDiffButtons = screen.getAllByTestId('view-diff-button');
      fireEvent.click(viewDiffButtons[0]);

      expect(mockViewDiff).toHaveBeenCalled();
    });

    it('calls onOpenInEditor when open in editor button is clicked', async () => {
      render(
        <SourceControlPane
          repoPath="/test/repo"
          onViewDiff={mockViewDiff}
          onOpenInEditor={mockOpenInEditor}
        />
      );
      await flushPromises();

      const openInEditorButtons = screen.getAllByTestId('open-in-editor-button');
      fireEvent.click(openInEditorButtons[0]);

      expect(mockOpenInEditor).toHaveBeenCalled();
    });
  });

  describe('null repo path', () => {
    it('renders pane without errors when repoPath is null', async () => {
      render(<SourceControlPane repoPath={null} />);
      await flushPromises();

      expect(screen.getByTestId('source-control-pane')).toBeInTheDocument();
    });
  });

  describe('branch display', () => {
    it('shows current branch in remote status bar', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('branch-name')).toHaveTextContent('feature-branch');
    });

    it('shows ahead/behind badges', async () => {
      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByTestId('ahead-badge')).toHaveTextContent('2');
      expect(screen.getByTestId('behind-badge')).toHaveTextContent('1');
    });
  });

  describe('file status sections visibility', () => {
    it('shows Changes section even when empty if there are staged files', async () => {
      vi.mocked(window.terminal.getFileStatuses).mockResolvedValue({
        staged: [createMockFileStatus('src/staged.ts')],
        unstaged: [],
        untracked: [],
      });

      render(<SourceControlPane repoPath="/test/repo" />);
      await flushPromises();

      expect(screen.getByText('Staged Changes')).toBeInTheDocument();
      // Changes section should be visible even when empty (shows "0" count)
      expect(screen.getByText('Changes')).toBeInTheDocument();
      expect(screen.queryByText('Untracked')).not.toBeInTheDocument();
    });
  });
});
