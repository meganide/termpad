import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanelTabs } from './RightPanelTabs';

describe('RightPanelTabs', () => {
  it('renders every tab', () => {
    render(<RightPanelTabs active="changes" onChange={vi.fn()} />);

    expect(screen.getByTestId('right-panel-tab-changes')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-review')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-browser')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-terminals')).toBeInTheDocument();
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

  it('shows file and terminal counts and the selected todo scope', async () => {
    render(
      <RightPanelTabs
        active="changes"
        onChange={vi.fn()}
        counts={{
          changes: 2,
          review: 5,
          reviewBase: 'main',
          terminals: 3,
          scope: 'worktree',
          todos: { completed: 2, total: 4 },
          notes: true,
        }}
      />
    );
    expect(screen.getByRole('tab', { name: 'Changes (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Review (5)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Terminals (3)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Todos (2/4)' })).toBeInTheDocument();
    expect(screen.getByTestId('notes-presence-indicator')).toBeInTheDocument();
    fireEvent.focus(screen.getByTestId('right-panel-tab-todos'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Worktree: 2/4 completed');
  });

  it('indicates notes only for the displayed scope', () => {
    const { rerender } = render(
      <RightPanelTabs
        active="notes"
        onChange={vi.fn()}
        counts={{ scope: 'worktree', notes: true }}
      />
    );
    expect(screen.getByTestId('notes-presence-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-tab-notes')).toHaveAccessibleName(
      'Notes — Worktree: has notes'
    );
    rerender(
      <RightPanelTabs
        active="notes"
        onChange={vi.fn()}
        counts={{ scope: 'global', notes: false }}
      />
    );
    expect(screen.queryByTestId('notes-presence-indicator')).not.toBeInTheDocument();
  });
});
