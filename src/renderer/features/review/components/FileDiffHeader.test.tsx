import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDiffHeader } from './FileDiffHeader';
import type { DiffFile } from '../../../../shared/reviewTypes';

describe('FileDiffHeader', () => {
  const mockFile: DiffFile = {
    path: 'src/example.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    isBinary: false,
    hunks: [],
  };

  const defaultProps = {
    file: mockFile,
    isExpanded: true,
    isViewed: false,
    onToggleExpand: vi.fn(),
    onMarkViewed: vi.fn(),
  };

  describe('Basic rendering', () => {
    it('should render the header container', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByTestId('file-diff-header')).toBeInTheDocument();
    });

    it('should render the file path', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByText('src/example.ts')).toBeInTheDocument();
    });

    it('should render expand toggle button', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByTestId('expand-toggle')).toBeInTheDocument();
    });

    it('should render addition and deletion counts', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByTestId('additions')).toHaveTextContent('+5');
      expect(screen.getByTestId('deletions')).toHaveTextContent('-2');
    });

    it('should render viewed checkbox', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByTestId('mark-viewed-checkbox')).toBeInTheDocument();
    });
  });

  describe('Expand All button', () => {
    it('should NOT render Expand All button when onExpandAll is not provided', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.queryByTestId('expand-all-button')).not.toBeInTheDocument();
    });

    it('should render Expand All button when onExpandAll is provided', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} onExpandAll={onExpandAll} />);

      expect(screen.getByTestId('expand-all-button')).toBeInTheDocument();
      expect(screen.getByText('Expand All')).toBeInTheDocument();
    });

    it('should call onExpandAll when Expand All button is clicked', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} onExpandAll={onExpandAll} />);

      fireEvent.click(screen.getByTestId('expand-all-button'));

      expect(onExpandAll).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onToggleExpand when Expand All button is clicked', () => {
      const onToggleExpand = vi.fn();
      const onExpandAll = vi.fn();
      render(
        <FileDiffHeader
          {...defaultProps}
          onToggleExpand={onToggleExpand}
          onExpandAll={onExpandAll}
        />
      );

      fireEvent.click(screen.getByTestId('expand-all-button'));

      // onExpandAll should be called, but not onToggleExpand
      expect(onExpandAll).toHaveBeenCalledTimes(1);
      expect(onToggleExpand).not.toHaveBeenCalled();
    });

    it('should disable Expand All button when file is collapsed', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} isExpanded={false} onExpandAll={onExpandAll} />);

      const button = screen.getByTestId('expand-all-button');
      expect(button).toBeDisabled();
    });

    it('should NOT disable Expand All button when file is expanded', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} isExpanded={true} onExpandAll={onExpandAll} />);

      const button = screen.getByTestId('expand-all-button');
      expect(button).not.toBeDisabled();
    });

    it('should NOT call onExpandAll when button is disabled and clicked', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} isExpanded={false} onExpandAll={onExpandAll} />);

      const button = screen.getByTestId('expand-all-button');
      fireEvent.click(button);

      expect(onExpandAll).not.toHaveBeenCalled();
    });

    it('should have tooltip indicating its purpose', () => {
      const onExpandAll = vi.fn();
      render(<FileDiffHeader {...defaultProps} onExpandAll={onExpandAll} />);

      const button = screen.getByTestId('expand-all-button');
      // Button should have tooltip trigger data attribute from shadcn tooltip
      expect(button).toHaveAttribute('data-slot', 'tooltip-trigger');
    });
  });

  describe('File status badges', () => {
    it('should show Modified badge for modified files', () => {
      render(<FileDiffHeader {...defaultProps} />);

      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('should show Added badge for added files', () => {
      const addedFile: DiffFile = { ...mockFile, status: 'added' };
      render(<FileDiffHeader {...defaultProps} file={addedFile} />);

      expect(screen.getByText('Added')).toBeInTheDocument();
    });

    it('should show Deleted badge for deleted files', () => {
      const deletedFile: DiffFile = { ...mockFile, status: 'deleted' };
      render(<FileDiffHeader {...defaultProps} file={deletedFile} />);

      expect(screen.getByText('Deleted')).toBeInTheDocument();
    });

    it('should show Renamed badge for renamed files with old path', () => {
      const renamedFile: DiffFile = {
        ...mockFile,
        status: 'renamed',
        oldPath: 'src/old-example.ts',
      };
      render(<FileDiffHeader {...defaultProps} file={renamedFile} />);

      expect(screen.getByText('Renamed')).toBeInTheDocument();
      expect(screen.getByText('(from src/old-example.ts)')).toBeInTheDocument();
    });
  });

  describe('Expand/collapse state', () => {
    it('should show ChevronDown when expanded', () => {
      render(<FileDiffHeader {...defaultProps} isExpanded={true} />);

      // ChevronDown icon should be visible when expanded
      const expandToggle = screen.getByTestId('expand-toggle');
      expect(expandToggle.querySelector('svg')).toBeInTheDocument();
    });

    it('should show ChevronRight when collapsed', () => {
      render(<FileDiffHeader {...defaultProps} isExpanded={false} />);

      // ChevronRight icon should be visible when collapsed
      const expandToggle = screen.getByTestId('expand-toggle');
      expect(expandToggle.querySelector('svg')).toBeInTheDocument();
    });

    it('should call onToggleExpand when expand toggle is clicked', () => {
      const onToggleExpand = vi.fn();
      render(<FileDiffHeader {...defaultProps} onToggleExpand={onToggleExpand} />);

      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(onToggleExpand).toHaveBeenCalledTimes(1);
    });
  });

  describe('Viewed state', () => {
    it('should show checked checkbox when file is viewed', () => {
      render(<FileDiffHeader {...defaultProps} isViewed={true} />);

      const checkbox = screen.getByTestId('mark-viewed-checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('should show unchecked checkbox when file is not viewed', () => {
      render(<FileDiffHeader {...defaultProps} isViewed={false} />);

      const checkbox = screen.getByTestId('mark-viewed-checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('should call onMarkViewed when checkbox is clicked', () => {
      const onMarkViewed = vi.fn();
      render(<FileDiffHeader {...defaultProps} onMarkViewed={onMarkViewed} />);

      fireEvent.click(screen.getByTestId('mark-viewed-checkbox'));

      expect(onMarkViewed).toHaveBeenCalledTimes(1);
    });
  });
});
