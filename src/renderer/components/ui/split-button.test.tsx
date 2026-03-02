import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dropdown menu components to avoid portal issues in tests
vi.mock('./dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { SplitButton, SplitButtonItem } from './split-button';

describe('SplitButton', () => {
  const defaultItems: SplitButtonItem[] = [
    { id: 'item1', label: 'Item 1', selected: true },
    { id: 'item2', label: 'Item 2', selected: false },
    { id: 'item3', label: 'Item 3', selected: false },
  ];

  const defaultProps = {
    label: 'Run',
    onClick: vi.fn(),
    items: defaultItems,
    onItemSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the main button with label', () => {
      render(<SplitButton {...defaultProps} />);
      expect(screen.getByTestId('split-button-main')).toHaveTextContent('Run');
    });

    it('renders the dropdown trigger button', () => {
      render(<SplitButton {...defaultProps} />);
      expect(screen.getByTestId('split-button-dropdown')).toBeInTheDocument();
    });

    it('renders with optional icon before label', () => {
      const icon = <span data-testid="test-icon">🎮</span>;
      render(<SplitButton {...defaultProps} icon={icon} />);
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      // Icon should appear before the label
      const button = screen.getByTestId('split-button-main');
      const iconElement = screen.getByTestId('test-icon');
      expect(button.contains(iconElement)).toBe(true);
    });

    it('applies custom className to container', () => {
      render(<SplitButton {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('split-button')).toHaveClass('custom-class');
    });
  });

  describe('main button behavior', () => {
    it('calls onClick when main button is clicked', () => {
      const onClick = vi.fn();
      render(<SplitButton {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('split-button-main'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(<SplitButton {...defaultProps} onClick={onClick} disabled />);

      fireEvent.click(screen.getByTestId('split-button-main'));

      expect(onClick).not.toHaveBeenCalled();
    });

    it('disables both buttons when disabled prop is true', () => {
      render(<SplitButton {...defaultProps} disabled />);

      expect(screen.getByTestId('split-button-main')).toBeDisabled();
      expect(screen.getByTestId('split-button-dropdown')).toBeDisabled();
    });
  });

  describe('dropdown behavior', () => {
    it('shows dropdown items (mocked dropdown always visible)', () => {
      render(<SplitButton {...defaultProps} />);

      // With mocked DropdownMenu, content is always rendered
      expect(screen.getByTestId('split-button-item-item1')).toBeInTheDocument();
      expect(screen.getByTestId('split-button-item-item2')).toBeInTheDocument();
      expect(screen.getByTestId('split-button-item-item3')).toBeInTheDocument();
    });

    it('displays item labels in dropdown', () => {
      render(<SplitButton {...defaultProps} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('calls onItemSelect when an item is clicked', () => {
      const onItemSelect = vi.fn();
      render(<SplitButton {...defaultProps} onItemSelect={onItemSelect} />);

      fireEvent.click(screen.getByTestId('split-button-item-item2'));

      expect(onItemSelect).toHaveBeenCalledWith('item2');
    });

    it('does NOT call onClick when selecting an item', () => {
      const onClick = vi.fn();
      const onItemSelect = vi.fn();
      render(<SplitButton {...defaultProps} onClick={onClick} onItemSelect={onItemSelect} />);

      fireEvent.click(screen.getByTestId('split-button-item-item2'));

      expect(onItemSelect).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('checkmark behavior', () => {
    it('shows checkmark next to selected item by default', () => {
      render(<SplitButton {...defaultProps} />);

      // The selected item should contain a checkmark (Check icon renders as svg)
      const item1 = screen.getByTestId('split-button-item-item1');
      expect(item1.querySelector('svg')).toBeInTheDocument();
    });

    it('does not show checkmark next to unselected items', () => {
      render(<SplitButton {...defaultProps} />);

      const item2 = screen.getByTestId('split-button-item-item2');
      expect(item2.querySelector('svg')).toBeNull();
    });

    it('hides checkmarks when showCheckmark is false', () => {
      render(<SplitButton {...defaultProps} showCheckmark={false} />);

      const item1 = screen.getByTestId('split-button-item-item1');
      // No checkmark space should be rendered
      expect(item1.querySelector('svg')).toBeNull();
    });
  });

  describe('multiple selections', () => {
    it('shows checkmark for multiple selected items', () => {
      const itemsWithMultiple: SplitButtonItem[] = [
        { id: 'item1', label: 'Item 1', selected: true },
        { id: 'item2', label: 'Item 2', selected: true },
        { id: 'item3', label: 'Item 3', selected: false },
      ];
      render(<SplitButton {...defaultProps} items={itemsWithMultiple} />);

      const item1 = screen.getByTestId('split-button-item-item1');
      const item2 = screen.getByTestId('split-button-item-item2');
      const item3 = screen.getByTestId('split-button-item-item3');

      expect(item1.querySelector('svg')).toBeInTheDocument();
      expect(item2.querySelector('svg')).toBeInTheDocument();
      expect(item3.querySelector('svg')).toBeNull();
    });
  });

  describe('empty items', () => {
    it('renders with empty items array', () => {
      render(<SplitButton {...defaultProps} items={[]} />);

      expect(screen.getByTestId('split-button-main')).toBeInTheDocument();
      expect(screen.getByTestId('split-button-dropdown')).toBeInTheDocument();
    });
  });
});
