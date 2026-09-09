import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron';
import { showBrowserContextMenu } from './browserContextMenu';

const mocks = vi.hoisted(() => ({
  popup: vi.fn(),
  build: vi.fn(),
  writeText: vi.fn(),
  window: {},
}));
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => mocks.window },
  Menu: { buildFromTemplate: mocks.build },
  clipboard: { writeText: mocks.writeText },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.build.mockReturnValue({ popup: mocks.popup });
});

function setup(overrides: Partial<ContextMenuParams> = {}) {
  const host = { send: vi.fn(), isDestroyed: () => false };
  const page = {
    id: 42,
    isDestroyed: vi.fn().mockReturnValue(false),
    navigationHistory: {
      canGoBack: () => true,
      canGoForward: () => false,
      goBack: vi.fn(),
      goForward: vi.fn(),
    },
    reload: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    pasteAndMatchStyle: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    selectAll: vi.fn(),
    downloadURL: vi.fn(),
    copyImageAt: vi.fn(),
  };
  const params = {
    x: 30,
    y: 50,
    linkURL: '',
    srcURL: '',
    mediaType: 'none',
    selectionText: '',
    isEditable: false,
    dictionarySuggestions: [],
    misspelledWord: '',
    editFlags: {
      canUndo: true,
      canRedo: false,
      canCopy: true,
      canCut: true,
      canPaste: true,
      canSelectAll: true,
    },
    ...overrides,
  } as ContextMenuParams;
  const inspect = vi.fn();
  showBrowserContextMenu(
    host as unknown as WebContents,
    page as unknown as WebContents,
    params,
    inspect
  );
  const items = mocks.build.mock.calls[0][0] as MenuItemConstructorOptions[];
  const item = (label: string) => items.find((entry) => entry.label === label)!;
  const click = (label: string) => (item(label).click as () => void)();
  return { host, page, inspect, items, item, click };
}

describe('browser context menu', () => {
  it('shows native page navigation and inspect actions', () => {
    const { page, inspect, item, click } = setup();
    expect(mocks.popup).toHaveBeenCalledWith({ window: mocks.window });
    expect(item('Back').enabled).toBe(true);
    expect(item('Forward').enabled).toBe(false);
    click('Back');
    click('Reload');
    click('Inspect Element');
    expect(page.navigationHistory.goBack).toHaveBeenCalledOnce();
    expect(page.reload).toHaveBeenCalledOnce();
    expect(inspect).toHaveBeenCalledOnce();
  });

  it('opens links through the source page to preserve repository scope and copies their addresses', () => {
    const { host, page, click } = setup({ linkURL: 'https://example.com/docs' });
    click('Open Link in New Tab');
    click('Copy Link Address');
    click('Save Link As…');
    expect(host.send).toHaveBeenCalledWith('browser:new-tab', 42, 'https://example.com/docs');
    expect(mocks.writeText).toHaveBeenCalledWith('https://example.com/docs');
    expect(page.downloadURL).toHaveBeenCalledWith('https://example.com/docs');
    page.isDestroyed.mockReturnValue(true);
    click('Open Link in New Tab');
    expect(host.send).toHaveBeenCalledOnce();
  });

  it('only offers address copying for non-web links', () => {
    const { items } = setup({ linkURL: 'javascript:alert(1)' });
    expect(items.map(({ label }) => label).filter(Boolean)).toEqual([
      'Copy Link Address',
      'Inspect Element',
    ]);
  });

  it('targets editing commands at the browser page and respects disabled operations', () => {
    const { page, item, click } = setup({ isEditable: true });
    expect(item('Redo').enabled).toBe(false);
    click('Copy');
    click('Paste');
    click('Cut');
    click('Select All');
    expect(page.copy).toHaveBeenCalledOnce();
    expect(page.paste).toHaveBeenCalledOnce();
    expect(page.cut).toHaveBeenCalledOnce();
    expect(page.selectAll).toHaveBeenCalledOnce();
  });

  it('copies selected text and provides image-specific commands', () => {
    const { page, host, click } = setup({
      selectionText: 'Selected text',
      mediaType: 'image',
      hasImageContents: true,
      srcURL: 'https://example.com/image.png',
    });
    click('Copy');
    click('Copy Image');
    click('Open Image in New Tab');
    click('Save Image As…');
    expect(page.copy).toHaveBeenCalledOnce();
    expect(page.copyImageAt).toHaveBeenCalledWith(30, 50);
    expect(host.send).toHaveBeenCalledWith('browser:new-tab', 42, 'https://example.com/image.png');
    expect(page.downloadURL).toHaveBeenCalledWith('https://example.com/image.png');
  });
});
