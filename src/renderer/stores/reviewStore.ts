import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  ReviewData,
  ReviewComment,
  ReviewFileState,
  DiffViewMode,
  CommentCategory,
  ReviewSession,
  ReviewExport,
  DiffFile,
  ExpandedRange,
} from '../../shared/reviewTypes';

interface ReviewStore {
  // Current review session
  currentReview: ReviewSession | null;
  reviewData: ReviewData | null;
  projectPath: string | null;
  isLoading: boolean;
  error: string | null;

  // UI state
  selectedFile: string | null;
  commentingOnLine: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    side: 'old' | 'new';
  } | null;

  // Expansion state (keyed by filePath to prevent state-drift when files are added/removed)
  expandedRanges: Map<string, ExpandedRange[]>;

  // Actions
  openReview: (projectPath: string, baseBranch?: string, compareBranch?: string) => Promise<void>;
  openWorkingTreeReview: (
    projectPath: string,
    files: DiffFile[],
    headCommit: string
  ) => Promise<void>;
  closeReview: () => void;
  setViewMode: (mode: DiffViewMode) => void;
  setSelectedFile: (filePath: string | null) => void;

  // Comment actions
  startCommenting: (
    filePath: string,
    lineStart: number,
    lineEnd: number,
    side: 'old' | 'new'
  ) => void;
  cancelCommenting: () => void;
  addComment: (
    filePath: string,
    lineStart: number,
    lineEnd: number,
    side: 'old' | 'new',
    category: CommentCategory,
    content: string
  ) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  clearAllComments: () => Promise<void>;
  getCommentCount: () => number;
  getFormattedCommentsMarkdown: () => string;
  getCommentsForExport: () => {
    file: string;
    lineStart: number;
    lineEnd: number;
    type: string;
    comment: string;
  }[];

  // File state actions
  markFileViewed: (filePath: string) => Promise<void>;
  markFileUnviewed: (filePath: string) => Promise<void>;

  // Export actions
  exportToJson: () => ReviewExport | null;
  getPromptText: () => string;

  // Utility
  getFileComments: (filePath: string) => ReviewComment[];
  getLineComments: (filePath: string, lineStart: number, lineEnd: number) => ReviewComment[];
  isFileViewed: (filePath: string) => boolean;

  // External sync (for diff window)
  setReviewData: (reviewData: ReviewData | null) => void;

  // Expansion actions
  addExpandedRange: (filePath: string, range: ExpandedRange) => void;
  getExpandedRanges: (filePath: string) => ExpandedRange[];
  clearExpansions: (filePath?: string) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  currentReview: null,
  reviewData: null,
  projectPath: null,
  isLoading: false,
  error: null,
  selectedFile: null,
  commentingOnLine: null,
  expandedRanges: new Map(),

  openReview: async (projectPath, baseBranch, compareBranch) => {
    set({ isLoading: true, error: null, projectPath });

    try {
      // Get default branch if not specified
      const defaultBranch = baseBranch || (await window.terminal.getDefaultBranch(projectPath));
      const currentBranch = compareBranch || (await window.terminal.getCurrentBranch(projectPath));

      // Get the diff
      const diffResult = await window.terminal.getDiff(projectPath, defaultBranch, currentBranch);

      // Try to load existing review for this branch combination
      let reviewData = await window.reviewStorage.findByBranches(
        projectPath,
        defaultBranch,
        currentBranch
      );

      // If no existing review, create a new one
      if (!reviewData) {
        reviewData = {
          id: generateId(),
          projectPath,
          baseBranch: defaultBranch,
          compareBranch: currentBranch,
          baseCommit: diffResult.baseCommit,
          compareCommit: diffResult.compareCommit,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          files: diffResult.files.map((f) => ({ path: f.path, viewed: false })),
          comments: [],
          lastCommitHash: diffResult.compareCommit,
        };
        await window.reviewStorage.save(reviewData);
      } else {
        // Check if diff has changed - compare commit hash
        const currentCommitHash = diffResult.compareCommit;
        if (reviewData.lastCommitHash && reviewData.lastCommitHash !== currentCommitHash) {
          // Diff has changed, clear comments if any exist
          if (reviewData.comments.length > 0) {
            const clearedCount = reviewData.comments.length;
            reviewData = {
              ...reviewData,
              comments: [],
              lastCommitHash: currentCommitHash,
              updatedAt: new Date().toISOString(),
            };
            await window.reviewStorage.save(reviewData);
            toast.info(
              `Diff changed - ${clearedCount} ${clearedCount === 1 ? 'comment' : 'comments'} cleared`
            );
          } else {
            // Just update the hash
            reviewData = {
              ...reviewData,
              lastCommitHash: currentCommitHash,
              updatedAt: new Date().toISOString(),
            };
            await window.reviewStorage.save(reviewData);
          }
        } else if (!reviewData.lastCommitHash) {
          // Initialize the hash if it wasn't set
          reviewData = {
            ...reviewData,
            lastCommitHash: currentCommitHash,
            updatedAt: new Date().toISOString(),
          };
          await window.reviewStorage.save(reviewData);
        }
      }

      // Create the current review session
      const currentReview: ReviewSession = {
        baseBranch: defaultBranch,
        compareBranch: currentBranch,
        files: diffResult.files,
        viewMode: 'unified',
      };

      set({
        currentReview,
        reviewData,
        isLoading: false,
        selectedFile: diffResult.files[0]?.path || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open review';
      set({ error: message, isLoading: false });
    }
  },

  openWorkingTreeReview: async (projectPath, files, headCommit) => {
    set({ isLoading: true, error: null, projectPath });

    try {
      // Try to load existing working tree review
      let reviewData = await window.reviewStorage.findByBranches(
        projectPath,
        'HEAD',
        'working-tree'
      );

      // If no existing review, create a new one
      if (!reviewData) {
        reviewData = {
          id: `working-tree-${Date.now()}`,
          projectPath,
          baseBranch: 'HEAD',
          compareBranch: 'working-tree',
          baseCommit: headCommit,
          compareCommit: 'working-tree',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          files: files.map((f) => ({ path: f.path, viewed: false })),
          comments: [],
          lastCommitHash: headCommit,
        };
        await window.reviewStorage.save(reviewData);
      } else {
        // Check if diff has changed - compare HEAD commit hash
        if (reviewData.lastCommitHash && reviewData.lastCommitHash !== headCommit) {
          // Diff has changed, clear comments if any exist
          if (reviewData.comments.length > 0) {
            const clearedCount = reviewData.comments.length;
            reviewData = {
              ...reviewData,
              comments: [],
              files: files.map((f) => ({ path: f.path, viewed: false })),
              lastCommitHash: headCommit,
              updatedAt: new Date().toISOString(),
            };
            await window.reviewStorage.save(reviewData);
            toast.info(
              `Diff changed - ${clearedCount} ${clearedCount === 1 ? 'comment' : 'comments'} cleared`
            );
          } else {
            // Just update the hash and files
            const existingFilePaths = new Set(reviewData.files.map((f) => f.path));
            const newFiles = files.filter((f) => !existingFilePaths.has(f.path));
            reviewData = {
              ...reviewData,
              files:
                newFiles.length > 0
                  ? [...reviewData.files, ...newFiles.map((f) => ({ path: f.path, viewed: false }))]
                  : reviewData.files,
              lastCommitHash: headCommit,
              updatedAt: new Date().toISOString(),
            };
            await window.reviewStorage.save(reviewData);
          }
        } else {
          // No hash change, just update files as before
          const existingFilePaths = new Set(reviewData.files.map((f) => f.path));
          const newFiles = files.filter((f) => !existingFilePaths.has(f.path));

          if (newFiles.length > 0 || !reviewData.lastCommitHash) {
            reviewData = {
              ...reviewData,
              files:
                newFiles.length > 0
                  ? [...reviewData.files, ...newFiles.map((f) => ({ path: f.path, viewed: false }))]
                  : reviewData.files,
              lastCommitHash: headCommit,
              updatedAt: new Date().toISOString(),
            };
            await window.reviewStorage.save(reviewData);
          }
        }
      }

      // Create the current review session
      const currentReview: ReviewSession = {
        baseBranch: 'HEAD',
        compareBranch: 'Working Tree',
        files,
        viewMode: 'unified',
      };

      set({
        currentReview,
        reviewData,
        isLoading: false,
        error: null,
        selectedFile: files[0]?.path || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open working tree review';
      set({ error: message, isLoading: false });
    }
  },

  closeReview: () => {
    set({
      currentReview: null,
      reviewData: null,
      projectPath: null,
      selectedFile: null,
      commentingOnLine: null,
      error: null,
      expandedRanges: new Map(),
    });
  },

  setViewMode: (mode) => {
    const { currentReview } = get();
    if (currentReview) {
      set({ currentReview: { ...currentReview, viewMode: mode } });
    }
  },

  setSelectedFile: (filePath) => {
    set({ selectedFile: filePath, commentingOnLine: null });
  },

  startCommenting: (filePath, lineStart, lineEnd, side) => {
    set({ commentingOnLine: { filePath, lineStart, lineEnd, side } });
  },

  cancelCommenting: () => {
    set({ commentingOnLine: null });
  },

  addComment: async (filePath, lineStart, lineEnd, side, category, content) => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const newComment: ReviewComment = {
      id: generateId(),
      reviewId: reviewData.id,
      filePath,
      lineStart,
      lineEnd,
      side,
      category,
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedReview: ReviewData = {
      ...reviewData,
      comments: [...reviewData.comments, newComment],
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview, commentingOnLine: null });
  },

  deleteComment: async (commentId) => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const updatedReview: ReviewData = {
      ...reviewData,
      comments: reviewData.comments.filter((c) => c.id !== commentId),
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview });
  },

  updateComment: async (commentId, content) => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const updatedReview: ReviewData = {
      ...reviewData,
      comments: reviewData.comments.map((c) => (c.id === commentId ? { ...c, content } : c)),
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview });
  },

  markFileViewed: async (filePath) => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const existingFile = reviewData.files.find((f) => f.path === filePath);
    let updatedFiles: ReviewFileState[];

    if (existingFile) {
      updatedFiles = reviewData.files.map((f) =>
        f.path === filePath ? { ...f, viewed: true, viewedAt: new Date().toISOString() } : f
      );
    } else {
      updatedFiles = [
        ...reviewData.files,
        { path: filePath, viewed: true, viewedAt: new Date().toISOString() },
      ];
    }

    const updatedReview: ReviewData = {
      ...reviewData,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview });
  },

  markFileUnviewed: async (filePath) => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const updatedFiles = reviewData.files.map((f) =>
      f.path === filePath ? { ...f, viewed: false, viewedAt: undefined } : f
    );

    const updatedReview: ReviewData = {
      ...reviewData,
      files: updatedFiles,
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview });
  },

  exportToJson: () => {
    const { reviewData, currentReview, projectPath } = get();
    if (!reviewData || !currentReview || !projectPath) return null;

    // Group comments by file
    const fileMap = new Map<string, ReviewComment[]>();
    for (const comment of reviewData.comments) {
      const existing = fileMap.get(comment.filePath) || [];
      fileMap.set(comment.filePath, [...existing, comment]);
    }

    const exportData: ReviewExport = {
      project: projectPath,
      baseBranch: currentReview.baseBranch,
      compareBranch: currentReview.compareBranch,
      exportedAt: new Date().toISOString(),
      files: Array.from(fileMap.entries()).map(([path, comments]) => ({
        path,
        comments: comments.map((c) => ({
          lines: c.lineStart === c.lineEnd ? `${c.lineStart}` : `${c.lineStart}-${c.lineEnd}`,
          category: c.category,
          comment: c.content,
        })),
      })),
    };

    return exportData;
  },

  getPromptText: () => {
    const exportData = get().exportToJson();
    if (!exportData) return '';

    let prompt = `Please fix the following code review comments in my codebase:\n\n`;

    for (const file of exportData.files) {
      prompt += `## ${file.path}\n\n`;
      for (const comment of file.comments) {
        prompt += `- **Line ${comment.lines}** [${comment.category.toUpperCase()}]: ${comment.comment}\n`;
      }
      prompt += '\n';
    }

    prompt += `\nPlease address each comment by modifying the appropriate files.`;
    return prompt;
  },

  getFileComments: (filePath) => {
    const { reviewData } = get();
    if (!reviewData) return [];
    return reviewData.comments.filter((c) => c.filePath === filePath);
  },

  getLineComments: (filePath, lineStart, lineEnd) => {
    const { reviewData } = get();
    if (!reviewData) return [];
    return reviewData.comments.filter(
      (c) => c.filePath === filePath && c.lineStart === lineStart && c.lineEnd === lineEnd
    );
  },

  isFileViewed: (filePath) => {
    const { reviewData } = get();
    if (!reviewData) return false;
    const file = reviewData.files.find((f) => f.path === filePath);
    return file?.viewed || false;
  },

  clearAllComments: async () => {
    const { reviewData, projectPath } = get();
    if (!reviewData || !projectPath) return;

    const updatedReview: ReviewData = {
      ...reviewData,
      comments: [],
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    set({ reviewData: updatedReview });
  },

  getCommentCount: () => {
    const { reviewData } = get();
    if (!reviewData) return 0;
    return reviewData.comments.length;
  },

  getFormattedCommentsMarkdown: () => {
    const { reviewData } = get();
    if (!reviewData || reviewData.comments.length === 0) return '';

    // Group comments by file
    const fileMap = new Map<string, ReviewComment[]>();
    for (const comment of reviewData.comments) {
      const existing = fileMap.get(comment.filePath) || [];
      fileMap.set(comment.filePath, [...existing, comment]);
    }

    let markdown = '';
    for (const [filePath, comments] of fileMap) {
      markdown += `## ${filePath}\n\n`;
      for (const comment of comments) {
        const lineText =
          comment.lineStart === comment.lineEnd
            ? `Line ${comment.lineStart}`
            : `Lines ${comment.lineStart}-${comment.lineEnd}`;
        markdown += `- [${comment.category}] ${lineText}: ${comment.content}\n`;
      }
      markdown += '\n';
    }

    return markdown.trim();
  },

  getCommentsForExport: () => {
    const { reviewData } = get();
    if (!reviewData) return [];

    return reviewData.comments.map((c) => ({
      file: c.filePath,
      lineStart: c.lineStart,
      lineEnd: c.lineEnd,
      type: c.category,
      comment: c.content,
    }));
  },

  addExpandedRange: (filePath, range) => {
    const { expandedRanges } = get();
    const existingRanges = expandedRanges.get(filePath) || [];
    const newMap = new Map(expandedRanges);
    newMap.set(filePath, [...existingRanges, range]);
    set({ expandedRanges: newMap });
  },

  getExpandedRanges: (filePath) => {
    const { expandedRanges } = get();
    return expandedRanges.get(filePath) || [];
  },

  clearExpansions: (filePath) => {
    const { expandedRanges } = get();
    if (filePath) {
      // Clear expansions for a specific file
      const newMap = new Map(expandedRanges);
      newMap.delete(filePath);
      set({ expandedRanges: newMap });
    } else {
      // Clear all expansions
      set({ expandedRanges: new Map() });
    }
  },

  setReviewData: (reviewData) => {
    set({ reviewData });
  },
}));
