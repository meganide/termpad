import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoppedTerminalPanel } from './StoppedTerminalPanel';
import { createMockWorktreeSession } from '../../../../tests/utils';

describe('StoppedTerminalPanel', () => {
  const mockOnStart = vi.fn();

  const defaultSession = createMockWorktreeSession({
    id: 'test-session-1',
    label: 'Test Session',
    path: '/test/project/path',
    branchName: undefined,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders session label', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      expect(screen.getByText('Test Session')).toBeInTheDocument();
    });

    it('renders session path', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      expect(screen.getByText('/test/project/path')).toBeInTheDocument();
    });

    it('renders terminal icon', () => {
      const { container } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );
      const terminalIcon = container.querySelector('svg.lucide-terminal');
      expect(terminalIcon).toBeInTheDocument();
    });

    it('renders start button with play icon', () => {
      const { container } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );
      const startButton = screen.getByRole('button', { name: /start terminal/i });
      expect(startButton).toBeInTheDocument();

      const playIcon = container.querySelector('svg.lucide-play');
      expect(playIcon).toBeInTheDocument();
    });

    it('renders keyboard hint for Enter key', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      expect(screen.getByText('Enter')).toBeInTheDocument();
      expect(screen.getByText(/press/i)).toBeInTheDocument();
      expect(screen.getByText(/to start/i)).toBeInTheDocument();
    });

    it('has correct layout classes for centering', () => {
      const { container } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );
      const mainContainer = container.firstChild;
      expect(mainContainer).toHaveClass(
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'h-full'
      );
    });
  });

  describe('branch name display', () => {
    it('shows branch name when provided', () => {
      const sessionWithBranch = createMockWorktreeSession({
        label: 'Feature Session',
        path: '/test/path',
        branchName: 'feature/new-feature',
      });
      render(<StoppedTerminalPanel session={sessionWithBranch} onStart={mockOnStart} />);
      expect(screen.getByText('Branch: feature/new-feature')).toBeInTheDocument();
    });

    it('does not show branch name when not provided', () => {
      const sessionNoBranch = createMockWorktreeSession({
        label: 'Main Session',
        path: '/test/path',
        branchName: undefined,
      });
      render(<StoppedTerminalPanel session={sessionNoBranch} onStart={mockOnStart} />);
      expect(screen.queryByText(/Branch:/)).not.toBeInTheDocument();
    });

    it('handles empty string branch name', () => {
      const sessionEmptyBranch = createMockWorktreeSession({
        label: 'Session',
        path: '/test/path',
        branchName: '',
      });
      render(<StoppedTerminalPanel session={sessionEmptyBranch} onStart={mockOnStart} />);
      // Empty string is falsy, so branch label should not appear
      expect(screen.queryByText(/Branch:/)).not.toBeInTheDocument();
    });
  });

  describe('start button interaction', () => {
    it('calls onStart when clicking the start button', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const startButton = screen.getByRole('button', { name: /start terminal/i });
      fireEvent.click(startButton);
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it('calls onStart once per click', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const startButton = screen.getByRole('button', { name: /start terminal/i });
      fireEvent.click(startButton);
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard interaction', () => {
    it('calls onStart when pressing Enter key', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it('does not call onStart when pressing Enter with metaKey', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
      expect(mockOnStart).not.toHaveBeenCalled();
    });

    it('does not call onStart when pressing Enter with ctrlKey', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      expect(mockOnStart).not.toHaveBeenCalled();
    });

    it('does not call onStart when pressing Enter with altKey', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      fireEvent.keyDown(window, { key: 'Enter', altKey: true });
      expect(mockOnStart).not.toHaveBeenCalled();
    });

    it('does not call onStart when pressing other keys', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      fireEvent.keyDown(window, { key: 'Space' });
      fireEvent.keyDown(window, { key: 'a' });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockOnStart).not.toHaveBeenCalled();
    });

    it('prevents default on Enter key press', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('event listener cleanup', () => {
    it('removes keydown listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('does not respond to Enter after unmount', () => {
      const { unmount } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );

      unmount();
      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockOnStart).not.toHaveBeenCalled();
    });
  });

  describe('callback reference stability', () => {
    it('updates event listener when onStart changes', () => {
      const onStart1 = vi.fn();
      const onStart2 = vi.fn();

      const { rerender } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={onStart1} />
      );

      // Press Enter with first callback
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onStart1).toHaveBeenCalledTimes(1);
      expect(onStart2).not.toHaveBeenCalled();

      // Re-render with new callback
      rerender(<StoppedTerminalPanel session={defaultSession} onStart={onStart2} />);

      // Press Enter again - should use new callback
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onStart1).toHaveBeenCalledTimes(1);
      expect(onStart2).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling and layout', () => {
    it('applies muted background to terminal icon container', () => {
      const { container } = render(
        <StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />
      );
      const iconContainer = container.querySelector('.rounded-full.bg-muted');
      expect(iconContainer).toBeInTheDocument();
    });

    it('applies monospace font to path display', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const pathElement = screen.getByText('/test/project/path');
      expect(pathElement).toHaveClass('font-mono');
    });

    it('applies truncate class to path for overflow handling', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const pathElement = screen.getByText('/test/project/path');
      expect(pathElement).toHaveClass('truncate');
    });

    it('renders Enter kbd element with proper styling', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const kbdElement = screen.getByText('Enter').closest('kbd');
      expect(kbdElement).toBeInTheDocument();
      expect(kbdElement).toHaveClass('rounded', 'bg-muted', 'font-mono');
    });
  });

  describe('edge cases', () => {
    it('handles very long session label', () => {
      const sessionLongLabel = createMockWorktreeSession({
        label: 'This is a very long session label that might overflow the container',
        path: '/test/path',
      });
      render(<StoppedTerminalPanel session={sessionLongLabel} onStart={mockOnStart} />);
      expect(
        screen.getByText('This is a very long session label that might overflow the container')
      ).toBeInTheDocument();
    });

    it('handles very long path', () => {
      const sessionLongPath = createMockWorktreeSession({
        label: 'Session',
        path: '/very/long/path/to/project/that/might/overflow/the/container/element',
      });
      render(<StoppedTerminalPanel session={sessionLongPath} onStart={mockOnStart} />);
      expect(
        screen.getByText('/very/long/path/to/project/that/might/overflow/the/container/element')
      ).toBeInTheDocument();
    });

    it('handles special characters in label', () => {
      const sessionSpecialChars = createMockWorktreeSession({
        label: 'Session <with> "special" & chars',
        path: '/test/path',
      });
      render(<StoppedTerminalPanel session={sessionSpecialChars} onStart={mockOnStart} />);
      expect(screen.getByText('Session <with> "special" & chars')).toBeInTheDocument();
    });

    it('handles special characters in path', () => {
      const sessionSpecialPath = createMockWorktreeSession({
        label: 'Session',
        path: '/path/with spaces/and-dashes/and_underscores',
      });
      render(<StoppedTerminalPanel session={sessionSpecialPath} onStart={mockOnStart} />);
      expect(screen.getByText('/path/with spaces/and-dashes/and_underscores')).toBeInTheDocument();
    });

    it('handles session with all optional fields populated', () => {
      const fullSession = createMockWorktreeSession({
        id: 'full-session',
        label: 'Full Session',
        path: '/test/path',
        branchName: 'feature/test',
        worktreeName: 'test-worktree',
        isExternal: true,
      });
      render(<StoppedTerminalPanel session={fullSession} onStart={mockOnStart} />);
      expect(screen.getByText('Full Session')).toBeInTheDocument();
      expect(screen.getByText('Branch: feature/test')).toBeInTheDocument();
      expect(screen.getByText('/test/path')).toBeInTheDocument();
    });

    it('handles rapid Enter key presses', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);

      // Simulate rapid key presses
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(window, { key: 'Enter' });
      }

      expect(mockOnStart).toHaveBeenCalledTimes(5);
    });

    it('handles rapid button clicks', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const startButton = screen.getByRole('button', { name: /start terminal/i });

      // Simulate rapid clicks
      for (let i = 0; i < 5; i++) {
        fireEvent.click(startButton);
      }

      expect(mockOnStart).toHaveBeenCalledTimes(5);
    });
  });

  describe('accessibility', () => {
    it('has accessible button with text', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const button = screen.getByRole('button', { name: /start terminal/i });
      expect(button).toBeInTheDocument();
    });

    it('uses semantic heading for session label', () => {
      render(<StoppedTerminalPanel session={defaultSession} onStart={mockOnStart} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Session');
    });
  });
});
