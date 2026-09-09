import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useResizeSelectionLock } from '../../hooks/useResizeSelectionLock';

const clampWidth = (width: number) => Math.min(80, Math.max(20, width));

export function BrowserInspectorDivider({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}) {
  const [drag, setDrag] = useState<{
    x: number;
    width: number;
    availableWidth: number;
  } | null>(null);
  const { start, stop } = useResizeSelectionLock();

  useEffect(() => {
    if (!drag) return;
    start();
    const move = (event: MouseEvent) => {
      onResize(clampWidth(drag.width + ((drag.x - event.clientX) / drag.availableWidth) * 100));
    };
    const end = () => setDrag(null);
    document.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('blur', end);
    return () => {
      document.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('blur', end);
      stop();
    };
  }, [drag, onResize, start, stop]);

  return (
    <>
      <div
        role="separator"
        aria-label="Resize DevTools"
        aria-orientation="vertical"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`DevTools width ${Math.round(width)}%`}
        tabIndex={0}
        title="Drag to resize DevTools. Double-click to reset."
        className="w-[6px] shrink-0 cursor-col-resize bg-border hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline focus-visible:outline-ring"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          const availableWidth =
            (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0) - 6;
          if (availableWidth <= 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          setDrag({ x: event.clientX, width, availableWidth });
        }}
        onDoubleClick={() => onResize(50)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          onResize(clampWidth(width + (event.key === 'ArrowLeft' ? 5 : -5)));
        }}
      />
      {drag &&
        // Cover guest pages so they cannot swallow mouse events. The native
        // inspector's existing occlusion check hides it until this overlay goes away.
        createPortal(
          <div
            data-testid="browser-resize-overlay"
            className="fixed inset-0 z-50 cursor-col-resize"
          />,
          document.body
        )}
    </>
  );
}
