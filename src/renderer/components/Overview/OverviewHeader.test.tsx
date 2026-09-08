import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OverviewHeader } from './OverviewHeader';

describe('OverviewHeader', () => {
  it('shows the agent count', () => {
    render(<OverviewHeader agentCount={3} onClose={vi.fn()} />);
    expect(screen.getByText('Agent overview')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<OverviewHeader agentCount={1} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close overview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
