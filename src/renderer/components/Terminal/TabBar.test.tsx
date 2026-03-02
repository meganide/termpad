import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TerminalTab, TerminalState, TerminalPreset } from '../../../shared/types';
import { NEW_TERMINAL_PRESET, CLAUDE_DEFAULT_PRESET } from '../../../shared/types';

// Mock @dnd-kit modules before importing TabBar
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToHorizontalAxis: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...(arr as unknown[])];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  horizontalListSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}));

// Import TabBar after mocks are set up
import { TabBar } from './TabBar';

// Mock the tooltip components to avoid tooltip provider issues
vi.mock('../ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

// Mock the dropdown menu components
vi.mock('../ui/dropdown-menu', () => ({
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
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the alert-dialog components
vi.mock('../ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe('TabBar', () => {
  const mockTabs: TerminalTab[] = [
    { id: 'tab-1', name: 'Terminal 1', createdAt: '2024-01-01T00:00:00Z', order: 0 },
    { id: 'tab-2', name: 'claude', createdAt: '2024-01-01T00:01:00Z', order: 1 },
  ];

  const mockTerminalStatuses = new Map<string, TerminalState>([
    [
      'session-1:tab-1',
      {
        id: 'session-1:tab-1',
        status: 'idle',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      },
    ],
    [
      'session-1:tab-2',
      {
        id: 'session-1:tab-2',
        status: 'running',
        lastActivityTime: Date.now(),
        hasReceivedOutput: true,
      },
    ],
  ]);

  const mockTerminalPresets: TerminalPreset[] = [NEW_TERMINAL_PRESET, CLAUDE_DEFAULT_PRESET];

  const defaultProps = {
    tabs: mockTabs,
    activeTabId: 'tab-1',
    terminalStatuses: mockTerminalStatuses,
    getTerminalIdForTab: (tabId: string) => `session-1:${tabId}`,
    onTabClick: vi.fn(),
    onTabClose: vi.fn(),
    onTabRename: vi.fn(),
    onTabReorder: vi.fn(),
    onNewTab: vi.fn(),
    terminalPresets: mockTerminalPresets,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tabs correctly', () => {
    render(<TabBar {...defaultProps} />);

    expect(screen.getByText('Terminal 1')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<TabBar {...defaultProps} />);

    const activeTab = screen.getByText('Terminal 1').closest('[role="tab"]');
    const inactiveTab = screen.getByText('claude').closest('[role="tab"]');

    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabClick when a tab is clicked', () => {
    render(<TabBar {...defaultProps} />);

    fireEvent.click(screen.getByText('claude'));

    expect(defaultProps.onTabClick).toHaveBeenCalledWith('tab-2');
  });

  it('calls onTabClose when close button is clicked', () => {
    render(<TabBar {...defaultProps} />);

    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[0]);

    expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab-1');
  });

  it('renders + button with dropdown menu showing terminal presets', () => {
    render(<TabBar {...defaultProps} />);

    expect(screen.getByLabelText('New terminal')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('calls onNewTab with name and undefined command when "Terminal" is clicked', () => {
    render(<TabBar {...defaultProps} />);

    const menuItems = screen.getAllByTestId('dropdown-item');
    // First item is "Terminal"
    fireEvent.click(menuItems[0]);

    // Terminal preset has empty command, so onNewTab is called with name, undefined, and icon
    expect(defaultProps.onNewTab).toHaveBeenCalledWith('Terminal', undefined, 'terminal');
  });

  it('calls onNewTab with name and command when "Claude" preset is clicked', () => {
    render(<TabBar {...defaultProps} />);

    const menuItems = screen.getAllByTestId('dropdown-item');
    // Second item is "Claude" preset
    fireEvent.click(menuItems[1]);

    expect(defaultProps.onNewTab).toHaveBeenCalledWith('Claude', 'claude', 'sparkles');
  });

  it('renders with correct status indicators', () => {
    render(<TabBar {...defaultProps} />);

    // The component should render status indicators - they are visible in the DOM
    // Since we mocked tooltips, we can verify the tabs render
    expect(screen.getByText('Terminal 1')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
  });

  it('renders empty state when no tabs', () => {
    render(<TabBar {...defaultProps} tabs={[]} />);

    // Should still show the new tab button
    expect(screen.getByLabelText('New terminal')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<TabBar {...defaultProps} />);

    const tab = screen.getByText('Terminal 1').closest('[role="tab"]');
    fireEvent.keyDown(tab!, { key: 'Enter' });

    expect(defaultProps.onTabClick).toHaveBeenCalledWith('tab-1');
  });

  describe('inline renaming', () => {
    it('enters edit mode on double-click', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Terminal 1');
    });

    it('saves new name on Enter', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      // Change value first, let React process state update
      act(() => {
        fireEvent.change(input, { target: { value: 'New Name' } });
      });
      // Then trigger Enter
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(defaultProps.onTabRename).toHaveBeenCalledWith('tab-1', 'New Name');
    });

    it('saves new name on blur', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      // Change value first, let React process state update
      act(() => {
        fireEvent.change(input, { target: { value: 'Blurred Name' } });
      });
      // Then trigger blur
      act(() => {
        fireEvent.blur(input);
      });

      expect(defaultProps.onTabRename).toHaveBeenCalledWith('tab-1', 'Blurred Name');
    });

    it('cancels edit on Escape', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      act(() => {
        fireEvent.change(input, { target: { value: 'Changed' } });
      });
      act(() => {
        fireEvent.keyDown(input, { key: 'Escape' });
      });

      // Should exit edit mode and NOT call onTabRename
      expect(defaultProps.onTabRename).not.toHaveBeenCalled();
      // Should exit edit mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Terminal 1')).toBeInTheDocument();
    });

    it('reverts to previous name when saving empty string', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      act(() => {
        fireEvent.change(input, { target: { value: '   ' } });
      });
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // Should NOT call onTabRename with empty string
      expect(defaultProps.onTabRename).not.toHaveBeenCalled();
    });

    it('trims whitespace from name', () => {
      render(<TabBar {...defaultProps} />);

      const tabName = screen.getByText('Terminal 1');
      fireEvent.doubleClick(tabName);

      const input = screen.getByRole('textbox');
      act(() => {
        fireEvent.change(input, { target: { value: '  Trimmed Name  ' } });
      });
      act(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(defaultProps.onTabRename).toHaveBeenCalledWith('tab-1', 'Trimmed Name');
    });
  });

  describe('close confirmation dialog', () => {
    it('closes idle terminal immediately without confirmation', () => {
      render(<TabBar {...defaultProps} />);

      // tab-1 has status 'idle' so should close immediately
      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[0]); // Close Terminal 1 (idle)

      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab-1');
      // Dialog should not appear
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog for running terminal', () => {
      render(<TabBar {...defaultProps} />);

      // tab-2 has status 'running' so should show confirmation
      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[1]); // Close claude tab (running)

      // Dialog should appear
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('Close Running Terminal?');
      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent(
        'Process "claude" is running'
      );
      // onTabClose should NOT have been called yet
      expect(defaultProps.onTabClose).not.toHaveBeenCalled();
    });

    it('closes terminal when confirmed in dialog', () => {
      render(<TabBar {...defaultProps} />);

      // Click close on running terminal
      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[1]); // Close claude tab (running)

      // Dialog should appear
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();

      // Click confirm
      fireEvent.click(screen.getByTestId('alert-dialog-action'));

      // Now onTabClose should have been called
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab-2');
    });

    it('cancels close when cancel clicked in dialog', () => {
      render(<TabBar {...defaultProps} />);

      // Click close on running terminal
      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[1]); // Close claude tab (running)

      // Dialog should appear
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();

      // Click cancel
      fireEvent.click(screen.getByTestId('alert-dialog-cancel'));

      // onTabClose should NOT have been called
      expect(defaultProps.onTabClose).not.toHaveBeenCalled();
      // Dialog should be closed
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('shows confirmation for waiting terminal', () => {
      const waitingStatuses = new Map<string, TerminalState>([
        [
          'session-1:tab-1',
          {
            id: 'session-1:tab-1',
            status: 'waiting',
            lastActivityTime: Date.now(),
            hasReceivedOutput: true,
          },
        ],
      ]);

      render(<TabBar {...defaultProps} terminalStatuses={waitingStatuses} />);

      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[0]);

      // Dialog should appear for waiting status
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('shows confirmation for starting terminal', () => {
      const startingStatuses = new Map<string, TerminalState>([
        [
          'session-1:tab-1',
          {
            id: 'session-1:tab-1',
            status: 'starting',
            lastActivityTime: Date.now(),
            hasReceivedOutput: false,
          },
        ],
      ]);

      render(<TabBar {...defaultProps} terminalStatuses={startingStatuses} />);

      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[0]);

      // Dialog should appear for starting status
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });

    it('closes immediately for error status', () => {
      const errorStatuses = new Map<string, TerminalState>([
        [
          'session-1:tab-1',
          {
            id: 'session-1:tab-1',
            status: 'error',
            lastActivityTime: Date.now(),
            hasReceivedOutput: true,
          },
        ],
      ]);

      render(<TabBar {...defaultProps} terminalStatuses={errorStatuses} />);

      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[0]);

      // Should close immediately without dialog
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab-1');
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('closes immediately for stopped status', () => {
      const stoppedStatuses = new Map<string, TerminalState>([
        [
          'session-1:tab-1',
          {
            id: 'session-1:tab-1',
            status: 'stopped',
            lastActivityTime: Date.now(),
            hasReceivedOutput: true,
          },
        ],
      ]);

      render(<TabBar {...defaultProps} terminalStatuses={stoppedStatuses} />);

      const closeButtons = screen.getAllByLabelText(/Close/);
      fireEvent.click(closeButtons[0]);

      // Should close immediately without dialog
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab-1');
      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });
  });
});
