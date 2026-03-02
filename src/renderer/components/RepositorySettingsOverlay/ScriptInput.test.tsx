import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScriptInput, parseTextWithHighlights, TERMPAD_VARIABLES } from './ScriptInput';

describe('ScriptInput', () => {
  describe('rendering', () => {
    it('renders an input element by default (not multiline)', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="" onChange={onChange} data-testid="test-input" />);

      const input = screen.getByTestId('test-input');
      expect(input.tagName).toBe('INPUT');
    });

    it('renders a textarea element when multiline is true', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="" onChange={onChange} multiline data-testid="test-input" />);

      const textarea = screen.getByTestId('test-input');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('displays placeholder text', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value=""
          onChange={onChange}
          placeholder="Enter command"
          data-testid="test-input"
        />
      );

      expect(screen.getByPlaceholderText('Enter command')).toBeInTheDocument();
    });

    it('displays the value in the input', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="npm install" onChange={onChange} data-testid="test-input" />);

      expect(screen.getByTestId('test-input')).toHaveValue('npm install');
    });

    it('renders highlight layer', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="" onChange={onChange} data-testid="test-input" />);

      expect(screen.getByTestId('test-input-highlight')).toBeInTheDocument();
    });
  });

  describe('onChange', () => {
    it('calls onChange when input value changes', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="" onChange={onChange} data-testid="test-input" />);

      fireEvent.change(screen.getByTestId('test-input'), {
        target: { value: 'new value' },
      });

      expect(onChange).toHaveBeenCalledWith('new value');
    });

    it('calls onChange when textarea value changes (multiline)', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="" onChange={onChange} multiline data-testid="test-input" />);

      fireEvent.change(screen.getByTestId('test-input'), {
        target: { value: 'new value' },
      });

      expect(onChange).toHaveBeenCalledWith('new value');
    });
  });

  describe('variable highlighting', () => {
    it('highlights $TERMPAD_WORKSPACE_NAME variable', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value="echo $TERMPAD_WORKSPACE_NAME"
          onChange={onChange}
          data-testid="test-input"
        />
      );

      const variableSpan = screen.getByTestId('test-input-variable');
      expect(variableSpan).toBeInTheDocument();
      expect(variableSpan).toHaveTextContent('$TERMPAD_WORKSPACE_NAME');
      expect(variableSpan).toHaveClass('bg-blue-500/30');
    });

    it('highlights $TERMPAD_WORKSPACE_PATH variable', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value="cd $TERMPAD_WORKSPACE_PATH"
          onChange={onChange}
          data-testid="test-input"
        />
      );

      const variableSpan = screen.getByTestId('test-input-variable');
      expect(variableSpan).toHaveTextContent('$TERMPAD_WORKSPACE_PATH');
    });

    it('highlights $TERMPAD_ROOT_PATH variable', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput value="ls $TERMPAD_ROOT_PATH" onChange={onChange} data-testid="test-input" />
      );

      const variableSpan = screen.getByTestId('test-input-variable');
      expect(variableSpan).toHaveTextContent('$TERMPAD_ROOT_PATH');
    });

    it('highlights $TERMPAD_PORT variable', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value="npm run dev -- --port $TERMPAD_PORT"
          onChange={onChange}
          data-testid="test-input"
        />
      );

      const variableSpan = screen.getByTestId('test-input-variable');
      expect(variableSpan).toHaveTextContent('$TERMPAD_PORT');
    });

    it('highlights multiple variables', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value="echo $TERMPAD_WORKSPACE_NAME $TERMPAD_PORT"
          onChange={onChange}
          data-testid="test-input"
        />
      );

      const variableSpans = screen.getAllByTestId('test-input-variable');
      expect(variableSpans).toHaveLength(2);
      expect(variableSpans[0]).toHaveTextContent('$TERMPAD_WORKSPACE_NAME');
      expect(variableSpans[1]).toHaveTextContent('$TERMPAD_PORT');
    });

    it('does not highlight unknown TERMPAD variables', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput value="echo $TERMPAD_UNKNOWN" onChange={onChange} data-testid="test-input" />
      );

      // Should not find any highlighted variable spans
      expect(screen.queryByTestId('test-input-variable')).not.toBeInTheDocument();
    });

    it('does not highlight non-TERMPAD environment variables', () => {
      const onChange = vi.fn();
      render(<ScriptInput value="echo $HOME $PATH" onChange={onChange} data-testid="test-input" />);

      expect(screen.queryByTestId('test-input-variable')).not.toBeInTheDocument();
    });
  });

  describe('multiline mode', () => {
    it('highlights variables in multiline input', () => {
      const onChange = vi.fn();
      render(
        <ScriptInput
          value="cd $TERMPAD_WORKSPACE_PATH\nnpm install"
          onChange={onChange}
          multiline
          data-testid="test-input"
        />
      );

      const variableSpan = screen.getByTestId('test-input-variable');
      expect(variableSpan).toHaveTextContent('$TERMPAD_WORKSPACE_PATH');
    });
  });
});

