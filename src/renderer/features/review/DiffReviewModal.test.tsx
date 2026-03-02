import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffReviewModal } from './DiffReviewModal';
import type { DiffFile, ReviewSession, ReviewData } from '../../../shared/reviewTypes';

// Mock the review store with selector support
const mockStoreState: Record<string, unknown> = {};
vi.mock('@/stores/reviewStore', () => ({
  useReviewStore: vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    if (selector) {
      return selector(mockStoreState);
    }
    return mockStoreState;
  }),
}));

const mockFiles: DiffFile[] = [
  {
    path: 'src/file1.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    isBinary: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        header: '@@ -1,3 +1,4 @@',
        lines: [
          { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
          { type: 'add', newLineNumber: 2, content: 'new line' },
          { type: 'context', oldLineNumber: 2, newLineNumber: 3, content: 'line 2' },
        ],
      },
    ],
  },
  {
    path: 'src/file2.ts',
    status: 'added',
    additions: 10,
    deletions: 0,
    isBinary: false,
    hunks: [],
  },
];

const mockCurrentReview: ReviewSession = {
  baseBranch: 'main',
  compareBranch: 'feature',
  files: mockFiles,
  viewMode: 'unified',
};

const mockReviewData: ReviewData = {
  id: 'review-1',
  projectPath: '/test/project',
  baseBranch: 'main',
  compareBranch: 'feature',
  baseCommit: 'abc123',
  compareCommit: 'def456',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  files: [{ path: 'src/file1.ts', viewed: false }],
  comments: [],
};

