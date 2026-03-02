import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useReviewStore } from '@/stores/reviewStore';
import { DiffReviewHeader } from './components/DiffReviewHeader';
import { FileList } from './components/FileList';
import { FileDiff } from './components/FileDiff';
import { useLineSelection } from './hooks/useLineSelection';
import type { CommentCategory } from '../../../shared/reviewTypes';

interface DiffReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DiffReviewModal({ isOpen, onClose }: DiffReviewModalProps) {
  const {
    currentReview,
    reviewData,
    projectPath,
    isLoading,
    error,
    selectedFile,
    commentingOnLine,
    setViewMode,
    setSelectedFile,
    startCommenting,
    cancelCommenting,
    addComment,
    deleteComment,
    updateComment,
    markFileViewed,
    markFileUnviewed,
    closeReview,
    getFileComments,
    isFileViewed,
  } = useReviewStore();

  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Compute initial expanded files based on review branches
  const reviewKey = currentReview
    ? `${currentReview.baseBranch}:${currentReview.compareBranch}`
    : '';
  const initialExpanded = useMemo(() => {
    if (!currentReview?.files) return new Set<string>();
    return new Set(currentReview.files.slice(0, 3).map((f) => f.path));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewKey]);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Sync expanded files when initial state changes (new review opened)
  // Also ensure selected file is expanded if pre-selected
  useEffect(() => {
    const expanded = new Set(initialExpanded);
    if (selectedFile) {
      expanded.add(selectedFile);
    }
    setExpandedFiles(expanded);
  }, [initialExpanded, selectedFile]);

  // Track if initial scroll has been done for this modal open
  const hasScrolledRef = useRef(false);
  const scrollTargetRef = useRef<string | null>(null);

  // Reset scroll tracking when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasScrolledRef.current = false;
      scrollTargetRef.current = null;
    }
  }, [isOpen]);

  // Set scroll target when modal opens with a pre-selected file
  useEffect(() => {
    if (isOpen && selectedFile && !hasScrolledRef.current) {
      scrollTargetRef.current = selectedFile;
    }
  }, [isOpen, selectedFile]);

  // Scroll to target file when ref becomes available
  useEffect(() => {
    if (!isOpen || !scrollTargetRef.current || hasScrolledRef.current || isLoading) {
      return;
    }

    const targetFile = scrollTargetRef.current;
    let attempts = 0;
    const maxAttempts = 20; // ~300ms max wait
    let rafId: number;

    const tryScroll = () => {
      const ref = fileRefs.current.get(targetFile);

      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
        hasScrolledRef.current = true;
        scrollTargetRef.current = null;
      } else if (attempts < maxAttempts) {
        // Ref not ready yet, retry on next frame
        attempts++;
        rafId = requestAnimationFrame(tryScroll);
      }
    };

    // Start trying after a small delay for initial render
    const timer = setTimeout(tryScroll, 16);

    return () => {
      clearTimeout(timer);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen, isLoading, expandedFiles]);

  // Compute unviewed files for the diff viewer content area
  // Depends on reviewData?.files to recompute when viewed status changes
  const unviewedFiles = useMemo(() => {
    if (!currentReview?.files) return [];
    return currentReview.files.filter((file) => !isFileViewed(file.path));
  }, [currentReview?.files, reviewData?.files, isFileViewed]);

  // Line selection hook
  const { selectedLines, clearSelection, handleLineMouseDown, handleLineMouseEnter } =
    useLineSelection({
      onSelectionComplete: (sel) => {
        if (selectedFile) {
          startCommenting(selectedFile, sel.startLine, sel.endLine, sel.side);
        }
      },
    });

  // Handle ESC key for the dialog - prevent closing when comment input is active
  const handleEscapeKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if the event originated from within a comment input area
      const target = e.target as HTMLElement;
      const isInCommentInput = target.closest('[data-testid="comment-input"]') !== null;

      if (isInCommentInput) {
        // Prevent the AlertDialog from closing, let CommentInput handle it
        e.preventDefault();
        return;
      }

      if (commentingOnLine) {
        // Cancel commenting instead of closing dialog
        e.preventDefault();
        cancelCommenting();
      }
      // Otherwise, let AlertDialog close normally
    },
    [commentingOnLine, cancelCommenting]
  );

  // Scroll to file when selected
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
    [setSelectedFile, scrollToFile]
  );

  const handleToggleExpand = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleMarkViewed = useCallback(
    async (filePath: string) => {
      if (isFileViewed(filePath)) {
        await markFileUnviewed(filePath);
        // Expand the file when unmarking as viewed
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          next.add(filePath);
          return next;
        });
      } else {
        await markFileViewed(filePath);
        // Collapse the file when marking as viewed
        setExpandedFiles((prev) => {
          const next = new Set(prev);
          next.delete(filePath);
          return next;
        });
      }
    },
    [isFileViewed, markFileViewed, markFileUnviewed]
  );

  const handleCommentClick = useCallback(
    (filePath: string, lineNumber: number, side: 'old' | 'new') => {
      setSelectedFile(filePath);
      startCommenting(filePath, lineNumber, lineNumber, side);
    },
    [setSelectedFile, startCommenting]
  );

  const handleCommentSubmit = useCallback(
    async (category: CommentCategory, content: string) => {
      if (commentingOnLine) {
        await addComment(
          commentingOnLine.filePath,
          commentingOnLine.lineStart,
          commentingOnLine.lineEnd,
          commentingOnLine.side,
          category,
          content
        );
        clearSelection();
      }
    },
    [commentingOnLine, addComment, clearSelection]
  );

  const handleCommentCancel = useCallback(() => {
    cancelCommenting();
    clearSelection();
  }, [cancelCommenting, clearSelection]);

  const handleClose = useCallback(() => {
    closeReview();
    onClose();
  }, [closeReview, onClose]);

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

  if (!currentReview) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent
        className="!fixed !inset-0 !translate-x-0 !translate-y-0 !top-10 !left-0 w-screen !h-[calc(100vh-2.5rem)] !max-w-none !max-h-none p-0 gap-0 rounded-none border-0 flex flex-col pointer-events-auto"
        data-testid="diff-review-modal"
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        <TooltipProvider>
          {/* Visually hidden title and description for accessibility */}
          <AlertDialogTitle className="sr-only">
            Review changes from {currentReview.baseBranch} to {currentReview.compareBranch}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Full screen diff viewer showing file changes. Use the sidebar to navigate between files.
          </AlertDialogDescription>

          {/* Header */}
          <DiffReviewHeader
            baseBranch={currentReview.baseBranch}
            compareBranch={currentReview.compareBranch}
            viewMode={currentReview.viewMode}
            onViewModeChange={setViewMode}
            onClose={handleClose}
          />

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden pointer-events-auto">
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
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">Loading diff...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-500">{error}</div>
                </div>
              ) : unviewedFiles.length === 0 ? (
                <div
                  className="flex items-center justify-center h-full"
                  data-testid="all-viewed-state"
                >
                  <div className="text-center">
                    <div className="text-muted-foreground text-lg mb-2">All files reviewed</div>
                    <div className="text-sm text-muted-foreground">
                      Uncheck files in the sidebar to review them again
                    </div>
                  </div>
                </div>
              ) : (
                unviewedFiles.map((file) => (
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
                    onCommentDelete={deleteComment}
                    onCommentUpdate={updateComment}
                  />
                ))
              )}
            </div>
          </div>
        </TooltipProvider>
      </AlertDialogContent>
    </AlertDialog>
  );
}
