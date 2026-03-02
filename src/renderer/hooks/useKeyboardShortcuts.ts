import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import type { WorktreeSession, Repository, CustomShortcut, TerminalTab } from '../../shared/types';
import { shortcutsEqual, isMac } from '../utils/shortcuts';
import { getSidebarFocusableItems } from '../utils/sidebarNavigation';

/**
 * Detect Linux platform for keyboard shortcut adjustments.
 * On Linux, Ctrl+Space is often reserved by input method frameworks (IBus, Fcitx),
 * so we use Ctrl+Shift+Space instead.
 *
 * This is a function rather than a constant because window.electronAPI may not
 * be available when the module is first evaluated (depends on bundler timing).
 */
function isLinux(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.platform === 'linux';
}

/**
 * Get tab at specific index (0-based) from sorted tabs
 */
export function getTabAtIndex(tabs: TerminalTab[], index: number): TerminalTab | undefined {
  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
  return sortedTabs[index];
}

/**
 * Get the modifier key display for the current platform
 * Used for showing shortcut hints in the UI
 * Returns empty string since default shortcuts are plain numbers (work when sidebar is focused)
 */
export function getModifierKey(): string {
  return '';
}

// Map shift+number symbols back to their number keys (US keyboard layout)
const SHIFT_NUMBER_MAP: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
};

/**
 * Create a CustomShortcut from a keyboard event
 * Handles Shift+Number producing symbols (e.g., Shift+1 = '!')
 */
function eventToShortcut(e: KeyboardEvent): CustomShortcut {
  let key = e.key.toLowerCase();

  // When Shift is pressed with a number, the key becomes the shifted symbol
  // Map it back to the number for shortcut matching
  if (e.shiftKey && SHIFT_NUMBER_MAP[e.key]) {
    key = SHIFT_NUMBER_MAP[e.key];
  }

  return {
    key,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
  };
}

/**
 * Get all sessions flattened in order across all repositories
 */
export function getAllSessionsOrdered(repositories: Repository[]): WorktreeSession[] {
  const sessions: WorktreeSession[] = [];
  for (const repository of repositories) {
    for (const session of repository.worktreeSessions) {
      sessions.push(session);
    }
  }
  return sessions;
}

/**
 * Find session by its customShortcut (no positional fallback)
 */
export function findSessionByShortcut(
  repositories: Repository[],
  shortcut: CustomShortcut
): WorktreeSession | undefined {
  const allSessions = getAllSessionsOrdered(repositories);
  return allSessions.find((s) => s.customShortcut && shortcutsEqual(s.customShortcut, shortcut));
}

interface UseKeyboardShortcutsOptions {
  onSessionSelect?: () => void;
  onOpenSettings?: () => void;
  onAddRepository?: () => void;
}

