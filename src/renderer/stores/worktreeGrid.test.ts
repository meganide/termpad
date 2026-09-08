import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './appStore';
import { resetAllStores } from '../../../tests/utils';

const store = () => useAppStore.getState();

describe('worktree grid view', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('retains independent grid preferences across worktree switches', () => {
    const first = store().createTab('one', 'Claude');
    store().createTab('two', 'Codex');
    store().setWorktreeGridView('one', true);
    store().setActiveTerminal('two');
    expect(
      store().worktreeTabs.find((wt) => wt.worktreeSessionId === 'two')?.isGridView
    ).toBeFalsy();
    store().setActiveTerminal('one');
    expect(store().activeTabId).toBe(first.id);
    expect(store().worktreeTabs.find((wt) => wt.worktreeSessionId === 'one')?.isGridView).toBe(
      true
    );
    store().setWorktreeGridView('one', false);
    expect(store().activeTabId).toBe(first.id);
    expect(window.terminal.kill).not.toHaveBeenCalled();
  });

  it('keeps grid mode enabled when adding, selecting, and closing tabs', () => {
    const first = store().createTab('one', 'Claude');
    store().setWorktreeGridView('one', true);
    const second = store().createTab('one', 'Codex');
    store().setActiveTab(first.id);
    store().closeTab(second.id);
    expect(store().worktreeTabs[0].isGridView).toBe(true);
    expect(store().activeTabId).toBe(first.id);
    expect(store().worktreeTabs[0].tabs).toEqual([first]);
  });
});
