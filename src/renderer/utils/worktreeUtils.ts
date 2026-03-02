import type { WorktreeInfo, WorktreeSession } from '../../shared/types';

/**
 * Normalize path slashes to forward slashes for consistent storage.
 * This ensures paths from different sources (Windows file dialogs vs git output) are stored consistently.
 * Forward slashes work in all shells on all platforms.
 */
export function normalizePathSlashes(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Normalize a file path for comparison.
 * Converts backslashes to forward slashes, lowercases on Windows, and normalizes
 * WSL path formats (wsl$ -> wsl.localhost) for consistent comparison.
 * This ensures paths from different sources (Node.js path.join vs git output) compare correctly.
 */
export function normalizePath(filePath: string): string {
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');
  // Remove trailing slash if present
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // On Windows, paths are case-insensitive, so lowercase for comparison
  if (typeof process !== 'undefined' && process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }
  // In renderer process, check navigator.platform
  if (typeof navigator !== 'undefined' && navigator.platform?.startsWith('Win')) {
    normalized = normalized.toLowerCase();
  }
  // Normalize WSL path formats (wsl$ -> wsl.localhost) for consistent comparison
  normalized = normalized.replace(/^\/\/wsl\$\//i, '//wsl.localhost/');
  return normalized;
}

/**
 * Filter worktrees to only include those that can be imported.
 * Excludes:
 * - Main worktree (the primary working directory)
 * - Prunable worktrees (missing directory)
 * - Already-imported worktrees (matching existing session paths)
 */
export function getImportableWorktrees(
  worktrees: WorktreeInfo[],
  existingSessions: WorktreeSession[]
): WorktreeInfo[] {
  const existingPaths = new Set(existingSessions.map((s) => normalizePath(s.path)));

  return worktrees.filter((worktree) => {
    // Exclude main worktree
    if (worktree.isMain) {
      return false;
    }

    // Exclude prunable worktrees (missing directory)
    if (worktree.prunable) {
      return false;
    }

    // Exclude already-imported worktrees (using normalized paths for comparison)
    if (existingPaths.has(normalizePath(worktree.path))) {
      return false;
    }

    return true;
  });
}
