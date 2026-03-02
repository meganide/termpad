import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MentionPopover } from './MentionPopover';

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

describe('MentionPopover', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<MentionPopover open={false} onClose={mockOnClose} />);
      expect(container).toBeInTheDocument();
    });

    it('renders with open=false', () => {
      render(<MentionPopover open={false} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'false');
    });

    it('renders with open=true', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover')).toHaveAttribute('data-open', 'true');
    });

    it('shows agent mentions', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@agent-1')).toBeInTheDocument();
      expect(screen.getByText('@agent-2')).toBeInTheDocument();
    });

    it('shows file mentions', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@main.ts')).toBeInTheDocument();
      expect(screen.getByText('@utils.ts')).toBeInTheDocument();
    });

    it('renders four mention buttons', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });
  });

  describe('mention icons', () => {
    it('agent mentions have Bot icon', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      // Find SVGs that are icons for agents (first two buttons)
      const buttons = container.querySelectorAll('button');
      const agent1Icon = buttons[0]?.querySelector('svg');
      const agent2Icon = buttons[1]?.querySelector('svg');
      expect(agent1Icon).toBeInTheDocument();
      expect(agent2Icon).toBeInTheDocument();
    });

    it('file mentions have FileCode icon', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      // Find SVGs that are icons for files (last two buttons)
      const buttons = container.querySelectorAll('button');
      const file1Icon = buttons[2]?.querySelector('svg');
      const file2Icon = buttons[3]?.querySelector('svg');
      expect(file1Icon).toBeInTheDocument();
      expect(file2Icon).toBeInTheDocument();
    });

    it('icons have muted foreground styling', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      const icons = container.querySelectorAll('button svg');
      icons.forEach((icon) => {
        expect(icon).toHaveClass('text-muted-foreground');
      });
    });

    it('icons have correct size classes', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      const icons = container.querySelectorAll('button svg');
      icons.forEach((icon) => {
        expect(icon).toHaveClass('h-4', 'w-4');
      });
    });
  });

  describe('mention interactions', () => {
    it('calls onClose when @agent-1 is clicked', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      fireEvent.click(agentButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when @agent-2 is clicked', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-2').closest('button');
      fireEvent.click(agentButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when @main.ts is clicked', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const fileButton = screen.getByText('@main.ts').closest('button');
      fireEvent.click(fileButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when @utils.ts is clicked', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const fileButton = screen.getByText('@utils.ts').closest('button');
      fireEvent.click(fileButton!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('mention button styling', () => {
    it('mention buttons have horizontal flex layout', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('mention buttons have hover styling', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('hover:bg-accent');
    });

    it('mention buttons are left-aligned', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('text-left');
    });

    it('mention buttons have rounded corners', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('rounded-md');
    });

    it('mention buttons have proper padding', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('px-3', 'py-2');
    });

    it('mention buttons have small text', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      expect(agentButton).toHaveClass('text-sm');
    });
  });

  describe('popover structure', () => {
    it('has popover anchor for positioning', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover-anchor')).toBeInTheDocument();
    });

    it('anchor has positioning classes', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const anchor = screen.getByTestId('popover-anchor');
      expect(anchor).toHaveClass('absolute', 'bottom-full');
    });

    it('has popover content container', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    it('popover content has width class', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const content = screen.getByTestId('popover-content');
      expect(content).toHaveClass('w-56');
    });

    it('popover content has padding class', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const content = screen.getByTestId('popover-content');
      expect(content).toHaveClass('p-1');
    });

    it('content has grid layout', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      const gridContainer = container.querySelector('.grid.gap-1');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('mention data', () => {
    it('renders @agent-1 mention', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@agent-1')).toBeInTheDocument();
    });

    it('renders @agent-2 mention', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@agent-2')).toBeInTheDocument();
    });

    it('renders @main.ts mention', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@main.ts')).toBeInTheDocument();
    });

    it('renders @utils.ts mention', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      expect(screen.getByText('@utils.ts')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles rapid open/close without crashing', () => {
      const { rerender } = render(<MentionPopover open={false} onClose={mockOnClose} />);

      for (let i = 0; i < 10; i++) {
        rerender(<MentionPopover open={i % 2 === 0} onClose={mockOnClose} />);
      }

      expect(screen.getByTestId('popover')).toBeInTheDocument();
    });

    it('handles multiple clicks on same mention', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');

      for (let i = 0; i < 5; i++) {
        fireEvent.click(agentButton!);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(5);
    });
  });

  describe('accessibility', () => {
    it('mention buttons are focusable', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const agentButton = screen.getByText('@agent-1').closest('button');
      agentButton!.focus();
      expect(document.activeElement).toBe(agentButton);
    });

    it('all mentions are buttons', () => {
      render(<MentionPopover open={true} onClose={mockOnClose} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('icons are presentational', () => {
      const { container } = render(<MentionPopover open={true} onClose={mockOnClose} />);
      const icons = container.querySelectorAll('svg');
      icons.forEach((icon) => {
        // Icons don't have role="img" - they're decorative
        expect(icon.getAttribute('role')).not.toBe('img');
      });
    });
  });
});
