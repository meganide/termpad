import { BrowserWindow, Menu, clipboard } from 'electron';
import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron';
import { isBrowserUrl } from '../shared/browser';

export function showBrowserContextMenu(
  host: WebContents,
  page: WebContents,
  params: ContextMenuParams,
  inspect: () => void
): void {
  const items: MenuItemConstructorOptions[] = [];
  const action = (label: string, run: () => void, enabled = true): MenuItemConstructorOptions => ({
    label,
    enabled,
    click: () => {
      if (!page.isDestroyed() && !host.isDestroyed()) run();
    },
  });
  const group = (...entries: MenuItemConstructorOptions[]) => {
    if (items.length) items.push({ type: 'separator' });
    items.push(...entries);
  };
  const newTab = (url: string) => host.send('browser:new-tab', page.id, url);

  if (params.linkURL) {
    const links: MenuItemConstructorOptions[] = [];
    if (isBrowserUrl(params.linkURL)) {
      links.push(action('Open Link in New Tab', () => newTab(params.linkURL)));
      links.push(action('Save Link As…', () => page.downloadURL(params.linkURL)));
    }
    links.push(action('Copy Link Address', () => clipboard.writeText(params.linkURL)));
    group(...links);
  }

  if (params.mediaType === 'image' || params.mediaType === 'canvas') {
    const images = [
      action('Copy Image', () => page.copyImageAt(params.x, params.y), params.hasImageContents),
    ];
    if (params.srcURL) {
      images.push(action('Copy Image Address', () => clipboard.writeText(params.srcURL)));
      if (isBrowserUrl(params.srcURL)) {
        images.push(action('Open Image in New Tab', () => newTab(params.srcURL)));
        images.push(action('Save Image As…', () => page.downloadURL(params.srcURL)));
      }
    }
    group(...images);
  }

  const flags = params.editFlags;
  if (params.isEditable) {
    if (params.misspelledWord && params.dictionarySuggestions.length) {
      group(
        ...params.dictionarySuggestions
          .slice(0, 5)
          .map((word) => action(word, () => page.replaceMisspelling(word)))
      );
    }
    group(
      action('Undo', () => page.undo(), flags.canUndo),
      action('Redo', () => page.redo(), flags.canRedo)
    );
    group(
      action('Cut', () => page.cut(), flags.canCut),
      action('Copy', () => page.copy(), flags.canCopy),
      action('Paste', () => page.paste(), flags.canPaste),
      action('Paste and Match Style', () => page.pasteAndMatchStyle(), flags.canPaste),
      action('Select All', () => page.selectAll(), flags.canSelectAll)
    );
  } else if (params.selectionText) {
    group(action('Copy', () => page.copy(), flags.canCopy));
  }

  if (
    !params.isEditable &&
    !params.selectionText &&
    !params.linkURL &&
    params.mediaType === 'none'
  ) {
    group(
      action('Back', () => page.navigationHistory.goBack(), page.navigationHistory.canGoBack()),
      action(
        'Forward',
        () => page.navigationHistory.goForward(),
        page.navigationHistory.canGoForward()
      ),
      action('Reload', () => page.reload())
    );
  }
  group(action('Inspect Element', inspect));
  Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(host) ?? undefined });
}
