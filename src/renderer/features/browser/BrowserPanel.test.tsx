import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrowserPanel } from './BrowserPanel';

function navigate(address: string) {
  if (!screen.queryByRole('textbox', { name: 'Browser address' }))
    fireEvent.click(screen.getByRole('button', { name: 'New browser tab' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Browser address' }), {
    target: { value: address },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Go' }));
}

describe('BrowserPanel', () => {
  it('resizes DevTools by dragging, clamps both panes, and ends dragging on blur', () => {
    const { container, unmount } = render(
      <BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />
    );
    navigate('localhost:3000');
    Object.assign(container.querySelector('webview')!, { getWebContentsId: () => 42 });
    fireEvent(container.querySelector('webview')!, new Event('did-start-loading'));
    fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }));
    const content = screen.getByTestId('browser-content');
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({ width: 1006 } as DOMRect);
    const divider = screen.getByRole('separator', { name: 'Resize DevTools' });
    const inspector = screen.getByRole('region', { name: 'Browser DevTools' });
    fireEvent.mouseDown(divider, { button: 0, clientX: 600 });
    expect(screen.getByTestId('browser-resize-overlay')).toBeInTheDocument();
    fireEvent.mouseMove(document, { clientX: 400 });
    expect(divider).toHaveAttribute('aria-valuenow', '70');
    expect(inspector.style.width).toContain('0.7');
    fireEvent.mouseMove(document, { clientX: -1000 });
    expect(divider).toHaveAttribute('aria-valuenow', '80');
    fireEvent.mouseMove(document, { clientX: 3000 });
    expect(divider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.blur(window);
    expect(screen.queryByTestId('browser-resize-overlay')).not.toBeInTheDocument();
    fireEvent.mouseMove(document, { clientX: 600 });
    expect(divider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.mouseDown(divider, { button: 0, clientX: 600 });
    fireEvent.mouseUp(window);
    expect(screen.queryByTestId('browser-resize-overlay')).not.toBeInTheDocument();
    fireEvent.mouseDown(divider, { button: 0, clientX: 600 });
    unmount();
    expect(screen.queryByTestId('browser-resize-overlay')).not.toBeInTheDocument();
    expect(document.querySelector('[data-resize-selection-lock]')).toBeNull();
  });

  it('resizes DevTools with the keyboard, remembers its width on reopen, and resets on double-click', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:3000');
    Object.assign(container.querySelector('webview')!, { getWebContentsId: () => 42 });
    fireEvent(container.querySelector('webview')!, new Event('did-start-loading'));
    fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }));
    const divider = screen.getByRole('separator', { name: 'Resize DevTools' });
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '55');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '45');
    fireEvent.click(screen.getByRole('button', { name: 'Close DevTools pane' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }));
    const reopenedDivider = screen.getByRole('separator', { name: 'Resize DevTools' });
    expect(reopenedDivider).toHaveAttribute('aria-valuenow', '45');
    fireEvent.doubleClick(reopenedDivider);
    expect(reopenedDivider).toHaveAttribute('aria-valuenow', '50');
  });

  it('positions the native inspector and hides it when other UI covers its surface', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    let nextFrame: FrameRequestCallback | undefined;
    let covered = false;
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'browser-inspector-surface'
          ? ({ x: 500, y: 100, left: 500, top: 100, width: 400, height: 600 } as DOMRect)
          : originalRect.call(this);
      });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () =>
        covered
          ? document.body
          : document.querySelector('[data-testid="browser-inspector-surface"]'),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    try {
      const { container, unmount } = render(
        <BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />
      );
      navigate('localhost:3000');
      const page = container.querySelector('webview')!;
      Object.assign(page, { getWebContentsId: () => 42 });
      fireEvent(page, new Event('did-start-loading'));
      await act(async () =>
        fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }))
      );
      expect(window.electronAPI.openBrowserDevTools).toHaveBeenLastCalledWith(42, {
        x: 500,
        y: 100,
        width: 400,
        height: 600,
        visible: true,
      });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      covered = true;
      await act(async () => nextFrame?.(0));
      expect(window.electronAPI.openBrowserDevTools).toHaveBeenLastCalledWith(
        42,
        expect.objectContaining({ visible: false })
      );
      covered = false;
      await act(async () => nextFrame?.(0));
      expect(window.electronAPI.openBrowserDevTools).toHaveBeenLastCalledWith(
        42,
        expect.objectContaining({ visible: true })
      );
      unmount();
      expect(window.electronAPI.closeBrowserDevTools).toHaveBeenCalledWith(42);
    } finally {
      rect.mockRestore();
      if (originalHitTest) Object.defineProperty(document, 'elementFromPoint', originalHitTest);
      else Reflect.deleteProperty(document, 'elementFromPoint');
      vi.unstubAllGlobals();
    }
  });

  it('shows inspector startup errors instead of leaving an unexplained gray pane', async () => {
    vi.mocked(window.electronAPI.openBrowserDevTools).mockRejectedValueOnce(
      new Error('DevTools could not finish loading.')
    );
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:3000');
    const page = container.querySelector('webview')!;
    Object.assign(page, { getWebContentsId: () => 42 });
    fireEvent(page, new Event('did-start-loading'));
    fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'DevTools could not finish loading.'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens the inline inspector only for the page that requested inspection', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:5173');
    const view = container.querySelector('webview')!;
    Object.assign(view, { getWebContentsId: () => 42 });
    fireEvent(view, new Event('did-attach'));
    const inspect = vi.mocked(window.electronAPI.onBrowserInspectElement).mock.calls.at(-1)![0];
    act(() => inspect(99));
    expect(screen.queryByRole('region', { name: 'Browser DevTools' })).not.toBeInTheDocument();
    act(() => inspect(42));
    expect(screen.getByRole('region', { name: 'Browser DevTools' })).toBeInTheDocument();
  });

  it('reports a crashed renderer and allows reloading instead of leaving a silent blank page', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:5173');
    const view = container.querySelector('webview')!;
    const reload = vi.fn();
    Object.assign(view, { reload });
    fireEvent(view, new Event('did-start-loading'));
    fireEvent(
      view,
      Object.assign(new Event('render-process-gone'), {
        details: { reason: 'crashed', exitCode: 1 },
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The browser page stopped (crashed)');
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledOnce();
    fireEvent(view, new Event('did-start-loading'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps webviews mounted across tab switches and closes the selected tab', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:3000');
    const firstView = container.querySelector('webview');
    expect(firstView).toHaveAttribute('src', 'http://localhost:3000/');
    fireEvent.click(screen.getByRole('button', { name: 'New browser tab' }));
    navigate('example.com');
    expect(container.querySelectorAll('webview')).toHaveLength(2);
    const tabs = within(screen.getByRole('tablist', { name: 'Browser tabs' })).getAllByRole('tab');
    fireEvent.click(tabs[0]);
    expect(screen.getByRole('textbox')).toHaveValue('http://localhost:3000/');
    expect(container.querySelector('webview')).toBe(firstView);
    fireEvent.click(screen.getAllByRole('button', { name: 'Close New tab' })[0]);
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com/');
    expect(container.querySelectorAll('webview')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close New tab' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('No browser tabs open')).toBeInTheDocument();
    expect(container.querySelectorAll('webview')).toHaveLength(0);
  });

  it('updates navigation, titles and loading failures from the page', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('example.com');
    const view = container.querySelector('webview')!;
    const goBack = vi.fn();
    const reload = vi.fn();
    Object.assign(view, {
      getURL: () => 'https://example.com/next',
      getTitle: () => 'Example page',
      canGoBack: () => true,
      canGoForward: () => false,
      goBack,
      reload,
    });
    fireEvent(view, new Event('dom-ready'));
    expect(screen.getByRole('tab', { name: 'Example page' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com/next');
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(goBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledOnce();
    fireEvent(
      view,
      Object.assign(new Event('did-fail-load'), {
        isMainFrame: true,
        errorCode: -102,
        errorDescription: 'ERR_CONNECTION_REFUSED',
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent('ERR_CONNECTION_REFUSED');
  });

  it('rejects non-web addresses and opens popup URLs in a new tab', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('file:///etc/passwd');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid');
    expect(container.querySelector('webview')).toBeNull();
    navigate('example.com');
    const view = container.querySelector('webview')!;
    Object.assign(view, { getWebContentsId: () => 42 });
    fireEvent(view, new Event('did-attach'));
    const onPopup = vi.mocked(window.electronAPI.onBrowserNewTab).mock.calls.at(-1)![0];
    act(() => onPopup(99, 'https://other-repository.com/'));
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    act(() => onPopup(42, 'https://example.com/'));
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com/');
  });

  it('starts with zero tabs and reports zero again after the last tab closes', () => {
    const count = vi.fn();
    render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} onTabCountChange={count} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(count).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open a browser tab' }));
    expect(count).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close New tab' }));
    expect(count).toHaveBeenLastCalledWith(0);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('hosts DevTools in a native surface on the right and closes without reloading the page', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'New browser tab' }));
    expect(screen.getByRole('button', { name: 'Open browser DevTools' })).toBeDisabled();
    navigate('localhost:3000');
    const page = container.querySelector('webview')!;
    Object.assign(page, { getWebContentsId: () => 42 });
    fireEvent(page, new Event('did-start-loading'));
    fireEvent.click(screen.getByRole('button', { name: 'Open browser DevTools' }));
    expect(container.querySelectorAll('webview')).toHaveLength(1);
    expect(screen.getByTestId('browser-content').firstElementChild).toBe(page);
    expect(screen.getByTestId('browser-content').lastElementChild).toBe(
      screen.getByRole('region', { name: 'Browser DevTools' })
    );
    expect(screen.getByTestId('browser-inspector-surface')).toBeInTheDocument();
    expect(window.electronAPI.openBrowserDevTools).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ visible: false })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close DevTools pane' }));
    expect(window.electronAPI.closeBrowserDevTools).toHaveBeenCalledWith(42);
    expect(container.querySelector('webview')).toBe(page);
    expect(screen.queryByRole('region', { name: 'Browser DevTools' })).not.toBeInTheDocument();
  });

  it('can stop the first load and retry the same address after a connection failure', () => {
    const { container } = render(<BrowserPanel expanded={false} onToggleExpanded={vi.fn()} />);
    navigate('localhost:3000');
    const view = container.querySelector('webview')!;
    const stop = vi.fn();
    const loadURL = vi.fn().mockResolvedValue(undefined);
    Object.assign(view, { stop, loadURL });
    fireEvent(view, new Event('did-start-loading'));
    fireEvent.click(screen.getByRole('button', { name: 'Stop loading' }));
    expect(stop).toHaveBeenCalledOnce();
    fireEvent(
      view,
      Object.assign(new Event('did-fail-load'), {
        isMainFrame: true,
        errorCode: -102,
        errorDescription: 'ERR_CONNECTION_REFUSED',
      })
    );
    navigate('localhost:3000');
    expect(loadURL).toHaveBeenCalledWith('http://localhost:3000/');
  });

  it('exposes the same expand and collapse interaction as review', () => {
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <BrowserPanel expanded={false} onToggleExpanded={onToggleExpanded} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand browser' }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
    rerender(<BrowserPanel expanded onToggleExpanded={onToggleExpanded} />);
    expect(screen.getByRole('button', { name: 'Collapse browser' })).toBeInTheDocument();
  });
});
