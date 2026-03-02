import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLineSelection } from './useLineSelection';

describe('useLineSelection', () => {
  it('should initialize with no selection', () => {
    const { result } = renderHook(() => useLineSelection());

    expect(result.current.selection).toBeNull();
    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectedLines.size).toBe(0);
  });

  it('should start selection on mousedown', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(10, 'new');
    });

    expect(result.current.isSelecting).toBe(true);
    expect(result.current.selection).toEqual({
      startLine: 10,
      endLine: 10,
      side: 'new',
    });
    expect(result.current.selectedLines.has(10)).toBe(true);
  });

  it('should expand selection on mouseenter during selection', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(10, 'new');
    });

    act(() => {
      result.current.handleLineMouseEnter(15);
    });

    expect(result.current.selection).toEqual({
      startLine: 10,
      endLine: 15,
      side: 'new',
    });

    // Check that all lines between 10 and 15 are selected
    expect(result.current.selectedLines.size).toBe(6);
    for (let i = 10; i <= 15; i++) {
      expect(result.current.selectedLines.has(i)).toBe(true);
    }
  });

  it('should handle reverse selection (dragging up)', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(15, 'new');
    });

    act(() => {
      result.current.handleLineMouseEnter(10);
    });

    expect(result.current.selection).toEqual({
      startLine: 15,
      endLine: 10,
      side: 'new',
    });

    // Selected lines should still include all lines in range
    expect(result.current.selectedLines.size).toBe(6);
    for (let i = 10; i <= 15; i++) {
      expect(result.current.selectedLines.has(i)).toBe(true);
    }
  });

  it('should not expand selection when not actively selecting', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseEnter(15);
    });

    expect(result.current.selection).toBeNull();
    expect(result.current.isSelecting).toBe(false);
  });

  it('should normalize selection on mouseup', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(15, 'new');
    });

    act(() => {
      result.current.handleLineMouseEnter(10);
    });

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selection).toEqual({
      startLine: 10,
      endLine: 15,
      side: 'new',
    });
  });

  it('should call onSelectionComplete callback on mouseup', () => {
    const onSelectionComplete = vi.fn();
    const { result } = renderHook(() =>
      useLineSelection({ onSelectionComplete })
    );

    act(() => {
      result.current.handleLineMouseDown(10, 'new');
    });

    act(() => {
      result.current.handleLineMouseEnter(15);
    });

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(onSelectionComplete).toHaveBeenCalledWith({
      startLine: 10,
      endLine: 15,
      side: 'new',
    });
  });

  it('should clear selection when clearSelection is called', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(10, 'new');
    });

    act(() => {
      result.current.handleLineMouseEnter(15);
    });

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(result.current.selection).not.toBeNull();

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selection).toBeNull();
    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectedLines.size).toBe(0);
  });

  it('should handle single-line selection', () => {
    const onSelectionComplete = vi.fn();
    const { result } = renderHook(() =>
      useLineSelection({ onSelectionComplete })
    );

    act(() => {
      result.current.handleLineMouseDown(10, 'new');
    });

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(result.current.selection).toEqual({
      startLine: 10,
      endLine: 10,
      side: 'new',
    });
    expect(result.current.selectedLines.size).toBe(1);
    expect(result.current.selectedLines.has(10)).toBe(true);
  });

  it('should track the correct side during selection', () => {
    const { result } = renderHook(() => useLineSelection());

    act(() => {
      result.current.handleLineMouseDown(10, 'old');
    });

    expect(result.current.selection?.side).toBe('old');

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(result.current.selection?.side).toBe('old');
  });

  it('should handle selection on old side', () => {
    const onSelectionComplete = vi.fn();
    const { result } = renderHook(() =>
      useLineSelection({ onSelectionComplete })
    );

    act(() => {
      result.current.handleLineMouseDown(5, 'old');
    });

    act(() => {
      result.current.handleLineMouseEnter(8);
    });

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(onSelectionComplete).toHaveBeenCalledWith({
      startLine: 5,
      endLine: 8,
      side: 'old',
    });
  });

  it('should not call onSelectionComplete when mouseup without selection', () => {
    const onSelectionComplete = vi.fn();
    const { result } = renderHook(() =>
      useLineSelection({ onSelectionComplete })
    );

    act(() => {
      result.current.handleLineMouseUp();
    });

    expect(onSelectionComplete).not.toHaveBeenCalled();
  });
});
