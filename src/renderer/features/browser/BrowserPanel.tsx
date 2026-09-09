import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserRegistry } from './browserRegistry';
import type { WebviewTag } from 'electron';
import type { BrowserDevToolsBounds } from '../../../shared/types';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Maximize2,
  Minimize2,
  Plus,
  RotateCw,
  SquareCode,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BrowserInspectorDivider } from './BrowserInspectorDivider';
import { BROWSER_PARTITION, isBrowserUrl, normalizeBrowserAddress } from '../../../shared/browser';

interface BrowserTab {
  id: string;
  title: string;
  initialUrl: string;
  url?: string;
  webContentsId?: number;
}

const createTab = (url = ''): BrowserTab => ({
  id: crypto.randomUUID(),
  title: url ? new URL(url).hostname : 'New tab',
  initialUrl: url,
});

interface BrowserPanelProps {
  repositoryId?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onTabCountChange?: (count: number) => void;
}

export function BrowserPanel({
  repositoryId,
  expanded,
  onToggleExpanded,
  onTabCountChange,
}: BrowserPanelProps) {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? tabs[0]?.id;

  useEffect(() => {
    onTabCountChange?.(tabs.length);
  }, [tabs.length, onTabCountChange]);

  const addTab = useCallback((url = '') => {
    if (url && !isBrowserUrl(url)) return;
    const tab = createTab(url);
    setTabs((previous) => [...previous, tab]);
    setSelectedId(tab.id);
  }, []);

  useEffect(() => {
    document.getElementById(`browser-tab-${activeId}`)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeId]);

  const updateTitle = useCallback((id: string, title: string) => {
    setTabs((previous) => previous.map((tab) => (tab.id === id ? { ...tab, title } : tab)));
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      const remaining = tabs.filter((tab) => tab.id !== id);
      setTabs(remaining);
      if (id === activeId)
        setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    },
    [tabs, activeId]
  );

  const updateGuest = useCallback((id: string, webContentsId: number, url: string) => {
    setTabs((previous) =>
      previous.map((tab) => (tab.id === id ? { ...tab, webContentsId, url } : tab))
    );
  }, []);

  useEffect(() => {
    if (!repositoryId) return;
    useBrowserRegistry.getState().replace(
      repositoryId,
      tabs.map((tab) => ({
        id: tab.id,
        repositoryId,
        title: tab.title,
        url: tab.url ?? tab.initialUrl,
        webContentsId: tab.webContentsId,
        select: () => {
          setSelectedId(tab.id);
          requestAnimationFrame(() => document.getElementById(`browser-tab-${tab.id}`)?.focus());
        },
        close: () => closeTab(tab.id),
      }))
    );
  }, [repositoryId, tabs, closeTab]);

  useEffect(
    () => () => {
      if (repositoryId) useBrowserRegistry.getState().replace(repositoryId, []);
    },
    [repositoryId]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="browser-panel">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
        <div
          role="tablist"
          aria-label="Browser tabs"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`flex shrink-0 items-center rounded-md ${tab.id === activeId ? 'bg-muted' : ''}`}
            >
              <button
                type="button"
                role="tab"
                id={`browser-tab-${tab.id}`}
                aria-controls={`browser-page-${tab.id}`}
                aria-selected={tab.id === activeId}
                tabIndex={tab.id === activeId ? 0 : -1}
                title={tab.title}
                className="flex min-w-0 items-center gap-2 rounded-md py-2 pl-2 pr-1 text-xs text-foreground focus-visible:outline focus-visible:outline-ring"
                onClick={() => setSelectedId(tab.id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setSelectedId(tabs[next].id);
                  document.getElementById(`browser-tab-${tabs[next].id}`)?.focus();
                }}
              >
                <Globe className="size-3 shrink-0 text-muted-foreground" />
                <span className="max-w-32 truncate">{tab.title}</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 mr-1"
                aria-label={`Close ${tab.title}`}
                title="Close tab"
                onClick={() => closeTab(tab.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="New browser tab"
          title="New browser tab"
          onClick={() => addTab()}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={expanded ? 'Collapse browser' : 'Expand browser'}
          title={expanded ? 'Collapse browser' : 'Expand browser'}
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>
      {tabs.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Globe className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No browser tabs open</p>
          <p className="max-w-64 text-xs text-muted-foreground">
            Open a tab to browse a website or local app in this repository.
          </p>
          <Button variant="outline" size="sm" onClick={() => addTab()}>
            <Plus className="size-4" />
            Open a browser tab
          </Button>
        </div>
      )}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`browser-page-${tab.id}`}
          role="tabpanel"
          aria-label={`Browser page: ${tab.title}`}
          hidden={tab.id !== activeId}
          className={tab.id === activeId ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <BrowserPage
            tab={tab}
            onTitleChange={updateTitle}
            onNewTab={addTab}
            onGuestChange={updateGuest}
          />
        </div>
      ))}
    </div>
  );
}

