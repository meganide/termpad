import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyTerminalState } from './EmptyTerminalState';
import { useAppStore } from '../../stores/appStore';
import { resetAllStores } from '../../../../tests/utils';

describe('EmptyTerminalState', () => {
  const createMockProps = (defaultPreset?: { name: string; command: string; icon: string }) => ({
    onCreateTab: vi.fn(),
    defaultPreset,
  });

  beforeEach(() => {
    resetAllStores();
    // Set focusArea to mainTerminal so Enter key tests work
    useAppStore.setState({ focusArea: 'mainTerminal' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('without default preset', () => {
    it('renders the empty state UI with "Terminal" as default', () => {
      const props = createMockProps();
      render(<EmptyTerminalState {...props} />);

      expect(screen.getByText('No Terminal Tabs')).toBeInTheDocument();
      expect(screen.getByText(/Press Enter or click below to start Terminal/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start terminal/i })).toBeInTheDocument();
    });

    it('calls onCreateTab with undefined when button is clicked (plain shell)', () => {
      const props = createMockProps();
      render(<EmptyTerminalState {...props} />);

      const button = screen.getByRole('button', { name: /start terminal/i });
      fireEvent.click(button);

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith(undefined, undefined, undefined);
    });

    it('calls onCreateTab with undefined when Enter key is pressed (plain shell)', () => {
      const props = createMockProps();
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe('with Claude default preset', () => {
    const claudePreset = { name: 'Claude', command: 'claude', icon: 'sparkles' };

    it('renders the empty state UI with Claude preset', () => {
      const props = createMockProps(claudePreset);
      render(<EmptyTerminalState {...props} />);

      expect(screen.getByText('No Terminal Tabs')).toBeInTheDocument();
      expect(screen.getByText(/Press Enter or click below to start Claude/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start claude/i })).toBeInTheDocument();
    });

    it('calls onCreateTab with name and command when button is clicked', () => {
      const props = createMockProps(claudePreset);
      render(<EmptyTerminalState {...props} />);

      const button = screen.getByRole('button', { name: /start claude/i });
      fireEvent.click(button);

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith('Claude', 'claude', 'sparkles');
    });

    it('calls onCreateTab with name and command when Enter key is pressed', () => {
      const props = createMockProps(claudePreset);
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith('Claude', 'claude', 'sparkles');
    });
  });

  describe('with custom preset', () => {
    const customPreset = { name: 'Gemini', command: 'gemini', icon: 'bot' };

    it('renders the empty state UI with custom preset name', () => {
      const props = createMockProps(customPreset);
      render(<EmptyTerminalState {...props} />);

      expect(screen.getByText('No Terminal Tabs')).toBeInTheDocument();
      expect(screen.getByText(/Press Enter or click below to start Gemini/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start gemini/i })).toBeInTheDocument();
    });

    it('calls onCreateTab with custom name and command when button is clicked', () => {
      const props = createMockProps(customPreset);
      render(<EmptyTerminalState {...props} />);

      const button = screen.getByRole('button', { name: /start gemini/i });
      fireEvent.click(button);

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith('Gemini', 'gemini', 'bot');
    });

    it('calls onCreateTab with custom name and command when Enter key is pressed', () => {
      const props = createMockProps(customPreset);
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith('Gemini', 'gemini', 'bot');
    });
  });

  describe('with "Terminal" preset (empty command)', () => {
    const terminalPreset = { name: 'Terminal', command: '', icon: 'terminal' };

    it('calls onCreateTab with name and undefined command for empty command (plain shell)', () => {
      const props = createMockProps(terminalPreset);
      render(<EmptyTerminalState {...props} />);

      const button = screen.getByRole('button', { name: /start terminal/i });
      fireEvent.click(button);

      expect(props.onCreateTab).toHaveBeenCalledTimes(1);
      expect(props.onCreateTab).toHaveBeenCalledWith('Terminal', undefined, 'terminal');
    });
  });

  describe('keyboard handling', () => {
    it('does not call onCreateTab when Enter is pressed with modifier keys', () => {
      const props = createMockProps({ name: 'Claude', command: 'claude', icon: 'sparkles' });
      render(<EmptyTerminalState {...props} />);

      // Test with Ctrl
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      expect(props.onCreateTab).not.toHaveBeenCalled();

      // Test with Shift
      fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
      expect(props.onCreateTab).not.toHaveBeenCalled();

      // Test with Alt
      fireEvent.keyDown(window, { key: 'Enter', altKey: true });
      expect(props.onCreateTab).not.toHaveBeenCalled();

      // Test with Meta
      fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
      expect(props.onCreateTab).not.toHaveBeenCalled();
    });

    it('does not call onCreateTab when other keys are pressed', () => {
      const props = createMockProps({ name: 'Claude', command: 'claude', icon: 'sparkles' });
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Space' });
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.keyDown(window, { key: 'a' });

      expect(props.onCreateTab).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const props = createMockProps({ name: 'Claude', command: 'claude', icon: 'sparkles' });

      const { unmount } = render(<EmptyTerminalState {...props} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('does not call onCreateTab when Enter is pressed while sidebar is focused', () => {
      useAppStore.setState({ focusArea: 'sidebar' });
      const props = createMockProps({ name: 'Claude', command: 'claude', icon: 'sparkles' });
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(props.onCreateTab).not.toHaveBeenCalled();
    });

    it('does not call onCreateTab when Enter is pressed while userTerminal is focused', () => {
      useAppStore.setState({ focusArea: 'userTerminal' });
      const props = createMockProps({ name: 'Claude', command: 'claude', icon: 'sparkles' });
      render(<EmptyTerminalState {...props} />);

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(props.onCreateTab).not.toHaveBeenCalled();
    });
  });
});
