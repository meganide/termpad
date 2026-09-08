import type { TerminalSplitView } from '../../shared/types';

// Switching to a hidden tab replaces only the focused pane.
export function selectSplitTab(
  split: TerminalSplitView | undefined,
  activeTabId: string | null,
  tabId: string
): TerminalSplitView | undefined {
  if (!split || split.tabIds.includes(tabId)) return split;
  const index = Math.max(0, split.tabIds.indexOf(activeTabId ?? ''));
  return { ...split, tabIds: split.tabIds.map((id, i) => (i === index ? tabId : id)) };
}

export function removeSplitTab(
  split: TerminalSplitView | undefined,
  tabId: string
): TerminalSplitView | undefined {
  if (!split || !split.tabIds.includes(tabId)) return split;
  const tabIds = split.tabIds.filter((id) => id !== tabId);
  if (tabIds.length < 2) return undefined;
  const sizes = split.sizes.filter((_, i) => split.tabIds[i] !== tabId);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return { ...split, tabIds, sizes: sizes.map((size) => (size / total) * 100) };
}
