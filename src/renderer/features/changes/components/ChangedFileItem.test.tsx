import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChangedFileItem } from './ChangedFileItem';
import type { DiffFile } from '../../../../shared/reviewTypes';

const createMockDiffFile = (
  path: string,
  additions = 10,
  deletions = 5,
  isBinary = false
): DiffFile => ({
  path,
  status: 'modified',
  additions,
  deletions,
  isBinary,
  hunks: [],
});

describe('ChangedFileItem', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders file path in monospace with directory and filename separated', () => {
      const file = createMockDiffFile('src/components/Button.tsx');
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      // Now directory and filename are separate elements with "/" shown separately
      expect(screen.getByText('src/components')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      // The container should have font-mono class
      expect(screen.getByText('Button.tsx').parentElement).toHaveClass('font-mono');
    });

    it('renders additions in green', () => {
      const file = createMockDiffFile('test.ts', 15, 0);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      const additions = screen.getByTestId('additions');
      expect(additions).toHaveTextContent('+15');
      expect(additions).toHaveClass('text-green-500');
    });

    it('renders deletions in red', () => {
      const file = createMockDiffFile('test.ts', 0, 8);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      const deletions = screen.getByTestId('deletions');
      expect(deletions).toHaveTextContent('-8');
      expect(deletions).toHaveClass('text-red-500');
    });

    it('renders both additions and deletions', () => {
      const file = createMockDiffFile('test.ts', 10, 5);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.getByTestId('additions')).toHaveTextContent('+10');
      expect(screen.getByTestId('deletions')).toHaveTextContent('-5');
    });

    it('does not render additions when zero', () => {
      const file = createMockDiffFile('test.ts', 0, 5);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.queryByTestId('additions')).not.toBeInTheDocument();
      expect(screen.getByTestId('deletions')).toBeInTheDocument();
    });

    it('does not render deletions when zero', () => {
      const file = createMockDiffFile('test.ts', 10, 0);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.getByTestId('additions')).toBeInTheDocument();
      expect(screen.queryByTestId('deletions')).not.toBeInTheDocument();
    });

    it('renders binary indicator for binary files', () => {
      const file = createMockDiffFile('image.png', 0, 0, true);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      const binaryIndicator = screen.getByTestId('binary-indicator');
      expect(binaryIndicator).toHaveTextContent('binary');
    });

    it('does not render binary indicator for text files', () => {
      const file = createMockDiffFile('test.ts', 10, 5, false);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.queryByTestId('binary-indicator')).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('calls onClick when clicked', () => {
      const file = createMockDiffFile('test.ts');
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      fireEvent.click(screen.getByTestId('changed-file-item'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('is a button element for accessibility', () => {
      const file = createMockDiffFile('test.ts');
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles long file paths with truncation on directory only', () => {
      const longPath =
        'src/components/deeply/nested/folder/structure/with/many/levels/Component.tsx';
      const file = createMockDiffFile(longPath);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      // Directory path should have truncate class, filename should not
      const dirPath = screen.getByText(
        'src/components/deeply/nested/folder/structure/with/many/levels'
      );
      const fileName = screen.getByText('Component.tsx');
      expect(dirPath).toHaveClass('truncate');
      expect(fileName).not.toHaveClass('truncate');
    });

    it('handles file with no changes (0 additions, 0 deletions)', () => {
      const file = createMockDiffFile('test.ts', 0, 0);
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      expect(screen.queryByTestId('additions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('deletions')).not.toBeInTheDocument();
    });

    it('handles special characters in file path', () => {
      const file = createMockDiffFile('src/[components]/file-name_with.special.chars.tsx');
      render(<ChangedFileItem file={file} onClick={mockOnClick} />);

      // Directory and filename are now separate with "/" shown separately
      expect(screen.getByText('src/[components]')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
      expect(screen.getByText('file-name_with.special.chars.tsx')).toBeInTheDocument();
    });
  });
});
