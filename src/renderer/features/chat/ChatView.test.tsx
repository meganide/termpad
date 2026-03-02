import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatView } from './ChatView';

// Mock highlight.js CSS import
vi.mock('highlight.js/styles/github-dark.css', () => ({}));

// Mock react-markdown to avoid complex processing
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock rehype-highlight
vi.mock('rehype-highlight', () => ({
  default: () => (tree: unknown) => tree,
}));

// Mock ScrollArea to simplify testing
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the chat view container', () => {
      const { container } = render(<ChatView />);
      const chatContainer = container.firstChild;
      expect(chatContainer).toHaveClass('flex', 'flex-col', 'h-full', 'bg-background', 'overflow-hidden');
    });

    it('renders ScrollArea component', () => {
      render(<ChatView />);
      expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    });

    it('renders message bubbles for mock messages', () => {
      render(<ChatView />);
      // Check that user messages are rendered
      expect(screen.getByText(/Can you help me set up a new React component/)).toBeInTheDocument();
    });

    it('renders assistant messages', () => {
      render(<ChatView />);
      // Check for assistant content
      expect(screen.getByText(/I'll help you create an authentication component/)).toBeInTheDocument();
    });

    it('renders thought blocks', () => {
      render(<ChatView />);
      // Check for thought labels
      expect(screen.getByText(/Agent is analyzing project structure/)).toBeInTheDocument();
    });

    it('renders ChatInput component', () => {
      render(<ChatView />);
      // ChatInput shows "Message..." placeholder
      expect(screen.getByPlaceholderText('Message...')).toBeInTheDocument();
    });

    it('renders model info from ChatInput', () => {
      render(<ChatView />);
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    });

    it('renders token count from ChatInput', () => {
      render(<ChatView />);
      expect(screen.getByText('1,234 tokens')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('has flex-1 ScrollArea for flexible height', () => {
      render(<ChatView />);
      const scrollArea = screen.getByTestId('scroll-area');
      expect(scrollArea).toHaveClass('flex-1');
    });

    it('messages container has proper spacing', () => {
      const { container } = render(<ChatView />);
      const messagesContainer = container.querySelector('.gap-4.p-4');
      expect(messagesContainer).toBeInTheDocument();
    });
  });

  describe('message types', () => {
    it('displays user messages', () => {
      render(<ChatView />);
      // First user message
      expect(screen.getByText(/Can you help me set up a new React component for user authentication/)).toBeInTheDocument();
    });

    it('displays assistant messages', () => {
      render(<ChatView />);
      // Check for assistant response
      expect(screen.getByText(/Of course! I'll help you create an authentication component/)).toBeInTheDocument();
    });

    it('displays error message state', () => {
      render(<ChatView />);
      // There's an error message in mockMessages
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('displays code content in messages', () => {
      render(<ChatView />);
      // Check for code content (AuthFormProps should appear somewhere)
      const codeElements = screen.getAllByText(/AuthFormProps/);
      expect(codeElements.length).toBeGreaterThan(0);
    });
  });

  describe('thought blocks', () => {
    it('renders analyzing thought block', () => {
      render(<ChatView />);
      expect(screen.getByText(/Agent is analyzing project structure/)).toBeInTheDocument();
    });

    it('renders searching thought block', () => {
      render(<ChatView />);
      expect(screen.getByText(/Agent is searching for validation patterns/)).toBeInTheDocument();
    });

    it('renders checking dependencies thought block', () => {
      render(<ChatView />);
      expect(screen.getByText(/Agent is checking dependencies/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles rendering without errors', () => {
      expect(() => render(<ChatView />)).not.toThrow();
    });

    it('renders all mock messages', () => {
      render(<ChatView />);
      // Verify multiple messages are rendered
      const container = screen.getByTestId('scroll-area');
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('provides scrollable area for messages', () => {
      render(<ChatView />);
      const scrollArea = screen.getByTestId('scroll-area');
      expect(scrollArea).toBeInTheDocument();
    });

    it('chat input is accessible', () => {
      render(<ChatView />);
      const textarea = screen.getByPlaceholderText('Message...');
      expect(textarea).toBeInTheDocument();
    });
  });
});
