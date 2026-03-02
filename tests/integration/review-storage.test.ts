import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReviewData } from '@/shared/reviewTypes';

describe('Review Storage IPC Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockReview = (overrides: Partial<ReviewData> = {}): ReviewData => ({
    id: 'review-1',
    projectPath: '/test/project',
    baseBranch: 'main',
    compareBranch: 'feature',
    baseCommit: 'abc123',
    compareCommit: 'def456',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    files: [],
    comments: [],
    ...overrides,
  });

  describe('save', () => {
    it('should call save IPC with review data', async () => {
      const review = createMockReview();

      await window.reviewStorage.save(review);

      expect(window.reviewStorage.save).toHaveBeenCalledWith(review);
    });

    it('should handle review with comments', async () => {
      const review = createMockReview({
        comments: [
          {
            id: 'comment-1',
            reviewId: 'review-1',
            filePath: 'src/file.ts',
            lineStart: 10,
            lineEnd: 15,
            side: 'new',
            category: 'bug',
            content: 'This looks like a bug',
            createdAt: '2024-01-01T00:00:00.000Z',
            isOutdated: false,
          },
        ],
      });

      await window.reviewStorage.save(review);

      expect(window.reviewStorage.save).toHaveBeenCalledWith(review);
    });
  });

  describe('load', () => {
    it('should call load IPC with project path and review ID', async () => {
      const mockReview = createMockReview();
      vi.mocked(window.reviewStorage.load).mockResolvedValue(mockReview);

      const result = await window.reviewStorage.load('/test/project', 'review-1');

      expect(window.reviewStorage.load).toHaveBeenCalledWith('/test/project', 'review-1');
      expect(result).toEqual(mockReview);
    });

    it('should return null when review not found', async () => {
      vi.mocked(window.reviewStorage.load).mockResolvedValue(null);

      const result = await window.reviewStorage.load('/test/project', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should call delete IPC and return true on success', async () => {
      vi.mocked(window.reviewStorage.delete).mockResolvedValue(true);

      const result = await window.reviewStorage.delete('/test/project', 'review-1');

      expect(window.reviewStorage.delete).toHaveBeenCalledWith('/test/project', 'review-1');
      expect(result).toBe(true);
    });

    it('should return false when review not found', async () => {
      vi.mocked(window.reviewStorage.delete).mockResolvedValue(false);

      const result = await window.reviewStorage.delete('/test/project', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should return list of review IDs', async () => {
      vi.mocked(window.reviewStorage.list).mockResolvedValue(['review-1', 'review-2', 'review-3']);

      const result = await window.reviewStorage.list('/test/project');

      expect(window.reviewStorage.list).toHaveBeenCalledWith('/test/project');
      expect(result).toEqual(['review-1', 'review-2', 'review-3']);
    });

    it('should return empty array when no reviews exist', async () => {
      vi.mocked(window.reviewStorage.list).mockResolvedValue([]);

      const result = await window.reviewStorage.list('/test/project');

      expect(result).toEqual([]);
    });
  });

  describe('loadAll', () => {
    it('should return all reviews for a project', async () => {
      const mockReviews = [
        createMockReview({ id: 'review-1' }),
        createMockReview({ id: 'review-2', baseBranch: 'develop' }),
      ];
      vi.mocked(window.reviewStorage.loadAll).mockResolvedValue(mockReviews);

      const result = await window.reviewStorage.loadAll('/test/project');

      expect(window.reviewStorage.loadAll).toHaveBeenCalledWith('/test/project');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('review-1');
    });

    it('should return empty array when no reviews exist', async () => {
      vi.mocked(window.reviewStorage.loadAll).mockResolvedValue([]);

      const result = await window.reviewStorage.loadAll('/test/project');

      expect(result).toEqual([]);
    });
  });

  describe('findByBranches', () => {
    it('should find review by branch combination', async () => {
      const mockReview = createMockReview();
      vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(mockReview);

      const result = await window.reviewStorage.findByBranches('/test/project', 'main', 'feature');

      expect(window.reviewStorage.findByBranches).toHaveBeenCalledWith(
        '/test/project',
        'main',
        'feature',
      );
      expect(result).toEqual(mockReview);
    });

    it('should return null when no matching review found', async () => {
      vi.mocked(window.reviewStorage.findByBranches).mockResolvedValue(null);

      const result = await window.reviewStorage.findByBranches(
        '/test/project',
        'main',
        'nonexistent',
      );

      expect(result).toBeNull();
    });
  });

  describe('review data persistence', () => {
    it('should preserve comments with all properties', async () => {
      const review = createMockReview({
        comments: [
          {
            id: 'comment-1',
            reviewId: 'review-1',
            filePath: 'src/file.ts',
            lineStart: 10,
            lineEnd: 10,
            side: 'new',
            category: 'suggestion',
            content: 'Consider using const here',
            createdAt: '2024-01-01T00:00:00.000Z',
            isOutdated: false,
          },
          {
            id: 'comment-2',
            reviewId: 'review-1',
            filePath: 'src/utils.ts',
            lineStart: 20,
            lineEnd: 25,
            side: 'old',
            category: 'bug',
            content: 'This will cause a null pointer',
            createdAt: '2024-01-01T00:00:00.000Z',
            isOutdated: true,
          },
        ],
      });

      vi.mocked(window.reviewStorage.load).mockResolvedValue(review);

      const result = await window.reviewStorage.load('/test/project', 'review-1');

      expect(result?.comments).toHaveLength(2);
      expect(result?.comments[0].category).toBe('suggestion');
      expect(result?.comments[1].isOutdated).toBe(true);
    });

    it('should preserve file viewed state', async () => {
      const review = createMockReview({
        files: [
          { path: 'src/file1.ts', viewed: true, viewedAt: '2024-01-01T12:00:00.000Z' },
          { path: 'src/file2.ts', viewed: false },
        ],
      });

      vi.mocked(window.reviewStorage.load).mockResolvedValue(review);

      const result = await window.reviewStorage.load('/test/project', 'review-1');

      expect(result?.files).toHaveLength(2);
      expect(result?.files[0].viewed).toBe(true);
      expect(result?.files[0].viewedAt).toBe('2024-01-01T12:00:00.000Z');
      expect(result?.files[1].viewed).toBe(false);
    });
  });
});
