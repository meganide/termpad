import type { CustomShortcut } from '../../shared/types';

// Detect if running on Mac
export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Mac keyboard symbols
const MAC_SYMBOLS = {
  ctrl: '⌃',
  shift: '⇧',
  alt: '⌥',
  meta: '⌘',
};

// Windows/Linux modifier names
const WINDOWS_MODIFIERS = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Win',
};

// Blocked shortcuts that conflict with system/terminal operations
export const BLOCKED_SHORTCUTS: Partial<CustomShortcut>[] = [
  { key: 'c', ctrlKey: true }, // Copy
  { key: 'v', ctrlKey: true }, // Paste
  { key: 'x', ctrlKey: true }, // Cut
  { key: 'a', ctrlKey: true }, // Select all
  { key: 'z', ctrlKey: true }, // Undo
  { key: 'y', ctrlKey: true }, // Redo
  { key: 'f', ctrlKey: true }, // Find
  // Ctrl+T and Ctrl+W are used for terminal navigation
  // Ctrl+Q is used for closing tabs
  { key: 'n', ctrlKey: true }, // New window
  { key: 'r', ctrlKey: true }, // Refresh
  { key: 's', ctrlKey: true }, // Save
  { key: 'p', ctrlKey: true }, // Print
  { key: 'd', ctrlKey: true }, // Terminal: EOF
  { key: 'l', ctrlKey: true }, // Terminal: Clear
  { key: 'b', ctrlKey: true }, // Sidebar toggle
];

/**
 * Format a shortcut for platform-aware display
 * Mac: ⌃⇧K
 * Windows/Linux: Ctrl+Shift+K
 */
export function formatShortcut(shortcut: CustomShortcut): string {
  if (isMac) {
    return formatShortcutMac(shortcut);
  }
  return formatShortcutWindows(shortcut);
}

/**
 * Format shortcut using Mac symbols
 */
export function formatShortcutMac(shortcut: CustomShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push(MAC_SYMBOLS.ctrl);
  if (shortcut.altKey) parts.push(MAC_SYMBOLS.alt);
  if (shortcut.shiftKey) parts.push(MAC_SYMBOLS.shift);
  if (shortcut.metaKey) parts.push(MAC_SYMBOLS.meta);

  // Capitalize single character keys for display
  const displayKey = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(displayKey);

  return parts.join('');
}

/**
 * Format shortcut using Windows/Linux text format
 */
export function formatShortcutWindows(shortcut: CustomShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push(WINDOWS_MODIFIERS.ctrl);
  if (shortcut.altKey) parts.push(WINDOWS_MODIFIERS.alt);
  if (shortcut.shiftKey) parts.push(WINDOWS_MODIFIERS.shift);
  if (shortcut.metaKey) parts.push(WINDOWS_MODIFIERS.meta);

  // Capitalize single character keys for display
  const displayKey = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(displayKey);

  return parts.join('+');
}

/**
 * Check if a shortcut is in the blocklist
 * A shortcut matches a blocked entry only if all modifiers match exactly
 * (blocked entries with ctrlKey: true and no shiftKey specified should only
 * match shortcuts where shiftKey is false)
 */
export function isShortcutBlocked(shortcut: CustomShortcut): boolean {
  const normalizedKey = shortcut.key.toLowerCase();

  return BLOCKED_SHORTCUTS.some((blocked) => {
    // Key must match
    if (blocked.key !== normalizedKey) return false;

    // For each modifier:
    // - If blocked specifies it, shortcut must match
    // - If blocked doesn't specify it (undefined), shortcut must be false
    const ctrlMatch =
      blocked.ctrlKey !== undefined ? blocked.ctrlKey === shortcut.ctrlKey : !shortcut.ctrlKey;
    const shiftMatch =
      blocked.shiftKey !== undefined ? blocked.shiftKey === shortcut.shiftKey : !shortcut.shiftKey;
    const altMatch =
      blocked.altKey !== undefined ? blocked.altKey === shortcut.altKey : !shortcut.altKey;
    const metaMatch =
      blocked.metaKey !== undefined ? blocked.metaKey === shortcut.metaKey : !shortcut.metaKey;

    return ctrlMatch && shiftMatch && altMatch && metaMatch;
  });
}

/**
 * Check if a shortcut has at least one modifier key
 */
export function hasModifier(shortcut: CustomShortcut): boolean {
  return shortcut.ctrlKey || shortcut.shiftKey || shortcut.altKey || shortcut.metaKey;
}

/**
 * Parse a keyboard event into a CustomShortcut object
 */
export function parseKeyboardEvent(e: KeyboardEvent): CustomShortcut {
  return {
    key: e.key.toLowerCase(),
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
  };
}

/**
 * Check if two shortcuts are equal
 */
export function shortcutsEqual(a: CustomShortcut, b: CustomShortcut): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.ctrlKey === b.ctrlKey &&
    a.shiftKey === b.shiftKey &&
    a.altKey === b.altKey &&
    a.metaKey === b.metaKey
  );
}

/**
 * Migrate an old string shortcut to the new CustomShortcut format
 * Old format: "1" for Alt+1 (or Cmd+1 on Mac)
 */
export function migrateOldShortcut(oldShortcut: string): CustomShortcut {
  return {
    key: oldShortcut,
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  };
}

/**
 * Get the default shortcut for a session by index (1-based)
 * Uses plain number key (no modifiers) - these only work when sidebar is focused
 */
export function getDefaultShortcut(index: number): CustomShortcut {
  return {
    key: String(index),
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };
}

/**
 * Find the next available shortcut number (1-9, then 0 for 10)
 * Returns the shortcut object, or undefined if all slots 1-10 are taken
 */
export function getNextAvailableShortcut(
  projects: readonly { worktreeSessions: readonly { customShortcut?: CustomShortcut }[] }[]
): CustomShortcut | undefined {
  // Collect all used shortcut keys
  const usedKeys = new Set<string>();
  for (const project of projects) {
    for (const worktreeSession of project.worktreeSessions) {
      if (worktreeSession.customShortcut) {
        // Only track plain number shortcuts (no modifiers)
        const s = worktreeSession.customShortcut;
        if (!s.ctrlKey && !s.shiftKey && !s.altKey && !s.metaKey) {
          usedKeys.add(s.key);
        }
      }
    }
  }

  // Try 1-9, then 0 (for 10)
  for (let i = 1; i <= 9; i++) {
    if (!usedKeys.has(String(i))) {
      return getDefaultShortcut(i);
    }
  }
  // 0 represents 10
  if (!usedKeys.has('0')) {
    return {
      key: '0',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    };
  }

  // All 1-10 slots are taken
  return undefined;
}
