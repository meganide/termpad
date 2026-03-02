import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileStatusItem, FileStatusCategory } from './FileStatusItem';
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

describe('FileStatusItem', () => {
  const mockHandlers = {
    onStage: vi.fn(),
    onUnstage: vi.fn(),
    onDiscard: vi.fn(),
    onViewDiff: vi.fn(),
    onOpenInEditor: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders file path with directory and filename separated', () => {
      const file = createMockFileStatus('src/components/Button.tsx');
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByText('src/components')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    });

    it('renders file without directory path', () => {
      const file = createMockFileStatus('README.md');
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    it('renders additions in green', () => {
      const file = createMockFileStatus('test.ts', 'modified', 15, 0);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      const additions = screen.getByTestId('additions');
      expect(additions).toHaveTextContent('+15');
      expect(additions).toHaveClass('text-green-500');
    });

    it('renders deletions in red', () => {
      const file = createMockFileStatus('test.ts', 'modified', 0, 8);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      const deletions = screen.getByTestId('deletions');
      expect(deletions).toHaveTextContent('-8');
      expect(deletions).toHaveClass('text-red-500');
    });

    it('renders both additions and deletions', () => {
      const file = createMockFileStatus('test.ts', 'modified', 10, 5);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByTestId('additions')).toHaveTextContent('+10');
      expect(screen.getByTestId('deletions')).toHaveTextContent('-5');
    });

    it('does not render additions when zero', () => {
      const file = createMockFileStatus('test.ts', 'modified', 0, 5);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.queryByTestId('additions')).not.toBeInTheDocument();
      expect(screen.getByTestId('deletions')).toBeInTheDocument();
    });

    it('does not render deletions when zero', () => {
      const file = createMockFileStatus('test.ts', 'modified', 10, 0);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByTestId('additions')).toBeInTheDocument();
      expect(screen.queryByTestId('deletions')).not.toBeInTheDocument();
    });

    it('shows old path for renamed files', () => {
      const file = createMockFileStatus('src/newName.ts', 'renamed', 0, 0, 'src/oldName.ts');
      render(<FileStatusItem file={file} category="staged" {...mockHandlers} />);

      expect(screen.getByText('newName.ts')).toBeInTheDocument();
      expect(screen.getByText('(oldName.ts)')).toBeInTheDocument();
    });
  });

  describe('file type icons', () => {
    it('renders file type icon', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByTestId('file-type-icon')).toBeInTheDocument();
    });
  });

  describe('status icons', () => {
    it('renders added status icon for new files', () => {
      const file = createMockFileStatus('new.ts', 'added', 20, 0);
      render(<FileStatusItem file={file} category="staged" {...mockHandlers} />);

      expect(screen.getByTestId('status-icon-added')).toBeInTheDocument();
    });

    it('renders deleted status icon for deleted files', () => {
      const file = createMockFileStatus('deleted.ts', 'deleted', 0, 15);
      render(<FileStatusItem file={file} category="staged" {...mockHandlers} />);

      expect(screen.getByTestId('status-icon-deleted')).toBeInTheDocument();
    });

    it('renders modified status icon for modified files', () => {
      const file = createMockFileStatus('modified.ts', 'modified', 10, 5);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByTestId('status-icon-modified')).toBeInTheDocument();
    });

    it('renders renamed status icon for renamed files', () => {
      const file = createMockFileStatus('renamed.ts', 'renamed', 0, 0, 'old.ts');
      render(<FileStatusItem file={file} category="staged" {...mockHandlers} />);

      expect(screen.getByTestId('status-icon-renamed')).toBeInTheDocument();
    });
  });

  describe('action buttons for unstaged files', () => {
    const category: FileStatusCategory = 'unstaged';

    it('shows stage button for unstaged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('stage-button')).toBeInTheDocument();
    });

    it('does not show unstage button for unstaged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.queryByTestId('unstage-button')).not.toBeInTheDocument();
    });

    it('shows discard button for unstaged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    });

    it('shows view diff button for unstaged modified files', () => {
      const file = createMockFileStatus('test.ts', 'modified');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('view-diff-button')).toBeInTheDocument();
    });

    it('shows open in editor button', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('open-in-editor-button')).toBeInTheDocument();
    });

    it('calls onStage when stage button is clicked', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      fireEvent.click(screen.getByTestId('stage-button'));
      expect(mockHandlers.onStage).toHaveBeenCalledTimes(1);
    });

    it('calls onDiscard when discard button is clicked', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      fireEvent.click(screen.getByTestId('discard-button'));
      expect(mockHandlers.onDiscard).toHaveBeenCalledTimes(1);
    });

    it('calls onViewDiff when view diff button is clicked', () => {
      const file = createMockFileStatus('test.ts', 'modified');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      fireEvent.click(screen.getByTestId('view-diff-button'));
      expect(mockHandlers.onViewDiff).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenInEditor when open in editor button is clicked', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      fireEvent.click(screen.getByTestId('open-in-editor-button'));
      expect(mockHandlers.onOpenInEditor).toHaveBeenCalledTimes(1);
    });
  });

  describe('action buttons for staged files', () => {
    const category: FileStatusCategory = 'staged';

    it('shows unstage button for staged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('unstage-button')).toBeInTheDocument();
    });

    it('does not show stage button for staged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.queryByTestId('stage-button')).not.toBeInTheDocument();
    });

    it('does not show discard button for staged files', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.queryByTestId('discard-button')).not.toBeInTheDocument();
    });

    it('calls onUnstage when unstage button is clicked', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      fireEvent.click(screen.getByTestId('unstage-button'));
      expect(mockHandlers.onUnstage).toHaveBeenCalledTimes(1);
    });
  });

  describe('action buttons for untracked files', () => {
    const category: FileStatusCategory = 'untracked';

    it('shows stage button for untracked files', () => {
      const file = createMockFileStatus('new.ts', 'added');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('stage-button')).toBeInTheDocument();
    });

    it('shows discard button for untracked files', () => {
      const file = createMockFileStatus('new.ts', 'added');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    });

    it('shows view diff button for untracked files', () => {
      const file = createMockFileStatus('new.ts', 'added');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      // Untracked files now show view diff button (displays content as all additions)
      expect(screen.getByTestId('view-diff-button')).toBeInTheDocument();
    });

    it('does not show unstage button for untracked files', () => {
      const file = createMockFileStatus('new.ts', 'added');
      render(<FileStatusItem file={file} category={category} {...mockHandlers} />);

      expect(screen.queryByTestId('unstage-button')).not.toBeInTheDocument();
    });
  });

  describe('view diff for added files', () => {
    it('shows view diff button for added files in unstaged', () => {
      const file = createMockFileStatus('new.ts', 'added', 20, 0);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByTestId('view-diff-button')).toBeInTheDocument();
    });

    it('shows view diff button for added files in staged', () => {
      const file = createMockFileStatus('new.ts', 'added', 20, 0);
      render(<FileStatusItem file={file} category="staged" {...mockHandlers} />);

      expect(screen.getByTestId('view-diff-button')).toBeInTheDocument();
    });
  });

  describe('optional handlers', () => {
    it('does not render stage button when onStage is not provided', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category="unstaged" />);

      expect(screen.queryByTestId('stage-button')).not.toBeInTheDocument();
    });

    it('does not render unstage button when onUnstage is not provided', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category="staged" />);

      expect(screen.queryByTestId('unstage-button')).not.toBeInTheDocument();
    });

    it('does not render discard button when onDiscard is not provided', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category="unstaged" />);

      expect(screen.queryByTestId('discard-button')).not.toBeInTheDocument();
    });

    it('does not render view diff button when onViewDiff is not provided', () => {
      const file = createMockFileStatus('test.ts', 'modified');
      render(<FileStatusItem file={file} category="unstaged" />);

      expect(screen.queryByTestId('view-diff-button')).not.toBeInTheDocument();
    });

    it('does not render open in editor button when onOpenInEditor is not provided', () => {
      const file = createMockFileStatus('test.ts');
      render(<FileStatusItem file={file} category="unstaged" />);

      expect(screen.queryByTestId('open-in-editor-button')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles long file paths with truncation on directory only', () => {
      const longPath =
        'src/components/deeply/nested/folder/structure/with/many/levels/Component.tsx';
      const file = createMockFileStatus(longPath);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      const dirPath = screen.getByText(
        'src/components/deeply/nested/folder/structure/with/many/levels'
      );
      const fileName = screen.getByText('Component.tsx');
      expect(dirPath).toHaveClass('truncate');
      expect(fileName).not.toHaveClass('truncate');
    });

    it('handles file with no changes (0 additions, 0 deletions)', () => {
      const file = createMockFileStatus('test.ts', 'modified', 0, 0);
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.queryByTestId('additions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('deletions')).not.toBeInTheDocument();
    });

    it('handles special characters in file path', () => {
      const file = createMockFileStatus('src/[components]/file-name_with.special.chars.tsx');
      render(<FileStatusItem file={file} category="unstaged" {...mockHandlers} />);

      expect(screen.getByText('src/[components]')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
      expect(screen.getByText('file-name_with.special.chars.tsx')).toBeInTheDocument();
    });

    it('stops event propagation when action buttons are clicked', () => {
      const file = createMockFileStatus('test.ts');
      const parentClickHandler = vi.fn();
      render(
        <div onClick={parentClickHandler}>
          <FileStatusItem file={file} category="unstaged" {...mockHandlers} />
        </div>
      );

      fireEvent.click(screen.getByTestId('stage-button'));
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });
});
