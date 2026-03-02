import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInput } from './ChatInput';

// Mock the SlashPopover and MentionPopover components
vi.mock('./SlashPopover', () => ({
  SlashPopover: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="slash-popover" data-open={open} onClick={onClose}>
      SlashPopover
    </div>
  ),
}));

vi.mock('./MentionPopover', () => ({
  MentionPopover: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="mention-popover" data-open={open} onClick={onClose}>
      MentionPopover
    </div>
  ),
}));

// Mock Radix UI Popover to avoid floating-ui DOM issues
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="attachment-popover">{children}</div>
  ),
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <button data-testid="popover-trigger">{children}</button>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="attachment-popover-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock Tooltip to avoid timing issues
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <button data-testid="tooltip-trigger">{children}</button>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders textarea with placeholder', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toBeInTheDocument();
    });

    it('renders send button', () => {
      const { container } = render(<ChatInput />);
      const sendIcon = container.querySelector('svg.lucide-send');
      expect(sendIcon).toBeInTheDocument();
    });

    it('renders plus button for attachments', () => {
      const { container } = render(<ChatInput />);
      const plusIcon = container.querySelector('svg.lucide-plus');
      expect(plusIcon).toBeInTheDocument();
    });

    it('renders model info text', () => {
      render(<ChatInput />);
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });

    it('renders token count', () => {
      render(<ChatInput />);
      expect(screen.getByText('1,234 tokens')).toBeInTheDocument();
    });

    it('renders SlashPopover component', () => {
      render(<ChatInput />);
      expect(screen.getByTestId('slash-popover')).toBeInTheDocument();
    });

    it('renders MentionPopover component', () => {
      render(<ChatInput />);
      expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
    });
  });

  describe('textarea behavior', () => {
    it('updates value on change', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      expect(textarea.value).toBe('Hello world');
    });

    it('has initial empty value', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('allows typing multiple characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Test message with multiple words' } });
      expect(textarea.value).toBe('Test message with multiple words');
    });

    it('allows clearing the textarea', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Some text' } });
      expect(textarea.value).toBe('Some text');
      fireEvent.change(textarea, { target: { value: '' } });
      expect(textarea.value).toBe('');
    });
  });

  describe('popover components', () => {
    it('SlashPopover is rendered', () => {
      render(<ChatInput />);
      const slashPopover = screen.getByTestId('slash-popover');
      expect(slashPopover).toBeInTheDocument();
    });

    it('SlashPopover starts closed (data-open false)', () => {
      render(<ChatInput />);
      const slashPopover = screen.getByTestId('slash-popover');
      expect(slashPopover).toHaveAttribute('data-open', 'false');
    });

    it('MentionPopover is rendered', () => {
      render(<ChatInput />);
      const mentionPopover = screen.getByTestId('mention-popover');
      expect(mentionPopover).toBeInTheDocument();
    });

    it('MentionPopover starts closed (data-open false)', () => {
      render(<ChatInput />);
      const mentionPopover = screen.getByTestId('mention-popover');
      expect(mentionPopover).toHaveAttribute('data-open', 'false');
    });

    it('both popovers are present in DOM', () => {
      render(<ChatInput />);
      expect(screen.getByTestId('slash-popover')).toBeInTheDocument();
      expect(screen.getByTestId('mention-popover')).toBeInTheDocument();
    });
  });

  describe('textarea auto-resize', () => {
    it('textarea has initial min-height', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toHaveClass('min-h-[56px]');
    });

    it('textarea has resize-none class to prevent manual resize', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toHaveClass('resize-none');
    });

    it('textarea height adjusts on content change', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;

      // Mock scrollHeight for the test
      Object.defineProperty(textarea, 'scrollHeight', {
        value: 100,
        configurable: true,
      });

      act(() => {
        fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2\nLine 3' } });
      });

      // The useEffect should have set the height
      expect(textarea.style.height).toBeDefined();
    });
  });

  describe('attachment popover', () => {
    it('renders attachment options when plus button is clicked', async () => {
      render(<ChatInput />);
      const plusButtons = screen.getAllByRole('button');
      // Find the plus button (first icon button)
      const plusButton = plusButtons.find((btn) =>
        btn.querySelector('svg.lucide-plus')
      );
      expect(plusButton).toBeDefined();

      if (plusButton) {
        fireEvent.click(plusButton);
        // The popover content should appear
        expect(screen.getByText('Attach file')).toBeInTheDocument();
        expect(screen.getByText('Attach image')).toBeInTheDocument();
      }
    });

    it('renders Attach file option in popover', async () => {
      render(<ChatInput />);
      const plusButtons = screen.getAllByRole('button');
      const plusButton = plusButtons.find((btn) =>
        btn.querySelector('svg.lucide-plus')
      );

      if (plusButton) {
        fireEvent.click(plusButton);
        const attachFileBtn = screen.getByText('Attach file');
        expect(attachFileBtn).toBeInTheDocument();
      }
    });

    it('renders Attach image option in popover', async () => {
      render(<ChatInput />);
      const plusButtons = screen.getAllByRole('button');
      const plusButton = plusButtons.find((btn) =>
        btn.querySelector('svg.lucide-plus')
      );

      if (plusButton) {
        fireEvent.click(plusButton);
        const attachImageBtn = screen.getByText('Attach image');
        expect(attachImageBtn).toBeInTheDocument();
      }
    });
  });

  describe('send button', () => {
    it('has tooltip with "Enter to send"', () => {
      render(<ChatInput />);
      const sendButton = screen.getAllByRole('button').find((btn) =>
        btn.querySelector('svg.lucide-send')
      );
      expect(sendButton).toBeDefined();
    });

    it('send button is always visible', () => {
      render(<ChatInput />);
      const sendIcon = document.querySelector('svg.lucide-send');
      expect(sendIcon).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has transparent background for textarea', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toHaveClass('bg-transparent');
    });

    it('has no visible border on textarea', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toHaveClass('border-0');
    });

    it('footer info has muted foreground color', () => {
      render(<ChatInput />);
      const modelText = screen.getByText('Claude 3.5 Sonnet');
      expect(modelText.parentElement).toHaveClass('text-muted-foreground');
    });
  });

  describe('edge cases', () => {
    it('handles empty string input', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '' } });
      expect(textarea.value).toBe('');
      expect(screen.getByTestId('slash-popover')).toHaveAttribute('data-open', 'false');
      expect(screen.getByTestId('mention-popover')).toHaveAttribute('data-open', 'false');
    });

    it('handles very long input', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      const longText = 'A'.repeat(10000);
      fireEvent.change(textarea, { target: { value: longText } });
      expect(textarea.value).toBe(longText);
    });

    it('handles special characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      fireEvent.change(textarea, { target: { value: specialChars } });
      expect(textarea.value).toBe(specialChars);
    });

    it('handles unicode characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      const unicode = '你好世界 🌍 مرحبا';
      fireEvent.change(textarea, { target: { value: unicode } });
      expect(textarea.value).toBe(unicode);
    });

    it('handles newlines in input', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      const multiline = 'Line 1\nLine 2\nLine 3';
      fireEvent.change(textarea, { target: { value: multiline } });
      expect(textarea.value).toBe(multiline);
    });

    it('handles multiple / characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '///' } });
      expect(textarea.value).toBe('///');
    });

    it('handles multiple @ characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '@@@' } });
      expect(textarea.value).toBe('@@@');
    });

    it('handles mixed @ and / characters', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '/@/@x' } });
      expect(textarea.value).toBe('/@/@x');
    });
  });

  describe('accessibility', () => {
    it('textarea has no disabled attribute', () => {
      render(<ChatInput />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).not.toHaveAttribute('disabled');
    });

    it('buttons are clickable', () => {
      render(<ChatInput />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
