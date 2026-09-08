import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewFile } from './ReviewFile';
import { createReviewStore, ReviewStoreContext } from '@/stores/reviewStore';
import type { DiffFile } from '../../../../shared/reviewTypes';

const renderFile = vi.hoisted(() => vi.fn());
vi.mock('./FileDiff', () => ({
  FileDiff: (props: { file: DiffFile }) => {
    renderFile(props);
    return <div data-testid="mounted-diff">{props.file.path}</div>;
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe('deferred review files', () => {
  it('mounts near the viewport, skips unchanged renders, and preserves mounted drafts', () => {
    let intersect!: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersect = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      }
    );
    const store = createReviewStore();
    const props = {
      file: {
        path: 'a.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
        isBinary: false,
        hunks: [],
      } as DiffFile,
      viewMode: 'unified' as const,
      isExpanded: true,
      isViewed: false,
      selectedLines: new Set<number>(),
      forceMount: false,
      onRegister: vi.fn(),
      onToggleExpand: vi.fn(),
      onMarkViewed: vi.fn(),
      onCommentClick: vi.fn(),
      onLineMouseDown: vi.fn(),
    };
    const view = (forceMount = false) => (
      <ReviewStoreContext.Provider value={store}>
        <ReviewFile {...props} forceMount={forceMount} />
      </ReviewStoreContext.Provider>
    );
    renderFile.mockClear();
    const { rerender } = render(view());
    expect(screen.queryByTestId('mounted-diff')).not.toBeInTheDocument();
    act(() =>
      intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    );
    expect(screen.getByTestId('mounted-diff')).toBeInTheDocument();
    const calls = renderFile.mock.calls.length;
    rerender(view());
    expect(renderFile).toHaveBeenCalledTimes(calls);
    rerender(view(true));
    rerender(view(false));
    expect(screen.getByTestId('mounted-diff')).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });
});
