import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReviewToolbar } from './ReviewToolbar';
import { useReviewStore } from '@/stores/reviewStore';

// Mock the review store
vi.mock('@/stores/reviewStore', () => ({
  useReviewStore: vi.fn(),
}));

// Mock window.dialog and clipboard
const mockSaveFile = vi.fn().mockResolvedValue(undefined);
const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);

describe('ReviewToolbar', () => {
  const mockGetFormattedCommentsMarkdown = vi.fn();
  const mockGetCommentsForExport = vi.fn();
  const mockClearAllComments = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFormattedCommentsMarkdown.mockReturnValue('');
    mockGetCommentsForExport.mockReturnValue([]);
    mockClearAllComments.mockResolvedValue(undefined);

    // Add dialog mock
    Object.defineProperty(window, 'dialog', {
      value: { saveFile: mockSaveFile },
      writable: true,
      configurable: true,
    });

    // Add clipboard mock to navigator
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  const setupMockStore = (commentCount: number) => {
    vi.mocked(useReviewStore).mockImplementation((selector) => {
      const state = {
        getCommentCount: () => commentCount,
        getFormattedCommentsMarkdown: mockGetFormattedCommentsMarkdown,
        getCommentsForExport: mockGetCommentsForExport,
        clearAllComments: mockClearAllComments,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return selector(state as any);
    });
  };

  describe('when there are no comments', () => {
    beforeEach(() => {
      setupMockStore(0);
    });

    it('should display "0 comments"', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('comment-count')).toHaveTextContent('0 comments');
    });

    it('should disable the copy button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('copy-button')).toBeDisabled();
    });

    it('should disable the export button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('export-button')).toBeDisabled();
    });

    it('should disable the clear button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('clear-button')).toBeDisabled();
    });
  });

  describe('when there is 1 comment', () => {
    beforeEach(() => {
      setupMockStore(1);
    });

    it('should display "1 comment" (singular)', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('comment-count')).toHaveTextContent('1 comment');
      expect(screen.getByTestId('comment-count')).not.toHaveTextContent('comments');
    });

    it('should enable the copy button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('copy-button')).not.toBeDisabled();
    });

    it('should enable the export button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('export-button')).not.toBeDisabled();
    });

    it('should enable the clear button', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('clear-button')).not.toBeDisabled();
    });
  });

  describe('when there are multiple comments', () => {
    beforeEach(() => {
      setupMockStore(5);
    });

    it('should display correct comment count', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('comment-count')).toHaveTextContent('5 comments');
    });

    it('should enable all buttons', () => {
      render(<ReviewToolbar />);

      expect(screen.getByTestId('copy-button')).not.toBeDisabled();
      expect(screen.getByTestId('export-button')).not.toBeDisabled();
      expect(screen.getByTestId('clear-button')).not.toBeDisabled();
    });
  });

  describe('copy button', () => {
    beforeEach(() => {
      setupMockStore(2);
    });

    it('should copy markdown to clipboard when clicked', async () => {
      const markdown = '## file.ts\n- [bug] Line 1: Fix this\n';
      mockGetFormattedCommentsMarkdown.mockReturnValue(markdown);

      render(<ReviewToolbar />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('copy-button'));
      });

      expect(mockClipboardWriteText).toHaveBeenCalledWith(markdown);
    });

    it('should show "Copied!" text after successful copy', async () => {
      mockGetFormattedCommentsMarkdown.mockReturnValue('some markdown');

      render(<ReviewToolbar />);

      expect(screen.getByTestId('copy-button')).toHaveTextContent('Copy');

      await act(async () => {
        fireEvent.click(screen.getByTestId('copy-button'));
      });

      expect(screen.getByTestId('copy-button')).toHaveTextContent('Copied!');
    });

    it('should not copy if markdown is empty', async () => {
      mockGetFormattedCommentsMarkdown.mockReturnValue('');

      render(<ReviewToolbar />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('copy-button'));
      });

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });
  });

  describe('export button', () => {
    beforeEach(() => {
      setupMockStore(2);
    });

    it('should open save dialog with comments when clicked', async () => {
      const comments = [
        { file: 'file.ts', lineStart: 1, lineEnd: 1, type: 'bug', comment: 'Fix this' },
      ];
      mockGetCommentsForExport.mockReturnValue(comments);

      render(<ReviewToolbar />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-button'));
      });

      expect(mockSaveFile).toHaveBeenCalledWith({
        title: 'Export Comments',
        defaultPath: 'review-comments.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        content: JSON.stringify(comments, null, 2),
      });
    });

    it('should not open save dialog if no comments to export', async () => {
      mockGetCommentsForExport.mockReturnValue([]);

      render(<ReviewToolbar />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('export-button'));
      });

      expect(mockSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('clear button', () => {
    beforeEach(() => {
      setupMockStore(3);
    });

    it('should show confirmation dialog when clicked', () => {
      render(<ReviewToolbar />);

      fireEvent.click(screen.getByTestId('clear-button'));

      expect(screen.getByText('Clear all comments?')).toBeInTheDocument();
      expect(screen.getByText(/This will permanently delete all 3 comments/)).toBeInTheDocument();
    });

    it('should call store clearAllComments when confirmed (no onClearAll prop)', async () => {
      render(<ReviewToolbar />);

      fireEvent.click(screen.getByTestId('clear-button'));
      expect(screen.getByText('Clear All')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Clear All'));
      });

      expect(mockClearAllComments).toHaveBeenCalled();
    });

    it('should call onClearAll prop when provided and confirmed', async () => {
      const onClearAll = vi.fn().mockResolvedValue(undefined);

      render(<ReviewToolbar onClearAll={onClearAll} />);

      fireEvent.click(screen.getByTestId('clear-button'));
      expect(screen.getByText('Clear All')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Clear All'));
      });

      expect(onClearAll).toHaveBeenCalled();
      expect(mockClearAllComments).not.toHaveBeenCalled();
    });

    it('should not clear comments when cancel is clicked', () => {
      render(<ReviewToolbar />);

      fireEvent.click(screen.getByTestId('clear-button'));
      expect(screen.getByText('Cancel')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockClearAllComments).not.toHaveBeenCalled();
    });
  });
});
