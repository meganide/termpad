import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { CommitSection } from './CommitSection';

describe('CommitSection', () => {
  const mockOnCommit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCommit.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Wait for any pending React updates to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    cleanup();
  });

  describe('rendering', () => {
    it('renders commit section', () => {
      render(<CommitSection stagedFilesCount={1} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-section')).toBeInTheDocument();
    });

    it('renders commit message textarea', () => {
      render(<CommitSection stagedFilesCount={1} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-message-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Commit message')).toBeInTheDocument();
    });

    it('renders commit button', () => {
      render(<CommitSection stagedFilesCount={1} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).toBeInTheDocument();
      expect(screen.getByTestId('commit-button')).toHaveTextContent('Commit');
    });

    it('shows keyboard shortcut hint', () => {
      render(<CommitSection stagedFilesCount={1} onCommit={mockOnCommit} />);

      expect(screen.getByText('Ctrl+Enter')).toBeInTheDocument();
    });

    it('shows file count when staged files exist', () => {
      render(<CommitSection stagedFilesCount={3} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).toHaveTextContent('(3 files)');
    });

    it('shows singular file when only one staged file', () => {
      render(<CommitSection stagedFilesCount={1} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).toHaveTextContent('(1 file)');
    });

    it('does not show file count when no staged files', () => {
      render(<CommitSection stagedFilesCount={0} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).not.toHaveTextContent('file');
    });
  });

  describe('button disabled state', () => {
    it('is disabled when message is empty', () => {
      render(<CommitSection stagedFilesCount={5} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });

    it('is disabled when no staged files', () => {
      render(<CommitSection stagedFilesCount={0} onCommit={mockOnCommit} />);

      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });

    it('is disabled when isLoading is true', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} isLoading />);

      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows "Committing..." when loading', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} isLoading />);

      expect(screen.getByTestId('commit-button')).toHaveTextContent('Committing...');
    });

    it('disables textarea when loading', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} isLoading />);

      expect(screen.getByTestId('commit-message-input')).toBeDisabled();
    });

    it('does not show file count when loading', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} isLoading />);

      expect(screen.getByTestId('commit-button')).not.toHaveTextContent('files');
    });
  });

  describe('textarea interaction', () => {
    it('updates textarea value when typing', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} />);

      const textarea = screen.getByTestId('commit-message-input') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test message' } });

      expect(textarea.value).toBe('Test message');
    });

    it('keeps button disabled when message is only whitespace', () => {
      render(<CommitSection stagedFilesCount={5} onCommit={mockOnCommit} />);

      const textarea = screen.getByTestId('commit-message-input');
      fireEvent.change(textarea, { target: { value: '   ' } });

      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });
  });

  describe('commit operation', () => {
    it('does not call onCommit when button is disabled', () => {
      render(<CommitSection stagedFilesCount={0} onCommit={mockOnCommit} />);

      fireEvent.click(screen.getByTestId('commit-button'));

      expect(mockOnCommit).not.toHaveBeenCalled();
    });
  });

  describe('keyboard shortcut', () => {
    it('does not commit with Ctrl+Enter when no staged files', () => {
      render(<CommitSection stagedFilesCount={0} onCommit={mockOnCommit} />);

      const textarea = screen.getByTestId('commit-message-input');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(mockOnCommit).not.toHaveBeenCalled();
    });

    it('does not commit with Ctrl+Enter when message is empty', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} />);

      const textarea = screen.getByTestId('commit-message-input');
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(mockOnCommit).not.toHaveBeenCalled();
    });

    it('does not commit with regular Enter key', () => {
      render(<CommitSection stagedFilesCount={2} onCommit={mockOnCommit} />);

      const textarea = screen.getByTestId('commit-message-input');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(mockOnCommit).not.toHaveBeenCalled();
    });
  });
});
