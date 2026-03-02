import { useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  getSidebarFocusableItems,
  getNextItem,
  getPreviousItem,
  getItemById,
  getStatusIndicatorsForWorktree,
  parseAddWorktreeItemId,
  type FocusableItem,
} from '../utils/sidebarNavigation';
import { shortcutsEqual } from '../utils/shortcuts';
import type { CustomShortcut, WorktreeSession, SidebarStatusFocus } from '../../shared/types';

interface UseSidebarNavigationOptions {
  onSessionSelect?: () => void;
  onAddRepository?: () => void;
  onNewWorktree?: (repositoryId: string) => void;
}

interface UseSidebarNavigationResult {
  focusedItemId: string | null;
  focusableItems: FocusableItem[];
  statusFocus: SidebarStatusFocus | null;
  handleKeyDown: (e: KeyboardEvent) => void;
}

/**
 * Find worktree session by its shortcut key (plain number key '0'-'9')
 * Only matches worktree sessions with that exact customShortcut - no positional fallback
 */
function findWorktreeSessionByShortcutKey(
  repositories: readonly { worktreeSessions: readonly WorktreeSession[] }[],
  key: string
): WorktreeSession | null {
  const targetShortcut: CustomShortcut = {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };

  for (const repository of repositories) {
    for (const worktreeSession of repository.worktreeSessions) {
      if (
        worktreeSession.customShortcut &&
        shortcutsEqual(worktreeSession.customShortcut, targetShortcut)
      ) {
        return worktreeSession;
      }
    }
  }

  return null;
}

