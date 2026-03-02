import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  getAllSessionsOrdered,
  getModifierKey,
  findSessionByShortcut,
  useKeyboardShortcuts,
  getTabAtIndex,
} from '@/hooks/useKeyboardShortcuts';
import { useAppStore } from '../../src/renderer/stores/appStore';
import { resetAllStores } from '../utils';
import type {
  Repository,
  WorktreeSession,
  CustomShortcut,
  TerminalTab,
} from '../../src/shared/types';
import { getDefaultShortcut } from '../../src/renderer/utils/shortcuts';

// Helper to create mock tabs
function createTab(id: string, order: number, name?: string): TerminalTab {
  return {
    id,
    name: name || `Tab ${id}`,
    createdAt: new Date().toISOString(),
    order,
  };
}

// Helper to create mock sessions
function createWorktreeSession(id: string, customShortcut?: CustomShortcut): WorktreeSession {
  return {
    id,

    label: `Session ${id}`,
    path: `/test/path/${id}`,
    branchName: `branch-${id}`,
    createdAt: new Date().toISOString(),
    isExternal: false,
    customShortcut,
  };
}

// Helper to create a CustomShortcut
function createShortcut(key: string, modifiers?: Partial<CustomShortcut>): CustomShortcut {
  return {
    key,
    ctrlKey: modifiers?.ctrlKey ?? false,
    shiftKey: modifiers?.shiftKey ?? false,
    altKey: modifiers?.altKey ?? false,
    metaKey: modifiers?.metaKey ?? false,
  };
}

// Helper to create mock repositories
function createRepository(id: string, worktreeSessions: WorktreeSession[]): Repository {
  return {
    id,
    name: `Repository ${id}`,
    path: `/test/repository/${id}`,

    isBare: false,
    isExpanded: true,
    worktreeSessions,
    createdAt: new Date().toISOString(),
  };
}

describe('Tab navigation utilities', () => {
  describe('getTabAtIndex', () => {
    it('returns tab at given index (sorted by order)', () => {
      const tabs = [createTab('t3', 2), createTab('t1', 0), createTab('t2', 1)];
      expect(getTabAtIndex(tabs, 0)?.id).toBe('t1');
      expect(getTabAtIndex(tabs, 1)?.id).toBe('t2');
      expect(getTabAtIndex(tabs, 2)?.id).toBe('t3');
    });

    it('returns undefined for out of bounds index', () => {
      const tabs = [createTab('t1', 0), createTab('t2', 1)];
      expect(getTabAtIndex(tabs, 5)).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(getTabAtIndex([], 0)).toBeUndefined();
    });
  });
});

