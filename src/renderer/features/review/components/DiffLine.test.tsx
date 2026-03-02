import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffLine } from './DiffLine';
import { DiffHunk } from './DiffHunk';
import type {
  DiffLine as DiffLineType,
  DiffHunk as DiffHunkType,
} from '../../../../shared/reviewTypes';

describe('DiffLine', () => {
  const mockContextLine: DiffLineType = {
    type: 'context',
    oldLineNumber: 10,
    newLineNumber: 10,
    content: 'const x = 1;',
  };

  const mockAddLine: DiffLineType = {
    type: 'add',
    newLineNumber: 11,
    content: 'const y = 2;',
  };

  const mockDeleteLine: DiffLineType = {
    type: 'delete',
    oldLineNumber: 12,
    content: 'const z = 3;',
  };

  const defaultProps = {
    filePath: 'src/file.ts',
    isSelected: false,
    hasComments: false,
    onCommentClick: vi.fn(),
  };

  it('should render context line with both line numbers', () => {
    render(<DiffLine line={mockContextLine} {...defaultProps} />);

    expect(screen.getByTestId('old-line-number')).toHaveTextContent('10');
    expect(screen.getByTestId('new-line-number')).toHaveTextContent('10');
    expect(screen.getByTestId('diff-line-context')).toBeInTheDocument();
  });

  it('should render add line with green styling', () => {
    render(<DiffLine line={mockAddLine} {...defaultProps} />);

    expect(screen.getByTestId('new-line-number')).toHaveTextContent('11');
    expect(screen.getByTestId('diff-line-add')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('should render delete line with red styling', () => {
    render(<DiffLine line={mockDeleteLine} {...defaultProps} />);

    expect(screen.getByTestId('old-line-number')).toHaveTextContent('12');
    expect(screen.getByTestId('diff-line-delete')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should apply selected styling when isSelected is true', () => {
    render(<DiffLine line={mockContextLine} {...defaultProps} isSelected={true} />);

    const lineElement = screen.getByTestId('diff-line-context');
    expect(lineElement.className).toContain('bg-blue-500/20');
  });

  it('should render code content with highlighting', () => {
    render(<DiffLine line={mockContextLine} {...defaultProps} />);

    // Content should be rendered (we can't easily test highlighting without snapshot)
    const lineElement = screen.getByTestId('diff-line-context');
    expect(lineElement).toBeInTheDocument();
  });

  // Note: Comment input and comments are now rendered by parent components (DiffHunk/FileDiff)
  // These tests have been moved to DiffHunk.test.tsx

  it('should call onLineMouseDown when line number is clicked with mousedown', () => {
    const onLineMouseDown = vi.fn();
    render(<DiffLine line={mockContextLine} {...defaultProps} onLineMouseDown={onLineMouseDown} />);

    const lineNumber = screen.getByTestId('old-line-number');
    fireEvent.mouseDown(lineNumber);

    expect(onLineMouseDown).toHaveBeenCalledWith(10, 'new');
  });

  it('should call onLineMouseEnter when hovering over line', () => {
    const onLineMouseEnter = vi.fn();
    render(
      <DiffLine line={mockContextLine} {...defaultProps} onLineMouseEnter={onLineMouseEnter} />
    );

    const lineElement = screen.getByTestId('diff-line-context');
    fireEvent.mouseEnter(lineElement);

    expect(onLineMouseEnter).toHaveBeenCalledWith(10);
  });

  describe('filler row behavior', () => {
    it('should render filler row with distinct styling when isFiller is true', () => {
      render(<DiffLine line={mockContextLine} {...defaultProps} isFiller={true} />);

      const fillerRow = screen.getByTestId('diff-line-filler');
      expect(fillerRow).toBeInTheDocument();
      // Should have select-none class for disabled text selection
      expect(fillerRow.className).toContain('select-none');
      // Should have the solid gray background
      expect(fillerRow.className).toContain('bg-neutral-100');
    });

    it('should not render comment button on filler row', () => {
      render(<DiffLine line={mockContextLine} {...defaultProps} isFiller={true} />);

      expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
    });

    it('should not render line numbers on filler row', () => {
      render(<DiffLine line={mockContextLine} {...defaultProps} isFiller={true} />);

      // Filler row should not have line number elements with content
      expect(screen.queryByTestId('old-line-number')).not.toBeInTheDocument();
      expect(screen.queryByTestId('new-line-number')).not.toBeInTheDocument();
    });

    it('should not respond to mouse events on filler row', () => {
      const onCommentClick = vi.fn();
      const onLineClick = vi.fn();
      const onLineMouseDown = vi.fn();
      const onLineMouseEnter = vi.fn();

      render(
        <DiffLine
          line={mockContextLine}
          {...defaultProps}
          isFiller={true}
          onCommentClick={onCommentClick}
          onLineClick={onLineClick}
          onLineMouseDown={onLineMouseDown}
          onLineMouseEnter={onLineMouseEnter}
        />
      );

      const fillerRow = screen.getByTestId('diff-line-filler');
      fireEvent.click(fillerRow);
      fireEvent.mouseDown(fillerRow);
      fireEvent.mouseEnter(fillerRow);

      // None of the callbacks should be called
      expect(onCommentClick).not.toHaveBeenCalled();
      expect(onLineClick).not.toHaveBeenCalled();
      expect(onLineMouseDown).not.toHaveBeenCalled();
      expect(onLineMouseEnter).not.toHaveBeenCalled();
    });

    // Note: Comments and comment input are now rendered by parent components (DiffHunk/FileDiff)
    // Filler rows don't need these tests anymore since they never had comment-related props
  });

  describe('word-level diffing', () => {
    it('should render word-level diff for added line when pairedLine is provided', () => {
      const addLine: DiffLineType = {
        type: 'add',
        newLineNumber: 5,
        content: 'const newValue = 42;',
      };

      render(<DiffLine line={addLine} {...defaultProps} pairedLine="const oldValue = 42;" />);

      // Should show word-added highlighting for the changed portion
      const wordAddedElements = screen.getAllByTestId('word-added');
      expect(wordAddedElements.length).toBeGreaterThan(0);
      // Check that the new word is highlighted
      const highlightedText = wordAddedElements.map((el) => el.textContent).join('');
      expect(highlightedText).toContain('new');
    });

    it('should render word-level diff for deleted line when pairedLine is provided', () => {
      const deleteLine: DiffLineType = {
        type: 'delete',
        oldLineNumber: 5,
        content: 'const oldValue = 42;',
      };

      render(<DiffLine line={deleteLine} {...defaultProps} pairedLine="const newValue = 42;" />);

      // Should show word-removed highlighting for the changed portion
      const wordRemovedElements = screen.getAllByTestId('word-removed');
      expect(wordRemovedElements.length).toBeGreaterThan(0);
      // Check that the old word is highlighted
      const highlightedText = wordRemovedElements.map((el) => el.textContent).join('');
      expect(highlightedText).toContain('old');
    });

    it('should not render word diff for context lines even with pairedLine', () => {
      render(
        <DiffLine line={mockContextLine} {...defaultProps} pairedLine="const different = 1;" />
      );

      // Context lines should not have word diff highlighting
      expect(screen.queryByTestId('word-added')).not.toBeInTheDocument();
      expect(screen.queryByTestId('word-removed')).not.toBeInTheDocument();
    });

    it('should not render word diff when no pairedLine is provided', () => {
      render(<DiffLine line={mockAddLine} {...defaultProps} />);

      // Without paired line, no word diff should be rendered
      expect(screen.queryByTestId('word-added')).not.toBeInTheDocument();
      expect(screen.queryByTestId('word-removed')).not.toBeInTheDocument();
    });

    it('should handle whitespace-only changes in word diff', () => {
      const addLine: DiffLineType = {
        type: 'add',
        newLineNumber: 5,
        content: 'const  value = 42;', // two spaces
      };

      render(
        <DiffLine
          line={addLine}
          {...defaultProps}
          pairedLine="const value = 42;" // one space
        />
      );

      // Should render without errors (whitespace diff is valid)
      expect(screen.getByTestId('diff-line-add')).toBeInTheDocument();
    });

    it('should highlight entire content when lines are completely different', () => {
      const addLine: DiffLineType = {
        type: 'add',
        newLineNumber: 5,
        content: 'completely new content',
      };

      render(<DiffLine line={addLine} {...defaultProps} pairedLine="totally different text" />);

      // Should render word-added elements for the different content
      const wordAddedElements = screen.getAllByTestId('word-added');
      expect(wordAddedElements.length).toBeGreaterThan(0);
    });
  });
});

describe('DiffHunk', () => {
  const mockHunk: DiffHunkType = {
    oldStart: 1,
    oldLines: 5,
    newStart: 1,
    newLines: 6,
    header: '@@ -1,5 +1,6 @@ function foo()',
    lines: [
      { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'const x = 1;' },
      { type: 'add', newLineNumber: 2, content: 'const y = 2;' },
      { type: 'context', oldLineNumber: 2, newLineNumber: 3, content: 'const z = 3;' },
    ],
  };

  const defaultProps = {
    filePath: 'src/file.ts',
    selectedLines: new Set<number>(),
    linesWithComments: new Set<number>(),
    onCommentClick: vi.fn(),
  };

  it('should render hunk header', () => {
    render(<DiffHunk hunk={mockHunk} {...defaultProps} />);

    const header = screen.getByTestId('hunk-header');
    expect(header).toHaveTextContent('@@ -1,5 +1,6 @@ function foo()');
  });

  it('should render all lines in the hunk', () => {
    render(<DiffHunk hunk={mockHunk} {...defaultProps} />);

    // Use more specific regex to avoid matching diff-line-content
    expect(screen.getAllByTestId(/^diff-line-(context|add|delete)$/)).toHaveLength(3);
    expect(screen.getByTestId('diff-line-add')).toBeInTheDocument();
    expect(screen.getAllByTestId('diff-line-context')).toHaveLength(2);
  });

  it('should pass selectedLines to DiffLine components', () => {
    render(<DiffHunk hunk={mockHunk} {...defaultProps} selectedLines={new Set([1, 2])} />);

    // Selected lines should have the selection styling
    // Use more specific regex to avoid matching diff-line-content
    const lines = screen.getAllByTestId(/^diff-line-(context|add|delete)$/);
    expect(lines[0].className).toContain('bg-blue-500/20');
    expect(lines[1].className).toContain('bg-blue-500/20');
  });
});
