import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';

// Mock rehype-highlight to avoid CSS processing issues
vi.mock('rehype-highlight', () => ({
  default: () => (tree: unknown) => tree,
}));

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('user messages', () => {
    const userMessage: Message = {
      type: 'message',
      role: 'user',
      content: 'Hello, assistant!',
    };

    it('renders user message content', () => {
      render(<MessageBubble message={userMessage} />);
      expect(screen.getByText('Hello, assistant!')).toBeInTheDocument();
    });

    it('aligns user message to the right', () => {
      const { container } = render(<MessageBubble message={userMessage} />);
      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('justify-end');
    });

    it('applies accent background for user messages', () => {
      const { container } = render(<MessageBubble message={userMessage} />);
      const bubble = container.querySelector('.bg-accent');
      expect(bubble).toBeInTheDocument();
    });

    it('renders user message as plain paragraph', () => {
      render(<MessageBubble message={userMessage} />);
      const paragraph = screen.getByText('Hello, assistant!');
      expect(paragraph.tagName).toBe('P');
    });

    it('does not render markdown for user messages', () => {
      const userWithMarkdown: Message = {
        type: 'message',
        role: 'user',
        content: '**bold** and *italic*',
      };
      render(<MessageBubble message={userWithMarkdown} />);
      // Should render as plain text, not as markdown
      expect(screen.getByText('**bold** and *italic*')).toBeInTheDocument();
    });
  });

  describe('assistant messages', () => {
    const assistantMessage: Message = {
      type: 'message',
      role: 'assistant',
      content: 'Hello! How can I help you?',
    };

    it('renders assistant message content', () => {
      render(<MessageBubble message={assistantMessage} />);
      expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
    });

    it('aligns assistant message to the left', () => {
      const { container } = render(<MessageBubble message={assistantMessage} />);
      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('justify-start');
    });

    it('applies transparent background for assistant messages', () => {
      const { container } = render(<MessageBubble message={assistantMessage} />);
      const bubble = container.querySelector('.rounded-xl.p-4');
      expect(bubble).toHaveClass('bg-transparent');
    });

    it('renders assistant message with prose styling', () => {
      const { container } = render(<MessageBubble message={assistantMessage} />);
      const proseContainer = container.querySelector('.prose');
      expect(proseContainer).toBeInTheDocument();
      expect(proseContainer).toHaveClass('prose-sm', 'dark:prose-invert');
    });

    it('renders markdown content in assistant messages', () => {
      const assistantWithMarkdown: Message = {
        type: 'message',
        role: 'assistant',
        content: 'This is **bold** text',
      };
      render(<MessageBubble message={assistantWithMarkdown} />);
      // ReactMarkdown should process this
      const boldText = screen.getByText('bold');
      expect(boldText.tagName).toBe('STRONG');
    });

    it('renders code blocks in assistant messages', () => {
      const assistantWithCode: Message = {
        type: 'message',
        role: 'assistant',
        content: '```javascript\nconsole.log("hello");\n```',
      };
      render(<MessageBubble message={assistantWithCode} />);
      const codeElement = screen.getByText('console.log("hello");');
      expect(codeElement).toBeInTheDocument();
    });

    it('renders inline code in assistant messages', () => {
      const assistantWithInlineCode: Message = {
        type: 'message',
        role: 'assistant',
        content: 'Use the `npm install` command',
      };
      render(<MessageBubble message={assistantWithInlineCode} />);
      const codeElement = screen.getByText('npm install');
      expect(codeElement.tagName).toBe('CODE');
    });

    it('renders links in assistant messages', () => {
      const assistantWithLink: Message = {
        type: 'message',
        role: 'assistant',
        content: 'Check out [this link](https://example.com)',
      };
      render(<MessageBubble message={assistantWithLink} />);
      const link = screen.getByRole('link', { name: 'this link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders lists in assistant messages', () => {
      const assistantWithList: Message = {
        type: 'message',
        role: 'assistant',
        content: '- Item 1\n- Item 2\n- Item 3',
      };
      render(<MessageBubble message={assistantWithList} />);
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders headings in assistant messages', () => {
      const assistantWithHeading: Message = {
        type: 'message',
        role: 'assistant',
        content: '## Section Title',
      };
      render(<MessageBubble message={assistantWithHeading} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Section Title');
    });
  });

  describe('error messages', () => {
    const errorMessage: Message = {
      type: 'message',
      role: 'assistant',
      content: '',
      isError: true,
    };

    it('renders error state when isError is true', () => {
      render(<MessageBubble message={errorMessage} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders error icon for errors', () => {
      const { container } = render(<MessageBubble message={errorMessage} />);
      // Lucide icons render as SVG elements within the error container
      const errorContainer = container.querySelector('.text-destructive');
      const svgIcon = errorContainer?.querySelector('svg');
      expect(svgIcon).toBeInTheDocument();
    });

    it('applies destructive styling for errors', () => {
      const { container } = render(<MessageBubble message={errorMessage} />);
      const errorContainer = container.querySelector('.text-destructive');
      expect(errorContainer).toBeInTheDocument();
    });

    it('applies destructive background for error bubble', () => {
      const { container } = render(<MessageBubble message={errorMessage} />);
      const bubble = container.querySelector('.bg-destructive\\/10');
      expect(bubble).toBeInTheDocument();
    });

    it('does not render content when error', () => {
      const errorWithContent: Message = {
        type: 'message',
        role: 'assistant',
        content: 'This should not appear',
        isError: true,
      };
      render(<MessageBubble message={errorWithContent} />);
      expect(screen.queryByText('This should not appear')).not.toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('error message aligns to the left like assistant messages', () => {
      const { container } = render(<MessageBubble message={errorMessage} />);
      const outerDiv = container.firstChild;
      expect(outerDiv).toHaveClass('justify-start');
    });
  });

  describe('styling', () => {
    it('bubble has max-width constraint', () => {
      const message: Message = {
        type: 'message',
        role: 'user',
        content: 'Test',
      };
      const { container } = render(<MessageBubble message={message} />);
      const bubble = container.querySelector('.max-w-\\[85\\%\\]');
      expect(bubble).toBeInTheDocument();
    });

    it('bubble has rounded corners', () => {
      const message: Message = {
        type: 'message',
        role: 'user',
        content: 'Test',
      };
      const { container } = render(<MessageBubble message={message} />);
      const bubble = container.querySelector('.rounded-xl');
      expect(bubble).toBeInTheDocument();
    });

    it('bubble has padding', () => {
      const message: Message = {
        type: 'message',
        role: 'user',
        content: 'Test',
      };
      const { container } = render(<MessageBubble message={message} />);
      const bubble = container.querySelector('.p-4');
      expect(bubble).toBeInTheDocument();
    });

    it('text has relaxed leading', () => {
      const message: Message = {
        type: 'message',
        role: 'user',
        content: 'Test',
      };
      const { container } = render(<MessageBubble message={message} />);
      const bubble = container.querySelector('.leading-relaxed');
      expect(bubble).toBeInTheDocument();
    });

    it('text has small size', () => {
      const message: Message = {
        type: 'message',
        role: 'user',
        content: 'Test',
      };
      const { container } = render(<MessageBubble message={message} />);
      const bubble = container.querySelector('.text-sm');
      expect(bubble).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty content for user message', () => {
      const emptyMessage: Message = {
        type: 'message',
        role: 'user',
        content: '',
      };
      const { container } = render(<MessageBubble message={emptyMessage} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles empty content for assistant message', () => {
      const emptyMessage: Message = {
        type: 'message',
        role: 'assistant',
        content: '',
      };
      const { container } = render(<MessageBubble message={emptyMessage} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longMessage: Message = {
        type: 'message',
        role: 'user',
        content: 'A'.repeat(5000),
      };
      render(<MessageBubble message={longMessage} />);
      expect(screen.getByText('A'.repeat(5000))).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialMessage: Message = {
        type: 'message',
        role: 'user',
        content: '<script>alert("xss")</script>',
      };
      render(<MessageBubble message={specialMessage} />);
      // Should be escaped, not executed
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    });

    it('handles unicode in content', () => {
      const unicodeMessage: Message = {
        type: 'message',
        role: 'user',
        content: '你好世界 🌍 مرحبا',
      };
      render(<MessageBubble message={unicodeMessage} />);
      expect(screen.getByText('你好世界 🌍 مرحبا')).toBeInTheDocument();
    });

    it('handles newlines in user message', () => {
      const multilineMessage: Message = {
        type: 'message',
        role: 'user',
        content: 'Line 1\nLine 2\nLine 3',
      };
      render(<MessageBubble message={multilineMessage} />);
      expect(screen.getByText('Line 1 Line 2 Line 3')).toBeInTheDocument();
    });

    it('handles complex markdown in assistant message', () => {
      const complexMarkdown: Message = {
        type: 'message',
        role: 'assistant',
        content: `# Title

**Bold** and *italic* with \`code\`

- List item 1
- List item 2

> Blockquote text`,
      };
      render(<MessageBubble message={complexMarkdown} />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
      expect(screen.getByText('Bold')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
    });

    it('handles isError false explicitly', () => {
      const message: Message = {
        type: 'message',
        role: 'assistant',
        content: 'Normal message',
        isError: false,
      };
      render(<MessageBubble message={message} />);
      expect(screen.getByText('Normal message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('handles isError undefined', () => {
      const message: Message = {
        type: 'message',
        role: 'assistant',
        content: 'Normal message',
      };
      render(<MessageBubble message={message} />);
      expect(screen.getByText('Normal message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('renders content in semantic structure', () => {
      const message: Message = {
        type: 'message',
        role: 'assistant',
        content: '## Heading\n\nParagraph text',
      };
      render(<MessageBubble message={message} />);
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('error message has icon and text together', () => {
      const errorMessage: Message = {
        type: 'message',
        role: 'assistant',
        content: '',
        isError: true,
      };
      const { container } = render(<MessageBubble message={errorMessage} />);
      const errorContainer = container.querySelector('.flex.items-center.gap-2');
      expect(errorContainer).toBeInTheDocument();
      expect(errorContainer).toHaveClass('text-destructive');
    });
  });
});
