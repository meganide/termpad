import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloseWarningDialog } from './CloseWarningDialog';

// Mock the AlertDialog components to avoid Radix UI portal issues
vi.mock('./ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <p data-testid="alert-dialog-description" className={className}>
      {children}
    </p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the Checkbox component
vi.mock('./ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      data-testid="dont-show-checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

describe('CloseWarningDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      render(
        <CloseWarningDialog
          open={false}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('renders dialog content', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-content')).toBeInTheDocument();
    });

    it('renders dialog header', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-header')).toBeInTheDocument();
    });

    it('renders dialog footer', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-footer')).toBeInTheDocument();
    });

    it('renders Keep Open button', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText('Keep Open')).toBeInTheDocument();
    });

    it('renders Close Anyway button', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByText('Close Anyway')).toBeInTheDocument();
    });
  });

  describe('title with singular terminal count', () => {
    it('shows singular "Terminal" for count of 1', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('1 Active Terminal');
      expect(screen.getByTestId('alert-dialog-title').textContent).not.toContain('Terminals');
    });
  });

  describe('title with plural terminal count', () => {
    it('shows plural "Terminals" for count of 2', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={2}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('2 Active Terminals');
    });

    it('shows plural "Terminals" for count of 5', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={5}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('5 Active Terminals');
    });

    it('shows plural "Terminals" for count of 10', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={10}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('10 Active Terminals');
    });
  });

  describe('description text', () => {
    it('shows singular "session" for count of 1', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const description = screen.getByTestId('alert-dialog-description');
      // Should show "1 terminal session" (singular), not "1 terminal sessions"
      expect(description).toHaveTextContent('1 terminal session still running');
    });

    it('shows plural "sessions" for count of 2', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={2}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const description = screen.getByTestId('alert-dialog-description');
      expect(description).toHaveTextContent('2 terminal sessions');
    });

    it('shows plural "sessions" for count of 3', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={3}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const description = screen.getByTestId('alert-dialog-description');
      expect(description).toHaveTextContent('3 terminal sessions');
    });

    it('contains warning about termination', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const description = screen.getByTestId('alert-dialog-description');
      expect(description).toHaveTextContent('terminate all active sessions');
    });

    it('asks for confirmation', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const description = screen.getByTestId('alert-dialog-description');
      expect(description).toHaveTextContent('Are you sure you want to close?');
    });
  });

  describe('button interactions', () => {
    it('calls onCancel when Keep Open is clicked', async () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Keep Open'));
      });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm with false when Close Anyway is clicked without checkbox', async () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Close Anyway'));
      });

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(false);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('calls onConfirm with true when Close Anyway is clicked with checkbox checked', async () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('dont-show-checkbox'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Close Anyway'));
      });

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith(true);
    });
  });

  describe('dont show again checkbox', () => {
    it('renders the checkbox', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('dont-show-checkbox')).toBeInTheDocument();
    });

    it('renders the checkbox label', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Don't show this warning again")).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('dont-show-checkbox')).not.toBeChecked();
    });

    it('resets checkbox state when dialog is cancelled', async () => {
      const { rerender } = render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Check the checkbox
      await act(async () => {
        fireEvent.click(screen.getByTestId('dont-show-checkbox'));
      });
      expect(screen.getByTestId('dont-show-checkbox')).toBeChecked();

      // Cancel
      await act(async () => {
        fireEvent.click(screen.getByText('Keep Open'));
      });

      // Reopen dialog
      rerender(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Checkbox should be reset
      expect(screen.getByTestId('dont-show-checkbox')).not.toBeChecked();
    });
  });

  describe('styling', () => {
    it('Close Anyway button has destructive styling', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      const closeButton = screen.getByTestId('alert-dialog-action');
      expect(closeButton).toHaveClass('bg-destructive');
    });
  });

  describe('edge cases', () => {
    it('handles activeCount of 0', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={0}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('0 Active Terminal');
    });

    it('handles large activeCount', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={100}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('100 Active Terminals');
    });

    it('multiple clicks on Keep Open call handler multiple times', async () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Keep Open'));
        fireEvent.click(screen.getByText('Keep Open'));
        fireEvent.click(screen.getByText('Keep Open'));
      });

      expect(mockOnCancel).toHaveBeenCalledTimes(3);
    });

    it('multiple clicks on Close Anyway call handler multiple times', async () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Close Anyway'));
        fireEvent.click(screen.getByText('Close Anyway'));
      });

      expect(mockOnConfirm).toHaveBeenCalledTimes(2);
      expect(mockOnConfirm).toHaveBeenCalledWith(false);
    });
  });

  describe('dialog open state changes', () => {
    it('shows dialog when open changes to true', () => {
      const { rerender } = render(
        <CloseWarningDialog
          open={false}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();

      rerender(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('hides dialog when open changes to false', () => {
      const { rerender } = render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();

      rerender(
        <CloseWarningDialog
          open={false}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });
  });

  describe('count updates while open', () => {
    it('updates title when activeCount changes', () => {
      const { rerender } = render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('1 Active Terminal');

      rerender(
        <CloseWarningDialog
          open={true}
          activeCount={3}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('3 Active Terminals');
    });

    it('updates description when activeCount changes', () => {
      const { rerender } = render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent(
        '1 terminal session'
      );

      rerender(
        <CloseWarningDialog
          open={true}
          activeCount={5}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent(
        '5 terminal sessions'
      );
    });
  });

  describe('accessibility', () => {
    it('has proper dialog structure', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-description')).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(
        <CloseWarningDialog
          open={true}
          activeCount={1}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Keep Open').tagName).toBe('BUTTON');
      expect(screen.getByText('Close Anyway').tagName).toBe('BUTTON');
    });
  });
});
