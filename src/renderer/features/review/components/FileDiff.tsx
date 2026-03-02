import { useRef, forwardRef, useMemo, useCallback, Fragment, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileDiffHeader } from './FileDiffHeader';
import { DiffHunk } from './DiffHunk';
import { DiffLine } from './DiffLine';
import { HunkSeparator } from './HunkSeparator';
import { CommentInput } from './CommentInput';
import { CommentThread } from './CommentThread';
import { useReviewStore } from '@/stores/reviewStore';
import type {
  DiffFile,
  DiffViewMode,
  DiffLine as DiffLineType,
  DiffHunk as DiffHunkType,
  ReviewComment,
  CommentCategory,
  ExpandedRange,
} from '../../../../shared/reviewTypes';

/** Number of lines to expand at a time for progressive expansion */
const EXPAND_INCREMENT = 20;

/** Threshold for considering a diff "large" - diffs with more lines will be collapsed by default */
const LARGE_DIFF_THRESHOLD = 500;

/**
 * Get the last line number of a hunk (from the new file perspective for consistency)
 */
function getHunkEndLine(hunk: DiffHunkType): number {
  return hunk.newStart + hunk.newLines - 1;
}

/**
 * Get the first line number of a hunk (from the new file perspective for consistency)
 */
function getHunkStartLine(hunk: DiffHunkType): number {
  return hunk.newStart;
}

/**
 * Extract function/class context from hunk header.
 * Git diff headers often look like: @@ -10,5 +10,7 @@ function handleClick()
 */
function extractContextHeader(header: string): string | undefined {
  // Match everything after the @@ ... @@ part
  const match = header.match(/@@[^@]+@@\s*(.+)$/);
  return match?.[1]?.trim() || undefined;
}

interface FileDiffProps {
  file: DiffFile;
  viewMode: DiffViewMode;
  isExpanded: boolean;
  isViewed: boolean;
  selectedLines: Set<number>;
  linesWithComments: Set<number>;
  comments?: ReviewComment[];
  commentingOnLine?: {
    lineStart: number;
    lineEnd: number;
    side: 'old' | 'new';
  } | null;
  /** Project path for file loading via IPC */
  projectPath?: string;
  /** Whether hunks have been loaded (for lazy loading large files) */
  hunksLoaded?: boolean;
  /** Whether hunks are currently being loaded */
  isLoadingHunks?: boolean;
  /** Callback to load hunks on demand (for lazy loading) */
  onLoadHunks?: () => void;
  onToggleExpand: () => void;
  onMarkViewed: () => void;
  onCommentClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineClick?: (lineNumber: number) => void;
  onLineMouseDown?: (lineNumber: number, side: 'old' | 'new') => void;
  onLineMouseEnter?: (lineNumber: number) => void;
  onCommentSubmit?: (category: CommentCategory, content: string) => void;
  onCommentCancel?: () => void;
  onCommentDelete?: (commentId: string) => void;
  onCommentUpdate?: (commentId: string, content: string) => void;
}

interface SplitLine {
  oldLine: DiffLineType | null;
  newLine: DiffLineType | null;
  /** Content of the paired new line (for word diff on old/deletion side) */
  pairedNewContent?: string;
  /** Content of the paired old line (for word diff on new/addition side) */
  pairedOldContent?: string;
}

function buildSplitLines(lines: DiffLineType[]): SplitLine[] {
  const result: SplitLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'context') {
      result.push({ oldLine: line, newLine: line });
      i++;
    } else if (line.type === 'delete') {
      // Look ahead for paired additions
      const deletions: DiffLineType[] = [];
      while (i < lines.length && lines[i].type === 'delete') {
        deletions.push(lines[i]);
        i++;
      }

      const additions: DiffLineType[] = [];
      while (i < lines.length && lines[i].type === 'add') {
        additions.push(lines[i]);
        i++;
      }

      // Pair deletions with additions
      const maxLen = Math.max(deletions.length, additions.length);
      for (let j = 0; j < maxLen; j++) {
        const deletion = deletions[j] || null;
        const addition = additions[j] || null;
        result.push({
          oldLine: deletion,
          newLine: addition,
          // Store paired content for word-level diffing
          pairedNewContent: addition?.content,
          pairedOldContent: deletion?.content,
        });
      }
    } else if (line.type === 'add') {
      // Standalone addition
      result.push({ oldLine: null, newLine: line });
      i++;
    }
  }

  return result;
}