describe('parseTextWithHighlights', () => {
  it('returns empty array for empty string', () => {
    const result = parseTextWithHighlights('');
    expect(result).toEqual([]);
  });

  it('returns single unhighlighted segment for text without variables', () => {
    const result = parseTextWithHighlights('npm install');
    expect(result).toEqual([{ text: 'npm install', highlighted: false }]);
  });

  it('parses text with a single variable', () => {
    const result = parseTextWithHighlights('echo $TERMPAD_PORT');
    expect(result).toEqual([
      { text: 'echo ', highlighted: false },
      { text: '$TERMPAD_PORT', highlighted: true },
    ]);
  });

  it('parses text with variable at the start', () => {
    const result = parseTextWithHighlights('$TERMPAD_PORT is the port');
    expect(result).toEqual([
      { text: '$TERMPAD_PORT', highlighted: true },
      { text: ' is the port', highlighted: false },
    ]);
  });

  it('parses text with variable at the end', () => {
    const result = parseTextWithHighlights('Port is $TERMPAD_PORT');
    expect(result).toEqual([
      { text: 'Port is ', highlighted: false },
      { text: '$TERMPAD_PORT', highlighted: true },
    ]);
  });

  it('parses text with multiple variables', () => {
    const result = parseTextWithHighlights('echo $TERMPAD_WORKSPACE_NAME at $TERMPAD_PORT');
    expect(result).toEqual([
      { text: 'echo ', highlighted: false },
      { text: '$TERMPAD_WORKSPACE_NAME', highlighted: true },
      { text: ' at ', highlighted: false },
      { text: '$TERMPAD_PORT', highlighted: true },
    ]);
  });

  it('parses text with only a variable', () => {
    const result = parseTextWithHighlights('$TERMPAD_PORT');
    expect(result).toEqual([{ text: '$TERMPAD_PORT', highlighted: true }]);
  });

  it('does not highlight unknown TERMPAD variables', () => {
    const result = parseTextWithHighlights('echo $TERMPAD_UNKNOWN');
    expect(result).toEqual([
      { text: 'echo ', highlighted: false },
      { text: '$TERMPAD_UNKNOWN', highlighted: false },
    ]);
  });

  it('handles adjacent variables', () => {
    const result = parseTextWithHighlights('$TERMPAD_PORT$TERMPAD_ROOT_PATH');
    expect(result).toEqual([
      { text: '$TERMPAD_PORT', highlighted: true },
      { text: '$TERMPAD_ROOT_PATH', highlighted: true },
    ]);
  });
});

describe('TERMPAD_VARIABLES', () => {
  it('contains all expected variables', () => {
    expect(TERMPAD_VARIABLES).toContain('$TERMPAD_WORKSPACE_NAME');
    expect(TERMPAD_VARIABLES).toContain('$TERMPAD_WORKSPACE_PATH');
    expect(TERMPAD_VARIABLES).toContain('$TERMPAD_ROOT_PATH');
    expect(TERMPAD_VARIABLES).toContain('$TERMPAD_PORT');
  });

  it('contains exactly 4 variables', () => {
    expect(TERMPAD_VARIABLES).toHaveLength(4);
  });
});
