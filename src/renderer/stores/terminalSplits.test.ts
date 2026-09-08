import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './appStore';
import { resetAllStores } from '../../../tests/utils';

const store = () => useAppStore.getState();
const split = () =>
  store().worktreeTabs.find((wt) => wt.worktreeSessionId === 'worktree')?.splitView;

describe('worktree terminal splits', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    useAppStore.setState({ activeTerminalId: 'worktree' });
  });

  function tabs() {
    const a = store().createTab('worktree', 'Claude');
    const b = store().createTab('worktree', 'Codex');
    const c = store().createTab('worktree', 'Shell');
    store().setActiveTab(a.id);
    return { a, b, c };
  }

  it('splits existing tabs without creating or killing sessions, and supports both directions', () => {
    const { a, b, c } = tabs();
    store().splitTab(b.id, 'horizontal');
    expect(split()).toEqual({ direction: 'horizontal', tabIds: [a.id, b.id], sizes: [50, 50] });
    store().splitTab(c.id, 'vertical');
    expect(split()?.tabIds).toEqual([a.id, b.id, c.id]);
    expect(split()?.direction).toBe('vertical');
    expect(window.terminal.kill).not.toHaveBeenCalled();
    expect(store().getTabsForWorktree('worktree')).toHaveLength(3);
  });

  it('focuses a visible tab without moving panes, and replaces only the focused pane for a hidden tab', () => {
    const { a, b, c } = tabs();
    store().splitTab(b.id, 'horizontal');
    store().resizeTerminalSplit('worktree', [60, 40]);
    store().setActiveTab(b.id);
    expect(split()?.tabIds).toEqual([a.id, b.id]);
    store().setActiveTab(c.id);
    expect(split()).toEqual({ direction: 'horizontal', tabIds: [a.id, c.id], sizes: [60, 40] });
  });

  it('changes orientation without adding an extra hidden tab or resetting sizes', () => {
    const { a, b } = tabs();
    store().splitTab(b.id, 'horizontal');
    store().resizeTerminalSplit('worktree', [60, 40]);
    store().splitTab(a.id, 'vertical');
    expect(split()).toEqual({ direction: 'vertical', tabIds: [a.id, b.id], sizes: [60, 40] });
  });

  it('opens a new terminal in the focused pane and keeps its neighbor visible', () => {
    const { a, b } = tabs();
    store().splitTab(b.id, 'horizontal');
    const added = store().createTab('worktree', 'Another shell');
    expect(split()?.tabIds).toEqual([added.id, b.id]);
    expect(
      store()
        .getTabsForWorktree('worktree')
        .some((tab) => tab.id === a.id)
    ).toBe(true);
  });

  it('removes a pane without closing its terminal and collapses the final split', () => {
    const { a, b, c } = tabs();
    store().splitTab(b.id, 'horizontal');
    store().splitTab(c.id, 'horizontal');
    store().removeTabFromSplit(a.id);
    expect(split()?.tabIds).toEqual([b.id, c.id]);
    expect(split()?.sizes).toEqual([50, 50]);
    expect(store().activeTabId).toBe(b.id);
    store().removeTabFromSplit(b.id);
    expect(split()).toBeUndefined();
    expect(store().activeTabId).toBe(c.id);
    expect(window.terminal.kill).not.toHaveBeenCalled();
    expect(store().getTabsForWorktree('worktree')).toHaveLength(3);
  });

  it('focuses a remaining visible terminal when closing the active split tab', () => {
    const { a, c } = tabs();
    store().splitTab(c.id, 'vertical');
    store().closeTab(a.id);
    expect(split()).toBeUndefined();
    expect(store().activeTabId).toBe(c.id);
    expect(window.terminal.kill).toHaveBeenCalledWith(`worktree:${a.id}`);
  });

  it('retains layouts and sizes across worktree switches and tab reordering', () => {
    const { a, b, c } = tabs();
    store().splitTab(b.id, 'horizontal');
    store().resizeTerminalSplit('worktree', [35, 65]);
    store().reorderTabs('worktree', [c, b, a]);
    store().setActiveTerminal('other-worktree');
    store().createTab('other-worktree', 'Other');
    store().setActiveTerminal('worktree');
    expect(store().activeTabId).toBe(a.id);
    expect(split()).toEqual({ direction: 'horizontal', tabIds: [a.id, b.id], sizes: [35, 65] });
    store().clearTerminalSplit('worktree');
    expect(split()).toBeUndefined();
    expect(store().activeTabId).toBe(a.id);
  });

  it('does not duplicate panes when all tabs are visible or split a single tab', () => {
    const a = store().createTab('worktree', 'Claude');
    store().splitTab(a.id, 'horizontal');
    expect(split()).toBeUndefined();
    const b = store().createTab('worktree', 'Codex');
    store().splitTab(b.id, 'horizontal');
    store().splitTab(b.id, 'vertical');
    expect(split()).toEqual({ direction: 'vertical', tabIds: [b.id, a.id], sizes: [50, 50] });
  });
});
