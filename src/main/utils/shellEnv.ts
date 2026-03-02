/**
 * Utility to get the user's shell environment PATH.
 *
 * When Electron apps are launched from Finder/Spotlight (not from terminal),
 * they don't inherit the user's shell PATH. This module runs the user's login
 * shell to extract the proper PATH including:
 * - Homebrew paths (/opt/homebrew/bin, /usr/local/bin)
 * - User paths (~/.local/bin)
 * - npm/pnpm global paths (where claude, cursor etc. are installed)
 */

let cachedShellPath: string | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the shell path by running the user's login shell.
 * Call this early in app startup (before any terminals are spawned).
 * This is safe to call multiple times - it will only run once.
 */
export async function initShellPath(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // shell-path is ESM-only, so we need dynamic import
      const { shellPath } = await import('shell-path');
      cachedShellPath = await shellPath();
      console.log('[ShellEnv] Initialized shell PATH:', cachedShellPath);
    } catch (error) {
      console.error('[ShellEnv] Failed to get shell path:', error);
      // Fall back to process.env.PATH
      cachedShellPath = process.env.PATH || '';
    }
  })();

  return initPromise;
}

/**
 * Get the user's shell PATH. If initShellPath() hasn't been called,
 * falls back to process.env.PATH.
 */
export function getShellPath(): string {
  if (cachedShellPath !== null) {
    return cachedShellPath;
  }
  // Fallback if init wasn't called yet
  return process.env.PATH || '';
}

/**
 * Get a merged environment object with the correct shell PATH.
 * Use this when spawning terminals or child processes.
 */
export function getShellEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  const shellPath = getShellPath();

  if (shellPath) {
    env.PATH = shellPath;
  }

  return env;
}
