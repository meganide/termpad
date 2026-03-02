import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useReviewStore } from './reviewStore';
import type { ReviewData, DiffFile, GitDiffResult } from '../../shared/reviewTypes';

describe('reviewStore', () => {
  const mockDiffFiles: DiffFile[] = [
    {
      path: 'src/file1.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      isBinary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 5,
          newStart: 1,
          newLines: 10,
          header: '@@ -1,5 +1,10 @@',
          lines: [
            { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const x = 1;' },
            { type: 'add', newLineNumber: 2, content: 'const y = 2;' },
          ],
        },
      ],
    },
    {
      path: 'src/file2.ts',
      status: 'added',
      additions: 20,
      deletions: 0,
      isBinary: false,
      hunks: [],
    },
  ];

  const mockDiffResult: GitDiffResult = {
    files: mockDiffFiles,
    baseCommit: 'abc123',
    compareCommit: 'def456',
  };

  const mockReviewData: ReviewData = {
    id: 'review-1',
    projectPath: '/test/project',
    baseBranch: 'main',
    compareBranch: 'feature',
    baseCommit: 'abc123',
    compareCommit: 'def456',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    files: [
      { path: 'src/file1.ts', viewed: false },
      { path: 'src/file2.ts', viewed: false },
    ],
    comments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the store state
    useReviewStore.setState({
      currentReview: null,
      reviewData: null,
      projectPath: null,
      isLoading: false,
      error: null,
      selectedFile: null,
      commentingOnLine: null,
      expandedRanges: new Map(),
    });

    // Setup default mocks
    vi.mocked(window.terminal.getDefaultBranch).mockResolvedValue('main');
    vi.mocked(window.terminal.getCurrentBranch).mockResolvedValue('feature');
    vi.mocked(window.terminal.getDiff).mockResolvedValue(mockDiffResult);
    vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(null);
    vi.mocked(window.reviewStorage.save).mockResolvedValue(undefined);
  });

  describe('openReview', () => {
    it('should open a new review when none exists', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      const state = useReviewStore.getState();
      expect(state.currentReview).not.toBeNull();
      expect(state.currentReview?.baseBranch).toBe('main');
      expect(state.currentReview?.compareBranch).toBe('feature');
      expect(state.currentReview?.files).toEqual(mockDiffFiles);
      expect(state.reviewData).not.toBeNull();
      expect(state.selectedFile).toBe('src/file1.ts');
      expect(window.reviewStorage.save).toHaveBeenCalled();
    });

    it('should load existing review when found', async () => {
      const existingReview = { ...mockReviewData, lastCommitHash: 'def456' };
      vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(existingReview);

      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      const state = useReviewStore.getState();
      // Check key fields rather than exact equality since updatedAt may change
      expect(state.reviewData?.id).toBe(mockReviewData.id);
      expect(state.reviewData?.baseBranch).toBe(mockReviewData.baseBranch);
      expect(state.reviewData?.compareBranch).toBe(mockReviewData.compareBranch);
    });

    it('should use specified branches', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project', 'develop', 'hotfix');
      });

      const state = useReviewStore.getState();
      expect(state.currentReview?.baseBranch).toBe('develop');
      expect(state.currentReview?.compareBranch).toBe('hotfix');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(window.terminal.getDiff).mockRejectedValue(new Error('Git error'));

      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      const state = useReviewStore.getState();
      expect(state.error).toBe('Git error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('closeReview', () => {
    it('should reset all state', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().closeReview();
      });

      const state = useReviewStore.getState();
      expect(state.currentReview).toBeNull();
      expect(state.reviewData).toBeNull();
      expect(state.projectPath).toBeNull();
      expect(state.selectedFile).toBeNull();
    });
  });

  describe('view mode', () => {
    it('should set view mode', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().setViewMode('split');
      });

      expect(useReviewStore.getState().currentReview?.viewMode).toBe('split');
    });
  });

  describe('file selection', () => {
    it('should set selected file', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().setSelectedFile('src/file2.ts');
      });

      expect(useReviewStore.getState().selectedFile).toBe('src/file2.ts');
    });

    it('should clear commenting state when changing files', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().startCommenting('src/file1.ts', 10, 10, 'new');
      });

      act(() => {
        useReviewStore.getState().setSelectedFile('src/file2.ts');
      });

      expect(useReviewStore.getState().commentingOnLine).toBeNull();
    });
  });

  describe('comment actions', () => {
    beforeEach(async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });
    });

    it('should start commenting', () => {
      act(() => {
        useReviewStore.getState().startCommenting('src/file1.ts', 10, 15, 'new');
      });

      const state = useReviewStore.getState();
      expect(state.commentingOnLine).toEqual({
        filePath: 'src/file1.ts',
        lineStart: 10,
        lineEnd: 15,
        side: 'new',
      });
    });

    it('should cancel commenting', () => {
      act(() => {
        useReviewStore.getState().startCommenting('src/file1.ts', 10, 10, 'new');
      });

      act(() => {
        useReviewStore.getState().cancelCommenting();
      });

      expect(useReviewStore.getState().commentingOnLine).toBeNull();
    });

    it('should add a comment', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'This is an issue');
      });

      const state = useReviewStore.getState();
      expect(state.reviewData?.comments).toHaveLength(1);
      expect(state.reviewData?.comments[0].content).toBe('This is an issue');
      expect(state.reviewData?.comments[0].category).toBe('issue');
      expect(window.reviewStorage.save).toHaveBeenCalled();
    });

    it('should delete a comment', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'This is an issue');
      });

      const commentId = useReviewStore.getState().reviewData?.comments[0].id;

      await act(async () => {
        await useReviewStore.getState().deleteComment(commentId!);
      });

      expect(useReviewStore.getState().reviewData?.comments).toHaveLength(0);
    });

    it('should update a comment', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'Original comment');
      });

      const commentId = useReviewStore.getState().reviewData?.comments[0].id;

      await act(async () => {
        await useReviewStore.getState().updateComment(commentId!, 'Updated comment');
      });

      expect(useReviewStore.getState().reviewData?.comments[0].content).toBe('Updated comment');
    });

    it('should clear all comments', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'Comment 1');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 20, 20, 'new', 'suggestion', 'Comment 2');
      });

      expect(useReviewStore.getState().reviewData?.comments).toHaveLength(2);

      await act(async () => {
        await useReviewStore.getState().clearAllComments();
      });

      expect(useReviewStore.getState().reviewData?.comments).toHaveLength(0);
      expect(window.reviewStorage.save).toHaveBeenCalled();
    });

    it('should get comment count', async () => {
      expect(useReviewStore.getState().getCommentCount()).toBe(0);

      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'Comment 1');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 20, 20, 'new', 'suggestion', 'Comment 2');
      });

      expect(useReviewStore.getState().getCommentCount()).toBe(2);
    });

    it('should get formatted comments markdown', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'Fix this bug');
        await useReviewStore
          .getState()
          .addComment('src/file2.ts', 5, 10, 'new', 'suggestion', 'Consider refactoring');
      });

      const markdown = useReviewStore.getState().getFormattedCommentsMarkdown();
      expect(markdown).toContain('## src/file1.ts');
      expect(markdown).toContain('[issue] Line 10: Fix this bug');
      expect(markdown).toContain('## src/file2.ts');
      expect(markdown).toContain('[suggestion] Lines 5-10: Consider refactoring');
    });

    it('should get comments for export', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 15, 'new', 'issue', 'Fix this');
      });

      const exported = useReviewStore.getState().getCommentsForExport();
      expect(exported).toHaveLength(1);
      expect(exported[0]).toEqual({
        file: 'src/file1.ts',
        lineStart: 10,
        lineEnd: 15,
        type: 'issue',
        comment: 'Fix this',
      });
    });
  });

  describe('file state actions', () => {
    beforeEach(async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });
    });

    it('should mark file as viewed', async () => {
      await act(async () => {
        await useReviewStore.getState().markFileViewed('src/file1.ts');
      });

      expect(useReviewStore.getState().isFileViewed('src/file1.ts')).toBe(true);
      expect(window.reviewStorage.save).toHaveBeenCalled();
    });

    it('should mark file as unviewed', async () => {
      await act(async () => {
        await useReviewStore.getState().markFileViewed('src/file1.ts');
        await useReviewStore.getState().markFileUnviewed('src/file1.ts');
      });

      expect(useReviewStore.getState().isFileViewed('src/file1.ts')).toBe(false);
    });
  });

  describe('export actions', () => {
    beforeEach(async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'This is a bug');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 20, 25, 'new', 'suggestion', 'Consider refactoring');
      });
    });

    it('should export to JSON', () => {
      const exportData = useReviewStore.getState().exportToJson();

      expect(exportData).not.toBeNull();
      expect(exportData?.files).toHaveLength(1);
      expect(exportData?.files[0].comments).toHaveLength(2);
      expect(exportData?.files[0].comments[0].lines).toBe('10');
      expect(exportData?.files[0].comments[1].lines).toBe('20-25');
    });

    it('should generate prompt text', () => {
      const prompt = useReviewStore.getState().getPromptText();

      expect(prompt).toContain('Please fix the following code review comments');
      expect(prompt).toContain('src/file1.ts');
      expect(prompt).toContain('Line 10');
      expect(prompt).toContain('[ISSUE]');
      expect(prompt).toContain('This is a bug');
    });
  });

  describe('utility functions', () => {
    beforeEach(async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 10, 10, 'new', 'issue', 'Comment 1');
        await useReviewStore
          .getState()
          .addComment('src/file1.ts', 20, 20, 'new', 'suggestion', 'Comment 2');
        await useReviewStore
          .getState()
          .addComment('src/file2.ts', 5, 5, 'new', 'question', 'Comment 3');
      });
    });

    it('should get file comments', () => {
      const comments = useReviewStore.getState().getFileComments('src/file1.ts');
      expect(comments).toHaveLength(2);
    });

    it('should get line comments', () => {
      const comments = useReviewStore.getState().getLineComments('src/file1.ts', 10, 10);
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe('Comment 1');
    });
  });

  describe('openWorkingTreeReview', () => {
    const workingTreeFiles: DiffFile[] = [
      {
        path: 'src/changed.ts',
        status: 'modified',
        additions: 5,
        deletions: 2,
        isBinary: false,
        hunks: [],
      },
      {
        path: 'src/new-file.ts',
        status: 'added',
        additions: 10,
        deletions: 0,
        isBinary: false,
        hunks: [],
      },
    ];

    it('should create a new working tree review', async () => {
      await act(async () => {
        await useReviewStore
          .getState()
          .openWorkingTreeReview('/test/project', workingTreeFiles, 'abc123');
      });

      const state = useReviewStore.getState();
      expect(state.currentReview).not.toBeNull();
      expect(state.currentReview?.baseBranch).toBe('HEAD');
      expect(state.currentReview?.compareBranch).toBe('Working Tree');
      expect(state.currentReview?.files).toEqual(workingTreeFiles);
      expect(state.reviewData).not.toBeNull();
      expect(state.reviewData?.baseBranch).toBe('HEAD');
      expect(state.reviewData?.compareBranch).toBe('working-tree');
      expect(window.reviewStorage.save).toHaveBeenCalled();
    });

    it('should load existing working tree review', async () => {
      const existingReview: ReviewData = {
        id: 'working-tree-1',
        projectPath: '/test/project',
        baseBranch: 'HEAD',
        compareBranch: 'working-tree',
        baseCommit: 'abc123',
        compareCommit: 'working-tree',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        files: [{ path: 'src/changed.ts', viewed: false }],
        comments: [],
        lastCommitHash: 'abc123',
      };
      vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(existingReview);

      await act(async () => {
        await useReviewStore
          .getState()
          .openWorkingTreeReview('/test/project', workingTreeFiles, 'abc123');
      });

      const state = useReviewStore.getState();
      expect(state.reviewData?.id).toBe('working-tree-1');
      // Should add new files
      expect(state.reviewData?.files).toHaveLength(2);
    });

    it('should handle errors', async () => {
      vi.mocked(window.reviewStorage.findByBranches).mockRejectedValue(new Error('Storage error'));

      await act(async () => {
        await useReviewStore
          .getState()
          .openWorkingTreeReview('/test/project', workingTreeFiles, 'abc123');
      });

      const state = useReviewStore.getState();
      expect(state.error).toBe('Storage error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('expansion state', () => {
    it('should add and get expanded ranges', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().addExpandedRange('src/file1.ts', {
          startLine: 10,
          endLine: 20,
          content: ['line 1', 'line 2'],
        });
      });

      const ranges = useReviewStore.getState().getExpandedRanges('src/file1.ts');
      expect(ranges).toHaveLength(1);
      expect(ranges[0].startLine).toBe(10);
      expect(ranges[0].endLine).toBe(20);
    });

    it('should clear expansions for specific file', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().addExpandedRange('src/file1.ts', {
          startLine: 10,
          endLine: 20,
          content: ['content'],
        });
        useReviewStore.getState().addExpandedRange('src/file2.ts', {
          startLine: 5,
          endLine: 10,
          content: ['content'],
        });
      });

      act(() => {
        useReviewStore.getState().clearExpansions('src/file1.ts');
      });

      expect(useReviewStore.getState().getExpandedRanges('src/file1.ts')).toHaveLength(0);
      expect(useReviewStore.getState().getExpandedRanges('src/file2.ts')).toHaveLength(1);
    });

    it('should clear all expansions', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().addExpandedRange('src/file1.ts', {
          startLine: 10,
          endLine: 20,
          content: ['content'],
        });
        useReviewStore.getState().addExpandedRange('src/file2.ts', {
          startLine: 5,
          endLine: 10,
          content: ['content'],
        });
      });

      act(() => {
        useReviewStore.getState().clearExpansions();
      });

      expect(useReviewStore.getState().expandedRanges.size).toBe(0);
    });

    it('should clear expansion state when closing review', async () => {
      await act(async () => {
        await useReviewStore.getState().openReview('/test/project');
      });

      act(() => {
        useReviewStore.getState().addExpandedRange('src/file1.ts', {
          startLine: 10,
          endLine: 20,
          content: ['content'],
        });
      });

      expect(useReviewStore.getState().getExpandedRanges('src/file1.ts')).toHaveLength(1);

      act(() => {
        useReviewStore.getState().closeReview();
      });

      expect(useReviewStore.getState().expandedRanges.size).toBe(0);
    });
  });
});
