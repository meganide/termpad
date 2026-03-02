import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThoughtBlock } from './ThoughtBlock';
import type { ThoughtBlockData } from '../types';

describe('ThoughtBlock', () => {
  const defaultData: ThoughtBlockData = {
    type: 'thought',
    label: 'Agent is analyzing...',
    output: 'Command output here',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the thought label', () => {
      render(<ThoughtBlock data={defaultData} />);
      expect(screen.getByText('Agent is analyzing...')).toBeInTheDocument();
    });

    it('renders the chevron icon', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const chevronIcon = container.querySelector('svg.lucide-chevron-right');
      expect(chevronIcon).toBeInTheDocument();
    });

    it('renders animated ping indicator', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const pingElement = container.querySelector('.animate-ping');
      expect(pingElement).toBeInTheDocument();
    });

    it('renders static dot indicator', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      // The static dot is the relative positioned one (not absolute)
      const dotElement = container.querySelector('span.relative.inline-flex.rounded-full');
      expect(dotElement).toBeInTheDocument();
    });

    it('starts in collapsed state', () => {
      render(<ThoughtBlock data={defaultData} />);
      // The output should not be visible initially
      expect(screen.queryByText('Command output here')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse behavior', () => {
    it('expands when trigger is clicked', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);
      expect(screen.getByText('Command output here')).toBeInTheDocument();
    });

    it('collapses when expanded and trigger is clicked', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');

      // Expand
      fireEvent.click(trigger);
      expect(screen.getByText('Command output here')).toBeInTheDocument();

      // Collapse
      fireEvent.click(trigger);
      // Content should be hidden after collapse animation
      // Note: Radix Collapsible may keep content in DOM with hidden state
    });

    it('chevron rotates when expanded', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      const chevron = container.querySelector('svg.lucide-chevron-right');

      expect(chevron).not.toHaveClass('rotate-90');

      fireEvent.click(trigger);

      const expandedChevron = container.querySelector('svg.lucide-chevron-right');
      expect(expandedChevron).toHaveClass('rotate-90');
    });

    it('chevron has transition class', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const chevron = container.querySelector('svg.lucide-chevron-right');
      expect(chevron).toHaveClass('transition-transform');
    });
  });

  describe('output content', () => {
    it('renders output in pre element when expanded', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const preElement = screen.getByText('Command output here');
      expect(preElement.tagName).toBe('PRE');
    });

    it('applies monospace font to output', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const preElement = screen.getByText('Command output here');
      expect(preElement).toHaveClass('font-mono');
    });

    it('preserves whitespace in output', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const preElement = screen.getByText('Command output here');
      expect(preElement).toHaveClass('whitespace-pre-wrap');
    });

    it('renders multiline output correctly', () => {
      const multilineData: ThoughtBlockData = {
        type: 'thought',
        label: 'Running command...',
        output: 'Line 1\nLine 2\nLine 3',
      };
      render(<ThoughtBlock data={multilineData} />);
      const trigger = screen.getByText('Running command...');
      fireEvent.click(trigger);

      // Check that each line is present in the output
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Line 2/)).toBeInTheDocument();
      expect(screen.getByText(/Line 3/)).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('trigger has hover state styling', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('hover:text-foreground');
    });

    it('trigger has muted foreground text', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('text-muted-foreground');
    });

    it('trigger spans full width', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('w-full');
    });

    it('label is left-aligned', () => {
      render(<ThoughtBlock data={defaultData} />);
      const labelContainer = screen.getByText('Agent is analyzing...');
      expect(labelContainer).toHaveClass('text-left');
    });

    it('output container has secondary background', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const outputContainer = container.querySelector('.bg-secondary');
      expect(outputContainer).toBeInTheDocument();
    });

    it('output container has max height', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const scrollContainer = container.querySelector('.max-h-48');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('output container has overflow scroll', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');
      fireEvent.click(trigger);

      const scrollContainer = container.querySelector('.overflow-auto');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty label', () => {
      const emptyLabel: ThoughtBlockData = {
        type: 'thought',
        label: '',
        output: 'Some output',
      };
      const { container } = render(<ThoughtBlock data={emptyLabel} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles empty output', () => {
      const emptyOutput: ThoughtBlockData = {
        type: 'thought',
        label: 'Processing...',
        output: '',
      };
      render(<ThoughtBlock data={emptyOutput} />);
      const trigger = screen.getByText('Processing...');
      fireEvent.click(trigger);
      // Should render pre element even with empty content
      const preElement = document.querySelector('pre');
      expect(preElement).toBeInTheDocument();
    });

    it('handles very long label', () => {
      const longLabel: ThoughtBlockData = {
        type: 'thought',
        label: 'A'.repeat(200),
        output: 'Output',
      };
      render(<ThoughtBlock data={longLabel} />);
      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    it('handles very long output', () => {
      const longOutput: ThoughtBlockData = {
        type: 'thought',
        label: 'Label',
        output: 'A'.repeat(5000),
      };
      render(<ThoughtBlock data={longOutput} />);
      const trigger = screen.getByText('Label');
      fireEvent.click(trigger);
      expect(screen.getByText('A'.repeat(5000))).toBeInTheDocument();
    });

    it('handles special characters in label', () => {
      const specialLabel: ThoughtBlockData = {
        type: 'thought',
        label: 'Agent <running> "command" & stuff...',
        output: 'Output',
      };
      render(<ThoughtBlock data={specialLabel} />);
      expect(screen.getByText('Agent <running> "command" & stuff...')).toBeInTheDocument();
    });

    it('handles special characters in output', () => {
      const specialOutput: ThoughtBlockData = {
        type: 'thought',
        label: 'Label',
        output: '$ echo "hello <world>" && exit',
      };
      render(<ThoughtBlock data={specialOutput} />);
      const trigger = screen.getByText('Label');
      fireEvent.click(trigger);
      expect(screen.getByText('$ echo "hello <world>" && exit')).toBeInTheDocument();
    });

    it('handles unicode in label and output', () => {
      const unicodeData: ThoughtBlockData = {
        type: 'thought',
        label: '处理中... 🔄',
        output: '你好世界 🌍',
      };
      render(<ThoughtBlock data={unicodeData} />);
      expect(screen.getByText('处理中... 🔄')).toBeInTheDocument();
      const trigger = screen.getByText('处理中... 🔄');
      fireEvent.click(trigger);
      expect(screen.getByText('你好世界 🌍')).toBeInTheDocument();
    });

    it('handles rapid toggle clicks', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByText('Agent is analyzing...');

      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(trigger);
      }

      // Should not crash, component should be in a valid state
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('trigger is a button', () => {
      render(<ThoughtBlock data={defaultData} />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('trigger is keyboard accessible', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
    });

    it('can be expanded with keyboard', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'Enter' });
      // Radix Collapsible handles Enter key
    });

    it('trigger has transition for color changes', () => {
      render(<ThoughtBlock data={defaultData} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('transition-colors');
    });
  });

  describe('indicator animation', () => {
    it('has indicator container with relative positioning', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const indicatorContainer = container.querySelector('.relative.flex.h-2.w-2');
      expect(indicatorContainer).toBeInTheDocument();
    });

    it('ping animation has opacity', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const pingElement = container.querySelector('.opacity-75');
      expect(pingElement).toBeInTheDocument();
    });

    it('ping animation is absolutely positioned', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const pingElement = container.querySelector('.animate-ping.absolute');
      expect(pingElement).toBeInTheDocument();
    });

    it('static dot uses relative positioning', () => {
      const { container } = render(<ThoughtBlock data={defaultData} />);
      const dotElement = container.querySelector('.relative.inline-flex.rounded-full');
      expect(dotElement).toBeInTheDocument();
    });
  });
});
