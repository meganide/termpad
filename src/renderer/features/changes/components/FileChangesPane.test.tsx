import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FileChangesPane } from './FileChangesPane';
import type { DiffFile } from '../../../../shared/reviewTypes';

const createMockDiffFile = (
  path: string,
  additions = 10,
  deletions = 5
): DiffFile => ({
  path,
  status: 'modified',
  additions,
  deletions,
  isBinary: false,
  hunks: [],
});

describe('FileChangesPane', () => {
  const mockOnFileClick = vi.fn();
  const mockOnReviewClick = vi.fn();

  const defaultProps = {
    files: [] as DiffFile[],
    isLoading: false,
    error: null,
    onFileClick: mockOnFileClick,
    onReviewClick: mockOnReviewClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header', () => {
    it('renders Changes title', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.getByText('Changes')).toBeInTheDocument();
    });

    it('renders Review button', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.getByTestId('review-button')).toBeInTheDocument();
    });

    it('shows file count when there are changes', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} />);
      expect(screen.getByTestId('file-count')).toHaveTextContent('(1 file)');
    });

    it('shows plural files count', () => {
      const files = [createMockDiffFile('a.ts'), createMockDiffFile('b.ts')];
      render(<FileChangesPane {...defaultProps} files={files} />);
      expect(screen.getByTestId('file-count')).toHaveTextContent('(2 files)');
    });

    it('does not show file count when empty', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.queryByTestId('file-count')).not.toBeInTheDocument();
    });
  });

  describe('Review button', () => {
    it('calls onReviewClick when clicked', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} />);

      fireEvent.click(screen.getByTestId('review-button'));
      expect(mockOnReviewClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when no changes', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.getByTestId('review-button')).toBeDisabled();
    });

    it('is disabled while loading', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} isLoading={true} />);
      expect(screen.getByTestId('review-button')).toBeDisabled();
    });

    it('is enabled when there are changes', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} />);
      expect(screen.getByTestId('review-button')).not.toBeDisabled();
    });
  });

  describe('stats row', () => {
    it('shows total additions and deletions', () => {
      const files = [
        createMockDiffFile('a.ts', 10, 5),
        createMockDiffFile('b.ts', 20, 10),
      ];
      render(<FileChangesPane {...defaultProps} files={files} />);

      expect(screen.getByTestId('total-additions')).toHaveTextContent('+30');
      expect(screen.getByTestId('total-deletions')).toHaveTextContent('-15');
    });

    it('does not show stats row when no changes', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.queryByTestId('total-additions')).not.toBeInTheDocument();
    });

    it('does not show additions when zero', () => {
      const files = [createMockDiffFile('a.ts', 0, 10)];
      render(<FileChangesPane {...defaultProps} files={files} />);

      expect(screen.queryByTestId('total-additions')).not.toBeInTheDocument();
      expect(screen.getByTestId('total-deletions')).toBeInTheDocument();
    });

    it('does not show deletions when zero', () => {
      const files = [createMockDiffFile('a.ts', 10, 0)];
      render(<FileChangesPane {...defaultProps} files={files} />);

      expect(screen.getByTestId('total-additions')).toBeInTheDocument();
      expect(screen.queryByTestId('total-deletions')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when loading', () => {
      render(<FileChangesPane {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('hides file list when loading', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} isLoading={true} />);
      expect(screen.queryByTestId('file-list')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      render(<FileChangesPane {...defaultProps} error="Failed to fetch diff" />);
      expect(screen.getByTestId('error-state')).toHaveTextContent('Failed to fetch diff');
    });

    it('hides file list when error', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} error="Error" />);
      expect(screen.queryByTestId('file-list')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state message when no changes', () => {
      render(<FileChangesPane {...defaultProps} />);
      expect(screen.getByTestId('empty-state')).toHaveTextContent('No uncommitted changes');
    });
  });

  describe('file list', () => {
    it('renders all files', () => {
      const files = [
        createMockDiffFile('src/a.ts'),
        createMockDiffFile('src/b.ts'),
        createMockDiffFile('src/c.ts'),
      ];
      render(<FileChangesPane {...defaultProps} files={files} />);

      const fileList = screen.getByTestId('file-list');
      const items = within(fileList).getAllByTestId('changed-file-item');
      expect(items).toHaveLength(3);
    });

    it('calls onFileClick when file is clicked', () => {
      const files = [createMockDiffFile('test.ts')];
      render(<FileChangesPane {...defaultProps} files={files} />);

      fireEvent.click(screen.getByTestId('changed-file-item'));
      expect(mockOnFileClick).toHaveBeenCalledWith(files[0]);
    });
  });

  describe('edge cases', () => {
    it('handles files with no additions or deletions', () => {
      const files = [createMockDiffFile('test.ts', 0, 0)];
      render(<FileChangesPane {...defaultProps} files={files} />);

      expect(screen.queryByTestId('total-additions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('total-deletions')).not.toBeInTheDocument();
    });
  });
});
