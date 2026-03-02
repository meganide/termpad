import type { Repository, TerminalTab, WorktreeTabState } from '../../shared/types';

export interface FocusableItem {
  type: 'project' | 'session' | 'addRepository' | 'addWorktree';
  id: string;
  projectId: string;
  sessionId: string | null;
}

// Special ID for the "Add Repository" button
export const ADD_REPOSITORY_ITEM_ID = '__add_repository__';

// Helper to create "Add Worktree" item IDs
export function getAddWorktreeItemId(repositoryId: string): string {
  return `__add_worktree__:${repositoryId}`;
}

// Helper to parse repository ID from "Add Worktree" item ID
export function parseAddWorktreeItemId(itemId: string): string | null {
  const prefix = '__add_worktree__:';
  if (itemId.startsWith(prefix)) {
    return itemId.slice(prefix.length);
  }
  return null;
}

/**
 * Flatten the sidebar items (repositories + expanded worktree sessions) into a navigable list.
 * Skips worktree sessions for collapsed repositories.
 * Includes the "Add Worktree" button for each expanded repository.
 * Includes the "Add Repository" button at the end.
 */
export function getSidebarFocusableItems(repositories: Repository[]): FocusableItem[] {
  const items: FocusableItem[] = [];

  for (const repository of repositories) {
    // Add the repository itself
    items.push({
      type: 'project',
      id: repository.id,
      projectId: repository.id,
      sessionId: null,
    });

    // Only add worktree sessions and "Add Worktree" button if repository is expanded
    if (repository.isExpanded) {
      // Add the "Add Worktree" button first (matches visual order in UI)
      items.push({
        type: 'addWorktree',
        id: getAddWorktreeItemId(repository.id),
        projectId: repository.id,
        sessionId: null,
      });

      for (const worktreeSession of repository.worktreeSessions) {
        items.push({
          type: 'session',
          id: worktreeSession.id,
          projectId: repository.id,
          sessionId: worktreeSession.id,
        });
      }
    }
  }

  // Add the "Add Repository" button as the last focusable item
  items.push({
    type: 'addRepository',
    id: ADD_REPOSITORY_ITEM_ID,
    projectId: '',
    sessionId: null,
  });

  return items;
}

/**
 * Find the index of an item in the focusable items list by its ID.
 */
export function findItemIndex(items: FocusableItem[], itemId: string): number {
  return items.findIndex((item) => item.id === itemId);
}

/**
 * Get the next item in the list (wraps around).
 */
export function getNextItem(
  items: FocusableItem[],
  currentId: string | null
): FocusableItem | null {
  if (items.length === 0) return null;
  if (currentId === null) return items[0];

  const currentIndex = findItemIndex(items, currentId);
  if (currentIndex === -1) return items[0];

  const nextIndex = (currentIndex + 1) % items.length;
  return items[nextIndex];
}

/**
 * Get the previous item in the list (wraps around).
 */
export function getPreviousItem(
  items: FocusableItem[],
  currentId: string | null
): FocusableItem | null {
  if (items.length === 0) return null;
  if (currentId === null) return items[items.length - 1];

  const currentIndex = findItemIndex(items, currentId);
  if (currentIndex === -1) return items[items.length - 1];

  const prevIndex = (currentIndex - 1 + items.length) % items.length;
  return items[prevIndex];
}

/**
 * Get the item at a specific 1-based index (for number key navigation).
 * Returns null if index is out of bounds.
 */
export function getItemByIndex(
  items: FocusableItem[],
  oneBasedIndex: number
): FocusableItem | null {
  const zeroBasedIndex = oneBasedIndex - 1;
  if (zeroBasedIndex < 0 || zeroBasedIndex >= items.length) return null;
  return items[zeroBasedIndex];
}

/**
 * Find the item for a given ID (project or session).
 */
export function getItemById(items: FocusableItem[], itemId: string): FocusableItem | null {
  return items.find((item) => item.id === itemId) || null;
}

/**
 * Get the status indicator tabs for a worktree session.
 * Returns sorted tabs that can be navigated with arrow keys.
 */
export function getStatusIndicatorsForWorktree(
  worktreeTabs: WorktreeTabState[],
  worktreeSessionId: string
): TerminalTab[] {
  const tabState = worktreeTabs.find((wt) => wt.worktreeSessionId === worktreeSessionId);
  if (!tabState) return [];
  return [...tabState.tabs].sort((a, b) => a.order - b.order);
}
