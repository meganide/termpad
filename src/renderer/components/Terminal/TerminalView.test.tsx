import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TerminalView } from './TerminalView';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores } from '../../../../tests/utils';
import { useTerminal } from '../../hooks/useTerminal';

// Mocked hooks
vi.mock('../../hooks/useTerminal');

// Create mock terminal instance
const createMockTerminalInstance = () => ({
  open: vi.fn(),
  write: vi.fn(),
  dispose: vi.fn(),
  focus: vi.fn(),
  loadAddon: vi.fn(),
  attachCustomKeyEventHandler: vi.fn(),
  onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onSelectionChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  hasSelection: vi.fn().mockReturnValue(false),
  getSelection: vi.fn().mockReturnValue(''),
  clearSelection: vi.fn(),
  cols: 80,
  rows: 24,
  options: {
    theme: {},
  },
});

// Keep a reference to the current mock instance
let mockTerminalInstance = createMockTerminalInstance();

const createMockFitAddonInstance = () => ({
  fit: vi.fn(),
});

let mockFitAddonInstance = createMockFitAddonInstance();

// Mock useTerminal return value
const mockUseTerminalReturn = {
  spawn: vi.fn().mockResolvedValue(undefined),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn().mockResolvedValue(undefined),
  onData: vi.fn().mockReturnValue(vi.fn()),
};

vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class MockTerminal {
      open = vi.fn();
      write = vi.fn();
      dispose = vi.fn();
      focus = vi.fn();
      loadAddon = vi.fn();
      attachCustomKeyEventHandler = vi.fn();
      onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
      onSelectionChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
      hasSelection = vi.fn().mockReturnValue(false);
      getSelection = vi.fn().mockReturnValue('');
      clearSelection = vi.fn();
      cols = 80;
      rows = 24;
      options = { theme: {} };

      constructor() {
        // Copy the current mock instance methods
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (globalThis as any).__mockTerminalInstance !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mock = (globalThis as any).__mockTerminalInstance;
          this.open = mock.open;
          this.write = mock.write;
          this.dispose = mock.dispose;
          this.focus = mock.focus;
          this.loadAddon = mock.loadAddon;
          this.attachCustomKeyEventHandler = mock.attachCustomKeyEventHandler;
          this.onData = mock.onData;
          this.onSelectionChange = mock.onSelectionChange;
          this.hasSelection = mock.hasSelection;
          this.getSelection = mock.getSelection;
          this.clearSelection = mock.clearSelection;
          this.cols = mock.cols;
          this.rows = mock.rows;
          this.options = mock.options;
        }
      }
    },
  };
});

vi.mock('@xterm/addon-fit', () => {
  return {
    FitAddon: class MockFitAddon {
      fit = vi.fn();

      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (globalThis as any).__mockFitAddonInstance !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.fit = (globalThis as any).__mockFitAddonInstance.fit;
        }
      }
    },
  };
});

