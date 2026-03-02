import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
import { TitleBar } from './components/TitleBar';
import { DiffReviewHeader } from './features/review/components/DiffReviewHeader';
import { FileList } from './features/review/components/FileList';
import { FileDiff } from './features/review/components/FileDiff';
import { useLineSelection } from './features/review/hooks/useLineSelection';
import { useWorkingTreeDiff, type LazyDiffFile } from './hooks/useWorkingTreeDiff';
import { useReviewStore } from './stores/reviewStore';
import { ReviewOnboarding } from './features/review/components/ReviewOnboarding';
import type {
  ReviewSession,
  ReviewData,
  DiffViewMode,
  CommentCategory,
  ReviewComment,
  DiffFile,
} from '../shared/reviewTypes';

export function DiffWindowApp() {
  // State
  const [currentReview, setCurrentReview] = useState<ReviewSession | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  // Sync reviewData to the store so ReviewToolbar can access it
  const setStoreReviewData = useReviewStore((s) => s.setReviewData);
  useEffect(() => {
    setStoreReviewData(reviewData);
  }, [reviewData, setStoreReviewData]);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentingOnLine, setCommentingOnLine] = useState<{
    filePath: string;
    lineStart: number;
    lineEnd: number;
    side: 'old' | 'new';
  } | null>(null);

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Determine if this is a working tree review (needs polling for updates)
  const isWorkingTreeReview = currentReview?.compareBranch === 'Working Tree';

  // Poll for working tree changes when viewing working tree diff
  const { files: polledFiles, loadFileHunks } = useWorkingTreeDiff({
    repoPath: isWorkingTreeReview ? projectPath : null,
    enabled: isWorkingTreeReview && !!projectPath,
    pollIntervalMs: 5000,
  });

  // Update review files when working tree changes
  useEffect(() => {
    if (isWorkingTreeReview && polledFiles.length > 0 && currentReview) {
      // Only update if files actually changed
      const currentPaths = currentReview.files
        .map((f) => f.path)
        .sort()
        .join(',');
      const newPaths = polledFiles
        .map((f) => f.path)
        .sort()
        .join(',');
      const hasStructuralChange = currentPaths !== newPaths;

      // Also check if any file content changed (stats, hunks loaded state)
      const hasContentChange =
        !hasStructuralChange &&
        currentReview.files.some((currentFile) => {
          const newFile = polledFiles.find((f) => f.path === currentFile.path);
          if (!newFile) return true;
          const currentLazy = currentFile as LazyDiffFile;
          return (
            currentFile.additions !== newFile.additions ||
            currentFile.deletions !== newFile.deletions ||
            currentFile.status !== newFile.status ||
            // Check if hunks were loaded (lazy loading state change)
            (!currentLazy.hunksLoaded && newFile.hunksLoaded) ||
            (currentLazy.hunksLoaded &&
              newFile.hunksLoaded &&
              currentFile.hunks.length !== newFile.hunks.length)
          );
        });

      if (hasStructuralChange || hasContentChange) {
        setCurrentReview((prev) =>
          prev ? { ...prev, files: polledFiles as unknown as DiffFile[] } : null
        );
      }
    }
  }, [isWorkingTreeReview, polledFiles, currentReview]);

  // Compute initial expanded files
  const reviewKey = currentReview
    ? `${currentReview.baseBranch}:${currentReview.compareBranch}`
    : '';
  const initialExpanded = useMemo(() => {
    if (!currentReview?.files) return new Set<string>();
    return new Set<string>(currentReview.files.slice(0, 3).map((f: DiffFile) => f.path));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewKey]);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Theme handling - always apply dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Load initial data from main process
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await window.diffWindow.getInitialData();
        if (data) {
          setCurrentReview(data.currentReview);
          setReviewData(data.reviewData);
          setProjectPath(data.projectPath);
          setSelectedFile(data.selectedFile);
          setIsLoading(false);

          // Set initial expanded files
          const expanded = new Set<string>(
            data.currentReview.files.slice(0, 3).map((f: DiffFile) => f.path)
          );
          if (data.selectedFile) {
            expanded.add(data.selectedFile);
          }
          setExpandedFiles(expanded);
        } else {
          setError('No review data received');
          setIsLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load review data');
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Listen for review data updates from main window
    const cleanup = window.diffWindow.onReviewDataUpdate((updatedData: ReviewData) => {
      setReviewData(updatedData);
    });

    return cleanup;
  }, []);

  // Sync expanded files when initial state changes
  useEffect(() => {
    const expanded = new Set<string>(initialExpanded);
    if (selectedFile) {
      expanded.add(selectedFile);
    }
    setExpandedFiles(expanded);
  }, [initialExpanded, selectedFile]);

  // Helper functions
  const isFileViewed = useCallback(
    (filePath: string): boolean => {
      if (!reviewData) return false;
      const file = reviewData.files.find((f) => f.path === filePath);
      return file?.viewed || false;
    },
    [reviewData]
  );

  const getFileComments = useCallback(
    (filePath: string): ReviewComment[] => {
      if (!reviewData) return [];
      return reviewData.comments.filter((c) => c.filePath === filePath);
    },
    [reviewData]
  );

  // Compute unviewed files
  const unviewedFiles = useMemo(() => {
    if (!currentReview?.files) return [];
    return currentReview.files.filter((file: DiffFile) => !isFileViewed(file.path));
  }, [currentReview?.files, reviewData?.files, isFileViewed]);

  // Line selection hook
  const { selectedLines, clearSelection, handleLineMouseDown, handleLineMouseEnter } =
    useLineSelection({
      onSelectionComplete: (sel) => {
        if (selectedFile) {
          setCommentingOnLine({
            filePath: selectedFile,
            lineStart: sel.startLine,
            lineEnd: sel.endLine,
            side: sel.side,
          });
        }
      },
    });

  // Handlers
  const scrollToFile = useCallback((filePath: string) => {
    const ref = fileRefs.current.get(filePath);
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath);
      scrollToFile(filePath);
    },
    [scrollToFile]
  );

  const handleToggleExpand = useCallback((filePath: string) => {
    setExpandedFiles((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleViewModeChange = useCallback((mode: DiffViewMode) => {
    setCurrentReview((prev: ReviewSession | null) => (prev ? { ...prev, viewMode: mode } : null));
  }, []);

  const handleMarkViewed = useCallback(
    async (filePath: string) => {
      if (!reviewData || !projectPath) return;

      const isViewed = isFileViewed(filePath);
      const existingFile = reviewData.files.find((f) => f.path === filePath);

      let updatedFiles;
      if (isViewed) {
        // Unmark as viewed
        updatedFiles = reviewData.files.map((f) =>
          f.path === filePath ? { ...f, viewed: false, viewedAt: undefined } : f
        );
        // Expand the file when unmarking
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          next.add(filePath);
          return next;
        });
      } else {
        // Mark as viewed
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
        // Collapse the file when marking as viewed
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          next.delete(filePath);
          return next;
        });
      }

      const updatedReview: ReviewData = {
        ...reviewData,
        files: updatedFiles,
        updatedAt: new Date().toISOString(),
      };

      await window.reviewStorage.save(updatedReview);
      setReviewData(updatedReview);

      // Notify main window
      window.diffWindow.notifyReviewDataChanged(updatedReview);
    },
    [reviewData, projectPath, isFileViewed]
  );

  const handleCommentClick = useCallback(
    (filePath: string, lineNumber: number, side: 'old' | 'new') => {
      setSelectedFile(filePath);
      setCommentingOnLine({ filePath, lineStart: lineNumber, lineEnd: lineNumber, side });
    },
    []
  );

  const handleCommentSubmit = useCallback(
    async (category: CommentCategory, content: string) => {
      if (!commentingOnLine || !reviewData || !projectPath) return;

      const newComment: ReviewComment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reviewId: reviewData.id,
        filePath: commentingOnLine.filePath,
        lineStart: commentingOnLine.lineStart,
        lineEnd: commentingOnLine.lineEnd,
        side: commentingOnLine.side,
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
      setReviewData(updatedReview);
      setCommentingOnLine(null);
      clearSelection();

      // Notify main window
      window.diffWindow.notifyReviewDataChanged(updatedReview);
    },
    [commentingOnLine, reviewData, projectPath, clearSelection]
  );

  const handleCommentCancel = useCallback(() => {
    setCommentingOnLine(null);
    clearSelection();
  }, [clearSelection]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!reviewData || !projectPath) return;

      const updatedReview: ReviewData = {
        ...reviewData,
        comments: reviewData.comments.filter((c) => c.id !== commentId),
        updatedAt: new Date().toISOString(),
      };

      await window.reviewStorage.save(updatedReview);
      setReviewData(updatedReview);

      // Notify main window
      window.diffWindow.notifyReviewDataChanged(updatedReview);
    },
    [reviewData, projectPath]
  );

  const handleUpdateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!reviewData || !projectPath) return;

      const updatedReview: ReviewData = {
        ...reviewData,
        comments: reviewData.comments.map((c) => (c.id === commentId ? { ...c, content } : c)),
        updatedAt: new Date().toISOString(),
      };

      await window.reviewStorage.save(updatedReview);
      setReviewData(updatedReview);

      // Notify main window
      window.diffWindow.notifyReviewDataChanged(updatedReview);
    },
    [reviewData, projectPath]
  );

  const handleClearAllComments = useCallback(async () => {
    if (!reviewData || !projectPath) return;

    const updatedReview: ReviewData = {
      ...reviewData,
      comments: [],
      updatedAt: new Date().toISOString(),
    };

    await window.reviewStorage.save(updatedReview);
    setReviewData(updatedReview);

    // Notify main window
    window.diffWindow.notifyReviewDataChanged(updatedReview);
  }, [reviewData, projectPath]);

  const handleClose = useCallback(() => {
    window.diffWindow.close();
  }, []);

  // Get lines with comments for a file
  const getLinesWithComments = useCallback(
    (filePath: string): Set<number> => {
      const comments = getFileComments(filePath);
      const lines = new Set<number>();
      for (const comment of comments) {
        for (let i = comment.lineStart; i <= comment.lineEnd; i++) {
          lines.add(i);
        }
      }
      return lines;
    },
    [getFileComments]
  );

  // Handle keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if in comment input
        const target = e.target as HTMLElement;
        const isInCommentInput = target.closest('[data-testid="comment-input"]') !== null;

        if (isInCommentInput) {
          return; // Let CommentInput handle it
        }

        if (commentingOnLine) {
          setCommentingOnLine(null);
          clearSelection();
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commentingOnLine, clearSelection, handleClose]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-muted-foreground">Loading diff...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!currentReview) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-muted-foreground">No review data</div>
      </div>
    );
  }

  // Only render custom title bar on Windows (macOS and Linux use native title bars)
  const shouldRenderTitleBar = window.electronAPI?.platform === 'win32';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {shouldRenderTitleBar && <TitleBar title="Diff Viewer" />}

      <Toaster position="bottom-right" theme="dark" />

      {/* Header */}
      <DiffReviewHeader
        baseBranch={currentReview.baseBranch}
        compareBranch={currentReview.compareBranch}
        viewMode={currentReview.viewMode}
        onViewModeChange={handleViewModeChange}
        onClearAllComments={handleClearAllComments}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File list */}
        <div
          className="w-80 2xl:w-96 3xl:w-[420px] flex-shrink-0 border-r border-border overflow-y-auto bg-sidebar/50"
          data-testid="file-list-sidebar"
        >
          <FileList
            files={currentReview.files}
            selectedFile={selectedFile}
            isFileViewed={isFileViewed}
            onFileSelect={handleFileSelect}
            onToggleViewed={handleMarkViewed}
          />
        </div>

        {/* Main content - Diff view */}
        <div
          className="flex-1 overflow-y-auto p-4 bg-background/30"
          data-testid="diff-content-area"
        >
          <ReviewOnboarding hasComments={(reviewData?.comments.length ?? 0) > 0} />

          {unviewedFiles.length === 0 ? (
            <div className="flex items-center justify-center h-full" data-testid="all-viewed-state">
              <div className="text-center">
                <div className="text-muted-foreground text-lg mb-2">All files reviewed</div>
                <div className="text-sm text-muted-foreground">
                  Uncheck files in the sidebar to review them again
                </div>
              </div>
            </div>
          ) : (
            unviewedFiles.map((file: DiffFile) => {
              const lazyFile = file as LazyDiffFile;
              return (
                <FileDiff
                  key={file.path}
                  ref={(el) => {
                    if (el) {
                      fileRefs.current.set(file.path, el);
                    } else {
                      fileRefs.current.delete(file.path);
                    }
                  }}
                  file={file}
                  viewMode={currentReview.viewMode}
                  isExpanded={expandedFiles.has(file.path)}
                  isViewed={isFileViewed(file.path)}
                  selectedLines={selectedFile === file.path ? selectedLines : new Set()}
                  linesWithComments={getLinesWithComments(file.path)}
                  comments={getFileComments(file.path)}
                  commentingOnLine={
                    commentingOnLine && commentingOnLine.filePath === file.path
                      ? {
                          lineStart: commentingOnLine.lineStart,
                          lineEnd: commentingOnLine.lineEnd,
                          side: commentingOnLine.side,
                        }
                      : null
                  }
                  projectPath={projectPath ?? undefined}
                  hunksLoaded={lazyFile.hunksLoaded ?? true}
                  isLoadingHunks={lazyFile.isLoadingHunks ?? false}
                  onLoadHunks={() => loadFileHunks(file.path)}
                  onToggleExpand={() => handleToggleExpand(file.path)}
                  onMarkViewed={() => handleMarkViewed(file.path)}
                  onCommentClick={(lineNumber, side) =>
                    handleCommentClick(file.path, lineNumber, side)
                  }
                  onLineMouseDown={(lineNumber, side) => {
                    setSelectedFile(file.path);
                    handleLineMouseDown(lineNumber, side);
                  }}
                  onLineMouseEnter={handleLineMouseEnter}
                  onCommentSubmit={handleCommentSubmit}
                  onCommentCancel={handleCommentCancel}
                  onCommentDelete={handleDeleteComment}
                  onCommentUpdate={handleUpdateComment}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
