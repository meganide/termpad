import { useEffect, useRef, useCallback, useState, useMemo, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useReviewStore } from '@/stores/reviewStore';
import { useReviewLayoutStore } from '@/stores/reviewLayoutStore';
import { DiffReviewHeader } from './components/DiffReviewHeader';
import { FileList } from './components/FileList';
import { FileDiff } from './components/FileDiff';
import { useLineSelection } from './hooks/useLineSelection';
import { useResizeSelectionLock } from '../../hooks/useResizeSelectionLock';
import type { CommentCategory } from '../../../shared/reviewTypes';

interface DiffReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  toolbar?: ReactNode;
  treeCollapsed?: boolean;
}

// Stable empty set so unselected FileDiff rows keep identical prop identity
const EMPTY_LINE_SET = new Set<number>();

export function DiffReviewModal({
  isOpen,
  onClose,
  embedded = false,
  toolbar,
  treeCollapsed = false,
}: DiffReviewModalProps) {
  const treeWidth = useReviewLayoutStore((state) => state.treeWidth);
  const setTreeWidth = useReviewLayoutStore((state) => state.setTreeWidth);
  const reviewBodyRef = useRef<HTMLDivElement>(null);
  const resizingTree = useRef(false);
  const { start: lockResizeSelection, stop: unlockResizeSelection } = useResizeSelectionLock();
  const resizeTree = (width: number) => {
    const available = reviewBodyRef.current?.getBoundingClientRect().width ?? 640;
    setTreeWidth(Math.max(128, Math.min(width, 480, Math.max(128, available - 160))));
  };
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

  // Files start open; remember only explicit collapses within this comparison.
  // Hidden context lines are controlled separately by FileDiff's Expand All action.
  const reviewKey = currentReview
    ? `${projectPath}:${currentReview.baseBranch}:${currentReview.compareBranch}`
    : '';
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsedFiles(new Set());
  }, [reviewKey]);

  useEffect(() => {
    if (selectedFile)
      setCollapsedFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedFile);
        return next;
      });
  }, [selectedFile]);

  // Track if initial scroll has been done for this modal open
  const hasScrolledRef = useRef(false);
  const scrollTargetRef = useRef<string | null>(null);

  // Reset scroll tracking when modal closes
  useEffect(() => {
    if (embedded) return;
    if (!isOpen) {
      hasScrolledRef.current = false;
      scrollTargetRef.current = null;
    }
  }, [isOpen, embedded]);

  // Set scroll target when modal opens with a pre-selected file
  useEffect(() => {
    if (embedded) return;
    if (isOpen && selectedFile && !hasScrolledRef.current) {
      scrollTargetRef.current = selectedFile;
    }
  }, [isOpen, selectedFile, embedded]);

  // Scroll to target file when ref becomes available
  useEffect(() => {
    if (embedded || !isOpen || !scrollTargetRef.current || hasScrolledRef.current || isLoading) {
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
  }, [isOpen, isLoading, collapsedFiles, embedded]);

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

  useEffect(() => {
    if (!embedded || !selectedFile) return;
    const frame = requestAnimationFrame(() => scrollToFile(selectedFile));
    return () => cancelAnimationFrame(frame);
  }, [embedded, selectedFile, scrollToFile]);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (isFileViewed(filePath)) void markFileUnviewed(filePath);
      setSelectedFile(filePath);
      requestAnimationFrame(() => scrollToFile(filePath));
    },
    [setSelectedFile, scrollToFile, isFileViewed, markFileUnviewed]
  );

  const handleToggleExpand = useCallback((filePath: string) => {
    setCollapsedFiles((prev) => {
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
        setCollapsedFiles((prev) => {
          const next = new Set(prev);
          next.delete(filePath);
          return next;
        });
      } else {
        await markFileViewed(filePath);
        // Collapse the file when marking as viewed
        setCollapsedFiles((prev) => {
          const next = new Set(prev);
          next.add(filePath);
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

  const content = (
    <TooltipProvider>
      {/* Header */}
      {toolbar ?? (
        <DiffReviewHeader
          baseBranch={currentReview.baseBranch}
          compareBranch={currentReview.compareBranch}
          viewMode={currentReview.viewMode}
          onViewModeChange={setViewMode}
          onClose={embedded ? undefined : handleClose}
        />
      )}

      {/* Main content */}
      <div ref={reviewBodyRef} className="flex flex-1 min-h-0 overflow-hidden pointer-events-auto">
        <aside
          aria-label="Review file tree"
          className={
            embedded
              ? '@container/review-tree shrink-0 min-h-0 overflow-hidden bg-sidebar/50'
              : 'w-80 2xl:w-96 3xl:w-[420px] shrink-0 min-h-0 border-r border-border overflow-hidden bg-sidebar/50'
          }
          style={{
            display: treeCollapsed ? 'none' : undefined,
            width: embedded ? treeWidth : undefined,
            maxWidth: embedded ? 'calc(100% - 160px)' : undefined,
          }}
          data-testid="file-list-sidebar"
        >
          <FileList
            files={currentReview.files}
            selectedFile={selectedFile}
            isFileViewed={isFileViewed}
            onFileSelect={handleFileSelect}
            onToggleViewed={handleMarkViewed}
          />
        </aside>
        {embedded && !treeCollapsed && (
          <div
            role="separator"
            aria-label="Resize file tree"
            aria-orientation="vertical"
            aria-valuenow={treeWidth}
            aria-valuemin={128}
            aria-valuemax={480}
            tabIndex={0}
            title="Drag to resize file tree, or use the arrow keys"
            className="w-1 shrink-0 cursor-col-resize touch-none bg-border hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none"
            onPointerDown={(event) => {
              event.preventDefault();
              lockResizeSelection();
              resizingTree.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (resizingTree.current && reviewBodyRef.current)
                resizeTree(event.clientX - reviewBodyRef.current.getBoundingClientRect().left);
            }}
            onPointerUp={(event) => {
              resizingTree.current = false;
              unlockResizeSelection();
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              resizingTree.current = false;
              unlockResizeSelection();
            }}
            onLostPointerCapture={() => {
              resizingTree.current = false;
              unlockResizeSelection();
            }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              resizeTree(
                event.key === 'Home'
                  ? 128
                  : event.key === 'End'
                    ? 480
                    : treeWidth + (event.key === 'ArrowRight' ? 16 : -16)
              );
            }}
          />
        )}
        {/* Main content - Diff view */}
        <div
          className="flex-1 min-h-0 overflow-auto p-3 bg-background/30"
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
            <div className="flex items-center justify-center h-full" data-testid="all-viewed-state">
              <div className="text-center">
                <div className="text-muted-foreground text-lg mb-2">
                  {currentReview.files.length
                    ? 'All files reviewed'
                    : 'No changes against this base'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentReview.files.length
                    ? 'Select a file to review it again'
                    : 'Choose another base branch to see more changes.'}
                </div>
              </div>
            </div>
          ) : (
            unviewedFiles.map((file) => (
              <div
                key={file.path}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_600px]"
              >
                <FileDiff
                  ref={(el) => {
                    if (el) {
                      fileRefs.current.set(file.path, el);
                    } else {
                      fileRefs.current.delete(file.path);
                    }
                  }}
                  file={file}
                  viewMode={currentReview.viewMode}
                  isExpanded={!collapsedFiles.has(file.path)}
                  isViewed={isFileViewed(file.path)}
                  selectedLines={selectedFile === file.path ? selectedLines : EMPTY_LINE_SET}
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
              </div>
            ))
          )}
        </div>
      </div>
    </TooltipProvider>
  );

  if (embedded)
    return (
      <div className="flex h-full min-h-0 flex-col" data-testid="diff-review-panel">
        {content}
      </div>
    );

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent
        className="!fixed !inset-0 !translate-x-0 !translate-y-0 !top-10 !left-0 w-screen !h-[calc(100vh-2.5rem)] !max-w-none !max-h-none p-0 gap-0 rounded-none border-0 flex flex-col pointer-events-auto"
        data-testid="diff-review-modal"
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        <AlertDialogTitle className="sr-only">Review changes</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">
          Review file changes and add comments.
        </AlertDialogDescription>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}