describe('useKeyboardShortcuts utilities', () => {
  describe('getAllSessionsOrdered', () => {
    it('returns empty array for empty projects', () => {
      const result = getAllSessionsOrdered([]);
      expect(result).toEqual([]);
    });

    it('returns sessions from single project', () => {
      const session1 = createWorktreeSession('s1');
      const session2 = createWorktreeSession('s2');
      const project = createRepository('p1', [session1, session2]);

      const result = getAllSessionsOrdered([project]);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(result[1].id).toBe('s2');
    });

    it('returns sessions from multiple projects in order', () => {
      const session1 = createWorktreeSession('s1');
      const session2 = createWorktreeSession('s2');
      const session3 = createWorktreeSession('s3');
      const project1 = createRepository('p1', [session1, session2]);
      const project2 = createRepository('p2', [session3]);

      const result = getAllSessionsOrdered([project1, project2]);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('s1');
      expect(result[1].id).toBe('s2');
      expect(result[2].id).toBe('s3');
    });

    it('handles projects with no sessions', () => {
      const project1 = createRepository('p1', []);
      const session1 = createWorktreeSession('s1');
      const project2 = createRepository('p2', [session1]);

      const result = getAllSessionsOrdered([project1, project2]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('preserves session order within projects', () => {
      const session1 = createWorktreeSession('first');
      const session2 = createWorktreeSession('second');
      const session3 = createWorktreeSession('third');
      const project = createRepository('p1', [session1, session2, session3]);

      const result = getAllSessionsOrdered([project]);
      expect(result.map((s) => s.id)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('getModifierKey', () => {
    it('returns empty string since default shortcuts are plain numbers (work when sidebar is focused)', () => {
      const modifier = getModifierKey();
      // Now returns empty string since default shortcuts have no modifiers
      expect(modifier).toBe('');
    });
  });

  describe('findSessionByShortcut', () => {
    it('finds session with custom shortcut', () => {
      const customShortcut = createShortcut('k', { ctrlKey: true, shiftKey: true });
      const session1 = createWorktreeSession('s1', getDefaultShortcut(1));
      const session2 = createWorktreeSession('s2', customShortcut);
      const session3 = createWorktreeSession('s3', getDefaultShortcut(3));
      const project = createRepository('p1', [session1, session2, session3]);

      const result = findSessionByShortcut([project], customShortcut);
      expect(result?.id).toBe('s2');
    });

    it('finds session by its assigned plain number shortcut', () => {
      const session1 = createWorktreeSession('s1', getDefaultShortcut(1));
      const session2 = createWorktreeSession('s2', getDefaultShortcut(2));
      const session3 = createWorktreeSession('s3', getDefaultShortcut(3));
      const project = createRepository('p1', [session1, session2, session3]);

      // Plain "1" should find s1
      const result1 = findSessionByShortcut([project], getDefaultShortcut(1));
      expect(result1?.id).toBe('s1');

      // Plain "2" should find s2
      const result2 = findSessionByShortcut([project], getDefaultShortcut(2));
      expect(result2?.id).toBe('s2');

      // Plain "3" should find s3
      const result3 = findSessionByShortcut([project], getDefaultShortcut(3));
      expect(result3?.id).toBe('s3');
    });

    it('returns undefined when no session has matching shortcut', () => {
      // Session has shortcut "2", not "1"
      const session1 = createWorktreeSession('s1', getDefaultShortcut(2));
      const project = createRepository('p1', [session1]);

      // Plain "1" should not find anything (no positional fallback)
      const result = findSessionByShortcut([project], getDefaultShortcut(1));
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-matching shortcut', () => {
      const session1 = createWorktreeSession('s1', getDefaultShortcut(1));
      const project = createRepository('p1', [session1]);

      // Alt+K has no match
      const result = findSessionByShortcut([project], createShortcut('k', { altKey: true }));
      expect(result).toBeUndefined();
    });

    it('handles sessions with assigned shortcuts beyond 9', () => {
      // Create sessions with shortcuts 1-9 and also key '0' (position 10)
      const sessions = [
        ...Array.from({ length: 9 }, (_, i) =>
          createWorktreeSession(`session-${i + 1}`, getDefaultShortcut(i + 1))
        ),
        createWorktreeSession('session-10', createShortcut('0')), // key '0' for position 10
      ];
      const project = createRepository('p1', sessions);

      // Plain "9" should find session-9
      const result9 = findSessionByShortcut([project], getDefaultShortcut(9));
      expect(result9?.id).toBe('session-9');

      // Plain "0" should find session-10
      const result0 = findSessionByShortcut([project], createShortcut('0'));
      expect(result0?.id).toBe('session-10');
    });

    it('handles empty projects array', () => {
      const result = findSessionByShortcut([], getDefaultShortcut(1));
      expect(result).toBeUndefined();
    });
  });
});

describe('useKeyboardShortcuts hook', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('Ctrl+Shift+Space toggle (Linux) / Ctrl+Space toggle (other platforms)', () => {
    // Note: Test environment mocks platform as 'linux', so tests use Ctrl+Shift+Space
    // On Linux, Ctrl+Space is reserved by input method frameworks (IBus, Fcitx)
    it('should toggle focus to sidebar on Ctrl+Shift+Space when terminal focused (Linux)', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });

    it('should stay in sidebar on Ctrl+Shift+Space when sidebar already focused (direct navigation, Linux)', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Direct navigation: Ctrl+Shift+Space always goes to sidebar on Linux
      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });

    it('should handle Ctrl+Shift+Space with Unidentified key (Linux input method quirk)', () => {
      // On Linux, Ctrl+Shift+Space often produces key: 'Unidentified' but code: 'Space'
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'Unidentified',
        code: 'Space',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });

    it('should not toggle focus if no projects exist', () => {
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should set sidebarFocusedItemId to active terminal when switching to sidebar', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().sidebarFocusedItemId).toBe('s1');
    });

    it('should set sidebarFocusedItemId to first item when no active terminal', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: null,
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().sidebarFocusedItemId).toBe('p1');
    });
  });

  describe('session shortcuts context awareness', () => {
    it('should handle custom session shortcuts when terminal is focused', () => {
      // Session has custom shortcut Ctrl+Shift+K
      const customShortcut = createShortcut('k', { ctrlKey: true, shiftKey: true });
      const session = createWorktreeSession('s1', customShortcut);
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().activeTerminalId).toBe('s1');
    });

    it('should NOT handle plain number shortcuts when terminal is focused (require modifier)', () => {
      // Default shortcuts are now plain numbers (no modifiers)
      // But useKeyboardShortcuts requires at least one modifier when terminal is focused
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: null,
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      // Plain number key without modifiers should not activate session when terminal focused
      const event = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: false,
        shiftKey: false,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should not change activeTerminalId since plain numbers only work in sidebar
      expect(useAppStore.getState().activeTerminalId).toBeNull();
    });

    it('should NOT handle session shortcuts when sidebar is focused', () => {
      const customShortcut = createShortcut('k', { ctrlKey: true, shiftKey: true });
      const session = createWorktreeSession('s1', customShortcut);
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        activeTerminalId: null,
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should not change activeTerminalId (sidebar handles its own shortcuts)
      expect(useAppStore.getState().activeTerminalId).toBeNull();
    });
  });

  describe('tab navigation shortcuts', () => {
    it('should switch to tab by index with Ctrl+1-9', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: 't1',
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1), createTab('t3', 2)],
            activeTabId: 't1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      // Press Ctrl+2 to switch to second tab
      const event = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().activeTabId).toBe('t2');
    });

    it('should switch to first tab with Ctrl+1', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: 't3',
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1), createTab('t3', 2)],
            activeTabId: 't3',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '1',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().activeTabId).toBe('t1');
    });

    it('should not switch if tab index does not exist', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: 't1',
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1)],
            activeTabId: 't1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      // Press Ctrl+5 - tab at index 4 does not exist
      const event = new KeyboardEvent('keydown', {
        key: '5',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should remain on current tab
      expect(useAppStore.getState().activeTabId).toBe('t1');
    });

    it('should not switch tabs when sidebar is focused', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        activeTerminalId: 's1',
        activeTabId: 't1',
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1)],
            activeTabId: 't1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      // Ctrl+2 should not switch tabs when sidebar is focused
      const event = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should remain on current tab (sidebar shortcuts handle their own navigation)
      expect(useAppStore.getState().activeTabId).toBe('t1');
    });

    it('should not switch tabs when no activeTerminalId', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: null,
        activeTabId: null,
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1)],
            activeTabId: 't1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().activeTabId).toBeNull();
    });

    it('should not switch tabs when no tabs exist for worktree', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: null,
        repositories: [project],
        worktreeTabs: [],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: '2',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().activeTabId).toBeNull();
    });
  });

  describe('onSessionSelect callback', () => {
    it('should call onSessionSelect when session is selected via custom shortcut', () => {
      const onSessionSelect = vi.fn();
      const session = createWorktreeSession('s1');
      session.customShortcut = {
        key: '1',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts({ onSessionSelect }));

      const event = new KeyboardEvent('keydown', {
        key: '!', // Shift+1 produces '!'
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onSessionSelect).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().activeTerminalId).toBe('s1');
    });

    it('should not call onSessionSelect when no matching session is found', () => {
      const onSessionSelect = vi.fn();
      const session = createWorktreeSession('s1');
      session.customShortcut = {
        key: '1',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts({ onSessionSelect }));

      // Press Ctrl+Shift+2 - no session has this shortcut
      const event = new KeyboardEvent('keydown', {
        key: '@', // Shift+2 produces '@'
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onSessionSelect).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+T (focus main terminal)', () => {
    it('should set focusArea to mainTerminal when Ctrl+T is pressed from sidebar', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should set focusArea to mainTerminal when Ctrl+T is pressed from userTerminal', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'userTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'T', // Test uppercase too
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('mainTerminal');
    });

    it('should NOT trigger with Ctrl+Shift+T (modifier mismatch)', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should remain on sidebar since Shift is also pressed
      expect(useAppStore.getState().focusArea).toBe('sidebar');
    });
  });

  describe('Ctrl+U (focus user terminal)', () => {
    it('should set focusArea to userTerminal when Ctrl+U is pressed from sidebar', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'u',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('userTerminal');
    });

    it('should set focusArea to userTerminal when Ctrl+U is pressed from mainTerminal', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'U', // Test uppercase
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useAppStore.getState().focusArea).toBe('userTerminal');
    });
  });

  describe('Ctrl+W (create new tab)', () => {
    it('should create a user tab when Ctrl+W is pressed in userTerminal focus', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'userTerminal',
        activeTerminalId: 's1',
        repositories: [project],
        userTerminalTabs: [],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'w',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.userTerminalTabs).toHaveLength(1);
      expect(state.userTerminalTabs[0].worktreeSessionId).toBe('s1');
    });

    it('should create a main terminal tab when Ctrl+W is pressed in mainTerminal focus', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        repositories: [project],
        worktreeTabs: [],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'w',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.worktreeTabs).toHaveLength(1);
      expect(state.worktreeTabs[0].worktreeSessionId).toBe('s1');
    });

    it('should NOT create a tab when Ctrl+W is pressed with no activeTerminalId', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: null,
        repositories: [project],
        worktreeTabs: [],
        userTerminalTabs: [],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'w',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      expect(state.worktreeTabs).toHaveLength(0);
      expect(state.userTerminalTabs).toHaveLength(0);
    });
  });

  describe('Ctrl+Q (close current tab)', () => {
    it('should close user tab when Ctrl+Q is pressed in userTerminal focus', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'userTerminal',
        activeTerminalId: 's1',
        activeUserTabId: 'ut1',
        repositories: [project],
        userTerminalTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('ut1', 0, 'User Terminal')],
            activeTabId: 'ut1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'q',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      const userTabState = state.userTerminalTabs.find((t) => t.worktreeSessionId === 's1');
      expect(userTabState?.tabs).toHaveLength(0);
    });

    it('should close main terminal tab when Ctrl+Q is pressed in mainTerminal focus', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: 't1',
        repositories: [project],
        worktreeTabs: [
          {
            worktreeSessionId: 's1',
            tabs: [createTab('t1', 0), createTab('t2', 1)],
            activeTabId: 't1',
          },
        ],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'q',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      const state = useAppStore.getState();
      const tabState = state.worktreeTabs.find((t) => t.worktreeSessionId === 's1');
      expect(tabState?.tabs).toHaveLength(1);
      expect(tabState?.tabs[0].id).toBe('t2');
    });

    it('should NOT throw when Ctrl+Q is pressed with no active tab', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: 's1',
        activeTabId: null,
        repositories: [project],
        worktreeTabs: [],
      });

      renderHook(() => useKeyboardShortcuts());

      // Should not throw
      expect(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'q',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      }).not.toThrow();
    });

    it('should always call preventDefault to avoid app quit', () => {
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        activeTerminalId: null,
        activeTabId: null,
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'q',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Ctrl+, and Ctrl+G shortcuts', () => {
    it('should call onOpenSettings when Ctrl+, is pressed', () => {
      const onOpenSettings = vi.fn();
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts({ onOpenSettings }));

      const event = new KeyboardEvent('keydown', {
        key: ',',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should call onAddRepository when Ctrl+G is pressed', () => {
      const onAddRepository = vi.fn();
      const session = createWorktreeSession('s1');
      const project = createRepository('p1', [session]);
      useAppStore.setState({
        focusArea: 'mainTerminal',
        repositories: [project],
      });

      renderHook(() => useKeyboardShortcuts({ onAddRepository }));

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onAddRepository).toHaveBeenCalledTimes(1);
    });

    it('should call onOpenSettings even when sidebar is focused', () => {
      const onOpenSettings = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [],
      });

      renderHook(() => useKeyboardShortcuts({ onOpenSettings }));

      const event = new KeyboardEvent('keydown', {
        key: ',',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should call onAddRepository even when sidebar is focused', () => {
      const onAddRepository = vi.fn();
      useAppStore.setState({
        focusArea: 'sidebar',
        repositories: [],
      });

      renderHook(() => useKeyboardShortcuts({ onAddRepository }));

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onAddRepository).toHaveBeenCalledTimes(1);
    });
  });
});
