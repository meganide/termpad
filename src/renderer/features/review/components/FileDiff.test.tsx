import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDiff } from './FileDiff';
import { useReviewStore } from '@/stores/reviewStore';
import type { DiffFile } from '../../../../shared/reviewTypes';

describe('FileDiff', () => {
  const mockFile: DiffFile = {
    path: 'src/example.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    isBinary: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: 5,
        newStart: 1,
        newLines: 6,
        header: '@@ -1,5 +1,6 @@ function example()',
        lines: [
          { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const a = 1;' },
          { type: 'delete', oldLineNumber: 2, content: 'const b = 2;' },
          { type: 'add', newLineNumber: 2, content: 'const b = "two";' },
          { type: 'add', newLineNumber: 3, content: 'const c = 3;' },
          { type: 'context', oldLineNumber: 3, newLineNumber: 4, content: 'return a + b;' },
        ],
      },
    ],
  };

  const defaultProps = {
    file: mockFile,
    viewMode: 'unified' as const,
    isExpanded: true,
    isViewed: false,
    selectedLines: new Set<number>(),
    linesWithComments: new Set<number>(),
    onToggleExpand: vi.fn(),
    onMarkViewed: vi.fn(),
    onCommentClick: vi.fn(),
    onLineClick: vi.fn(),
  };

  describe('Basic rendering', () => {
    it('should render the file diff container', () => {
      render(<FileDiff {...defaultProps} />);

      expect(screen.getByTestId('file-diff')).toBeInTheDocument();
      expect(screen.getByTestId('file-diff')).toHaveAttribute('data-file-path', 'src/example.ts');
    });

    it('should render the file header', () => {
      render(<FileDiff {...defaultProps} />);

      expect(screen.getByTestId('file-diff-header')).toBeInTheDocument();
      expect(screen.getByText('src/example.ts')).toBeInTheDocument();
    });

    it('should show content when expanded', () => {
      render(<FileDiff {...defaultProps} isExpanded={true} />);

      expect(screen.getByTestId('file-diff-content')).toBeInTheDocument();
    });

    it('should hide content when collapsed', () => {
      render(<FileDiff {...defaultProps} isExpanded={false} />);

      expect(screen.queryByTestId('file-diff-content')).not.toBeInTheDocument();
    });

    it('should show binary file message for binary files', () => {
      const binaryFile: DiffFile = {
        ...mockFile,
        isBinary: true,
        hunks: [],
      };

      render(<FileDiff {...defaultProps} file={binaryFile} />);

      expect(screen.getByText('Binary file not shown')).toBeInTheDocument();
    });

    it('should show no changes message for empty hunks', () => {
      const emptyFile: DiffFile = {
        ...mockFile,
        hunks: [],
      };

      render(<FileDiff {...defaultProps} file={emptyFile} />);

      expect(screen.getByText('No changes')).toBeInTheDocument();
    });
  });

  describe('Unified view', () => {
    it('should render unified view by default', () => {
      render(<FileDiff {...defaultProps} viewMode="unified" />);

      expect(screen.getByTestId('unified-view')).toBeInTheDocument();
      expect(screen.queryByTestId('split-view')).not.toBeInTheDocument();
    });

    it('should render all lines in unified view', () => {
      render(<FileDiff {...defaultProps} viewMode="unified" />);

      // Should have all 5 lines (use specific regex to avoid matching diff-line-content)
      expect(screen.getAllByTestId(/^diff-line-(context|add|delete)$/)).toHaveLength(5);
    });

    it('should render hunk header in unified view', () => {
      render(<FileDiff {...defaultProps} viewMode="unified" />);

      expect(screen.getByTestId('hunk-header')).toHaveTextContent(
        '@@ -1,5 +1,6 @@ function example()'
      );
    });
  });

  describe('Split view', () => {
    it('should render split view when mode is split', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      expect(screen.getByTestId('split-view')).toBeInTheDocument();
      expect(screen.queryByTestId('unified-view')).not.toBeInTheDocument();
    });

    it('should render split line container', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      expect(screen.getByTestId('split-line-container')).toBeInTheDocument();
    });

    it('should render hunk header in split view', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      expect(screen.getByTestId('hunk-header')).toHaveTextContent(
        '@@ -1,5 +1,6 @@ function example()'
      );
    });

    it('should render old and new side lines', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      const oldSideLines = screen.getAllByTestId('split-line-old');
      const newSideLines = screen.getAllByTestId('split-line-new');

      expect(oldSideLines.length).toBeGreaterThan(0);
      expect(newSideLines.length).toBeGreaterThan(0);
    });

    it('should render filler placeholders for unmatched lines', () => {
      // In our mock file, we have 1 deletion and 2 additions
      // So the old side should have 1 filler placeholder
      render(<FileDiff {...defaultProps} viewMode="split" />);

      const fillerPlaceholders = screen.getAllByTestId(/split-line-filler/);
      expect(fillerPlaceholders.length).toBeGreaterThan(0);
    });

    it('should render filler placeholders with hatched styling and no interactivity', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      const fillerPlaceholders = screen.getAllByTestId(/split-line-filler/);
      const fillerRow = fillerPlaceholders[0];

      // Should have select-none for disabled text selection
      expect(fillerRow.className).toContain('select-none');
      // Should have the solid gray background
      expect(fillerRow.className).toContain('bg-neutral-100');
      // Should NOT have a comment button
      expect(fillerRow.querySelector('[data-testid="comment-button"]')).not.toBeInTheDocument();
    });

    it('should render split view with side-by-side layout', () => {
      render(<FileDiff {...defaultProps} viewMode="split" />);

      // Split view should have split line container
      const container = screen.getByTestId('split-line-container');
      expect(container).toBeInTheDocument();
      // Each row should have both old and new sides
      expect(screen.getAllByTestId('split-line-old').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('split-line-new').length).toBeGreaterThan(0);
    });
  });

  describe('Interactions', () => {
    it('should call onToggleExpand when header expand button is clicked', () => {
      const onToggleExpand = vi.fn();
      render(<FileDiff {...defaultProps} onToggleExpand={onToggleExpand} />);

      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(onToggleExpand).toHaveBeenCalled();
    });

    it('should call onMarkViewed when mark viewed checkbox is clicked', () => {
      const onMarkViewed = vi.fn();
      render(<FileDiff {...defaultProps} onMarkViewed={onMarkViewed} />);

      fireEvent.click(screen.getByTestId('mark-viewed-checkbox'));

      expect(onMarkViewed).toHaveBeenCalled();
    });
  });

  describe('Selection', () => {
    it('should apply selection styling to selected lines in unified view', () => {
      render(<FileDiff {...defaultProps} selectedLines={new Set([1, 2])} />);

      const lines = screen.getAllByTestId(/diff-line-/);
      expect(lines[0].className).toContain('bg-blue-500/20');
    });
  });

  describe('Multiple hunks', () => {
    it('should render multiple hunks correctly', () => {
      const multiHunkFile: DiffFile = {
        ...mockFile,
        hunks: [
          {
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 3,
            header: '@@ -1,3 +1,3 @@ first hunk',
            lines: [{ type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' }],
          },
          {
            oldStart: 10,
            oldLines: 3,
            newStart: 10,
            newLines: 3,
            header: '@@ -10,3 +10,3 @@ second hunk',
            lines: [{ type: 'context', oldLineNumber: 10, newLineNumber: 10, content: 'line 10' }],
          },
        ],
      };

      render(<FileDiff {...defaultProps} file={multiHunkFile} />);

      const hunkHeaders = screen.getAllByTestId('hunk-header');
      expect(hunkHeaders).toHaveLength(2);
      expect(hunkHeaders[0]).toHaveTextContent('first hunk');
      expect(hunkHeaders[1]).toHaveTextContent('second hunk');
    });
  });

  describe('File status display', () => {
    it('should show Added badge for added files', () => {
      const addedFile: DiffFile = { ...mockFile, status: 'added' };
      render(<FileDiff {...defaultProps} file={addedFile} />);

      expect(screen.getByText('Added')).toBeInTheDocument();
    });

    it('should show Deleted badge for deleted files', () => {
      const deletedFile: DiffFile = { ...mockFile, status: 'deleted' };
      render(<FileDiff {...defaultProps} file={deletedFile} />);

      expect(screen.getByText('Deleted')).toBeInTheDocument();
    });

    it('should show Renamed badge for renamed files', () => {
      const renamedFile: DiffFile = {
        ...mockFile,
        status: 'renamed',
        oldPath: 'src/old-example.ts',
      };
      render(<FileDiff {...defaultProps} file={renamedFile} />);

      expect(screen.getByText('Renamed')).toBeInTheDocument();
      expect(screen.getByText('(from src/old-example.ts)')).toBeInTheDocument();
    });
  });

  describe('Viewed state', () => {
    it('should show Viewed label with checkbox when file is viewed', () => {
      render(<FileDiff {...defaultProps} isViewed={true} />);

      expect(screen.getByText('Viewed')).toBeInTheDocument();
      const checkbox = screen.getByTestId('mark-viewed-checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('should show Viewed label with unchecked checkbox when file is not viewed', () => {
      render(<FileDiff {...defaultProps} isViewed={false} />);

      expect(screen.getByText('Viewed')).toBeInTheDocument();
      const checkbox = screen.getByTestId('mark-viewed-checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('HunkSeparator integration', () => {
    const fileWithGapBetweenHunks: DiffFile = {
      path: 'src/example.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      isBinary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: '@@ -1,3 +1,3 @@ function first()',
          lines: [
            { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
            { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'line 2' },
            { type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'line 3' },
          ],
        },
        {
          // Gap: lines 4-49 are hidden (46 lines)
          oldStart: 50,
          oldLines: 3,
          newStart: 50,
          newLines: 3,
          header: '@@ -50,3 +50,3 @@ function second()',
          lines: [
            { type: 'context', oldLineNumber: 50, newLineNumber: 50, content: 'line 50' },
            { type: 'context', oldLineNumber: 51, newLineNumber: 51, content: 'line 51' },
            { type: 'context', oldLineNumber: 52, newLineNumber: 52, content: 'line 52' },
          ],
        },
      ],
    };

    const fileWithSmallGap: DiffFile = {
      path: 'src/example.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      isBinary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: '@@ -1,3 +1,3 @@ function first()',
          lines: [
            { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
            { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'line 2' },
            { type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'line 3' },
          ],
        },
        {
          // Small gap: lines 4-13 are hidden (10 lines)
          oldStart: 14,
          oldLines: 3,
          newStart: 14,
          newLines: 3,
          header: '@@ -14,3 +14,3 @@ function second()',
          lines: [
            { type: 'context', oldLineNumber: 14, newLineNumber: 14, content: 'line 14' },
            { type: 'context', oldLineNumber: 15, newLineNumber: 15, content: 'line 15' },
            { type: 'context', oldLineNumber: 16, newLineNumber: 16, content: 'line 16' },
          ],
        },
      ],
    };

    const fileWithNoGap: DiffFile = {
      path: 'src/example.ts',
      status: 'modified',
      additions: 2,
      deletions: 2,
      isBinary: false,
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: '@@ -1,3 +1,3 @@ function first()',
          lines: [
            { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'line 1' },
            { type: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'line 2' },
            { type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'line 3' },
          ],
        },
        {
          // No gap: lines continue directly
          oldStart: 4,
          oldLines: 3,
          newStart: 4,
          newLines: 3,
          header: '@@ -4,3 +4,3 @@ function second()',
          lines: [
            { type: 'context', oldLineNumber: 4, newLineNumber: 4, content: 'line 4' },
            { type: 'context', oldLineNumber: 5, newLineNumber: 5, content: 'line 5' },
            { type: 'context', oldLineNumber: 6, newLineNumber: 6, content: 'line 6' },
          ],
        },
      ],
    };

    beforeEach(() => {
      // Reset the review store before each test
      useReviewStore.setState({ expandedRanges: new Map() });
    });

    afterEach(() => {
      // Clean up after each test
      useReviewStore.setState({ expandedRanges: new Map() });
    });

    it('should render HunkSeparator between hunks when there is a gap in unified view', () => {
      render(<FileDiff {...defaultProps} file={fileWithGapBetweenHunks} viewMode="unified" />);

      // Should have a hunk separator
      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toBeInTheDocument();

      // Should show the gap size (lines 4-49 = 46 lines)
      expect(separator.getAttribute('data-gap')).toBe('46');

      // Large gap should be in progressive mode
      expect(separator.getAttribute('data-mode')).toBe('progressive');
    });

    it('should render HunkSeparator with bridge mode for small gaps', () => {
      render(<FileDiff {...defaultProps} file={fileWithSmallGap} viewMode="unified" />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toBeInTheDocument();

      // Should show the gap size (lines 4-13 = 10 lines)
      expect(separator.getAttribute('data-gap')).toBe('10');

      // Small gap should be in bridge mode
      expect(separator.getAttribute('data-mode')).toBe('bridge');
    });

    it('should NOT render HunkSeparator when there is no gap between hunks', () => {
      render(<FileDiff {...defaultProps} file={fileWithNoGap} viewMode="unified" />);

      // Should not have a hunk separator
      expect(screen.queryByTestId('hunk-separator')).not.toBeInTheDocument();
    });

    it('should render HunkSeparator in split view', () => {
      render(<FileDiff {...defaultProps} file={fileWithGapBetweenHunks} viewMode="split" />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toBeInTheDocument();
      expect(separator.getAttribute('data-gap')).toBe('46');
    });

    it('should show context header from hunk in HunkSeparator', () => {
      render(<FileDiff {...defaultProps} file={fileWithGapBetweenHunks} viewMode="unified" />);

      // The second hunk header has "function second()" as context
      const contextHeader = screen.getByTestId('context-header');
      expect(contextHeader).toHaveTextContent('function second()');
    });

    it('should render expand buttons for progressive mode', () => {
      render(<FileDiff {...defaultProps} file={fileWithGapBetweenHunks} viewMode="unified" />);

      // Large gap should have expand up/down buttons
      expect(screen.getByTestId('expand-up-button')).toBeInTheDocument();
      expect(screen.getByTestId('expand-down-button')).toBeInTheDocument();
      expect(screen.getByTestId('show-all-button')).toBeInTheDocument();
    });

    it('should render bridge button for small gaps', () => {
      render(<FileDiff {...defaultProps} file={fileWithSmallGap} viewMode="unified" />);

      // Small gap should have only bridge button
      expect(screen.getByTestId('bridge-button')).toBeInTheDocument();
      expect(screen.queryByTestId('expand-up-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('expand-down-button')).not.toBeInTheDocument();
    });
  });
});
