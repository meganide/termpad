import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTile } from './AgentTile';

describe('AgentTile', () => {
  const defaultProps = {
    terminalId: 'session-1:tab-1',
    isOverview: false,
    isVisible: true,
    isActive: false,
    repositoryName: 'termpad',
    worktreeLabel: 'feat-login',
    tabName: 'claude',
    status: 'running' as const,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders its terminal child in normal mode', () => {
    render(
      <AgentTile {...defaultProps}>
        <div data-testid="terminal" />
      </AgentTile>
    );
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
  });

  it('shows no card chrome in normal mode', () => {
    render(
      <AgentTile {...defaultProps}>
        <div />
      </AgentTile>
    );
    expect(screen.queryByText('termpad')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides the tile when not visible', () => {
    render(
      <AgentTile {...defaultProps} isVisible={false}>
        <div />
      </AgentTile>
    );
    expect(screen.getByTestId('agent-tile-session-1:tab-1')).toHaveStyle({ display: 'none' });
  });

  it('shows repository, worktree and tab labels in overview mode', () => {
    render(
      <AgentTile {...defaultProps} isOverview>
        <div />
      </AgentTile>
    );
    expect(screen.getByText('termpad')).toBeInTheDocument();
    expect(screen.getByText('feat-login')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
  });

  it('calls onSelect when the tile is clicked in overview mode', () => {
    const onSelect = vi.fn();
    render(
      <AgentTile {...defaultProps} isOverview onSelect={onSelect}>
        <div />
      </AgentTile>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open claude in termpad \/ feat-login/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not let the click reach the surrounding content area', () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <AgentTile {...defaultProps} isOverview>
          <div />
        </AgentTile>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open claude in termpad/ }));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('includes the status in the accessible name', () => {
    render(
      <AgentTile {...defaultProps} isOverview status="waiting">
        <div />
      </AgentTile>
    );
    expect(screen.getByRole('button', { name: /Waiting/ })).toBeInTheDocument();
  });

  it('highlights the active agent', () => {
    render(
      <AgentTile {...defaultProps} isOverview isActive>
        <div />
      </AgentTile>
    );
    expect(screen.getByTestId('agent-tile-session-1:tab-1').className).toContain('ring-lime-500');
  });
});
