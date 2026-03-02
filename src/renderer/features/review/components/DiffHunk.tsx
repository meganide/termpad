import { useMemo, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { DiffLine } from './DiffLine';
import { CommentInput } from './CommentInput';
import { CommentThread } from './CommentThread';
import type {
  DiffHunk as DiffHunkType,
  DiffLine as DiffLineType,
  ReviewComment,
  CommentCategory,
} from '../../../../shared/reviewTypes';

/**
 * Compute paired content for lines in unified view.
 * Returns a Map where the key is the line index and value is the paired content string.
 * - For deletions: the paired content is the corresponding addition
 * - For additions: the paired content is the corresponding deletion
 */
function computePairedLines(lines: DiffLineType[]): Map<number, string> {
  const pairedContent = new Map<number, string>();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'delete') {
      // Collect consecutive deletions
      const deletionIndices: number[] = [];
      const deletionContents: string[] = [];
      while (i < lines.length && lines[i].type === 'delete') {
        deletionIndices.push(i);
        deletionContents.push(lines[i].content);
        i++;
      }

      // Collect consecutive additions
      const additionIndices: number[] = [];
      const additionContents: string[] = [];
      while (i < lines.length && lines[i].type === 'add') {
        additionIndices.push(i);
        additionContents.push(lines[i].content);
        i++;
      }

      // Pair deletions with additions
      const maxLen = Math.max(deletionIndices.length, additionIndices.length);
      for (let j = 0; j < maxLen; j++) {
        if (deletionIndices[j] !== undefined && additionContents[j] !== undefined) {
          // Deletion has a paired addition
          pairedContent.set(deletionIndices[j], additionContents[j]);
        }
        if (additionIndices[j] !== undefined && deletionContents[j] !== undefined) {
          // Addition has a paired deletion
          pairedContent.set(additionIndices[j], deletionContents[j]);
        }
      }
    } else {
      // Context or standalone addition - skip
      i++;
    }
  }

  return pairedContent;
}

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath: string;
  selectedLines: Set<number>;
  linesWithComments: Set<number>;
  comments?: ReviewComment[];
  commentingOnLine?: {
    lineStart: number;
    lineEnd: number;
    side: 'old' | 'new';
  } | null;
  onCommentClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineClick?: (lineNumber: number) => void;
  onLineMouseDown?: (lineNumber: number, side: 'old' | 'new') => void;
  onLineMouseEnter?: (lineNumber: number) => void;
  onCommentSubmit?: (category: CommentCategory, content: string) => void;
  onCommentCancel?: () => void;
  onCommentDelete?: (commentId: string) => void;
  onCommentUpdate?: (commentId: string, content: string) => void;
}

export function DiffHunk({
  hunk,
  filePath,
  selectedLines,
  linesWithComments,
  comments = [],
  commentingOnLine,
  onCommentClick,
  onLineClick,
  onLineMouseDown,
  onLineMouseEnter,
  onCommentSubmit,
  onCommentCancel,
  onCommentDelete,
  onCommentUpdate,
}: DiffHunkProps) {
  // Pre-compute paired content for word-level diffing in unified view
  const pairedContent = useMemo(() => computePairedLines(hunk.lines), [hunk.lines]);

  return (
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

      {/* Hunk lines */}
      <div>
        {hunk.lines.map((line, index) => {
          const lineNum = line.newLineNumber || line.oldLineNumber || index;
          const lineSide = line.type === 'delete' ? 'old' : 'new';

          // In unified view, show + button in appropriate gutter:
          // - Deletions: old gutter only
          // - Additions/context: new gutter only
          const showAddButtonInOldGutter = line.type === 'delete';
          const showAddButtonInNewGutter = line.type !== 'delete';

          // Check if comment input should be shown after this line (anchored to lineEnd and side)
          const showCommentInput =
            commentingOnLine !== null &&
            commentingOnLine !== undefined &&
            commentingOnLine.lineEnd === lineNum &&
            commentingOnLine.side === lineSide;

          // Get comments that end at this line and match the side
          const lineComments = comments.filter((c) => c.lineEnd === lineNum && c.side === lineSide);

          return (
            <Fragment key={`${lineNum}-${index}`}>
              <DiffLine
                line={line}
                filePath={filePath}
                isSelected={selectedLines.has(lineNum)}
                hasComments={linesWithComments.has(lineNum)}
                pairedLine={pairedContent.get(index)}
                showAddButtonInOldGutter={showAddButtonInOldGutter}
                showAddButtonInNewGutter={showAddButtonInNewGutter}
                onCommentClick={onCommentClick}
                onLineClick={onLineClick}
                onLineMouseDown={onLineMouseDown}
                onLineMouseEnter={onLineMouseEnter}
              />

              {/* Comment input - rendered as separate full-width row below the anchor line */}
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

              {/* Comments - rendered as separate full-width rows below the anchor line */}
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
    </div>
  );
}
