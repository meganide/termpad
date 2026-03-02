import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlashPopover } from './SlashPopover';

// Mock Radix UI Popover to avoid floating-ui DOM issues
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
  PopoverAnchor: ({ className }: { className?: string }) => (
    <div data-testid="popover-anchor" className={className} />
  ),
}));

describe('SlashPopover', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<SlashPopover open={false} onClose={mockOnClose} />);
      expect(container).toBeInTheDocument();
    });

    it('renders with open=false', () => {
      render(<SlashPopover open={false} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'false');
    });

    it('renders with open=true', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true');
    });

    it('shows slash commands', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('/plan')).toBeInTheDocument();
      expect(screen.getByText('/revert')).toBeInTheDocument();
    });

    it('shows command descriptions', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('Run test suite')).toBeInTheDocument();
      expect(screen.getByText('Create implementation plan')).toBeInTheDocument();
      expect(screen.getByText('Revert last change')).toBeInTheDocument();
    });

    it('renders three command buttons', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });
  });

  describe('command interactions', () => {
    it('calls onClose when /test is clicked', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      fireEvent.click(testButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when /plan is clicked', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const planButton = screen.getByText('/plan').closest('button');
      fireEvent.click(planButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when /revert is clicked', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const revertButton = screen.getByText('/revert').closest('button');
      fireEvent.click(revertButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('command button styling', () => {
    it('command buttons have vertical flex layout', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('flex', 'flex-col', 'items-start');
    });

    it('command buttons have hover styling', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('hover:bg-accent');
    });

    it('command buttons are left-aligned', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('text-left');
    });

    it('command buttons have rounded corners', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('rounded-md');
    });

    it('command buttons have proper padding', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('px-3', 'py-2');
    });

    it('command name has medium font weight', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const commandName = screen.getByText('/test');
      expect(commandName).toHaveClass('font-medium');
    });

    it('description has muted styling', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const description = screen.getByText('Run test suite');
      expect(description).toHaveClass('text-xs', 'text-muted-foreground');
    });
  });

  describe('popover structure', () => {
    it('has popover anchor for positioning', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover-anchor')).toBeInTheDocument();
    });

    it('anchor has positioning classes', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const anchor = screen.getByTestId('popover-anchor');
      expect(anchor).toHaveClass('absolute', 'bottom-full');
    });

    it('has popover content container', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    it('popover content has width class', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const content = screen.getByTestId('popover-content');
      expect(content).toHaveClass('w-64');
    });

    it('popover content has padding class', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const content = screen.getByTestId('popover-content');
      expect(content).toHaveClass('p-1');
    });
  });

  describe('command data', () => {
    it('renders /test with correct description', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testCommand = screen.getByText('/test');
      const description = screen.getByText('Run test suite');
      expect(testCommand).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    it('renders /plan with correct description', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const planCommand = screen.getByText('/plan');
      const description = screen.getByText('Create implementation plan');
      expect(planCommand).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    it('renders /revert with correct description', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const revertCommand = screen.getByText('/revert');
      const description = screen.getByText('Revert last change');
      expect(revertCommand).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles rapid open/close without crashing', () => {
      const { rerender } = render(<SlashPopover open={false} onClose={mockOnClose} />);

      for (let i = 0; i < 10; i++) {
        rerender(<SlashPopover open={i % 2 === 0} onClose={mockOnClose} />);
      }

      expect(screen.getByTestId('popover')).toBeInTheDocument();
    });

    it('handles multiple clicks on same command', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');

      for (let i = 0; i < 5; i++) {
        fireEvent.click(testButton!);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(5);
    });
  });

  describe('accessibility', () => {
    it('command buttons are focusable', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      testButton!.focus();
      expect(document.activeElement).toBe(testButton);
    });

    it('all commands are buttons', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('buttons have text size for readability', () => {
      render(<SlashPopover open={true} onClose={mockOnClose} />);
      const testButton = screen.getByText('/test').closest('button');
      expect(testButton).toHaveClass('text-sm');
    });
  });
});