/**
 * Hook to handle keyboard shortcuts for quick navigation
 * Default: Ctrl+Shift+1-9, or custom shortcuts assigned to sessions
 * Also handles Ctrl+Space to toggle focus between sidebar and terminal
 * Tab navigation: Ctrl+1-9 for jump to tab by index
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onSessionSelect, onOpenSettings, onAddRepository } = options;
  const {
    repositories,
    focusArea,
    activeTerminalId,
    activeTabId,
    activeUserTabId,
    setActiveTerminal,
    setFocusArea,
    setSidebarFocusedItemId,
    setActiveTab,
    getTabsForWorktree,
    closeTab,
    closeUserTab,
    getUserTabsForWorktree,
    createTab,
    createUserTab,
    settings,
  } = useAppStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Handle Ctrl+Space (or Ctrl+Shift+Space on Linux) to focus sidebar (direct navigation, works globally)
      // Must check before input field check since xterm uses a textarea internally
      // On Linux, Ctrl+Space is reserved by input method frameworks, so we use Ctrl+Shift+Space instead
      // Note: On Linux, e.key may be 'Unidentified' for Ctrl+Shift+Space, so we check e.code instead
      const onLinux = isLinux();
      const isSpaceKey = e.key === ' ' || e.code === 'Space';
      const isSidebarShortcut = onLinux
        ? e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && isSpaceKey
        : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && isSpaceKey;

      if (isSidebarShortcut) {
        e.preventDefault();

        // Only navigate if there are repositories
        if (repositories.length === 0) return;

        // Always go to sidebar (direct navigation)
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setFocusArea('sidebar');
        // Set initial focus to active terminal's session if available
        const focusableItems = getSidebarFocusableItems(repositories);
        if (activeTerminalId && focusableItems.some((item) => item.id === activeTerminalId)) {
          setSidebarFocusedItemId(activeTerminalId);
        } else if (focusableItems.length > 0) {
          setSidebarFocusedItemId(focusableItems[0].id);
        }
        return;
      }

      // Handle Ctrl+T to focus main terminal (direct navigation, works globally)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setFocusArea('mainTerminal');
        return;
      }

      // Handle Ctrl+U to focus user terminal (direct navigation, works globally)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setFocusArea('userTerminal');
        return;
      }

      // Handle Ctrl+, (comma) to open settings (works globally)
      // On Mac: Cmd+, (standard Mac preferences shortcut)
      // On Windows/Linux: Ctrl+,
      const isSettingsShortcut = isMac
        ? e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ','
        : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === ',';
      if (isSettingsShortcut) {
        e.preventDefault();
        onOpenSettings?.();
        return;
      }

      // Handle Ctrl+G to add repository (works globally)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        onAddRepository?.();
        return;
      }

      // Handle Ctrl+W to create new tab (works in main terminal, user terminal, or from sidebar)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'w') {
        if (activeTerminalId) {
          e.preventDefault();
          if (focusArea === 'userTerminal') {
            createUserTab(activeTerminalId, 'Terminal');
          } else {
            // Main terminal or sidebar - create main terminal tab
            const { terminalPresets, defaultPresetId } = settings;
            const preset = defaultPresetId
              ? terminalPresets.find((p) => p.id === defaultPresetId)
              : terminalPresets.find((p) => p.isBuiltIn);
            createTab(
              activeTerminalId,
              preset?.name || 'Terminal',
              preset?.command || undefined,
              preset?.icon
            );
          }
          return;
        }
      }

      // Handle Ctrl+Q to close current tab (works in main terminal, user terminal, or from sidebar)
      // Always prevent default to avoid closing the app
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (focusArea === 'userTerminal' && activeTerminalId && activeUserTabId) {
          closeUserTab(activeUserTabId);
          return;
        }
        if (activeTerminalId && activeTabId) {
          closeTab(activeTabId);
          return;
        }
      }

      // Handle Ctrl+1 through Ctrl+9 for tab index navigation (works globally, including from main terminal)
      // On Mac: Cmd+1-9 (standard Mac tab switching)
      // On Windows/Linux: Ctrl+1-9
      // Must check before input field check since xterm uses a textarea internally
      const isTabSwitchModifier = isMac
        ? e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
        : e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
      if (isTabSwitchModifier && focusArea === 'mainTerminal') {
        const keyNum = parseInt(e.key, 10);
        if (keyNum >= 1 && keyNum <= 9) {
          e.preventDefault();
          if (!activeTerminalId) return;

          const tabs = getTabsForWorktree(activeTerminalId);
          const targetTab = getTabAtIndex(tabs, keyNum - 1); // 0-indexed

          if (targetTab) {
            setActiveTab(targetTab.id);
          }
          return;
        }
      }

      // Skip if we're in an input field (for other shortcuts)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Session shortcuts only work when main terminal is focused
      if (focusArea !== 'mainTerminal') {
        return;
      }

      // Need at least one modifier key for session shortcuts
      if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        return;
      }

      const shortcut = eventToShortcut(e);
      const targetSession = findSessionByShortcut(repositories, shortcut);

      if (targetSession) {
        e.preventDefault();
        setActiveTerminal(targetSession.id);
        onSessionSelect?.();
      }
    },
    [
      repositories,
      focusArea,
      activeTerminalId,
      activeTabId,
      activeUserTabId,
      setActiveTerminal,
      setFocusArea,
      setSidebarFocusedItemId,
      setActiveTab,
      getTabsForWorktree,
      closeTab,
      closeUserTab,
      getUserTabsForWorktree,
      createTab,
      createUserTab,
      settings,
      onSessionSelect,
      onOpenSettings,
      onAddRepository,
    ]
  );

  useEffect(() => {
    // Use capture phase to handle Ctrl+Space before xterm intercepts it
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);
}
