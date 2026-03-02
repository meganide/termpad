import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileStatusSection } from './FileStatusSection';
import type { FileStatus, FileChangeType } from '../../../../shared/types';

const createMockFileStatus = (
  path: string,
  type: FileChangeType = 'modified',
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

describe('FileStatusSection', () => {
  const mockFiles: FileStatus[] = [
    createMockFileStatus('src/file1.ts', 'modified', 10, 5),
    createMockFileStatus('src/file2.ts', 'added', 20, 0),
    createMockFileStatus('src/file3.ts', 'deleted', 0, 15),
  ];

  const mockHandlers = {
    onStageFile: vi.fn(),
    onUnstageFile: vi.fn(),
    onDiscardFile: vi.fn(),
    onViewDiff: vi.fn(),
    onOpenInEditor: vi.fn(),
    onBulkAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders section title', () => {
      render(
        <FileStatusSection
          title="Staged Changes"
          category="staged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('section-title')).toHaveTextContent('Staged Changes');
    });

    it('renders file count badge', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('file-count-badge')).toHaveTextContent('3');
    });

    it('renders all files in the list', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const fileItems = screen.getAllByTestId('file-status-item');
      expect(fileItems).toHaveLength(3);
    });

    it('does not render when files array is empty', () => {
      render(
        <FileStatusSection title="Changes" category="unstaged" files={[]} {...mockHandlers} />
      );

      expect(screen.queryByTestId('file-status-section')).not.toBeInTheDocument();
    });
  });

  describe('collapsible behavior', () => {
    it('is open by default', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('section-content')).toBeVisible();
    });

    it('can be rendered initially collapsed', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          defaultOpen={false}
          {...mockHandlers}
        />
      );

      // When collapsed, the chevron should have the -rotate-90 class
      const chevron = screen.getByTestId('chevron-icon');
      expect(chevron).toHaveClass('-rotate-90');
    });

    it('toggles content visibility when trigger is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const trigger = screen.getByTestId('section-trigger');

      // Initially open - chevron should not have -rotate-90
      let chevron = screen.getByTestId('chevron-icon');
      expect(chevron).not.toHaveClass('-rotate-90');

      // Click to collapse
      fireEvent.click(trigger);
      chevron = screen.getByTestId('chevron-icon');
      expect(chevron).toHaveClass('-rotate-90');

      // Click again to expand
      fireEvent.click(trigger);
      chevron = screen.getByTestId('chevron-icon');
      expect(chevron).not.toHaveClass('-rotate-90');
    });
  });

  describe('bulk action button', () => {
    it('shows "Stage All" for unstaged files', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('bulk-action-button')).toHaveTextContent('Stage All');
    });

    it('shows "Stage All" for untracked files', () => {
      render(
        <FileStatusSection
          title="Untracked Files"
          category="untracked"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('bulk-action-button')).toHaveTextContent('Stage All');
    });

    it('shows "Unstage All" for staged files', () => {
      render(
        <FileStatusSection
          title="Staged Changes"
          category="staged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('bulk-action-button')).toHaveTextContent('Unstage All');
    });

    it('calls onBulkAction when bulk action button is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      fireEvent.click(screen.getByTestId('bulk-action-button'));
      expect(mockHandlers.onBulkAction).toHaveBeenCalledTimes(1);
    });

    it('does not render bulk action button when onBulkAction is not provided', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          onStageFile={mockHandlers.onStageFile}
        />
      );

      expect(screen.queryByTestId('bulk-action-button')).not.toBeInTheDocument();
    });

    it('stops event propagation when bulk action button is clicked', () => {
      const parentClickHandler = vi.fn();
      render(
        <div onClick={parentClickHandler}>
          <FileStatusSection
            title="Changes"
            category="unstaged"
            files={mockFiles}
            {...mockHandlers}
          />
        </div>
      );

      fireEvent.click(screen.getByTestId('bulk-action-button'));
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('file item callbacks', () => {
    it('calls onStageFile with correct file when stage button is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const stageButtons = screen.getAllByTestId('stage-button');
      fireEvent.click(stageButtons[0]);

      expect(mockHandlers.onStageFile).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onStageFile).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('calls onUnstageFile with correct file when unstage button is clicked', () => {
      render(
        <FileStatusSection
          title="Staged Changes"
          category="staged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const unstageButtons = screen.getAllByTestId('unstage-button');
      fireEvent.click(unstageButtons[0]);

      expect(mockHandlers.onUnstageFile).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onUnstageFile).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('calls onDiscardFile with correct file when discard button is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const discardButtons = screen.getAllByTestId('discard-button');
      fireEvent.click(discardButtons[0]);

      expect(mockHandlers.onDiscardFile).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onDiscardFile).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('calls onViewDiff with correct file when view diff button is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      // view diff is only shown for modified files (not added)
      const viewDiffButtons = screen.getAllByTestId('view-diff-button');
      fireEvent.click(viewDiffButtons[0]);

      expect(mockHandlers.onViewDiff).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onViewDiff).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('calls onOpenInEditor with correct file when open in editor button is clicked', () => {
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={mockFiles}
          {...mockHandlers}
        />
      );

      const openInEditorButtons = screen.getAllByTestId('open-in-editor-button');
      fireEvent.click(openInEditorButtons[0]);

      expect(mockHandlers.onOpenInEditor).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onOpenInEditor).toHaveBeenCalledWith(mockFiles[0]);
    });
  });

  describe('optional handlers', () => {
    it('does not pass onStage to FileStatusItem when onStageFile is not provided', () => {
      render(<FileStatusSection title="Changes" category="unstaged" files={mockFiles} />);

      expect(screen.queryAllByTestId('stage-button')).toHaveLength(0);
    });

    it('does not pass onUnstage to FileStatusItem when onUnstageFile is not provided', () => {
      render(<FileStatusSection title="Staged Changes" category="staged" files={mockFiles} />);

      expect(screen.queryAllByTestId('unstage-button')).toHaveLength(0);
    });

    it('does not pass onDiscard to FileStatusItem when onDiscardFile is not provided', () => {
      render(<FileStatusSection title="Changes" category="unstaged" files={mockFiles} />);

      expect(screen.queryAllByTestId('discard-button')).toHaveLength(0);
    });

    it('does not pass onViewDiff to FileStatusItem when onViewDiff is not provided', () => {
      render(<FileStatusSection title="Changes" category="unstaged" files={mockFiles} />);

      expect(screen.queryAllByTestId('view-diff-button')).toHaveLength(0);
    });

    it('does not pass onOpenInEditor to FileStatusItem when onOpenInEditor is not provided', () => {
      render(<FileStatusSection title="Changes" category="unstaged" files={mockFiles} />);

      expect(screen.queryAllByTestId('open-in-editor-button')).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles single file correctly', () => {
      const singleFile = [createMockFileStatus('single.ts')];
      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={singleFile}
          {...mockHandlers}
        />
      );

      expect(screen.getByTestId('file-count-badge')).toHaveTextContent('1');
      expect(screen.getAllByTestId('file-status-item')).toHaveLength(1);
    });

    it('uses file path as unique key', () => {
      const duplicateNameFiles: FileStatus[] = [
        createMockFileStatus('src/file.ts'),
        createMockFileStatus('lib/file.ts'),
      ];

      render(
        <FileStatusSection
          title="Changes"
          category="unstaged"
          files={duplicateNameFiles}
          {...mockHandlers}
        />
      );

      expect(screen.getAllByTestId('file-status-item')).toHaveLength(2);
    });
  });
});
