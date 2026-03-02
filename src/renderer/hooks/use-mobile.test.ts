import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

describe('useIsMobile', () => {
  // Store original values
  const originalInnerWidth = window.innerWidth;
  let mqlChangeHandler: (() => void) | null = null;
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let removeEventListenerSpy: ReturnType<typeof vi.fn>;

  // Helper to set window innerWidth
  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  };

  beforeEach(() => {
    mqlChangeHandler = null;
    addEventListenerSpy = vi.fn((event: string, handler: () => void) => {
      if (event === 'change') {
        mqlChangeHandler = handler;
      }
    });
    removeEventListenerSpy = vi.fn();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
        dispatchEvent: vi.fn(),
      })),
    });

    // Default to desktop width
    setWindowWidth(1024);
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('initial state', () => {
    it('should return false initially before effect runs', () => {
      const { result } = renderHook(() => useIsMobile());
      // After effect runs, it should be false for desktop width
      expect(result.current).toBe(false);
    });

    it('should return false for desktop width (>= 768)', () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });

    it('should return true for mobile width (< 768)', () => {
      setWindowWidth(375);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('should return false for exact breakpoint (768)', () => {
      setWindowWidth(768);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });

    it('should return true for width just below breakpoint (767)', () => {
      setWindowWidth(767);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });
  });

  describe('matchMedia setup', () => {
    it('should call matchMedia with correct query', () => {
      renderHook(() => useIsMobile());
      expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    });

    it('should add event listener for change event', () => {
      renderHook(() => useIsMobile());
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => useIsMobile());
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should use same handler for add and remove listener', () => {
      const { unmount } = renderHook(() => useIsMobile());

      const addedHandler = addEventListenerSpy.mock.calls[0][1];
      unmount();
      const removedHandler = removeEventListenerSpy.mock.calls[0][1];

      expect(addedHandler).toBe(removedHandler);
    });
  });

  describe('responsive behavior', () => {
    it('should update to mobile when window resizes to small', () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);

      act(() => {
        setWindowWidth(375);
        mqlChangeHandler?.();
      });

      expect(result.current).toBe(true);
    });

    it('should update to desktop when window resizes to large', () => {
      setWindowWidth(375);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);

      act(() => {
        setWindowWidth(1024);
        mqlChangeHandler?.();
      });

      expect(result.current).toBe(false);
    });

    it('should update correctly when crossing breakpoint from below', () => {
      setWindowWidth(767);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);

      act(() => {
        setWindowWidth(768);
        mqlChangeHandler?.();
      });

      expect(result.current).toBe(false);
    });

    it('should update correctly when crossing breakpoint from above', () => {
      setWindowWidth(768);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);

      act(() => {
        setWindowWidth(767);
        mqlChangeHandler?.();
      });

      expect(result.current).toBe(true);
    });

    it('should handle multiple resize events', () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);

      // Resize to mobile
      act(() => {
        setWindowWidth(500);
        mqlChangeHandler?.();
      });
      expect(result.current).toBe(true);

      // Resize back to desktop
      act(() => {
        setWindowWidth(900);
        mqlChangeHandler?.();
      });
      expect(result.current).toBe(false);

      // Resize to mobile again
      act(() => {
        setWindowWidth(320);
        mqlChangeHandler?.();
      });
      expect(result.current).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle width of 0', () => {
      setWindowWidth(0);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('should handle very large width', () => {
      setWindowWidth(10000);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });

    it('should handle width of 1', () => {
      setWindowWidth(1);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('should convert undefined initial state to false', () => {
      // The hook internally uses !!isMobile which converts undefined to false
      // This is tested implicitly but we verify the boolean coercion
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(typeof result.current).toBe('boolean');
      expect(result.current).toBe(false);
    });
  });

  describe('SSR safety', () => {
    it('should return boolean value (not undefined)', () => {
      const { result } = renderHook(() => useIsMobile());
      expect(typeof result.current).toBe('boolean');
    });

    it('should handle re-renders without issues', () => {
      const { result, rerender } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);

      rerender();
      expect(result.current).toBe(false);

      rerender();
      expect(result.current).toBe(false);
    });
  });

  describe('multiple hook instances', () => {
    it('should work independently when multiple hooks are used', () => {
      setWindowWidth(1024);

      const { result: result1 } = renderHook(() => useIsMobile());
      const { result: result2 } = renderHook(() => useIsMobile());

      expect(result1.current).toBe(false);
      expect(result2.current).toBe(false);
    });

    it('should each set up their own event listeners', () => {
      renderHook(() => useIsMobile());
      renderHook(() => useIsMobile());

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });

    it('should each clean up their own event listeners', () => {
      const { unmount: unmount1 } = renderHook(() => useIsMobile());
      const { unmount: unmount2 } = renderHook(() => useIsMobile());

      unmount1();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);

      unmount2();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
    });
  });
});
