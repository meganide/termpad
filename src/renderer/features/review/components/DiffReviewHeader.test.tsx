import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffReviewHeader } from './DiffReviewHeader';

// Mock the ReviewToolbar component since it uses zustand store
vi.mock('./ReviewToolbar', () => ({
  ReviewToolbar: () => <div data-testid="review-toolbar">Mocked ReviewToolbar</div>,
}));

describe('DiffReviewHeader', () => {
  const defaultProps = {
    baseBranch: 'main',
    compareBranch: 'feature',
    viewMode: 'unified' as const,
    onViewModeChange: vi.fn(),
    onClose: vi.fn(),
  };

  it('should render branch names', () => {
    render(<DiffReviewHeader {...defaultProps} />);

    expect(screen.getByTestId('base-branch')).toHaveTextContent('main');
    expect(screen.getByTestId('compare-branch')).toHaveTextContent('feature');
  });

  it('should render view mode toggle', () => {
    render(<DiffReviewHeader {...defaultProps} />);

    expect(screen.getByTestId('unified-mode-button')).toBeInTheDocument();
    expect(screen.getByTestId('split-mode-button')).toBeInTheDocument();
  });

  it('should call onViewModeChange when toggling view mode', () => {
    const onViewModeChange = vi.fn();
    render(<DiffReviewHeader {...defaultProps} onViewModeChange={onViewModeChange} />);

    fireEvent.click(screen.getByTestId('split-mode-button'));

    expect(onViewModeChange).toHaveBeenCalledWith('split');
  });

  it('should call onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<DiffReviewHeader {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('close-button'));

    expect(onClose).toHaveBeenCalled();
  });

  it('should render the ReviewToolbar', () => {
    render(<DiffReviewHeader {...defaultProps} />);

    expect(screen.getByTestId('review-toolbar')).toBeInTheDocument();
  });
});