function BrowserPage({
  tab,
  onTitleChange,
  onNewTab,
  onGuestChange,
}: {
  tab: BrowserTab;
  onTitleChange: (id: string, title: string) => void;
  onNewTab: (url: string) => void;
  onGuestChange: (id: string, webContentsId: number, url: string) => void;
}) {
  const webview = useRef<WebviewTag | null>(null);
  const [requestedUrl, setRequestedUrl] = useState(tab.initialUrl);
  const [address, setAddress] = useState(tab.initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inspectorSource, setInspectorSource] = useState<number | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(50);
  const [navigation, setNavigation] = useState({ ready: false, back: false, forward: false });
  const hasPage = !!requestedUrl;

  useEffect(() => {
    const view = webview.current;
    if (!view || !hasPage) return;
    let guestId: number | null = null;
    const attached = () => {
      guestId = view.getWebContentsId();
      onGuestChange(tab.id, guestId, requestedUrl);
    };
    // Popups belong to the page's repository, including when it is in the background.
    const unsubscribe = window.electronAPI.onBrowserNewTab((sourceId, url) => {
      if (sourceId === guestId) onNewTab(url);
    });
    const unsubscribeInspect = window.electronAPI.onBrowserInspectElement((sourceId) => {
      if (sourceId === guestId) setInspectorSource(sourceId);
    });
    const syncNavigation = () => {
      setNavigation({ ready: true, back: view.canGoBack(), forward: view.canGoForward() });
      const url = view.getURL();
      guestId = view.getWebContentsId();
      onGuestChange(tab.id, guestId, url);
      setAddress(url);
      onTitleChange(
        tab.id,
        view.getTitle() || (isBrowserUrl(url) ? new URL(url).hostname : 'New tab')
      );
    };
    const start = () => {
      setLoading(true);
      setError(null);
      setNavigation((previous) => ({ ...previous, ready: true }));
    };
    const stop = () => {
      setLoading(false);
    };
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (!event.isMainFrame || event.errorCode === -3) return;
      setLoading(false);
      setNavigation((previous) => ({ ...previous, ready: true }));
      setError(
        `Could not load this page (${event.errorDescription}). Check the address or try reloading.`
      );
    };
    const processGone = (event: Electron.RenderProcessGoneEvent) => {
      setLoading(false);
      setNavigation({ ready: true, back: false, forward: false });
      setInspectorSource(null);
      setError(`The browser page stopped (${event.details.reason}). Reload the page to try again.`);
    };
    view.addEventListener('did-attach', attached);
    view.addEventListener('dom-ready', syncNavigation);
    view.addEventListener('did-navigate', syncNavigation);
    view.addEventListener('did-navigate-in-page', syncNavigation);
    view.addEventListener('page-title-updated', syncNavigation);
    view.addEventListener('did-start-loading', start);
    view.addEventListener('did-stop-loading', stop);
    view.addEventListener('did-fail-load', fail);
    view.addEventListener('render-process-gone', processGone);
    return () => {
      unsubscribe();
      unsubscribeInspect();
      view.removeEventListener('did-attach', attached);
      view.removeEventListener('dom-ready', syncNavigation);
      view.removeEventListener('did-navigate', syncNavigation);
      view.removeEventListener('did-navigate-in-page', syncNavigation);
      view.removeEventListener('page-title-updated', syncNavigation);
      view.removeEventListener('did-start-loading', start);
      view.removeEventListener('did-stop-loading', stop);
      view.removeEventListener('did-fail-load', fail);
      view.removeEventListener('render-process-gone', processGone);
    };
  }, [hasPage, requestedUrl, tab.id, onTitleChange, onNewTab, onGuestChange]);

  return (
    <>
      <form
        className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          const url = normalizeBrowserAddress(address);
          if (!url) {
            setError('Enter a valid http:// or https:// address.');
            return;
          }
          setError(null);
          setAddress(url);
          if (url === requestedUrl && navigation.ready) {
            void webview.current?.loadURL(url).catch(() => {
              /* did-fail-load displays the error. */
            });
          } else setRequestedUrl(url);
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Go back"
          title="Go back"
          disabled={!navigation.back}
          onClick={() => webview.current?.goBack()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Go forward"
          title="Go forward"
          disabled={!navigation.forward}
          onClick={() => webview.current?.goForward()}
        >
          <ArrowRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={loading ? 'Stop loading' : 'Reload page'}
          title={loading ? 'Stop loading' : 'Reload page'}
          disabled={!navigation.ready}
          onClick={() => (loading ? webview.current?.stop() : webview.current?.reload())}
        >
          {loading ? <X className="size-4" /> : <RotateCw className="size-4" />}
        </Button>
        <label htmlFor={`browser-address-${tab.id}`} className="sr-only">
          Browser address
        </label>
        <input
          id={`browser-address-${tab.id}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onFocus={(event) => event.target.select()}
          placeholder="URL or localhost:3000"
          spellCheck={false}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline focus-visible:outline-ring"
        />
        <Button type="submit" variant="ghost" className="h-8 px-2 text-xs">
          Go
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={inspectorSource === null ? 'Open browser DevTools' : 'Close browser DevTools'}
          title={inspectorSource === null ? 'Open browser DevTools' : 'Close browser DevTools'}
          aria-pressed={inspectorSource !== null}
          disabled={!navigation.ready}
          onClick={() =>
            setInspectorSource((previous) =>
              previous === null ? (webview.current?.getWebContentsId() ?? null) : null
            )
          }
        >
          <SquareCode className="size-4" />
        </Button>
      </form>
      {error && (
        <p role="alert" className="shrink-0 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {hasPage ? (
        <div className="flex min-h-0 min-w-0 flex-1" data-testid="browser-content">
          <webview
            ref={(element) => {
              webview.current = element as WebviewTag | null;
            }}
            src={requestedUrl}
            // Electron's webview attributes are not part of the standard HTML attribute list.
            // eslint-disable-next-line react/no-unknown-property
            partition={BROWSER_PARTITION}
            className="flex min-h-0 min-w-0 flex-1 bg-white"
          />
          {inspectorSource !== null && (
            <>
              <BrowserInspectorDivider width={inspectorWidth} onResize={setInspectorWidth} />
              <BrowserInspector
                sourceId={inspectorSource}
                width={inspectorWidth}
                onClose={() => setInspectorSource(null)}
              />
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Globe className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Open a website or local app</p>
            <p className="max-w-64 text-xs text-muted-foreground">
              Enter an address above. Use + to keep several pages open side by side in tabs.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function BrowserInspector({
  sourceId,
  width,
  onClose,
}: {
  sourceId: number;
  width: number;
  onClose: () => void;
}) {
  const inspector = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const element = inspector.current;
    if (!element) return;
    let disposed = false;
    let failed = false;
    let frame = 0;
    let previous = '';
    const sync = () => {
      if (disposed || failed) return;
      const rect = element.getBoundingClientRect();
      // Native views sit above DOM content. Hide the inspector whenever its pane
      // is hidden or a dialog/menu overlays it, as well as on repository switches.
      const visible =
        document.visibilityState !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0 &&
        [
          [0.05, 0.05],
          [0.95, 0.05],
          [0.5, 0.5],
          [0.05, 0.95],
          [0.95, 0.95],
        ].every(([x, y]) =>
          element.contains(
            document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y)
          )
        );
      const bounds: BrowserDevToolsBounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible,
      };
      const key = JSON.stringify(bounds);
      if (key !== previous) {
        previous = key;
        void window.electronAPI
          .openBrowserDevTools(sourceId, bounds)
          .then(() => {
            if (!disposed && visible) setLoading(false);
          })
          .catch((reason: unknown) => {
            if (disposed) return;
            failed = true;
            setLoading(false);
            setError(
              reason instanceof Error
                ? reason.message
                : 'Could not open DevTools. Close the pane and try again.'
            );
          });
      }
      frame = requestAnimationFrame(sync);
    };
    sync();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      void window.electronAPI.closeBrowserDevTools(sourceId).catch(() => {
        // Closing the host window may dispose its IPC handler first.
      });
    };
  }, [sourceId]);

  return (
    <section
      aria-label="Browser DevTools"
      className="flex min-h-0 min-w-0 shrink-0 flex-col"
      style={{ width: `calc((100% - 6px) * ${width / 100})` }}
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <span className="text-xs font-medium">DevTools</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Close DevTools pane"
          title="Close DevTools pane"
          onClick={onClose}
        >
          <X className="size-3" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="px-2 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div
        ref={inspector}
        data-testid="browser-inspector-surface"
        className="relative min-h-0 flex-1"
      >
        {loading && !error && (
          <p role="status" className="p-3 text-xs text-muted-foreground">
            Loading DevTools…
          </p>
        )}
      </div>
    </section>
  );
}
