import { cn } from '@/lib/utils';
import { highlightLine, getLanguageFromPath } from '@/utils/highlight';
import type { DiffLine as DiffLineType } from '../../../../shared/reviewTypes';
import {
  computeWordDiffWithLimit,
  getOldLineSegments,
  getNewLineSegments,
  type DiffSegment,
} from '@/utils/wordDiff';

interface DiffLineProps {
  line: DiffLineType;
  filePath: string;
  isSelected: boolean;
  hasComments: boolean;
  truncateContent?: boolean;
  /** Paired line content for word-level diffing (e.g., the old line content when rendering an addition) */
  pairedLine?: string;
  /** Whether this is a filler row (empty placeholder for alignment in split view) */
  isFiller?: boolean;
  /** Show comment add button in old (left) gutter column. Defaults to true for deletions. */
  showAddButtonInOldGutter?: boolean;
  /** Show comment add button in new (right) gutter column. Defaults to true for additions/context. */
  showAddButtonInNewGutter?: boolean;
  onCommentClick: (lineNumber: number, side: 'old' | 'new') => void;
  onLineClick?: (lineNumber: number) => void;
  onLineMouseDown?: (lineNumber: number, side: 'old' | 'new') => void;
  onLineMouseEnter?: (lineNumber: number) => void;
}

/**
 * Render content with word-level highlighting.
 * Segments are rendered with appropriate styling based on their type.
 */
function renderWordDiffContent(
  segments: DiffSegment[],
  lineType: 'add' | 'delete'
): React.ReactNode {
  return segments.map((segment, index) => {
    // Determine if this segment should be highlighted
    const isHighlighted =
      (lineType === 'add' && segment.type === 'added') ||
      (lineType === 'delete' && segment.type === 'removed');

    if (isHighlighted) {
      return (
        <span
          key={index}
          className={cn(
            'rounded-sm',
            lineType === 'add'
              ? 'bg-green-500/40 dark:bg-green-500/50'
              : 'bg-red-500/40 dark:bg-red-500/50'
          )}
          data-testid={lineType === 'add' ? 'word-added' : 'word-removed'}
        >
          {segment.text}
        </span>
      );
    }

    return <span key={index}>{segment.text}</span>;
  });
}

export function DiffLine({
  line,
  filePath,
  isSelected,
  hasComments: _hasComments,
  truncateContent = false,
  pairedLine,
  isFiller = false,
  showAddButtonInOldGutter: _showAddButtonInOldGutter,
  showAddButtonInNewGutter: _showAddButtonInNewGutter,
  onCommentClick: _onCommentClick,
  onLineClick,
  onLineMouseDown,
  onLineMouseEnter,
}: DiffLineProps) {
  const language = getLanguageFromPath(filePath);
  // Note: highlightLine returns HTML from highlight.js which properly escapes user content
  // and only adds safe span elements for syntax highlighting classes
  const highlightedContent = highlightLine(line.content, language);

  // Compute word-level diff if we have a paired line for comparison
  const wordDiffSegments = (() => {
    if (!pairedLine || line.type === 'context') {
      return null;
    }

    // Compute diff between old and new content
    const allSegments =
      line.type === 'delete'
        ? computeWordDiffWithLimit(line.content, pairedLine)
        : computeWordDiffWithLimit(pairedLine, line.content);

    // Filter segments for this side
    return line.type === 'delete'
      ? getOldLineSegments(allSegments)
      : getNewLineSegments(allSegments);
  })();

  const bgColor =
    line.type === 'add'
      ? 'bg-green-500/10 dark:bg-green-500/15'
      : line.type === 'delete'
        ? 'bg-red-500/10 dark:bg-red-500/15'
        : '';

  const lineNumColor =
    line.type === 'add'
      ? 'text-green-600 dark:text-green-500'
      : line.type === 'delete'
        ? 'text-red-600 dark:text-red-500'
        : 'text-muted-foreground';

  const currentLineNum = line.newLineNumber || line.oldLineNumber;
  const currentSide = line.type === 'delete' ? 'old' : 'new';

  const handleLineClick = () => {
    if (currentLineNum !== undefined && onLineClick) {
      onLineClick(currentLineNum);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger on line number areas (left side)
    if (currentLineNum !== undefined && onLineMouseDown) {
      e.preventDefault(); // Prevent text selection
      onLineMouseDown(currentLineNum, currentSide);
    }
  };

  const handleMouseEnter = () => {
    if (currentLineNum !== undefined && onLineMouseEnter) {
      onLineMouseEnter(currentLineNum);
    }
  };

  // Filler rows have distinct styling and no interactivity
  if (isFiller) {
    return (
      <div
        className={cn(
          'flex h-6 text-sm font-mono select-none',
          'bg-neutral-100 dark:bg-neutral-800'
        )}
        data-testid="diff-line-filler"
      >
        {/* Empty line number gutter */}
        <div className="w-12 flex-shrink-0 border-r border-border" />
        {/* Empty content area */}
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'flex group hover:bg-muted/50 text-sm font-mono',
          bgColor,
          isSelected && 'bg-blue-500/20 hover:bg-blue-500/30'
        )}
        data-testid={`diff-line-${line.type}`}
        onMouseEnter={handleMouseEnter}
      >
        {/* Old line number */}
        <div
          className={cn(
            'w-12 flex-shrink-0 flex items-center justify-end px-1 py-0.5 select-none border-r border-border cursor-pointer',
            lineNumColor,
            'hover:bg-blue-500/10'
          )}
          onClick={handleLineClick}
          onMouseDown={handleMouseDown}
          role={onLineClick ? 'button' : undefined}
          tabIndex={onLineClick ? 0 : undefined}
          data-testid="old-line-number"
        >
          <span className="pr-1">{line.oldLineNumber || ''}</span>
        </div>

        {/* New line number */}
        <div
          className={cn(
            'w-12 flex-shrink-0 flex items-center justify-end px-1 py-0.5 select-none border-r border-border cursor-pointer',
            lineNumColor,
            'hover:bg-blue-500/10'
          )}
          onClick={handleLineClick}
          onMouseDown={handleMouseDown}
          role={onLineClick ? 'button' : undefined}
          tabIndex={onLineClick ? 0 : undefined}
          data-testid="new-line-number"
        >
          <span className="pr-1">{line.newLineNumber || ''}</span>
        </div>

        {/* Diff indicator */}
        <div className="w-6 flex-shrink-0 text-center py-0.5 select-none">
          {line.type === 'add' && <span className="text-green-600 dark:text-green-500">+</span>}
          {line.type === 'delete' && <span className="text-red-600 dark:text-red-500">-</span>}
        </div>

        {/* Content - uses word diff rendering when paired line exists, otherwise falls back
            to existing safe highlight.js output which escapes user content */}
        <div
          className={cn(
            'diff-line-content flex-1 py-0.5 px-2 whitespace-pre-wrap break-all',
            truncateContent && 'overflow-hidden text-ellipsis'
          )}
          data-testid="diff-line-content"
        >
          {wordDiffSegments ? (
            // Render word-level diff (no syntax highlighting, but shows character changes)
            renderWordDiffContent(wordDiffSegments, line.type as 'add' | 'delete')
          ) : (
            <span
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: highlightedContent || '&nbsp;' }}
            />
          )}
        </div>
      </div>
    </>
  );
}