describe('DiffReviewModal', () => {
  const mockSetViewMode = vi.fn();
  const mockSetSelectedFile = vi.fn();
  const mockStartCommenting = vi.fn();
  const mockCancelCommenting = vi.fn();
  const mockAddComment = vi.fn();
  const mockDeleteComment = vi.fn();
  const mockUpdateComment = vi.fn();
  const mockMarkFileViewed = vi.fn();
  const mockMarkFileUnviewed = vi.fn();
  const mockCloseReview = vi.fn();
  const mockGetFileComments = vi.fn(() => []);
  const mockIsFileViewed = vi.fn((_path: string) => false); // Default: no files viewed
  const mockAddExpandedRange = vi.fn();
  const mockGetExpandedRanges = vi.fn(() => []);
  const mockClearExpansions = vi.fn();
  const mockGetLineComments = vi.fn(() => []);
  const mockExportToJson = vi.fn(() => null);
  const mockGetPromptText = vi.fn(() => '');
  const mockClearAllComments = vi.fn();
  const mockGetCommentCount = vi.fn(() => 0);
  const mockGetFormattedCommentsMarkdown = vi.fn(() => '');
  const mockGetCommentsForExport = vi.fn(() => []);
  const mockOnClose = vi.fn();

  const defaultMockStore = {
    currentReview: mockCurrentReview,
    reviewData: mockReviewData,
    projectPath: '/test/project',
    isLoading: false,
    error: null,
    selectedFile: 'src/file1.ts',
    commentingOnLine: null,
    setViewMode: mockSetViewMode,
    setSelectedFile: mockSetSelectedFile,
    startCommenting: mockStartCommenting,
    cancelCommenting: mockCancelCommenting,
    addComment: mockAddComment,
    deleteComment: mockDeleteComment,
    updateComment: mockUpdateComment,
    markFileViewed: mockMarkFileViewed,
    markFileUnviewed: mockMarkFileUnviewed,
    closeReview: mockCloseReview,
    getFileComments: mockGetFileComments,
    isFileViewed: mockIsFileViewed,
    addExpandedRange: mockAddExpandedRange,
    getExpandedRanges: mockGetExpandedRanges,
    clearExpansions: mockClearExpansions,
    getLineComments: mockGetLineComments,
    exportToJson: mockExportToJson,
    getPromptText: mockGetPromptText,
    clearAllComments: mockClearAllComments,
    getCommentCount: mockGetCommentCount,
    getFormattedCommentsMarkdown: mockGetFormattedCommentsMarkdown,
    getCommentsForExport: mockGetCommentsForExport,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFileViewed.mockReturnValue(false);
    // Set up the mock store state
    Object.assign(mockStoreState, defaultMockStore);
  });

  it('should render modal when open', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('diff-review-modal')).toBeInTheDocument();
  });

  it('should not render when currentReview is null', () => {
    Object.assign(mockStoreState, {
      ...defaultMockStore,
      currentReview: null,
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.queryByTestId('diff-review-modal')).not.toBeInTheDocument();
  });

  it('should render header with branch names', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('diff-review-header')).toBeInTheDocument();
    expect(screen.getByTestId('base-branch')).toHaveTextContent('main');
    expect(screen.getByTestId('compare-branch')).toHaveTextContent('feature');
  });

  it('should render file list sidebar', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('file-list-sidebar')).toBeInTheDocument();
  });

  it('should render diff content area', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('diff-content-area')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    Object.assign(mockStoreState, {
      ...defaultMockStore,
      isLoading: true,
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Loading diff...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    Object.assign(mockStoreState, {
      ...defaultMockStore,
      error: 'Failed to load diff',
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Failed to load diff')).toBeInTheDocument();
  });

  it('should call setViewMode when view mode button is clicked', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('split-mode-button'));

    expect(mockSetViewMode).toHaveBeenCalledWith('split');
  });

  it('should call closeReview and onClose when close button is clicked', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('close-button'));

    expect(mockCloseReview).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render file diffs for unviewed files only', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Both files are unviewed (default mock returns false)
    expect(screen.getAllByTestId('file-diff')).toHaveLength(2);
  });

  it('should hide viewed files from diff content area', () => {
    // Mark file1 as viewed
    mockIsFileViewed.mockImplementation((path: string) => path === 'src/file1.ts');

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Only file2 should be shown (file1 is viewed)
    expect(screen.getAllByTestId('file-diff')).toHaveLength(1);
  });

  it('should show all-viewed state when all files are viewed', () => {
    mockIsFileViewed.mockReturnValue(true); // All files viewed

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByTestId('all-viewed-state')).toBeInTheDocument();
    expect(screen.getByText('All files reviewed')).toBeInTheDocument();
    expect(screen.queryByTestId('file-diff')).not.toBeInTheDocument();
  });

  it('should call markFileViewed when file is marked as viewed', () => {
    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Find the mark viewed checkbox for a file
    const markViewedCheckboxes = screen.getAllByTestId('mark-viewed-checkbox');
    fireEvent.click(markViewedCheckboxes[0]);

    expect(mockMarkFileViewed).toHaveBeenCalled();
  });

  it('should call markFileUnviewed when viewed file is unmarked', () => {
    // Mark file1 as viewed
    mockIsFileViewed.mockImplementation((path: string) => path === 'src/file1.ts');

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Find the toggle viewed button in the file list (for the viewed file)
    const toggleViewedButtons = screen.getAllByTestId('toggle-viewed-button');
    fireEvent.click(toggleViewedButtons[0]); // This should unmark the viewed file

    expect(mockMarkFileUnviewed).toHaveBeenCalledWith('src/file1.ts');
  });

  it('should render inline comment input when commentingOnLine is set for unviewed file', () => {
    Object.assign(mockStoreState, {
      ...defaultMockStore,
      commentingOnLine: {
        filePath: 'src/file1.ts',
        lineStart: 1,
        lineEnd: 1,
        side: 'new' as const,
      },
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Comment input is now rendered inline at the line position
    expect(screen.getByTestId('comment-input-row')).toBeInTheDocument();
    expect(screen.getByTestId('comment-input')).toBeInTheDocument();
  });

  it('should call cancelCommenting when comment input is cancelled', () => {
    Object.assign(mockStoreState, {
      ...defaultMockStore,
      commentingOnLine: {
        filePath: 'src/file1.ts',
        lineStart: 1,
        lineEnd: 1,
        side: 'new' as const,
      },
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(mockCancelCommenting).toHaveBeenCalled();
  });

  it('should render inline comments when unviewed file has comments', () => {
    const mockComments = [
      {
        id: 'comment-1',
        reviewId: 'review-1',
        filePath: 'src/file1.ts',
        lineStart: 1,
        lineEnd: 1,
        side: 'new' as const,
        category: 'issue' as const,
        content: 'Test comment',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    Object.assign(mockStoreState, {
      ...defaultMockStore,
      getFileComments: (path: string) => (path === 'src/file1.ts' ? mockComments : []),
    });

    render(<DiffReviewModal isOpen={true} onClose={mockOnClose} />);

    // Comments are now rendered inline at the line position
    expect(screen.getByTestId('comment-thread-row')).toBeInTheDocument();
    expect(screen.getByTestId('comment-thread')).toBeInTheDocument();
  });
});
