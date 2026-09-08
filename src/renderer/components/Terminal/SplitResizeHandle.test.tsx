import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitResizeHandle } from './SplitResizeHandle';

describe('SplitResizeHandle', () => {
  it.each(['horizontal', 'vertical'] as const)(
    'resizes %s panes with the keyboard and resets their sizes',
    (direction) => {
      const onResize = vi.fn();
      render(
        <SplitResizeHandle direction={direction} sizes={[60, 40]} index={1} onResize={onResize} />
      );
      const separator = screen.getByRole('separator');
      fireEvent.keyDown(separator, {
        key: direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown',
      });
      expect(onResize).toHaveBeenLastCalledWith([62, 38]);
      fireEvent.keyDown(separator, { key: 'Home' });
      expect(onResize).toHaveBeenLastCalledWith([50, 50]);
    }
  );

  it('keeps adjacent panes usable and does not resize other panes', () => {
    const onResize = vi.fn();
    render(
      <SplitResizeHandle
        direction="horizontal"
        sizes={[40, 50, 10]}
        index={2}
        onResize={onResize}
      />
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenCalledWith([40, 50, 10]);
  });
});
