import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useResizeSelectionLock } from './useResizeSelectionLock';

const selectionEvent = () => new Event('selectstart', { bubbles: true, cancelable: true });

describe('resize selection lock', () => {
  it.each(['mouseup', 'pointerup', 'pointercancel', 'blur'])(
    'blocks text selection until %s',
    (endEvent) => {
      const { result } = renderHook(useResizeSelectionLock);
      act(() => result.current.start());
      const duringDrag = selectionEvent();
      document.dispatchEvent(duringDrag);
      expect(duringDrag.defaultPrevented).toBe(true);
      expect(document.querySelector('[data-resize-selection-lock]')?.textContent).toContain(
        'user-select: none !important'
      );
      fireEvent(window, new Event(endEvent));
      const afterDrag = selectionEvent();
      document.dispatchEvent(afterDrag);
      expect(afterDrag.defaultPrevented).toBe(false);
      expect(document.querySelector('[data-resize-selection-lock]')).toBeNull();
    }
  );

  it('restores selection if the resizing component unmounts', () => {
    const { result, unmount } = renderHook(useResizeSelectionLock);
    act(() => result.current.start());
    unmount();
    const event = selectionEvent();
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-resize-selection-lock]')).toBeNull();
  });
});
