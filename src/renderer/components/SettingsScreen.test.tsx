import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsScreen } from './SettingsScreen';
import { resetAllStores } from '../../../tests/utils';

// Mock ShellSettings to avoid Radix UI component issues
vi.mock('./ShellSettings', () => ({
  ShellSettings: () => <div data-testid="shell-settings">Shell Settings Content</div>,
}));

// Mock other settings components
vi.mock('./NotificationSettings', () => ({
  NotificationSettings: () => (
    <div data-testid="notification-settings">Notification Settings Content</div>
  ),
}));

vi.mock('./ShortcutsSettings', () => ({
  ShortcutsSettings: () => <div data-testid="shortcuts-settings">Shortcuts Settings Content</div>,
}));

describe('SettingsScreen', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the settings screen', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders all navigation tabs', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      // Terminal may appear multiple times (nav + content), use getAllByText
      expect(screen.getAllByText('Terminal').length).toBeGreaterThan(0);
      expect(screen.getByText('Shortcuts')).toBeInTheDocument();
    });

    it('renders the back button', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  describe('Terminal tab', () => {
    it('displays Terminal tab in navigation', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      // Terminal may appear multiple times (nav + content), use getAllByText
      const terminalElements = screen.getAllByText('Terminal');
      expect(terminalElements.length).toBeGreaterThan(0);
    });

    it('shows ShellSettings when Terminal tab is clicked', () => {
      render(<SettingsScreen onBack={mockOnBack} />);

      // Terminal is the default tab, so shell-settings should already be visible
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();
    });

    it('activates Terminal tab when initialTab is terminal', () => {
      render(<SettingsScreen onBack={mockOnBack} initialTab="terminal" />);
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();
    });

    it('switches from Terminal to other tabs', () => {
      render(<SettingsScreen onBack={mockOnBack} initialTab="terminal" />);
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Notifications'));
      expect(screen.queryByTestId('shell-settings')).not.toBeInTheDocument();
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    });

    it('switches from other tabs to Terminal', () => {
      render(<SettingsScreen onBack={mockOnBack} initialTab="notifications" />);
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Terminal'));
      expect(screen.queryByTestId('notification-settings')).not.toBeInTheDocument();
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('defaults to terminal tab', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();
    });

    it('shows correct content for each tab', () => {
      const { rerender } = render(
        <SettingsScreen onBack={mockOnBack} initialTab="notifications" />
      );
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();

      rerender(<SettingsScreen onBack={mockOnBack} initialTab="terminal" />);
      expect(screen.getByTestId('shell-settings')).toBeInTheDocument();

      rerender(<SettingsScreen onBack={mockOnBack} initialTab="shortcuts" />);
      expect(screen.getByTestId('shortcuts-settings')).toBeInTheDocument();
    });
  });

  describe('back button', () => {
    it('calls onBack when back button is clicked', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      fireEvent.click(screen.getByText('Back'));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('tab styling', () => {
    it('applies active styling to selected tab', () => {
      render(<SettingsScreen onBack={mockOnBack} initialTab="terminal" />);
      // Use getAllByText since "Terminal" appears both as nav tab and as a preset name
      const terminalButton = screen.getAllByText('Terminal')[0].closest('button');
      expect(terminalButton).toHaveClass('bg-accent');
    });

    it('applies inactive styling to non-selected tabs', () => {
      render(<SettingsScreen onBack={mockOnBack} initialTab="terminal" />);
      const notificationsButton = screen.getByText('Notifications').closest('button');
      expect(notificationsButton).toHaveClass('text-muted-foreground');
    });
  });

  describe('icons', () => {
    it('renders icon for Terminal tab', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      // Use getAllByText since "Terminal" may appear multiple times when Terminal tab content is shown
      const terminalButton = screen.getAllByText('Terminal')[0].closest('button');
      const icon = terminalButton?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('all tabs have icons', () => {
      render(<SettingsScreen onBack={mockOnBack} />);
      const tabs = ['Notifications', 'Terminal', 'Shortcuts'];

      tabs.forEach((tabName) => {
        // Use getAllByText for Terminal since it may appear multiple times
        const elements = screen.getAllByText(tabName);
        const button = elements[0].closest('button');
        const icon = button?.querySelector('svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });
});
