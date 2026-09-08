import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanelTabs } from './RightPanelTabs';

describe('RightPanelTabs', () => {
  it('renders every tab', () => {
    render(<RightPanelTabs active="changes" onChange={vi.fn()} />);

    expect(screen.getByTestId('right-panel-tab-changes')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-notes')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-todos')).toBeInTheDocument();
  });

  it('marks the active tab as selected', () => {
    render(<RightPanelTabs active="notes" onChange={vi.fn()} />);

    expect(screen.getByTestId('right-panel-tab-notes')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('right-panel-tab-changes')).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the clicked tab', () => {
    const onChange = vi.fn();
    render(<RightPanelTabs active="changes" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('right-panel-tab-notes'));

    expect(onChange).toHaveBeenCalledWith('notes');
  });
});