export function useSidebarNavigation(
  options: UseSidebarNavigationOptions = {}
): UseSidebarNavigationResult {
  const { onSessionSelect, onAddRepository, onNewWorktree } = options;
  const {
    repositories,
    focusArea,
    sidebarFocusedItemId,
    sidebarStatusFocus,
    activeTerminalId,
    worktreeTabs,
    setFocusArea,
    setSidebarFocusedItemId,
    setSidebarStatusFocus,
    setActiveTerminal,
    setActiveTab,
    toggleRepositoryExpanded,
  } = useAppStore();

  const focusableItems = useMemo(() => getSidebarFocusableItems(repositories), [repositories]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle keys when sidebar is focused
      if (focusArea !== 'sidebar') return;

      const key = e.key;

      // Arrow Up - move to previous item (or previous worktree in status mode)
      if (key === 'ArrowUp') {
        e.preventDefault();
        if (sidebarStatusFocus) {
          // In status mode: move to previous worktree session, keeping indicator index
          const prevItem = getPreviousItem(focusableItems, sidebarStatusFocus.worktreeSessionId);
          if (prevItem && prevItem.type === 'session' && prevItem.sessionId) {
            const prevTabs = getStatusIndicatorsForWorktree(worktreeTabs, prevItem.sessionId);
            if (prevTabs.length > 0) {
              // Keep the same indicator index, but clamp to available tabs
              const newIndex = Math.min(sidebarStatusFocus.indicatorIndex, prevTabs.length - 1);
              setSidebarStatusFocus({
                worktreeSessionId: prevItem.sessionId,
                indicatorIndex: newIndex,
              });
              setSidebarFocusedItemId(prevItem.sessionId);
            } else {
              // No tabs in previous worktree, exit status mode and focus it
              setSidebarStatusFocus(null);
              setSidebarFocusedItemId(prevItem.id);
            }
          } else if (prevItem) {
            // Previous item is a project, exit status mode and focus it
            setSidebarStatusFocus(null);
            setSidebarFocusedItemId(prevItem.id);
          }
        } else {
          const prevItem = getPreviousItem(focusableItems, sidebarFocusedItemId);
          if (prevItem) {
            setSidebarFocusedItemId(prevItem.id);
          }
        }
        return;
      }

      // Arrow Down - move to next item (or next worktree in status mode)
      if (key === 'ArrowDown') {
        e.preventDefault();
        if (sidebarStatusFocus) {
          // In status mode: move to next worktree session, keeping indicator index
          const nextItem = getNextItem(focusableItems, sidebarStatusFocus.worktreeSessionId);
          if (nextItem && nextItem.type === 'session' && nextItem.sessionId) {
            const nextTabs = getStatusIndicatorsForWorktree(worktreeTabs, nextItem.sessionId);
            if (nextTabs.length > 0) {
              // Keep the same indicator index, but clamp to available tabs
              const newIndex = Math.min(sidebarStatusFocus.indicatorIndex, nextTabs.length - 1);
              setSidebarStatusFocus({
                worktreeSessionId: nextItem.sessionId,
                indicatorIndex: newIndex,
              });
              setSidebarFocusedItemId(nextItem.sessionId);
            } else {
              // No tabs in next worktree, exit status mode and focus it
              setSidebarStatusFocus(null);
              setSidebarFocusedItemId(nextItem.id);
            }
          } else if (nextItem) {
            // Next item is a project, exit status mode and focus it
            setSidebarStatusFocus(null);
            setSidebarFocusedItemId(nextItem.id);
          }
        } else {
          const nextItem = getNextItem(focusableItems, sidebarFocusedItemId);
          if (nextItem) {
            setSidebarFocusedItemId(nextItem.id);
          }
        }
        return;
      }

      // Arrow Left - exit status mode, collapse repository, or move to parent
      if (key === 'ArrowLeft') {
        e.preventDefault();
        if (sidebarStatusFocus) {
          // In status mode: navigate to previous indicator or exit status mode
          if (sidebarStatusFocus.indicatorIndex > 0) {
            // Move to previous indicator
            setSidebarStatusFocus({
              ...sidebarStatusFocus,
              indicatorIndex: sidebarStatusFocus.indicatorIndex - 1,
            });
          } else {
            // At first indicator, exit status mode
            setSidebarStatusFocus(null);
          }
        } else if (sidebarFocusedItemId) {
          const currentItem = getItemById(focusableItems, sidebarFocusedItemId);
          if (currentItem?.type === 'project') {
            // Find the repository and collapse if expanded
            const repository = repositories.find((r) => r.id === currentItem.projectId);
            if (repository?.isExpanded) {
              toggleRepositoryExpanded(currentItem.projectId);
            }
          } else if (currentItem?.type === 'session' || currentItem?.type === 'addWorktree') {
            // Move focus to parent repository
            setSidebarFocusedItemId(currentItem.projectId);
          }
        }
        return;
      }

      // Arrow Right - enter status mode or expand repository
      if (key === 'ArrowRight') {
        e.preventDefault();
        if (sidebarStatusFocus) {
          // In status mode: navigate to next indicator
          const tabs = getStatusIndicatorsForWorktree(
            worktreeTabs,
            sidebarStatusFocus.worktreeSessionId
          );
          if (sidebarStatusFocus.indicatorIndex < tabs.length - 1) {
            setSidebarStatusFocus({
              ...sidebarStatusFocus,
              indicatorIndex: sidebarStatusFocus.indicatorIndex + 1,
            });
          }
        } else if (sidebarFocusedItemId) {
          const currentItem = getItemById(focusableItems, sidebarFocusedItemId);
          if (currentItem?.type === 'session' && currentItem.sessionId) {
            // On a session: enter status indicator mode if tabs exist
            const tabs = getStatusIndicatorsForWorktree(worktreeTabs, currentItem.sessionId);
            if (tabs.length > 0) {
              setSidebarStatusFocus({
                worktreeSessionId: currentItem.sessionId,
                indicatorIndex: 0,
              });
            }
          } else if (currentItem?.type === 'project') {
            const repository = repositories.find((r) => r.id === currentItem.projectId);
            if (repository && !repository.isExpanded) {
              toggleRepositoryExpanded(currentItem.projectId);
            }
          }
        }
        return;
      }

      // Enter - select session/tab (focus terminal), toggle repository expand, or add repository
      if (key === 'Enter') {
        e.preventDefault();
        if (sidebarStatusFocus) {
          // In status mode: open the focused tab's terminal
          const tabs = getStatusIndicatorsForWorktree(
            worktreeTabs,
            sidebarStatusFocus.worktreeSessionId
          );
          const tab = tabs[sidebarStatusFocus.indicatorIndex];
          if (tab) {
            setActiveTerminal(sidebarStatusFocus.worktreeSessionId);
            setActiveTab(tab.id);
            setSidebarStatusFocus(null);
            setFocusArea('mainTerminal');
            onSessionSelect?.();
          }
        } else if (sidebarFocusedItemId) {
          const currentItem = getItemById(focusableItems, sidebarFocusedItemId);
          if (currentItem?.type === 'session') {
            // Select session and return focus to main terminal
            setActiveTerminal(currentItem.sessionId);
            setFocusArea('mainTerminal');
            onSessionSelect?.();
          } else if (currentItem?.type === 'project') {
            // Toggle repository expansion
            toggleRepositoryExpanded(currentItem.projectId);
          } else if (currentItem?.type === 'addRepository') {
            // Open add repository screen
            onAddRepository?.();
          } else if (currentItem?.type === 'addWorktree') {
            // Open add worktree screen for the repository
            const repositoryId = parseAddWorktreeItemId(sidebarFocusedItemId);
            if (repositoryId) {
              onNewWorktree?.(repositoryId);
            }
          }
        }
        return;
      }

      // Escape - return to main terminal (or app if no terminal is selected)
      if (key === 'Escape') {
        e.preventDefault();
        // Clear status focus if active
        if (sidebarStatusFocus) {
          setSidebarStatusFocus(null);
        }
        // Only set to 'mainTerminal' if there's an active terminal, otherwise use 'app'
        setFocusArea(activeTerminalId ? 'mainTerminal' : 'app');
        return;
      }

      // Number keys 0-9 for quick worktree session navigation by shortcut
      if (/^[0-9]$/.test(key) && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        // Find the worktree session with this shortcut key
        const targetWorktreeSession = findWorktreeSessionByShortcutKey(repositories, key);
        if (targetWorktreeSession) {
          setSidebarFocusedItemId(targetWorktreeSession.id);
          setActiveTerminal(targetWorktreeSession.id);
          setFocusArea('mainTerminal');
          onSessionSelect?.();
        }
        return;
      }

      // Check for custom shortcuts (including those without modifiers)
      const shortcut: CustomShortcut = {
        key: key.toLowerCase(),
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      };

      // Search for a session with this custom shortcut
      for (const repository of repositories) {
        for (const session of repository.worktreeSessions) {
          if (session.customShortcut && shortcutsEqual(session.customShortcut, shortcut)) {
            e.preventDefault();
            setSidebarFocusedItemId(`session:${session.id}`);
            setActiveTerminal(session.id);
            setFocusArea('mainTerminal');
            onSessionSelect?.();
            return;
          }
        }
      }
    },
    [
      activeTerminalId,
      focusArea,
      focusableItems,
      sidebarFocusedItemId,
      sidebarStatusFocus,
      repositories,
      worktreeTabs,
      setFocusArea,
      setSidebarFocusedItemId,
      setSidebarStatusFocus,
      setActiveTerminal,
      setActiveTab,
      toggleRepositoryExpanded,
      onSessionSelect,
      onAddRepository,
      onNewWorktree,
    ]
  );

  // Determine the current focused item ID
  // If we have an explicit sidebarFocusedItemId, use it
  // Otherwise, use the activeTerminalId if it's in the list
  const effectiveFocusedItemId = useMemo(() => {
    if (focusArea !== 'sidebar') return null;
    if (sidebarFocusedItemId) return sidebarFocusedItemId;
    // Default to active terminal if available
    if (activeTerminalId && focusableItems.some((item) => item.id === activeTerminalId)) {
      return activeTerminalId;
    }
    // Default to first item
    return focusableItems[0]?.id ?? null;
  }, [focusArea, sidebarFocusedItemId, activeTerminalId, focusableItems]);

  return {
    focusedItemId: effectiveFocusedItemId,
    focusableItems,
    statusFocus: sidebarStatusFocus,
    handleKeyDown,
  };
}