vi.mock('@xterm/addon-web-links', () => {
  return {
    WebLinksAddon: class MockWebLinksAddon {},
  };
});

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue('pasted text'),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('TerminalView', () => {
  const defaultProps = {
    sessionId: 'test-session-1',
    cwd: '/test/project/path',
    isVisible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetAllStores();

    // Reset mock instances
    mockTerminalInstance = createMockTerminalInstance();
    mockFitAddonInstance = createMockFitAddonInstance();

    // Set global references for the mocked classes
    (globalThis as Record<string, unknown>).__mockTerminalInstance = mockTerminalInstance;
    (globalThis as Record<string, unknown>).__mockFitAddonInstance = mockFitAddonInstance;

    // Reset mock implementations
    mockTerminalInstance.hasSelection.mockReturnValue(false);
    mockTerminalInstance.getSelection.mockReturnValue('');

    // Setup terminal onData mock to capture callback
    mockTerminalInstance.onData.mockReturnValue({ dispose: vi.fn() });
    mockTerminalInstance.onSelectionChange.mockReturnValue({ dispose: vi.fn() });

    // Reset useTerminal return values
    mockUseTerminalReturn.spawn.mockClear().mockResolvedValue(undefined);
    mockUseTerminalReturn.write.mockClear();
    mockUseTerminalReturn.resize.mockClear();
    mockUseTerminalReturn.kill.mockClear().mockResolvedValue(undefined);
    mockUseTerminalReturn.onData.mockClear().mockReturnValue(vi.fn());

    // Configure useTerminal mock to return the mock object
    vi.mocked(useTerminal).mockReturnValue(mockUseTerminalReturn);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders terminal container div', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full');
      expect(terminalContainer).toBeInTheDocument();
    });

    it('renders with outline-none class for focus handling', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.outline-none');
      expect(terminalContainer).toBeInTheDocument();
    });

    it('shows terminal when isVisible is true', () => {
      const { container } = render(<TerminalView {...defaultProps} isVisible={true} />);
      const terminalContainer = container.querySelector('.h-full.w-full');
      expect(terminalContainer).toHaveStyle({ display: 'block' });
    });

    it('hides terminal when isVisible is false', () => {
      const { container } = render(<TerminalView {...defaultProps} isVisible={false} />);
      const terminalContainer = container.querySelector('.h-full.w-full');
      expect(terminalContainer).toHaveStyle({ display: 'none' });
    });

    it('sets tabIndex to -1 on container', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full');
      expect(terminalContainer).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('terminal initialization', () => {
    it('creates and opens Terminal on mount', () => {
      render(<TerminalView {...defaultProps} />);

      // Verify terminal was opened (which proves Terminal was created)
      expect(mockTerminalInstance.open).toHaveBeenCalled();
    });

    it('opens terminal on container element', () => {
      render(<TerminalView {...defaultProps} />);
      expect(mockTerminalInstance.open).toHaveBeenCalled();
    });

    it('loads addons via loadAddon', () => {
      render(<TerminalView {...defaultProps} />);
      // loadAddon is called twice - once for FitAddon, once for WebLinksAddon
      expect(mockTerminalInstance.loadAddon).toHaveBeenCalledTimes(2);
    });

    it('does not call fit on initialization when container has no dimensions', () => {
      // In jsdom, containers have 0 dimensions by default (like hidden containers)
      // Fit is only called when container is visible
      render(<TerminalView {...defaultProps} />);
      expect(mockFitAddonInstance.fit).not.toHaveBeenCalled();
    });

    it('spawns terminal process', () => {
      render(<TerminalView {...defaultProps} />);
      expect(mockUseTerminalReturn.spawn).toHaveBeenCalled();
    });

    it('sets up data listener via onData', () => {
      render(<TerminalView {...defaultProps} />);
      expect(mockUseTerminalReturn.onData).toHaveBeenCalled();
    });

    it('does not call resize when container has no dimensions (hidden)', () => {
      // In jsdom, containers have 0 dimensions by default (like hidden containers)
      // Resize should only be called when the container is visible
      render(<TerminalView {...defaultProps} />);
      expect(mockUseTerminalReturn.resize).not.toHaveBeenCalled();
    });
  });

  describe('terminal cleanup', () => {
    it('disposes terminal on unmount', () => {
      const { unmount } = render(<TerminalView {...defaultProps} />);
      unmount();
      expect(mockTerminalInstance.dispose).toHaveBeenCalled();
    });

    it('unsubscribes from data listener on unmount', () => {
      const unsubscribe = vi.fn();
      mockUseTerminalReturn.onData.mockReturnValue(unsubscribe);

      const { unmount } = render(<TerminalView {...defaultProps} />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('visibility handling', () => {
    it('fits terminal when becoming visible', async () => {
      const { rerender } = render(<TerminalView {...defaultProps} isVisible={false} />);

      // Clear calls from initial render
      mockFitAddonInstance.fit.mockClear();

      rerender(<TerminalView {...defaultProps} isVisible={true} />);

      // Advance timers to trigger the delayed fit
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockFitAddonInstance.fit).toHaveBeenCalled();
    });

    it('focuses terminal when becoming visible and focusArea matches', async () => {
      // Set focusArea to mainTerminal so the terminal will focus when becoming visible
      useAppStore.setState({ focusArea: 'mainTerminal' });

      const { rerender } = render(<TerminalView {...defaultProps} isVisible={false} />);

      mockTerminalInstance.focus.mockClear();

      rerender(<TerminalView {...defaultProps} isVisible={true} />);

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });

    it('does not focus terminal when becoming visible but focusArea does not match', async () => {
      // Set focusArea to sidebar so the terminal will NOT focus when becoming visible
      useAppStore.setState({ focusArea: 'sidebar' });

      const { rerender } = render(<TerminalView {...defaultProps} isVisible={false} />);

      mockTerminalInstance.focus.mockClear();

      rerender(<TerminalView {...defaultProps} isVisible={true} />);

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockTerminalInstance.focus).not.toHaveBeenCalled();
    });

    it('resizes terminal when becoming visible', async () => {
      const { rerender } = render(<TerminalView {...defaultProps} isVisible={false} />);

      mockUseTerminalReturn.resize.mockClear();

      rerender(<TerminalView {...defaultProps} isVisible={true} />);

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(mockUseTerminalReturn.resize).toHaveBeenCalledWith(80, 24);
    });
  });

  describe('theme handling', () => {
    it('applies theme on initialization', () => {
      render(<TerminalView {...defaultProps} />);

      // Terminal should be created - we verify via the open call
      expect(mockTerminalInstance.open).toHaveBeenCalled();
      // The theme is set via terminal options
      expect(mockTerminalInstance.options.theme).toBeDefined();
    });
  });

  describe('mouse interaction', () => {
    it('focuses terminal on mousedown', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.focus.mockClear();
      fireEvent.mouseDown(terminalContainer);

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });

    it('closes context menu on mousedown', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Open context menu first
      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      // Context menu should be visible
      expect(screen.getByText('Copy')).toBeInTheDocument();

      // Mousedown should close it
      fireEvent.mouseDown(terminalContainer);

      // Context menu should be closed
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });
  });

  describe('context menu', () => {
    it('opens context menu on right click', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Paste')).toBeInTheDocument();
    });

    it('positions context menu at click coordinates', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 150, clientY: 200 });

      const contextMenu = screen.getByText('Copy').closest('.fixed');
      expect(contextMenu).toHaveStyle({ left: '150px', top: '200px' });
    });

    it('disables copy button when no selection', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(false);
      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const copyButton = screen.getByText('Copy').closest('button');
      expect(copyButton).toHaveAttribute('disabled');
      expect(copyButton).toHaveClass('opacity-50');
    });

    it('enables copy button when text is selected', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Simulate selection change
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        mockTerminalInstance.hasSelection.mockReturnValue(true);
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const copyButton = screen.getByText('Copy').closest('button');
      expect(copyButton).not.toHaveAttribute('disabled');
      expect(copyButton).not.toHaveClass('pointer-events-none');
    });

    it('shows clear selection option when text is selected', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Simulate selection
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        mockTerminalInstance.hasSelection.mockReturnValue(true);
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
    });

    it('hides clear selection option when no selection', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(false);
      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    });

    it('closes context menu on outside click', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      expect(screen.getByText('Copy')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('closes context menu on Escape key', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      expect(screen.getByText('Copy')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('focuses terminal after closing context menu with Escape', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      mockTerminalInstance.focus.mockClear();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });
  });

  describe('copy functionality', () => {
    it('copies selected text to clipboard', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Setup selection
      mockTerminalInstance.hasSelection.mockReturnValue(true);
      mockTerminalInstance.getSelection.mockReturnValue('selected text');

      // Trigger selection change
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const copyButton = screen.getByText('Copy').closest('button')!;
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockClipboard.writeText).toHaveBeenCalledWith('selected text');
    });

    it('clears selection after copy', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      mockTerminalInstance.getSelection.mockReturnValue('text');

      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const copyButton = screen.getByText('Copy').closest('button')!;
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockTerminalInstance.clearSelection).toHaveBeenCalled();
    });

    it('closes context menu after copy', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      mockTerminalInstance.getSelection.mockReturnValue('text');

      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const copyButton = screen.getByText('Copy').closest('button')!;
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('focuses terminal after copy', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      mockTerminalInstance.getSelection.mockReturnValue('text');

      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      mockTerminalInstance.focus.mockClear();

      const copyButton = screen.getByText('Copy').closest('button')!;
      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });
  });

  describe('paste functionality', () => {
    it('reads text from clipboard', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockClipboard.readText).toHaveBeenCalled();
    });

    it('writes clipboard text to terminal', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockUseTerminalReturn.write).toHaveBeenCalledWith('pasted text');
    });

    it('clears selection after paste', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockTerminalInstance.clearSelection).toHaveBeenCalled();
    });

    it('closes context menu after paste', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(screen.queryByText('Paste')).not.toBeInTheDocument();
    });

    it('focuses terminal after paste', async () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      mockTerminalInstance.focus.mockClear();

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });

    it('does not write to terminal if clipboard is empty', async () => {
      mockClipboard.readText.mockResolvedValueOnce('');

      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const pasteButton = screen.getByText('Paste').closest('button')!;
      await act(async () => {
        fireEvent.click(pasteButton);
      });

      expect(mockUseTerminalReturn.write).not.toHaveBeenCalled();
    });
  });

  describe('clear selection functionality', () => {
    it('clears terminal selection', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Setup selection
      mockTerminalInstance.hasSelection.mockReturnValue(true);
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const clearButton = screen.getByText('Clear Selection').closest('button')!;
      fireEvent.click(clearButton);

      expect(mockTerminalInstance.clearSelection).toHaveBeenCalled();
    });

    it('closes context menu after clear selection', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const clearButton = screen.getByText('Clear Selection').closest('button')!;
      fireEvent.click(clearButton);

      expect(screen.queryByText('Clear Selection')).not.toBeInTheDocument();
    });

    it('focuses terminal after clear selection', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
      mockTerminalInstance.focus.mockClear();

      const clearButton = screen.getByText('Clear Selection').closest('button')!;
      fireEvent.click(clearButton);

      expect(mockTerminalInstance.focus).toHaveBeenCalled();
    });
  });

  describe('user input handling', () => {
    it('writes user input to terminal via useTerminal.write', () => {
      render(<TerminalView {...defaultProps} />);

      // Get the onData callback passed to terminal
      const onDataCallback = mockTerminalInstance.onData.mock.calls[0]?.[0];
      expect(onDataCallback).toBeDefined();

      if (onDataCallback) {
        onDataCallback('user input');
        expect(mockUseTerminalReturn.write).toHaveBeenCalledWith('user input');
      }
    });
  });

  describe('context menu icons', () => {
    it('shows copy icon', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const contextMenu = screen.getByText('Copy').closest('.fixed');
      const copyIcon = contextMenu?.querySelector('svg.lucide-copy');
      expect(copyIcon).toBeInTheDocument();
    });

    it('shows paste icon', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      const contextMenu = screen.getByText('Paste').closest('.fixed');
      const pasteIcon = contextMenu?.querySelector('svg.lucide-clipboard-paste');
      expect(pasteIcon).toBeInTheDocument();
    });

    it('shows clear selection button with icon', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      mockTerminalInstance.hasSelection.mockReturnValue(true);
      const selectionChangeCallback = mockTerminalInstance.onSelectionChange.mock.calls[0]?.[0];
      if (selectionChangeCallback) {
        act(() => {
          selectionChangeCallback();
        });
      }

      fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });

      // Verify clear selection button is present and has an icon (svg element)
      const clearSelectionButton = screen.getByText('Clear Selection').closest('button');
      expect(clearSelectionButton).toBeInTheDocument();
      const icon = clearSelectionButton?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('props handling', () => {
    it('uses sessionId for terminal operations', () => {
      render(<TerminalView {...defaultProps} sessionId="custom-session-id" />);

      // useTerminal should be called with the sessionId
      expect(vi.mocked(useTerminal)).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'custom-session-id',
        })
      );
    });

    it('uses cwd for terminal spawn', () => {
      render(<TerminalView {...defaultProps} cwd="/custom/path" />);

      expect(vi.mocked(useTerminal)).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('passes autoSpawn: false to useTerminal', () => {
      render(<TerminalView {...defaultProps} />);

      expect(vi.mocked(useTerminal)).toHaveBeenCalledWith(
        expect.objectContaining({
          autoSpawn: false,
        })
      );
    });

    it('passes initialCommand: undefined to useTerminal by default', () => {
      render(<TerminalView {...defaultProps} />);

      expect(vi.mocked(useTerminal)).toHaveBeenCalledWith(
        expect.objectContaining({
          initialCommand: undefined,
        })
      );
    });
  });

  describe('keyboard shortcut passthrough', () => {
    it('registers custom key event handler', () => {
      render(<TerminalView {...defaultProps} />);
      expect(mockTerminalInstance.attachCustomKeyEventHandler).toHaveBeenCalledTimes(1);
    });

    it('allows Ctrl+Shift+Space to pass through for focus toggle (Linux)', () => {
      // Note: Test environment mocks platform as 'linux', so tests use Ctrl+Shift+Space
      // On Linux, Ctrl+Space is reserved by input method frameworks (IBus, Fcitx)
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      const ctrlShiftSpaceEvent = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: ' ',
      };

      // Should return false to let event bubble to window
      expect(keyHandler(ctrlShiftSpaceEvent)).toBe(false);
    });

    it('allows Ctrl+1-9 to pass through for tab switching', () => {
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      // Test all digit keys 1-9
      for (let i = 1; i <= 9; i++) {
        const ctrlDigitEvent = {
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          key: String(i),
        };

        // Should return false to let event bubble to window
        expect(keyHandler(ctrlDigitEvent)).toBe(false);
      }
    });

    it('does not pass through Ctrl+0', () => {
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      const ctrlZeroEvent = {
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: '0',
      };

      // Should return true to let xterm handle it
      expect(keyHandler(ctrlZeroEvent)).toBe(true);
    });

    it('lets xterm handle regular key events', () => {
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      const regularKeyEvent = {
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        key: 'a',
      };

      // Should return true to let xterm handle it
      expect(keyHandler(regularKeyEvent)).toBe(true);
    });

    it('does not pass through Ctrl+Shift+digit combinations', () => {
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      const ctrlShiftDigitEvent = {
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        key: '1',
      };

      // Should return true to let xterm handle it
      expect(keyHandler(ctrlShiftDigitEvent)).toBe(true);
    });

    it('does not pass through Ctrl+Alt+digit combinations', () => {
      render(<TerminalView {...defaultProps} />);

      const keyHandler = mockTerminalInstance.attachCustomKeyEventHandler.mock.calls[0][0];

      const ctrlAltDigitEvent = {
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
        metaKey: false,
        key: '1',
      };

      // Should return true to let xterm handle it
      expect(keyHandler(ctrlAltDigitEvent)).toBe(true);
    });
  });

  describe('strict mode double-render protection', () => {
    it('only spawns terminal once even with re-renders', () => {
      const { rerender } = render(<TerminalView {...defaultProps} />);

      // Clear the spawn call from first render
      mockUseTerminalReturn.spawn.mockClear();

      // Re-render with same props (simulating strict mode behavior)
      rerender(<TerminalView {...defaultProps} />);

      // Spawn should not be called again due to hasSpawnedRef
      expect(mockUseTerminalReturn.spawn).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles empty cwd', () => {
      expect(() => {
        render(<TerminalView {...defaultProps} cwd="" />);
      }).not.toThrow();
    });

    it('handles special characters in sessionId', () => {
      expect(() => {
        render(<TerminalView {...defaultProps} sessionId="session-with-special/chars:123" />);
      }).not.toThrow();
    });

    it('handles rapid visibility toggling', async () => {
      const { rerender } = render(<TerminalView {...defaultProps} isVisible={true} />);

      // Toggle visibility rapidly
      for (let i = 0; i < 5; i++) {
        rerender(<TerminalView {...defaultProps} isVisible={i % 2 === 0} />);
      }

      // Should not throw and terminal should still function
      expect(mockTerminalInstance.dispose).not.toHaveBeenCalled();
    });

    it('handles context menu open/close rapidly', () => {
      const { container } = render(<TerminalView {...defaultProps} />);
      const terminalContainer = container.querySelector('.h-full.w-full')!;

      // Open and close context menu rapidly
      for (let i = 0; i < 5; i++) {
        fireEvent.contextMenu(terminalContainer, { clientX: 100, clientY: 100 });
        fireEvent.keyDown(document, { key: 'Escape' });
      }

      // Should not throw
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });
  });
});
