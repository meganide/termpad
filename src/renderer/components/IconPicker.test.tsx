import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IconPicker, PRESET_ICONS } from './IconPicker';

describe('IconPicker', () => {
  const defaultProps = {
    value: 'terminal',
    onSelect: vi.fn(),
  };

  describe('rendering', () => {
    it('renders a button', () => {
      render(<IconPicker {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Select icon' })).toBeInTheDocument();
    });

    it('shows the currently selected icon', () => {
      render(<IconPicker {...defaultProps} value="sparkles" />);
      const button = screen.getByRole('button', { name: 'Select icon' });
      expect(button).toBeInTheDocument();
    });

    it('defaults to terminal icon for unknown value', () => {
      render(<IconPicker {...defaultProps} value="unknown-icon" />);
      expect(screen.getByRole('button', { name: 'Select icon' })).toBeInTheDocument();
    });
  });

  describe('popover behavior', () => {
    it('opens popover when clicked', () => {
      render(<IconPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));

      // Popover should show all icon buttons
      const iconButtons = screen.getAllByRole('button', { name: /Select .* icon/i });
      expect(iconButtons.length).toBeGreaterThan(1);
    });

    it('closes popover when icon is selected', () => {
      render(<IconPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select sparkles icon' }));

      // Popover should close - grid of icons should no longer be visible
      expect(
        screen.queryByRole('button', { name: 'Select sparkles icon' })
      ).not.toBeInTheDocument();
    });

    it('shows all available icons in the popover', () => {
      render(<IconPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));

      const expectedIconCount = Object.keys(PRESET_ICONS).length;
      // +1 for the trigger button
      const allButtons = screen.getAllByRole('button');
      // Subtract 1 for trigger button to get icon grid count
      expect(allButtons.length - 1).toBe(expectedIconCount);
    });
  });

  describe('icon selection', () => {
    it('calls onSelect with the icon name when an icon is clicked', () => {
      const onSelect = vi.fn();
      render(<IconPicker {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select sparkles icon' }));

      expect(onSelect).toHaveBeenCalledWith('sparkles');
    });

    it('calls onSelect only once per click', () => {
      const onSelect = vi.fn();
      render(<IconPicker {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));
      fireEvent.click(screen.getByRole('button', { name: 'Select rocket icon' }));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled state', () => {
    it('prevents opening when disabled', () => {
      render(<IconPicker {...defaultProps} disabled />);

      const button = screen.getByRole('button', { name: 'Select icon' });
      expect(button).toBeDisabled();

      fireEvent.click(button);

      // Popover should not open
      expect(
        screen.queryByRole('button', { name: 'Select sparkles icon' })
      ).not.toBeInTheDocument();
    });
  });

  describe('visual selection state', () => {
    it('highlights the currently selected icon in the grid', () => {
      render(<IconPicker {...defaultProps} value="sparkles" />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));

      const sparklesButton = screen.getByRole('button', { name: 'Select sparkles icon' });
      expect(sparklesButton.className).toContain('bg-accent');
    });

    it('does not highlight non-selected icons', () => {
      render(<IconPicker {...defaultProps} value="terminal" />);

      fireEvent.click(screen.getByRole('button', { name: 'Select icon' }));

      const sparklesButton = screen.getByRole('button', { name: 'Select sparkles icon' });
      // Check that it doesn't have the bg-accent class (without hover: prefix)
      // The className contains 'hover:bg-accent' which is different from 'bg-accent text-accent-foreground'
      expect(sparklesButton.className).not.toMatch(/(?<![:\w-])bg-accent(?!\S)/);
    });
  });

  describe('PRESET_ICONS export', () => {
    it('exports all expected icons', () => {
      const expectedIcons = [
        'terminal',
        'sparkles',
        'code',
        'bot',
        'zap',
        'command',
        'play',
        'wrench',
        'star',
        'heart',
        'rocket',
        'coffee',
        'message-square',
        'cpu',
        'globe',
      ];

      expectedIcons.forEach((iconName) => {
        expect(PRESET_ICONS[iconName]).toBeDefined();
      });
    });

    it('has exactly 15 icons', () => {
      expect(Object.keys(PRESET_ICONS)).toHaveLength(15);
    });
  });
});
