import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportToJson,
  generatePrompt,
  generateSingleCommentPrompt,
  copyToClipboard,
  downloadJson,
  generateExportFilename,
} from './exportComments';
import type { ReviewData, DiffFile } from '../../../../shared/reviewTypes';

describe('exportComments', () => {
  const mockReviewData: ReviewData = {
    id: 'review-1',
    projectPath: '/home/user/project',
    baseBranch: 'main',
    compareBranch: 'feature/new-feature',
    baseCommit: 'abc123',
    compareCommit: 'def456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    files: [],
    comments: [
      {
        id: 'comment-1',
        reviewId: 'review-1',
        filePath: 'src/file1.ts',
        lineStart: 10,
        lineEnd: 10,
        side: 'new',
        category: 'issue',
        content: 'This will cause a null pointer exception',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'comment-2',
        reviewId: 'review-1',
        filePath: 'src/file1.ts',
        lineStart: 20,
        lineEnd: 25,
        side: 'new',
        category: 'suggestion',
        content: 'Consider using a map here',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'comment-3',
        reviewId: 'review-1',
        filePath: 'src/file2.ts',
        lineStart: 5,
        lineEnd: 5,
        side: 'new',
        category: 'nitpick',
        content: 'Rename this variable',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
  };

  const mockFiles: DiffFile[] = [
    {
      path: 'src/file1.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      isBinary: false,
      hunks: [],
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

  describe('exportToJson', () => {
    it('should export review data to JSON format', () => {
      const result = exportToJson(mockReviewData, mockFiles, '/home/user/project');

      expect(result.project).toBe('/home/user/project');
      expect(result.baseBranch).toBe('main');
      expect(result.compareBranch).toBe('feature/new-feature');
      expect(result.exportedAt).toBeDefined();
      expect(result.files).toHaveLength(2);
    });

    it('should group comments by file', () => {
      const result = exportToJson(mockReviewData, mockFiles, '/home/user/project');

      const file1 = result.files.find((f) => f.path === 'src/file1.ts');
      const file2 = result.files.find((f) => f.path === 'src/file2.ts');

      expect(file1?.comments).toHaveLength(2);
      expect(file2?.comments).toHaveLength(1);
    });

    it('should format line ranges correctly', () => {
      const result = exportToJson(mockReviewData, mockFiles, '/home/user/project');

      const file1 = result.files.find((f) => f.path === 'src/file1.ts');
      expect(file1?.comments[0].lines).toBe('10');
      expect(file1?.comments[1].lines).toBe('20-25');
    });

    it('should sort comments by line number', () => {
      const result = exportToJson(mockReviewData, mockFiles, '/home/user/project');

      const file1 = result.files.find((f) => f.path === 'src/file1.ts');
      expect(file1?.comments[0].lines).toBe('10');
      expect(file1?.comments[1].lines).toBe('20-25');
    });

    it('should handle empty comments', () => {
      const emptyReviewData = { ...mockReviewData, comments: [] };
      const result = exportToJson(emptyReviewData, mockFiles, '/home/user/project');

      expect(result.files).toHaveLength(0);
    });
  });

  describe('generatePrompt', () => {
    it('should generate a prompt with all comments', () => {
      const prompt = generatePrompt(mockReviewData, '/home/user/project');

      expect(prompt).toContain('Please fix the following code review comments');
      expect(prompt).toContain('/home/user/project');
      expect(prompt).toContain('main');
      expect(prompt).toContain('feature/new-feature');
    });

    it('should include file sections', () => {
      const prompt = generatePrompt(mockReviewData, '/home/user/project');

      expect(prompt).toContain('## src/file1.ts');
      expect(prompt).toContain('## src/file2.ts');
    });

    it('should format comments with line numbers and categories', () => {
      const prompt = generatePrompt(mockReviewData, '/home/user/project');

      expect(prompt).toContain('**Line 10** [ISSUE]');
      expect(prompt).toContain('**Lines 20-25** [SUGGESTION]');
      expect(prompt).toContain('**Line 5** [NITPICK]');
    });

    it('should include comment content', () => {
      const prompt = generatePrompt(mockReviewData, '/home/user/project');

      expect(prompt).toContain('This will cause a null pointer exception');
      expect(prompt).toContain('Consider using a map here');
      expect(prompt).toContain('Rename this variable');
    });

    it('should return message when no comments', () => {
      const emptyReviewData = { ...mockReviewData, comments: [] };
      const prompt = generatePrompt(emptyReviewData, '/home/user/project');

      expect(prompt).toBe('No comments to address.');
    });

    it('should prioritize issues in the prompt', () => {
      const prompt = generatePrompt(mockReviewData, '/home/user/project');

      expect(prompt).toContain('issues');
    });
  });

  describe('generateSingleCommentPrompt', () => {
    it('should generate prompt for single line comment', () => {
      const comment = mockReviewData.comments[0];
      const prompt = generateSingleCommentPrompt(comment, 'src/file1.ts');

      expect(prompt).toContain('issue');
      expect(prompt).toContain('src/file1.ts');
      expect(prompt).toContain('line 10');
      expect(prompt).toContain('This will cause a null pointer exception');
    });

    it('should generate prompt for multi-line comment', () => {
      const comment = mockReviewData.comments[1];
      const prompt = generateSingleCommentPrompt(comment, 'src/file1.ts');

      expect(prompt).toContain('suggestion');
      expect(prompt).toContain('lines 20-25');
    });
  });

  describe('copyToClipboard', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
    });

    it('should copy text to clipboard', async () => {
      const result = await copyToClipboard('test text');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed')
      );

      const result = await copyToClipboard('test text');

      expect(result).toBe(false);
    });
  });

  describe('downloadJson', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:test');
      global.URL.revokeObjectURL = vi.fn();
    });

    it('should create and click download link', () => {
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadJson({ test: 'data' }, 'test.json');

      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('generateExportFilename', () => {
    it('should generate filename with project name and branch', () => {
      const filename = generateExportFilename('/home/user/my-project', 'feature/new-feature');

      expect(filename).toContain('my-project');
      expect(filename).toContain('feature-new-feature');
      expect(filename).toContain('-review-');
      expect(filename.endsWith('.json')).toBe(true);
    });

    it('should sanitize branch name', () => {
      const filename = generateExportFilename('/project', 'feature/test@branch#123');

      expect(filename).toContain('feature-test-branch-123');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('/');
    });

    it('should include date in filename', () => {
      const today = new Date().toISOString().split('T')[0];
      const filename = generateExportFilename('/project', 'main');

      expect(filename).toContain(today);
    });
  });
});
