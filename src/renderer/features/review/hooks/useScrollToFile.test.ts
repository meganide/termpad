import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollToFile } from './useScrollToFile';

describe('useScrollToFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty refs and no highlighted file', () => {
    const { result } = renderHook(() => useScrollToFile());

    expect(result.current.fileRefs.current.size).toBe(0);
    expect(result.current.highlightedFile).toBeNull();
  });

  it('should register file refs', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement = document.createElement('div');

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement);
    });

    expect(result.current.fileRefs.current.get('src/file1.ts')).toBe(mockElement);
  });

  it('should unregister file refs when passed null', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement = document.createElement('div');

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement);
    });

    expect(result.current.fileRefs.current.has('src/file1.ts')).toBe(true);

    act(() => {
      result.current.registerFileRef('src/file1.ts', null);
    });

    expect(result.current.fileRefs.current.has('src/file1.ts')).toBe(false);
  });

  it('should scroll to file and highlight it', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement = document.createElement('div');
    mockElement.scrollIntoView = vi.fn();

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement);
    });

    act(() => {
      result.current.scrollToFile('src/file1.ts');
    });

    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(result.current.highlightedFile).toBe('src/file1.ts');
  });

  it('should clear highlight after timeout', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement = document.createElement('div');
    mockElement.scrollIntoView = vi.fn();

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement);
    });

    act(() => {
      result.current.scrollToFile('src/file1.ts');
    });

    expect(result.current.highlightedFile).toBe('src/file1.ts');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.highlightedFile).toBeNull();
  });

  it('should not scroll if file ref does not exist', () => {
    const { result } = renderHook(() => useScrollToFile());

    act(() => {
      result.current.scrollToFile('non-existent.ts');
    });

    expect(result.current.highlightedFile).toBeNull();
  });

  it('should cancel previous highlight when scrolling to new file', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement1 = document.createElement('div');
    mockElement1.scrollIntoView = vi.fn();
    const mockElement2 = document.createElement('div');
    mockElement2.scrollIntoView = vi.fn();

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement1);
      result.current.registerFileRef('src/file2.ts', mockElement2);
    });

    act(() => {
      result.current.scrollToFile('src/file1.ts');
    });

    expect(result.current.highlightedFile).toBe('src/file1.ts');

    // Scroll to second file before timeout
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.scrollToFile('src/file2.ts');
    });

    expect(result.current.highlightedFile).toBe('src/file2.ts');

    // Advance past original timeout - should still show file2
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.highlightedFile).toBe('src/file2.ts');

    // Advance past second timeout
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.highlightedFile).toBeNull();
  });

  it('should handle multiple file registrations', () => {
    const { result } = renderHook(() => useScrollToFile());

    const mockElement1 = document.createElement('div');
    const mockElement2 = document.createElement('div');
    const mockElement3 = document.createElement('div');

    act(() => {
      result.current.registerFileRef('src/file1.ts', mockElement1);
      result.current.registerFileRef('src/file2.ts', mockElement2);
      result.current.registerFileRef('src/file3.ts', mockElement3);
    });

    expect(result.current.fileRefs.current.size).toBe(3);
    expect(result.current.fileRefs.current.get('src/file1.ts')).toBe(mockElement1);
    expect(result.current.fileRefs.current.get('src/file2.ts')).toBe(mockElement2);
    expect(result.current.fileRefs.current.get('src/file3.ts')).toBe(mockElement3);
  });
});
