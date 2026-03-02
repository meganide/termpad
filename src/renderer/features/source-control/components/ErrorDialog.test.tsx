import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorDialog } from './ErrorDialog';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ErrorDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    errorContent: ['Error line 1', 'Error line 2', 'Error line 3'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('should render when open is true', () => {
    render(<ErrorDialog {...defaultProps} />);
    expect(screen.getByTestId('error-dialog')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<ErrorDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('error-dialog')).not.toBeInTheDocument();
  });

  it('should display custom title', () => {
    render(<ErrorDialog {...defaultProps} title="Custom Error Title" />);
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
  });

  it('should display default title', () => {
    render(<ErrorDialog {...defaultProps} />);
    expect(screen.getByText('Commit Failed')).toBeInTheDocument();
  });

  it('should display error content', () => {
    render(<ErrorDialog {...defaultProps} />);
    expect(screen.getByText(/Error line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Error line 2/)).toBeInTheDocument();
  });

  it('should display fallback message when error content is empty', () => {
    render(<ErrorDialog {...defaultProps} errorContent={[]} />);
    expect(screen.getByText('No error details available')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ErrorDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should copy error content to clipboard when copy button is clicked', async () => {
    const { container } = render(<ErrorDialog {...defaultProps} />);

    fireEvent.click(screen.getByTestId('copy-button'));

    await waitFor(
      () => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'Error line 1\nError line 2\nError line 3'
        );
      },
      { container }
    );

    expect(toast.success).toHaveBeenCalledWith('Error copied to clipboard');
  });

  it('should show error toast when clipboard fails', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
      },
    });

    const { container } = render(<ErrorDialog {...defaultProps} />);

    fireEvent.click(screen.getByTestId('copy-button'));

    await waitFor(
      () => {
        expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard');
      },
      { container }
    );
  });

  it('should have description text', () => {
    render(<ErrorDialog {...defaultProps} />);
    expect(
      screen.getByText('The operation failed. See the full error output below.')
    ).toBeInTheDocument();
  });

  it('should display custom description', () => {
    render(<ErrorDialog {...defaultProps} description="Custom description text" />);
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('should show post-hook failure style when isPostHookFailure is true', () => {
    render(
      <ErrorDialog
        {...defaultProps}
        title="Post-commit Hook Failed"
        description="The commit succeeded, but the post-commit hook failed."
        isPostHookFailure={true}
      />
    );
    expect(screen.getByText('Post-commit Hook Failed')).toBeInTheDocument();
    expect(
      screen.getByText('The commit succeeded, but the post-commit hook failed.')
    ).toBeInTheDocument();
  });
});
