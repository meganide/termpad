import { useCallback, useEffect, useRef } from 'react';

/** Suppress native selection across the whole window for the duration of a resize. */
export function useResizeSelectionLock() {
  const cleanupRef = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    // Descendants such as code and rich-text editors explicitly enable selection,
    // so setting user-select on the resize handle or body alone is insufficient.
    const style = document.createElement('style');
    style.dataset.resizeSelectionLock = '';
    style.textContent = '* { user-select: none !important; -webkit-user-select: none !important; }';
    document.head.appendChild(style);
    window.getSelection()?.removeAllRanges();
    const preventSelection = (event: Event) => event.preventDefault();
    document.addEventListener('selectstart', preventSelection, true);
    const endEvents = ['mouseup', 'pointerup', 'pointercancel', 'blur'];
    for (const event of endEvents) window.addEventListener(event, stop);
    cleanupRef.current = () => {
      style.remove();
      document.removeEventListener('selectstart', preventSelection, true);
      for (const event of endEvents) window.removeEventListener(event, stop);
    };
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { start, stop };
}
