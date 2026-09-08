import { useRef } from 'react';
import type { TerminalSplitView } from '../../../shared/types';
import { cn } from '../../lib/utils';

interface SplitResizeHandleProps {
  direction: TerminalSplitView['direction'];
  sizes: number[];
  index: number;
  onResize: (sizes: number[]) => void;
}

export function SplitResizeHandle({ direction, sizes, index, onResize }: SplitResizeHandleProps) {
  const drag = useRef<{ start: number; extent: number; sizes: number[] } | null>(null);
  const horizontal = direction === 'horizontal';
  const pairSize = sizes[index - 1] + sizes[index];
  const resizePair = (initial: number[], delta: number) => {
    const total = initial[index - 1] + initial[index];
    const minimum = Math.min(10, total / 3);
    const first = Math.max(minimum, Math.min(total - minimum, initial[index - 1] + delta));
    const next = [...initial];
    next[index - 1] = first;
    next[index] = total - first;
    onResize(next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={`Resize terminal panes ${index} and ${index + 1}`}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round((sizes[index - 1] / pairSize) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'group flex shrink-0 touch-none items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        horizontal ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'
      )}
      style={{ order: index * 2 - 1 }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const parent = event.currentTarget.parentElement;
        if (!parent) return;
        const extent =
          (horizontal ? parent.clientWidth : parent.clientHeight) - 16 - (sizes.length - 1) * 8;
        if (extent <= 0) return;
        drag.current = {
          start: horizontal ? event.clientX : event.clientY,
          extent,
          sizes: [...sizes],
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const { start, extent, sizes: initial } = drag.current;
        resizePair(
          initial,
          (((horizontal ? event.clientX : event.clientY) - start) / extent) * 100
        );
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={() => resizePair(sizes, pairSize / 2 - sizes[index - 1])}
      onKeyDown={(event) => {
        const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp';
        const increase = horizontal ? 'ArrowRight' : 'ArrowDown';
        if (event.key !== decrease && event.key !== increase && event.key !== 'Home') return;
        event.preventDefault();
        event.stopPropagation();
        resizePair(
          sizes,
          event.key === 'Home' ? pairSize / 2 - sizes[index - 1] : event.key === decrease ? -2 : 2
        );
      }}
    >
      <span
        className={cn(
          'rounded bg-border group-hover:bg-lime-500/60 group-focus-visible:bg-lime-500/60',
          horizontal ? 'h-8 w-1' : 'h-1 w-8'
        )}
      />
    </div>
  );
}
