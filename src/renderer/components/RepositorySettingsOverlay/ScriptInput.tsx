import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Environment variables that should be highlighted
const TERMPAD_VARIABLES = [
  '$TERMPAD_WORKSPACE_NAME',
  '$TERMPAD_WORKSPACE_PATH',
  '$TERMPAD_ROOT_PATH',
  '$TERMPAD_PORT',
];

// Create regex pattern that matches any TERMPAD_* variable
const VARIABLE_REGEX = /(\$TERMPAD_\w+)/g;

// Default height for multiline script inputs
const DEFAULT_MULTILINE_HEIGHT = 120;

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * Parses text and returns segments with highlighting info
 */
function parseTextWithHighlights(text: string): Array<{ text: string; highlighted: boolean }> {
  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;

  // Find all matches
  const regex = new RegExp(VARIABLE_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match (if any)
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        highlighted: false,
      });
    }

    // Check if this is a known TERMPAD variable
    const variable = match[1];
    const isKnown = TERMPAD_VARIABLES.includes(variable);

    segments.push({
      text: variable,
      highlighted: isKnown,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlighted: false,
    });
  }

  // If no segments, return the whole text as unhighlighted
  if (segments.length === 0 && text.length > 0) {
    segments.push({ text, highlighted: false });
  }

  return segments;
}

/**
 * ScriptInput - A textarea/input component that highlights TERMPAD_* environment variables.
 *
 * Uses an overlay technique: a transparent input sits over a styled div that shows
 * the highlighted content. This gives native editing behavior while showing custom styling.
 */
export function ScriptInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  className,
  'data-testid': testId,
}: ScriptInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync scroll position between input and highlight layer
  const syncScroll = useCallback(() => {
    const input = inputRef.current;
    const highlight = highlightRef.current;

    if (!input || !highlight) return;

    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }, []);

  // Sync highlight layer size when textarea is resized
  const syncSize = useCallback(() => {
    const input = inputRef.current;
    const highlight = highlightRef.current;

    if (!input || !highlight || !multiline) return;

    // Match the highlight layer dimensions to the textarea
    highlight.style.height = `${input.offsetHeight}px`;
    highlight.style.width = `${input.offsetWidth}px`;
  }, [multiline]);

  useEffect(() => {
    const input = inputRef.current;
    const container = containerRef.current;

    if (!input) return;

    input.addEventListener('scroll', syncScroll);

    // Use ResizeObserver to detect textarea resize
    let resizeObserver: ResizeObserver | null = null;
    if (multiline && container) {
      resizeObserver = new ResizeObserver(() => {
        syncSize();
        syncScroll();
      });
      resizeObserver.observe(input);
    }

    // Initial sync
    syncSize();

    return () => {
      input.removeEventListener('scroll', syncScroll);
      resizeObserver?.disconnect();
    };
  }, [syncScroll, syncSize, multiline]);

  const segments = parseTextWithHighlights(value);

  // Common classes for both input types
  const baseClasses = cn(
    'w-full px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm',
    'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40',
    'font-mono',
    className
  );

  // Highlight layer classes - needs to match textarea exactly for scroll sync
  const highlightClasses = cn(
    'absolute top-0 left-0 px-3 py-2 text-sm font-mono pointer-events-none whitespace-pre-wrap break-words overflow-hidden',
    'rounded-lg border border-transparent',
    !multiline && 'whitespace-nowrap'
  );

  const renderHighlight = () => (
    <div
      ref={highlightRef}
      className={highlightClasses}
      data-testid={testId ? `${testId}-highlight` : undefined}
      aria-hidden="true"
    >
      {segments.map((segment, index) =>
        segment.highlighted ? (
          // Show background highlight only - text is transparent so input text shows through
          <span
            key={index}
            className="text-transparent bg-blue-500/30 rounded-sm"
            data-testid={testId ? `${testId}-variable` : undefined}
          >
            {segment.text}
          </span>
        ) : (
          // Transparent text to maintain spacing
          <span key={index} className="text-transparent">
            {segment.text}
          </span>
        )
      )}
    </div>
  );

  if (multiline) {
    return (
      <div ref={containerRef} className="relative">
        {renderHighlight()}
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(baseClasses, 'resize-y relative bg-transparent')}
          style={{ minHeight: DEFAULT_MULTILINE_HEIGHT }}
          data-testid={testId}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {renderHighlight()}
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(baseClasses, 'h-9 relative bg-transparent')}
        data-testid={testId}
      />
    </div>
  );
}

// Export the parse function for testing
export { parseTextWithHighlights, TERMPAD_VARIABLES };