export const FileDiff = forwardRef<HTMLDivElement, FileDiffProps>(
  (
    {
      file,
      viewMode,
      isExpanded,
      isViewed,
      selectedLines,
      linesWithComments,
      comments = [],
      commentingOnLine,
      projectPath,
      hunksLoaded = true,
      isLoadingHunks = false,
      onLoadHunks,
      onToggleExpand,
      onMarkViewed,
      onCommentClick,
      onLineClick,
      onLineMouseDown,
      onLineMouseEnter,
      onCommentSubmit,
      onCommentCancel,
      onCommentDelete,
      onCommentUpdate,
    },
    ref
  ) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isExpandingAll, setIsExpandingAll] = useState(false);
    const [showLargeDiff, setShowLargeDiff] = useState(false);

    // Calculate total line count to determine if diff is "large"
    const totalLineCount = useMemo(() => {
      return file.hunks.reduce((total, hunk) => total + hunk.lines.length, 0);
    }, [file.hunks]);

    const isLargeDiff = totalLineCount > LARGE_DIFF_THRESHOLD;

    // Get expansion state and actions from store
    const { addExpandedRange, getExpandedRanges } = useReviewStore();
    const expandedRanges = getExpandedRanges(file.path);

    /**
     * Load lines from file via IPC and store in expansion state.
     * Uses 1-based line numbers.
     */
    const loadLines = useCallback(
      async (startLine: number, endLine: number): Promise<void> => {
        if (!projectPath) return;

        // Construct full path - use forward slash as git paths are normalized
        const fullPath =
          projectPath.endsWith('/') || projectPath.endsWith('\\')
            ? projectPath + file.path
            : projectPath + '/' + file.path;
        const result = await window.terminal.getFileLines(fullPath, startLine, endLine);

        if (result.error) {
          console.error(`Failed to load lines ${startLine}-${endLine}:`, result.error);
          return;
        }

        const range: ExpandedRange = {
          startLine,
          endLine,
          content: result.lines,
        };

        addExpandedRange(file.path, range);
      },
      [projectPath, file.path, addExpandedRange]
    );

    /**
     * Handle Expand Up button click.
     * Loads up to EXPAND_INCREMENT lines above the next hunk.
     */
    const handleExpandUp = useCallback(
      (prevHunkEndLine: number, nextHunkStartLine: number) => {
        // Lines to expand: from just after prevHunk to just before nextHunk
        const gapStart = prevHunkEndLine + 1;
        const gapEnd = nextHunkStartLine - 1;

        if (gapStart > gapEnd) return;

        // Expand up: load lines from end of gap, going up
        const linesToLoad = Math.min(EXPAND_INCREMENT, gapEnd - gapStart + 1);
        const loadStart = gapEnd - linesToLoad + 1;

        loadLines(loadStart, gapEnd);
      },
      [loadLines]
    );

    /**
     * Handle Expand Down button click.
     * Loads up to EXPAND_INCREMENT lines below the previous hunk.
     */
    const handleExpandDown = useCallback(
      (prevHunkEndLine: number, nextHunkStartLine: number) => {
        // Lines to expand: from just after prevHunk to just before nextHunk
        const gapStart = prevHunkEndLine + 1;
        const gapEnd = nextHunkStartLine - 1;

        if (gapStart > gapEnd) return;

        // Expand down: load lines from start of gap, going down
        const linesToLoad = Math.min(EXPAND_INCREMENT, gapEnd - gapStart + 1);
        const loadEnd = gapStart + linesToLoad - 1;

        loadLines(gapStart, loadEnd);
      },
      [loadLines]
    );

    /**
     * Handle Bridge/Show All button click.
     * Loads all remaining lines in the gap.
     */
    const handleBridge = useCallback(
      (prevHunkEndLine: number, nextHunkStartLine: number) => {
        const gapStart = prevHunkEndLine + 1;
        const gapEnd = nextHunkStartLine - 1;

        if (gapStart > gapEnd) return;

        loadLines(gapStart, gapEnd);
      },
      [loadLines]
    );

    /**
     * Handle Expand All button click.
     * Loads all hidden context lines: before first hunk, between hunks, and after last hunk.
     */
    const handleExpandAll = useCallback(async () => {
      if (!projectPath || isExpandingAll) return;

      setIsExpandingAll(true);
      try {
        // Collect all gaps to load
        const gaps: Array<{ start: number; end: number }> = [];

        // Helper to find unexpanded ranges within a gap
        const findUnexpandedRanges = (gapStart: number, gapEnd: number) => {
          if (gapStart > gapEnd) return;

          const expandedInGap = expandedRanges.filter(
            (range) => range.startLine >= gapStart && range.endLine <= gapEnd
          );

          const expandedLineNumbers = new Set<number>();
          expandedInGap.forEach((range) => {
            for (let j = range.startLine; j <= range.endLine; j++) {
              expandedLineNumbers.add(j);
            }
          });

          let rangeStart: number | null = null;
          for (let line = gapStart; line <= gapEnd + 1; line++) {
            const isExpanded = expandedLineNumbers.has(line);
            const isPastEnd = line > gapEnd;

            if (!isExpanded && !isPastEnd && rangeStart === null) {
              rangeStart = line;
            } else if ((isExpanded || isPastEnd) && rangeStart !== null) {
              gaps.push({ start: rangeStart, end: line - 1 });
              rangeStart = null;
            }
          }
        };

        // 1. Lines before first hunk (line 1 to firstHunk.newStart - 1)
        if (file.hunks.length > 0) {
          const firstHunk = file.hunks[0];
          const firstHunkStart = getHunkStartLine(firstHunk);
          if (firstHunkStart > 1) {
            findUnexpandedRanges(1, firstHunkStart - 1);
          }
        }

        // 2. Gaps between hunks
        for (let i = 1; i < file.hunks.length; i++) {
          const prevHunk = file.hunks[i - 1];
          const currentHunk = file.hunks[i];
          const prevHunkEndLine = getHunkEndLine(prevHunk);
          const currentHunkStartLine = getHunkStartLine(currentHunk);

          const gapStart = prevHunkEndLine + 1;
          const gapEnd = currentHunkStartLine - 1;

          findUnexpandedRanges(gapStart, gapEnd);
        }

        // 3. Lines after last hunk (need file line count)
        if (file.hunks.length > 0) {
          const lastHunk = file.hunks[file.hunks.length - 1];
          const lastHunkEnd = getHunkEndLine(lastHunk);

          // Get file line count to know where file ends
          const fullPath =
            projectPath.endsWith('/') || projectPath.endsWith('\\')
              ? projectPath + file.path
              : projectPath + '/' + file.path;
          const lineCountResult = await window.terminal.getFileLineCount(fullPath);

          if (!lineCountResult.error && lineCountResult.lineCount > lastHunkEnd) {
            findUnexpandedRanges(lastHunkEnd + 1, lineCountResult.lineCount);
          }
        }

        // Load all gaps in parallel
        await Promise.all(gaps.map((gap) => loadLines(gap.start, gap.end)));
      } finally {
        setIsExpandingAll(false);
      }
    }, [file.hunks, file.path, expandedRanges, loadLines, projectPath, isExpandingAll]);

    // Pre-compute split lines for split view mode
    const splitHunks = useMemo(() => {
      if (viewMode !== 'split') return null;
      return file.hunks.map((hunk) => ({
        ...hunk,
        splitLines: buildSplitLines(hunk.lines),
      }));
    }, [file.hunks, viewMode]);

    // Compute expanded lines before first hunk
    const expandedLinesBeforeFirstHunk = useMemo(() => {
      if (file.hunks.length === 0) return [];
      const firstHunkStart = getHunkStartLine(file.hunks[0]);
      return expandedRanges.filter((range) => range.endLine < firstHunkStart);
    }, [file.hunks, expandedRanges]);

    // Compute expanded lines after last hunk
    const expandedLinesAfterLastHunk = useMemo(() => {
      if (file.hunks.length === 0) return [];
      const lastHunkEnd = getHunkEndLine(file.hunks[file.hunks.length - 1]);
      return expandedRanges.filter((range) => range.startLine > lastHunkEnd);
    }, [file.hunks, expandedRanges]);

    // Helper to render expanded context lines (unified view)
    const renderExpandedLinesUnified = useCallback(
      (ranges: ExpandedRange[], keyPrefix: string) => {
        return ranges.map((range, rangeIdx) => (
          <div
            key={`${keyPrefix}-${range.startLine}-${range.endLine}-${rangeIdx}`}
            className="border-b border-border"
            data-testid="expanded-lines"
          >
            {range.content.map((lineContent, lineIdx) => {
              const lineNum = range.startLine + lineIdx;

              const showCommentInput =
                commentingOnLine !== null &&
                commentingOnLine !== undefined &&
                commentingOnLine.lineEnd === lineNum;

              const lineComments = comments.filter((c) => c.lineEnd === lineNum);

              return (
                <Fragment key={`${keyPrefix}-line-${lineNum}`}>
                  <DiffLine
                    line={{
                      type: 'context',
                      oldLineNumber: lineNum,
                      newLineNumber: lineNum,
                      content: lineContent,
                    }}
                    filePath={file.path}
                    isSelected={selectedLines.has(lineNum)}
                    hasComments={linesWithComments.has(lineNum)}
                    showAddButtonInOldGutter={false}
                    showAddButtonInNewGutter={true}
                    onCommentClick={onCommentClick}
                    onLineClick={onLineClick}
                    onLineMouseDown={onLineMouseDown}
                    onLineMouseEnter={onLineMouseEnter}
                  />

                  {showCommentInput && onCommentSubmit && onCommentCancel && (
                    <div className="py-2 px-4 bg-muted/30" data-testid="comment-input-row">
                      <CommentInput
                        lineStart={commentingOnLine.lineStart}
                        lineEnd={commentingOnLine.lineEnd}
                        side={commentingOnLine.side}
                        onSubmit={onCommentSubmit}
                        onCancel={onCommentCancel}
                      />
                    </div>
                  )}

                  {lineComments.length > 0 && onCommentDelete && onCommentUpdate && (
                    <div className="py-2 px-4 bg-muted/30" data-testid="comment-thread-row">
                      <CommentThread
                        comments={lineComments}
                        onDelete={onCommentDelete}
                        onUpdate={onCommentUpdate}
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        ));
      },
      [
        file.path,
        selectedLines,
        linesWithComments,
        comments,
        commentingOnLine,
        onCommentClick,
        onLineClick,
        onLineMouseDown,
        onLineMouseEnter,
        onCommentSubmit,
        onCommentCancel,
        onCommentDelete,
        onCommentUpdate,
      ]
    );

    // Helper to render expanded context lines (split view)
    const renderExpandedLinesSplit = useCallback(
      (ranges: ExpandedRange[], keyPrefix: string) => {
        return ranges.map((range, rangeIdx) => (
          <div
            key={`${keyPrefix}-split-${range.startLine}-${range.endLine}-${rangeIdx}`}
            className="border-b border-border"
            data-testid="expanded-lines"
          >
            {range.content.map((lineContent, lineIdx) => {
              const lineNum = range.startLine + lineIdx;

              const showCommentInputOld =
                commentingOnLine !== null &&
                commentingOnLine !== undefined &&
                commentingOnLine.lineEnd === lineNum &&
                commentingOnLine.side === 'old';

              const showCommentInputNew =
                commentingOnLine !== null &&
                commentingOnLine !== undefined &&
                commentingOnLine.lineEnd === lineNum &&
                commentingOnLine.side === 'new';

              const oldSideComments = comments.filter(
                (c) => c.lineEnd === lineNum && c.side === 'old'
              );
              const newSideComments = comments.filter(
                (c) => c.lineEnd === lineNum && c.side === 'new'
              );

              return (
                <Fragment key={`${keyPrefix}-split-line-${lineNum}`}>
                  <div className="flex">
                    {/* Old side */}
                    <div className="flex-1 border-r border-border">
                      <SplitDiffLine
                        line={{
                          type: 'context',
                          oldLineNumber: lineNum,
                          newLineNumber: lineNum,
                          content: lineContent,
                        }}
                        side="old"
                        filePath={file.path}
                        isSelected={selectedLines.has(lineNum)}
                        hasComments={linesWithComments.has(lineNum)}
                        onCommentClick={onCommentClick}
                        onLineClick={onLineClick}
                        onLineMouseDown={onLineMouseDown}
                        onLineMouseEnter={onLineMouseEnter}
                      />
                    </div>
                    {/* New side */}
                    <div className="flex-1">
                      <SplitDiffLine
                        line={{
                          type: 'context',
                          oldLineNumber: lineNum,
                          newLineNumber: lineNum,
                          content: lineContent,
                        }}
                        side="new"
                        filePath={file.path}
                        isSelected={selectedLines.has(lineNum)}
                        hasComments={linesWithComments.has(lineNum)}
                        onCommentClick={onCommentClick}
                        onLineClick={onLineClick}
                        onLineMouseDown={onLineMouseDown}
                        onLineMouseEnter={onLineMouseEnter}
                      />
                    </div>
                  </div>

                  {/* Comment input row - split by side */}
                  {(showCommentInputOld || showCommentInputNew) &&
                    onCommentSubmit &&
                    onCommentCancel && (
                      <div className="flex" data-testid="comment-input-row">
                        {/* Old side (left pane) */}
                        <div className="flex-1 border-r border-border">
                          {showCommentInputOld && (
                            <div className="py-2 px-4 bg-muted/30">
                              <CommentInput
                                lineStart={commentingOnLine.lineStart}
                                lineEnd={commentingOnLine.lineEnd}
                                side={commentingOnLine.side}
                                onSubmit={onCommentSubmit}
                                onCancel={onCommentCancel}
                              />
                            </div>
                          )}
                        </div>
                        {/* New side (right pane) */}
                        <div className="flex-1">
                          {showCommentInputNew && (
                            <div className="py-2 px-4 bg-muted/30">
                              <CommentInput
                                lineStart={commentingOnLine.lineStart}
                                lineEnd={commentingOnLine.lineEnd}
                                side={commentingOnLine.side}
                                onSubmit={onCommentSubmit}
                                onCancel={onCommentCancel}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Comments row - split by side */}
                  {(oldSideComments.length > 0 || newSideComments.length > 0) &&
                    onCommentDelete &&
                    onCommentUpdate && (
                      <div className="flex" data-testid="comment-thread-row">
                        {/* Old side (left pane) */}
                        <div className="flex-1 border-r border-border">
                          {oldSideComments.length > 0 && (
                            <div className="py-2 px-4 bg-muted/30">
                              <CommentThread
                                comments={oldSideComments}
                                onDelete={onCommentDelete}
                                onUpdate={onCommentUpdate}
                              />
                            </div>
                          )}
                        </div>
                        {/* New side (right pane) */}
                        <div className="flex-1">
                          {newSideComments.length > 0 && (
                            <div className="py-2 px-4 bg-muted/30">
                              <CommentThread
                                comments={newSideComments}
                                onDelete={onCommentDelete}
                                onUpdate={onCommentUpdate}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </Fragment>
              );
            })}
          </div>
        ));
      },
      [
        file.path,
        selectedLines,
        linesWithComments,
        comments,
        commentingOnLine,
        onCommentClick,
        onLineClick,
        onLineMouseDown,
        onLineMouseEnter,
        onCommentSubmit,
        onCommentCancel,
        onCommentDelete,
        onCommentUpdate,
      ]
    );

    return (
      <div
        ref={ref}
        className={cn(
          'border border-border rounded-lg',
          'bg-background mb-4',
          'shadow-md shadow-black/20'
        )}
        data-testid="file-diff"
        data-file-path={file.path}
      >
        <FileDiffHeader
          file={file}
          isExpanded={isExpanded}
          isViewed={isViewed}
          isExpandingAll={isExpandingAll}
          onToggleExpand={onToggleExpand}
          onMarkViewed={onMarkViewed}
          onExpandAll={handleExpandAll}
        />

        {isExpanded && (
          <div ref={contentRef} className="overflow-x-auto" data-testid="file-diff-content">
            {!hunksLoaded ? (
              // Lazy loading: hunks not yet loaded
              <div className="px-4 py-8 text-center" data-testid="lazy-load-placeholder">
                <p className="text-muted-foreground mb-3">
                  Large diff not rendered by default ({file.additions + file.deletions} lines
                  changed)
                </p>
                <button
                  onClick={onLoadHunks}
                  disabled={isLoadingHunks}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                  data-testid="load-hunks-button"
                >
                  {isLoadingHunks ? 'Loading...' : 'Show diff'}
                </button>
              </div>
            ) : file.isBinary ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Binary file not shown
              </div>
            ) : file.hunks.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">No changes</div>
            ) : isLargeDiff && !showLargeDiff ? (
              <div className="px-4 py-8 text-center" data-testid="large-diff-placeholder">
                <p className="text-muted-foreground mb-3">
                  Large diff not rendered by default ({totalLineCount} lines)
                </p>
                <button
                  onClick={() => setShowLargeDiff(true)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
                  data-testid="show-large-diff-button"
                >
                  Show diff
                </button>
              </div>
            ) : viewMode === 'unified' ? (
              // Unified view with HunkSeparators between hunks
              <div data-testid="unified-view">
                {/* Render expanded lines before first hunk */}
                {expandedLinesBeforeFirstHunk.length > 0 &&
                  renderExpandedLinesUnified(expandedLinesBeforeFirstHunk, 'before-first')}

                {file.hunks.map((hunk, index) => {
                  const prevHunk = index > 0 ? file.hunks[index - 1] : null;
                  const prevHunkEndLine = prevHunk ? getHunkEndLine(prevHunk) : 0;
                  const currentHunkStartLine = getHunkStartLine(hunk);

                  // Check if there's a gap between this hunk and the previous one
                  const hasGap = prevHunk && currentHunkStartLine > prevHunkEndLine + 1;

                  // Get expanded lines for this gap if any
                  const gapExpandedLines = expandedRanges.filter(
                    (range) =>
                      range.startLine > prevHunkEndLine && range.endLine < currentHunkStartLine
                  );

                  return (
                    <Fragment key={`${hunk.oldStart}-${hunk.newStart}-${index}`}>
                      {/* Render HunkSeparator between hunks if there's a gap */}
                      {hasGap && prevHunk && (
                        <>
                          {/* Render any expanded lines for this gap */}
                          {gapExpandedLines.map((range, rangeIdx) => (
                            <div
                              key={`expanded-${range.startLine}-${range.endLine}-${rangeIdx}`}
                              className="border-b border-border"
                              data-testid="expanded-lines"
                            >
                              {range.content.map((lineContent, lineIdx) => {
                                const lineNum = range.startLine + lineIdx;

                                // Check if comment input should be shown after this line
                                const showCommentInput =
                                  commentingOnLine !== null &&
                                  commentingOnLine !== undefined &&
                                  commentingOnLine.lineEnd === lineNum;

                                // Get comments that end at this line
                                const lineComments = comments.filter((c) => c.lineEnd === lineNum);

                                return (
                                  <Fragment key={`expanded-line-${lineNum}`}>
                                    <DiffLine
                                      line={{
                                        type: 'context',
                                        oldLineNumber: lineNum,
                                        newLineNumber: lineNum,
                                        content: lineContent,
                                      }}
                                      filePath={file.path}
                                      isSelected={selectedLines.has(lineNum)}
                                      hasComments={linesWithComments.has(lineNum)}
                                      showAddButtonInOldGutter={false}
                                      showAddButtonInNewGutter={true}
                                      onCommentClick={onCommentClick}
                                      onLineClick={onLineClick}
                                      onLineMouseDown={onLineMouseDown}
                                      onLineMouseEnter={onLineMouseEnter}
                                    />

                                    {/* Comment input */}
                                    {showCommentInput && onCommentSubmit && onCommentCancel && (
                                      <div
                                        className="py-2 px-4 bg-muted/30"
                                        data-testid="comment-input-row"
                                      >
                                        <CommentInput
                                          lineStart={commentingOnLine.lineStart}
                                          lineEnd={commentingOnLine.lineEnd}
                                          side={commentingOnLine.side}
                                          onSubmit={onCommentSubmit}
                                          onCancel={onCommentCancel}
                                        />
                                      </div>
                                    )}

                                    {/* Comments */}
                                    {lineComments.length > 0 &&
                                      onCommentDelete &&
                                      onCommentUpdate && (
                                        <div
                                          className="py-2 px-4 bg-muted/30"
                                          data-testid="comment-thread-row"
                                        >
                                          <CommentThread
                                            comments={lineComments}
                                            onDelete={onCommentDelete}
                                            onUpdate={onCommentUpdate}
                                          />
                                        </div>
                                      )}
                                  </Fragment>
                                );
                              })}
                            </div>
                          ))}

                          {/* Render HunkSeparator if there's still a gap after expanded lines */}
                          {(() => {
                            // Calculate remaining gap after expansions
                            const expandedLineNumbers = new Set<number>();
                            gapExpandedLines.forEach((range) => {
                              for (let i = range.startLine; i <= range.endLine; i++) {
                                expandedLineNumbers.add(i);
                              }
                            });

                            // Check if there are still unexpanded lines in the gap
                            let remainingGapStart = prevHunkEndLine + 1;
                            let remainingGapEnd = currentHunkStartLine - 1;

                            // Adjust for already expanded lines
                            while (
                              remainingGapStart <= remainingGapEnd &&
                              expandedLineNumbers.has(remainingGapStart)
                            ) {
                              remainingGapStart++;
                            }
                            while (
                              remainingGapEnd >= remainingGapStart &&
                              expandedLineNumbers.has(remainingGapEnd)
                            ) {
                              remainingGapEnd--;
                            }

                            const hasRemainingGap = remainingGapStart <= remainingGapEnd;

                            return hasRemainingGap ? (
                              <HunkSeparator
                                prevHunkEndLine={remainingGapStart - 1}
                                nextHunkStartLine={remainingGapEnd + 1}
                                contextHeader={extractContextHeader(hunk.header)}
                                onExpandUp={() =>
                                  handleExpandUp(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                                onExpandDown={() =>
                                  handleExpandDown(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                                onBridge={() =>
                                  handleBridge(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                              />
                            ) : null;
                          })()}
                        </>
                      )}

                      <DiffHunk
                        hunk={hunk}
                        filePath={file.path}
                        selectedLines={selectedLines}
                        linesWithComments={linesWithComments}
                        comments={comments}
                        commentingOnLine={commentingOnLine}
                        onCommentClick={onCommentClick}
                        onLineClick={onLineClick}
                        onLineMouseDown={onLineMouseDown}
                        onLineMouseEnter={onLineMouseEnter}
                        onCommentSubmit={onCommentSubmit}
                        onCommentCancel={onCommentCancel}
                        onCommentDelete={onCommentDelete}
                        onCommentUpdate={onCommentUpdate}
                      />
                    </Fragment>
                  );
                })}

                {/* Render expanded lines after last hunk */}
                {expandedLinesAfterLastHunk.length > 0 &&
                  renderExpandedLinesUnified(expandedLinesAfterLastHunk, 'after-last')}
              </div>
            ) : (
              // Split view with synchronized scrolling
              <div data-testid="split-view">
                {/* Render expanded lines before first hunk */}
                {expandedLinesBeforeFirstHunk.length > 0 &&
                  renderExpandedLinesSplit(expandedLinesBeforeFirstHunk, 'before-first')}

                {splitHunks?.map((hunk, hunkIndex) => {
                  const prevHunk = hunkIndex > 0 ? splitHunks[hunkIndex - 1] : null;
                  const prevHunkEndLine = prevHunk ? getHunkEndLine(prevHunk) : 0;
                  const currentHunkStartLine = getHunkStartLine(hunk);

                  // Check if there's a gap between this hunk and the previous one
                  const hasGap = prevHunk && currentHunkStartLine > prevHunkEndLine + 1;

                  // Get expanded lines for this gap if any
                  const gapExpandedLines = expandedRanges.filter(
                    (range) =>
                      range.startLine > prevHunkEndLine && range.endLine < currentHunkStartLine
                  );

                  return (
                    <Fragment key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
                      {/* Render HunkSeparator between hunks if there's a gap */}
                      {hasGap && prevHunk && (
                        <>
                          {/* Render expanded lines in split view format */}
                          {gapExpandedLines.map((range, rangeIdx) => (
                            <div
                              key={`expanded-split-${range.startLine}-${range.endLine}-${rangeIdx}`}
                              className="border-b border-border"
                              data-testid="expanded-lines"
                            >
                              {range.content.map((lineContent, lineIdx) => {
                                const lineNum = range.startLine + lineIdx;

                                // Check if comment input should be shown after this line - filtered by side
                                const showCommentInputOld =
                                  commentingOnLine !== null &&
                                  commentingOnLine !== undefined &&
                                  commentingOnLine.lineEnd === lineNum &&
                                  commentingOnLine.side === 'old';

                                const showCommentInputNew =
                                  commentingOnLine !== null &&
                                  commentingOnLine !== undefined &&
                                  commentingOnLine.lineEnd === lineNum &&
                                  commentingOnLine.side === 'new';

                                // Get comments that end at this line - filtered by side
                                const oldSideComments = comments.filter(
                                  (c) => c.lineEnd === lineNum && c.side === 'old'
                                );
                                const newSideComments = comments.filter(
                                  (c) => c.lineEnd === lineNum && c.side === 'new'
                                );

                                return (
                                  <Fragment key={`expanded-${lineNum}`}>
                                    <div className="flex">
                                      {/* Old side */}
                                      <div className="flex-1 border-r border-border">
                                        <SplitDiffLine
                                          line={{
                                            type: 'context',
                                            oldLineNumber: lineNum,
                                            newLineNumber: lineNum,
                                            content: lineContent,
                                          }}
                                          side="old"
                                          filePath={file.path}
                                          isSelected={selectedLines.has(lineNum)}
                                          hasComments={linesWithComments.has(lineNum)}
                                          onCommentClick={onCommentClick}
                                          onLineClick={onLineClick}
                                          onLineMouseDown={onLineMouseDown}
                                          onLineMouseEnter={onLineMouseEnter}
                                        />
                                      </div>
                                      {/* New side */}
                                      <div className="flex-1">
                                        <SplitDiffLine
                                          line={{
                                            type: 'context',
                                            oldLineNumber: lineNum,
                                            newLineNumber: lineNum,
                                            content: lineContent,
                                          }}
                                          side="new"
                                          filePath={file.path}
                                          isSelected={selectedLines.has(lineNum)}
                                          hasComments={linesWithComments.has(lineNum)}
                                          onCommentClick={onCommentClick}
                                          onLineClick={onLineClick}
                                          onLineMouseDown={onLineMouseDown}
                                          onLineMouseEnter={onLineMouseEnter}
                                        />
                                      </div>
                                    </div>

                                    {/* Comment input row - split by side */}
                                    {(showCommentInputOld || showCommentInputNew) &&
                                      onCommentSubmit &&
                                      onCommentCancel && (
                                        <div className="flex" data-testid="comment-input-row">
                                          {/* Old side (left pane) */}
                                          <div className="flex-1 border-r border-border">
                                            {showCommentInputOld && (
                                              <div className="py-2 px-4 bg-muted/30">
                                                <CommentInput
                                                  lineStart={commentingOnLine.lineStart}
                                                  lineEnd={commentingOnLine.lineEnd}
                                                  side={commentingOnLine.side}
                                                  onSubmit={onCommentSubmit}
                                                  onCancel={onCommentCancel}
                                                />
                                              </div>
                                            )}
                                          </div>
                                          {/* New side (right pane) */}
                                          <div className="flex-1">
                                            {showCommentInputNew && (
                                              <div className="py-2 px-4 bg-muted/30">
                                                <CommentInput
                                                  lineStart={commentingOnLine.lineStart}
                                                  lineEnd={commentingOnLine.lineEnd}
                                                  side={commentingOnLine.side}
                                                  onSubmit={onCommentSubmit}
                                                  onCancel={onCommentCancel}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                    {/* Comments row - split by side */}
                                    {(oldSideComments.length > 0 || newSideComments.length > 0) &&
                                      onCommentDelete &&
                                      onCommentUpdate && (
                                        <div className="flex" data-testid="comment-thread-row">
                                          {/* Old side (left pane) */}
                                          <div className="flex-1 border-r border-border">
                                            {oldSideComments.length > 0 && (
                                              <div className="py-2 px-4 bg-muted/30">
                                                <CommentThread
                                                  comments={oldSideComments}
                                                  onDelete={onCommentDelete}
                                                  onUpdate={onCommentUpdate}
                                                />
                                              </div>
                                            )}
                                          </div>
                                          {/* New side (right pane) */}
                                          <div className="flex-1">
                                            {newSideComments.length > 0 && (
                                              <div className="py-2 px-4 bg-muted/30">
                                                <CommentThread
                                                  comments={newSideComments}
                                                  onDelete={onCommentDelete}
                                                  onUpdate={onCommentUpdate}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </Fragment>
                                );
                              })}
                            </div>
                          ))}

                          {/* Render HunkSeparator if there's still a gap after expanded lines */}
                          {(() => {
                            // Calculate remaining gap after expansions
                            const expandedLineNumbers = new Set<number>();
                            gapExpandedLines.forEach((range) => {
                              for (let i = range.startLine; i <= range.endLine; i++) {
                                expandedLineNumbers.add(i);
                              }
                            });

                            // Check if there are still unexpanded lines in the gap
                            let remainingGapStart = prevHunkEndLine + 1;
                            let remainingGapEnd = currentHunkStartLine - 1;

                            // Adjust for already expanded lines
                            while (
                              remainingGapStart <= remainingGapEnd &&
                              expandedLineNumbers.has(remainingGapStart)
                            ) {
                              remainingGapStart++;
                            }
                            while (
                              remainingGapEnd >= remainingGapStart &&
                              expandedLineNumbers.has(remainingGapEnd)
                            ) {
                              remainingGapEnd--;
                            }

                            const hasRemainingGap = remainingGapStart <= remainingGapEnd;

                            return hasRemainingGap ? (
                              <HunkSeparator
                                prevHunkEndLine={remainingGapStart - 1}
                                nextHunkStartLine={remainingGapEnd + 1}
                                contextHeader={extractContextHeader(hunk.header)}
                                onExpandUp={() =>
                                  handleExpandUp(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                                onExpandDown={() =>
                                  handleExpandDown(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                                onBridge={() =>
                                  handleBridge(remainingGapStart - 1, remainingGapEnd + 1)
                                }
                              />
                            ) : null;
                          })()}
                        </>
                      )}

                      <div className="border-b border-border last:border-b-0">
                        {/* Hunk header */}
                        <div
                          className={cn(
                            'flex items-center px-4 py-1 bg-muted/50 text-xs font-mono text-muted-foreground',
                            'sticky top-0 z-10 border-b border-border'
                          )}
                          data-testid="hunk-header"
                        >
                          <span className="text-blue-500">{hunk.header}</span>
                        </div>

                        {/* Split lines - each row contains both sides, comments below */}
                        <div data-testid="split-line-container">
                          {hunk.splitLines.map((splitLine, lineIndex) => {
                            // Determine the line number for comment anchoring
                            // Use the line that exists (old for deletions, new for additions/context)
                            const anchorLineNum =
                              splitLine.newLine?.newLineNumber || splitLine.oldLine?.oldLineNumber;

                            // Check if comment input should be shown after this line - filtered by side
                            const showCommentInputOld =
                              commentingOnLine !== null &&
                              commentingOnLine !== undefined &&
                              anchorLineNum !== undefined &&
                              commentingOnLine.lineEnd === anchorLineNum &&
                              commentingOnLine.side === 'old';

                            const showCommentInputNew =
                              commentingOnLine !== null &&
                              commentingOnLine !== undefined &&
                              anchorLineNum !== undefined &&
                              commentingOnLine.lineEnd === anchorLineNum &&
                              commentingOnLine.side === 'new';

                            // Get comments that end at this line - filtered by side
                            const oldSideComments = anchorLineNum
                              ? comments.filter(
                                  (c) => c.lineEnd === anchorLineNum && c.side === 'old'
                                )
                              : [];

                            const newSideComments = anchorLineNum
                              ? comments.filter(
                                  (c) => c.lineEnd === anchorLineNum && c.side === 'new'
                                )
                              : [];

                            return (
                              <Fragment key={`split-row-${lineIndex}`}>
                                <div className="flex">
                                  {/* Old side (left pane) */}
                                  <div className="flex-1 border-r border-border">
                                    <SplitDiffLine
                                      line={splitLine.oldLine}
                                      side="old"
                                      filePath={file.path}
                                      isSelected={
                                        splitLine.oldLine?.oldLineNumber
                                          ? selectedLines.has(splitLine.oldLine.oldLineNumber)
                                          : false
                                      }
                                      hasComments={
                                        splitLine.oldLine?.oldLineNumber
                                          ? linesWithComments.has(splitLine.oldLine.oldLineNumber)
                                          : false
                                      }
                                      pairedContent={splitLine.pairedNewContent}
                                      onCommentClick={onCommentClick}
                                      onLineClick={onLineClick}
                                      onLineMouseDown={onLineMouseDown}
                                      onLineMouseEnter={onLineMouseEnter}
                                    />
                                  </div>

                                  {/* New side (right pane) */}
                                  <div className="flex-1">
                                    <SplitDiffLine
                                      line={splitLine.newLine}
                                      side="new"
                                      filePath={file.path}
                                      isSelected={
                                        splitLine.newLine?.newLineNumber
                                          ? selectedLines.has(splitLine.newLine.newLineNumber)
                                          : false
                                      }
                                      hasComments={
                                        splitLine.newLine?.newLineNumber
                                          ? linesWithComments.has(splitLine.newLine.newLineNumber)
                                          : false
                                      }
                                      pairedContent={splitLine.pairedOldContent}
                                      onCommentClick={onCommentClick}
                                      onLineClick={onLineClick}
                                      onLineMouseDown={onLineMouseDown}
                                      onLineMouseEnter={onLineMouseEnter}
                                    />
                                  </div>
                                </div>

                                {/* Comment input row - split by side */}
                                {(showCommentInputOld || showCommentInputNew) &&
                                  onCommentSubmit &&
                                  onCommentCancel && (
                                    <div className="flex" data-testid="comment-input-row">
                                      {/* Old side (left pane) */}
                                      <div className="flex-1 border-r border-border">
                                        {showCommentInputOld && (
                                          <div className="py-2 px-4 bg-muted/30">
                                            <CommentInput
                                              lineStart={commentingOnLine.lineStart}
                                              lineEnd={commentingOnLine.lineEnd}
                                              side={commentingOnLine.side}
                                              onSubmit={onCommentSubmit}
                                              onCancel={onCommentCancel}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {/* New side (right pane) */}
                                      <div className="flex-1">
                                        {showCommentInputNew && (
                                          <div className="py-2 px-4 bg-muted/30">
                                            <CommentInput
                                              lineStart={commentingOnLine.lineStart}
                                              lineEnd={commentingOnLine.lineEnd}
                                              side={commentingOnLine.side}
                                              onSubmit={onCommentSubmit}
                                              onCancel={onCommentCancel}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {/* Comments row - split by side */}
                                {(oldSideComments.length > 0 || newSideComments.length > 0) &&
                                  onCommentDelete &&
                                  onCommentUpdate && (
                                    <div className="flex" data-testid="comment-thread-row">
                                      {/* Old side (left pane) */}
                                      <div className="flex-1 border-r border-border">
                                        {oldSideComments.length > 0 && (
                                          <div className="py-2 px-4 bg-muted/30">
                                            <CommentThread
                                              comments={oldSideComments}
                                              onDelete={onCommentDelete}
                                              onUpdate={onCommentUpdate}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      {/* New side (right pane) */}
                                      <div className="flex-1">
                                        {newSideComments.length > 0 && (
                                          <div className="py-2 px-4 bg-muted/30">
                                            <CommentThread
                                              comments={newSideComments}
                                              onDelete={onCommentDelete}
                                              onUpdate={onCommentUpdate}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}

                {/* Render expanded lines after last hunk */}
                {expandedLinesAfterLastHunk.length > 0 &&
                  renderExpandedLinesSplit(expandedLinesAfterLastHunk, 'after-last')}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

FileDiff.displayName = 'FileDiff';

// Split view line component - renders just the diff line, no comments
// Comments are rendered separately as full-width rows spanning both panes
interface SplitDiffLineProps {
  line: DiffLineType | null;
  side: 'old' | 'new';
  filePath: string;
  isSelected: boolean;
  hasComments: boolean;
  /** Paired line content for word-level diffing */
  pairedContent?: string;
  onCommentClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineClick?: (lineNumber: number) => void;
  onLineMouseDown?: (lineNumber: number, side: 'old' | 'new') => void;
  onLineMouseEnter?: (lineNumber: number) => void;
}

function SplitDiffLine({
  line,
  side,
  filePath,
  isSelected,
  hasComments,
  pairedContent,
  onCommentClick,
  onLineClick,
  onLineMouseDown,
  onLineMouseEnter,
}: SplitDiffLineProps) {
  if (!line) {
    // Filler row placeholder for alignment
    // No interactivity: no + button, text selection disabled
    return (
      <div
        className={cn('flex h-6 select-none', 'bg-neutral-100 dark:bg-neutral-800')}
        data-testid={`split-line-filler-${side}`}
      >
        <div className="w-12 flex-shrink-0 border-r border-border" />
        <div className="flex-1" />
      </div>
    );
  }

  // For split view, we show only one line number column
  // Adjust the line display based on which side we're on
  const displayLine: DiffLineType = {
    ...line,
    // In split view, context lines show both sides normally
    // Additions only appear on new side, deletions on old side
    oldLineNumber: side === 'old' ? line.oldLineNumber : undefined,
    newLineNumber: side === 'new' ? line.newLineNumber : undefined,
  };

  // For context lines in split view, show the appropriate line number
  if (line.type === 'context') {
    if (side === 'old') {
      displayLine.oldLineNumber = line.oldLineNumber;
      displayLine.newLineNumber = undefined;
    } else {
      displayLine.oldLineNumber = undefined;
      displayLine.newLineNumber = line.newLineNumber;
    }
  }

  // Only pass pairedContent for modification pairs (delete/add), not context lines
  const shouldShowWordDiff =
    pairedContent !== undefined && (line.type === 'delete' || line.type === 'add');

  return (
    <div data-testid={`split-line-${side}`}>
      <DiffLine
        line={displayLine}
        filePath={filePath}
        isSelected={isSelected}
        hasComments={hasComments}
        truncateContent
        pairedLine={shouldShowWordDiff ? pairedContent : undefined}
        onCommentClick={(lineNum) => onCommentClick(lineNum, side)}
        onLineClick={onLineClick}
        onLineMouseDown={onLineMouseDown}
        onLineMouseEnter={onLineMouseEnter}
      />
    </div>
  );
}
