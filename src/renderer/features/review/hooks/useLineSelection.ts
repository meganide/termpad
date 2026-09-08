import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

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

export function useLineSelection(options: UseLineSelectionOptions = {}): UseLineSelectionReturn {
  const { onSelectionComplete } = options;

  const [selection, setSelection] = useState<LineSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const startLineRef = useRef<number | null>(null);
  const sideRef = useRef<'old' | 'new'>('new');
  const selectingRef = useRef(false);

  const selectedLines = useMemo(() => {
    const lines = new Set<number>();
    if (selection) {
      for (
        let line = Math.min(selection.startLine, selection.endLine);
        line <= Math.max(selection.startLine, selection.endLine);
        line++
      )
        lines.add(line);
    }
    return lines;
  }, [selection]);

  const handleLineMouseDown = useCallback((lineNumber: number, side: 'old' | 'new') => {
    selectingRef.current = true;
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
    if (selectingRef.current && startLineRef.current !== null) {
      setSelection({
        startLine: startLineRef.current,
        endLine: lineNumber,
        side: sideRef.current,
      });
    }
  }, []);

  const handleLineMouseUp = useCallback(() => {
    if (isSelecting && selection) {
      selectingRef.current = false;
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
    selectingRef.current = false;
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
