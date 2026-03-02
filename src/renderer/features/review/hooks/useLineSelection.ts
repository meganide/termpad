import { useState, useCallback, useRef, useEffect } from 'react';

interface LineSelection {
  startLine: number;
  endLine: number;
  side: 'old' | 'new';
}

interface UseLineSelectionOptions {
  onSelectionComplete?: (selection: LineSelection) => void;
}

interface UseLineSelectionReturn {
  selection: LineSelection | null;
  isSelecting: boolean;
  selectedLines: Set<number>;
  handleLineMouseDown: (lineNumber: number, side: 'old' | 'new') => void;
  handleLineMouseEnter: (lineNumber: number) => void;
  handleLineMouseUp: () => void;
  clearSelection: () => void;
}

export function useLineSelection(
  options: UseLineSelectionOptions = {}
): UseLineSelectionReturn {
  const { onSelectionComplete } = options;

  const [selection, setSelection] = useState<LineSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const startLineRef = useRef<number | null>(null);
  const sideRef = useRef<'old' | 'new'>('new');

  // Compute selected lines as a Set for efficient lookup
  const selectedLines = new Set<number>();
  if (selection) {
    const start = Math.min(selection.startLine, selection.endLine);
    const end = Math.max(selection.startLine, selection.endLine);
    for (let i = start; i <= end; i++) {
      selectedLines.add(i);
    }
  }

  const handleLineMouseDown = useCallback((lineNumber: number, side: 'old' | 'new') => {
    setIsSelecting(true);
    startLineRef.current = lineNumber;
    sideRef.current = side;
    setSelection({
      startLine: lineNumber,
      endLine: lineNumber,
      side,
    });
  }, []);

  const handleLineMouseEnter = useCallback((lineNumber: number) => {
    if (isSelecting && startLineRef.current !== null) {
      setSelection({
        startLine: startLineRef.current,
        endLine: lineNumber,
        side: sideRef.current,
      });
    }
  }, [isSelecting]);

  const handleLineMouseUp = useCallback(() => {
    if (isSelecting && selection) {
      setIsSelecting(false);
      // Normalize the selection so startLine is always <= endLine
      const normalizedSelection: LineSelection = {
        startLine: Math.min(selection.startLine, selection.endLine),
        endLine: Math.max(selection.startLine, selection.endLine),
        side: selection.side,
      };
      setSelection(normalizedSelection);
      onSelectionComplete?.(normalizedSelection);
    }
  }, [isSelecting, selection, onSelectionComplete]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
    startLineRef.current = null;
  }, []);

  // Handle mouseup outside the selection area
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        handleLineMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelecting, handleLineMouseUp]);

  return {
    selection,
    isSelecting,
    selectedLines,
    handleLineMouseDown,
    handleLineMouseEnter,
    handleLineMouseUp,
    clearSelection,
  };
}
