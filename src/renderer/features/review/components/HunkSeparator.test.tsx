import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HunkSeparator, getExpandLineCount } from './HunkSeparator';

describe('HunkSeparator', () => {
  const defaultProps = {
    prevHunkEndLine: 10,
    nextHunkStartLine: 35,
    onExpandUp: vi.fn(),
    onExpandDown: vi.fn(),
    onBridge: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gap calculation', () => {
    it('should calculate gap correctly for standard case', () => {
      // Gap between line 10 and line 35 is 24 lines (11-34)
      const { container } = render(<HunkSeparator {...defaultProps} />);
      const separator = container.querySelector('[data-testid="hunk-separator"]');
      expect(separator).toHaveAttribute('data-gap', '24');
    });

    it('should calculate gap for adjacent hunks', () => {
      // Gap between line 10 and line 12 is 1 line (11)
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={12}
          onBridge={vi.fn()}
        />
      );
      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-gap', '1');
    });

    it('should not render when gap is zero', () => {
      // No gap between line 10 and line 11
      const { container } = render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={11}
          onBridge={vi.fn()}
        />
      );
      expect(container.querySelector('[data-testid="hunk-separator"]')).not.toBeInTheDocument();
    });

    it('should not render when gap is negative', () => {
      // Invalid case: next hunk starts before previous ends
      const { container } = render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={8}
          onBridge={vi.fn()}
        />
      );
      expect(container.querySelector('[data-testid="hunk-separator"]')).not.toBeInTheDocument();
    });
  });

  describe('Bridge mode (gap ≤20 lines)', () => {
    it('should render single bridge button for gap of 20 lines', () => {
      // Gap = 20 lines (11-30)
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={31}
          onBridge={vi.fn()}
        />
      );

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-mode', 'bridge');

      const bridgeButton = screen.getByTestId('bridge-button');
      expect(bridgeButton).toBeInTheDocument();
      expect(bridgeButton).toHaveTextContent('Show all 20 lines');

      // Should not show expand up/down buttons in bridge mode
      expect(screen.queryByTestId('expand-up-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('expand-down-button')).not.toBeInTheDocument();
    });

    it('should render single bridge button for gap of 10 lines', () => {
      // Gap = 10 lines (11-20)
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={21}
          onBridge={vi.fn()}
        />
      );

      const bridgeButton = screen.getByTestId('bridge-button');
      expect(bridgeButton).toHaveTextContent('Show all 10 lines');
    });

    it('should render single bridge button for gap of 1 line', () => {
      // Gap = 1 line (11)
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={12}
          onBridge={vi.fn()}
        />
      );

      const bridgeButton = screen.getByTestId('bridge-button');
      expect(bridgeButton).toHaveTextContent('Show all 1 lines');
    });

    it('should call onBridge when bridge button is clicked', () => {
      const onBridge = vi.fn();
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={21}
          onBridge={onBridge}
        />
      );

      const bridgeButton = screen.getByTestId('bridge-button');
      fireEvent.click(bridgeButton);

      expect(onBridge).toHaveBeenCalledTimes(1);
    });
  });

  describe('Progressive expansion mode (gap >20 lines)', () => {
    it('should render expand up/down and show all buttons for gap of 24 lines', () => {
      // Gap = 24 lines (11-34)
      render(<HunkSeparator {...defaultProps} />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-mode', 'progressive');

      expect(screen.getByTestId('expand-up-button')).toBeInTheDocument();
      expect(screen.getByTestId('expand-down-button')).toBeInTheDocument();
      expect(screen.getByTestId('show-all-button')).toBeInTheDocument();
      expect(screen.getByTestId('show-all-button')).toHaveTextContent('Show all 24 lines');
    });

    it('should render expand up/down buttons for gap of 50 lines', () => {
      // Gap = 50 lines
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={61}
          onExpandUp={vi.fn()}
          onExpandDown={vi.fn()}
          onBridge={vi.fn()}
        />
      );

      expect(screen.getByTestId('expand-up-button')).toBeInTheDocument();
      expect(screen.getByTestId('expand-down-button')).toBeInTheDocument();
      expect(screen.getByTestId('show-all-button')).toHaveTextContent('Show all 50 lines');
    });

    it('should call onExpandUp when expand up button is clicked', () => {
      const onExpandUp = vi.fn();
      render(<HunkSeparator {...defaultProps} onExpandUp={onExpandUp} />);

      const expandUpButton = screen.getByTestId('expand-up-button');
      fireEvent.click(expandUpButton);

      expect(onExpandUp).toHaveBeenCalledTimes(1);
    });

    it('should call onExpandDown when expand down button is clicked', () => {
      const onExpandDown = vi.fn();
      render(<HunkSeparator {...defaultProps} onExpandDown={onExpandDown} />);

      const expandDownButton = screen.getByTestId('expand-down-button');
      fireEvent.click(expandDownButton);

      expect(onExpandDown).toHaveBeenCalledTimes(1);
    });

    it('should call onBridge when show all button is clicked', () => {
      const onBridge = vi.fn();
      render(<HunkSeparator {...defaultProps} onBridge={onBridge} />);

      const showAllButton = screen.getByTestId('show-all-button');
      fireEvent.click(showAllButton);

      expect(onBridge).toHaveBeenCalledTimes(1);
    });

    it('should not render expand up button if onExpandUp is not provided', () => {
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={35}
          onExpandDown={vi.fn()}
          onBridge={vi.fn()}
        />
      );

      expect(screen.queryByTestId('expand-up-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('expand-down-button')).toBeInTheDocument();
    });

    it('should not render expand down button if onExpandDown is not provided', () => {
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={35}
          onExpandUp={vi.fn()}
          onBridge={vi.fn()}
        />
      );

      expect(screen.getByTestId('expand-up-button')).toBeInTheDocument();
      expect(screen.queryByTestId('expand-down-button')).not.toBeInTheDocument();
    });

    it('should not render show all button if onBridge is not provided', () => {
      render(
        <HunkSeparator
          prevHunkEndLine={10}
          nextHunkStartLine={35}
          onExpandUp={vi.fn()}
          onExpandDown={vi.fn()}
        />
      );

      expect(screen.queryByTestId('show-all-button')).not.toBeInTheDocument();
    });
  });

  describe('Context header', () => {
    it('should render context header when provided', () => {
      render(
        <HunkSeparator
          {...defaultProps}
          contextHeader="function handleClick()"
        />
      );

      const contextHeader = screen.getByTestId('context-header');
      expect(contextHeader).toBeInTheDocument();
      expect(contextHeader).toHaveTextContent('function handleClick()');
    });

    it('should not render context header when not provided', () => {
      render(<HunkSeparator {...defaultProps} />);

      expect(screen.queryByTestId('context-header')).not.toBeInTheDocument();
    });

    it('should render context header with class name', () => {
      render(
        <HunkSeparator
          {...defaultProps}
          contextHeader="class UserController"
        />
      );

      const contextHeader = screen.getByTestId('context-header');
      expect(contextHeader).toHaveTextContent('class UserController');
    });
  });

  describe('Side attribute', () => {
    it('should default to "new" side', () => {
      render(<HunkSeparator {...defaultProps} />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-side', 'new');
    });

    it('should render with "old" side when specified', () => {
      render(<HunkSeparator {...defaultProps} side="old" />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-side', 'old');
    });

    it('should render with "new" side when specified', () => {
      render(<HunkSeparator {...defaultProps} side="new" />);

      const separator = screen.getByTestId('hunk-separator');
      expect(separator).toHaveAttribute('data-side', 'new');
    });
  });
});

describe('getExpandLineCount', () => {
  it('should return gap for bridge operation', () => {
    expect(getExpandLineCount('bridge', 10)).toBe(10);
    expect(getExpandLineCount('bridge', 50)).toBe(50);
    expect(getExpandLineCount('bridge', 1)).toBe(1);
  });

  it('should return 20 lines for up operation when gap > 20', () => {
    expect(getExpandLineCount('up', 50)).toBe(20);
    expect(getExpandLineCount('up', 100)).toBe(20);
  });

  it('should return gap size for up operation when gap ≤ 20', () => {
    expect(getExpandLineCount('up', 10)).toBe(10);
    expect(getExpandLineCount('up', 20)).toBe(20);
    expect(getExpandLineCount('up', 5)).toBe(5);
  });

  it('should return 20 lines for down operation when gap > 20', () => {
    expect(getExpandLineCount('down', 50)).toBe(20);
    expect(getExpandLineCount('down', 100)).toBe(20);
  });

  it('should return gap size for down operation when gap ≤ 20', () => {
    expect(getExpandLineCount('down', 10)).toBe(10);
    expect(getExpandLineCount('down', 20)).toBe(20);
    expect(getExpandLineCount('down', 1)).toBe(1);
  });
});
