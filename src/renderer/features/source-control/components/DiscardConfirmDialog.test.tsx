import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiscardConfirmDialog } from './DiscardConfirmDialog';

describe('DiscardConfirmDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders dialog when open is true', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('discard-confirm-dialog')).toBeInTheDocument();
    });

    it('does not render dialog when open is false', () => {
      render(
        <DiscardConfirmDialog
          open={false}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('discard-confirm-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog title with warning icon', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Discard Changes')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
    });

    it('renders confirm button', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Discard');
    });
  });

  describe('file list', () => {
    it('renders list of files to be discarded', () => {
      const files = ['src/file1.ts', 'src/file2.ts', 'src/file3.ts'];
      render(
        <DiscardConfirmDialog
          open={true}
          files={files}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('files-list')).toBeInTheDocument();
      files.forEach((file) => {
        expect(screen.getByText(file)).toBeInTheDocument();
      });
    });

    it('handles empty files array', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={[]}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('files-list')).not.toBeInTheDocument();
    });
  });

  describe('description text', () => {
    it('shows singular text for single file', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/single.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText(/Are you sure you want to discard changes to this file\?/)
      ).toBeInTheDocument();
    });

    it('shows plural text with count for multiple files', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/file1.ts', 'src/file2.ts', 'src/file3.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText(/Are you sure you want to discard changes to these 3 files\?/)
      ).toBeInTheDocument();
    });

    it('shows warning that action cannot be undone', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls onConfirm with false when confirm button is clicked without checkbox', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(false);
    });

    it('calls onConfirm with true when confirm button is clicked with checkbox checked', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByTestId('dont-ask-checkbox'));
      fireEvent.click(screen.getByTestId('confirm-button'));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(true);
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('dont ask again checkbox', () => {
    it('renders the checkbox', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('dont-ask-checkbox')).toBeInTheDocument();
    });

    it('renders the checkbox label', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Don't ask me again")).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('dont-ask-checkbox')).not.toBeChecked();
    });

    it('resets checkbox state when dialog is cancelled', () => {
      const { rerender } = render(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Check the checkbox
      fireEvent.click(screen.getByTestId('dont-ask-checkbox'));
      expect(screen.getByTestId('dont-ask-checkbox')).toBeChecked();

      // Cancel
      fireEvent.click(screen.getByTestId('cancel-button'));

      // Reopen dialog
      rerender(
        <DiscardConfirmDialog
          open={true}
          files={['src/test.ts']}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Checkbox should be reset
      expect(screen.getByTestId('dont-ask-checkbox')).not.toBeChecked();
    });
  });
});
