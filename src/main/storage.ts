import { app } from 'electron';
import type { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { AppState, TermpadConfigFile } from '../shared/types';
import { getDefaultAppState } from '../shared/types';

const DATA_FILE = 'projects.json';

// Track pending saves to prevent concurrent writes
let savePromise: Promise<void> | null = null;

// In-memory mirror of the persisted state. The file is owned exclusively by
// this app, so once loaded (or saved) the memory copy is authoritative and
// spawn-path readers skip the disk read + JSON parse entirely.
let lastKnownState: AppState | null = null;

function getDataFilePath(): string {
  return path.join(app.getPath('userData'), DATA_FILE);
}

export async function loadAppState(): Promise<AppState> {
  // A debounced save may hold newer state than the file on disk
  const pending = getPendingAppState();
  if (pending) {
    return pending;
  }
  if (lastKnownState) {
    return lastKnownState;
  }
  try {
    const filePath = getDataFilePath();
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    const defaults = getDefaultAppState();
    // Merge with defaults to ensure all required fields exist
    // Note: Old stored data may contain worktreeTabs/userTerminalTabs which will be ignored
    const loaded: AppState = {
      ...defaults,
      ...parsed,
      // Ensure arrays exist (don't let undefined override defaults)
      repositories: parsed.repositories ?? defaults.repositories,
      settings: { ...defaults.settings, ...parsed.settings },
      window: { ...defaults.window, ...parsed.window },
    };
    lastKnownState = loaded;
    return loaded;
  } catch (error) {
    console.log('[Storage] No existing state found, using defaults');
    return getDefaultAppState();
  }
}

// Retry configuration for save operations
const RETRY_DELAYS = [100, 200, 400]; // Exponential backoff delays in ms
const MAX_RETRIES = RETRY_DELAYS.length;

/**
 * Helper to check if an error is an EPERM error (file locked by another process)
 */
function isEpermError(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EPERM'
  );
}

/**
 * Helper to delay for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function saveAppState(state: AppState): Promise<void> {
  lastKnownState = state;
  const doSave = async () => {
    const filePath = getDataFilePath();
    const tempPath = `${filePath}.tmp`;

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Force-delete temp file before each attempt to ensure clean state
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore if temp file doesn't exist
        }

        // Write to temp file first (compact JSON: the file is machine-read
        // only and pretty-printing inflates size and stringify cost)
        await fs.writeFile(tempPath, JSON.stringify(state), 'utf-8');
        // Atomic rename
        await fs.rename(tempPath, filePath);
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error;

        // Only retry for EPERM errors (file locked)
        if (isEpermError(error) && attempt < MAX_RETRIES) {
          const delayMs = RETRY_DELAYS[attempt];
          console.log(
            `[Storage] EPERM error on attempt ${attempt + 1}/${MAX_RETRIES + 1}, retrying in ${delayMs}ms...`
          );
          await delay(delayMs);
          continue; // Retry
        }

        // For non-EPERM errors or final attempt, cleanup and throw
        console.error('[Storage] Failed to save state:', error);
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    }

    // If we get here, all retries failed
    throw lastError;
  };

  // Chain saves to ensure order and prevent concurrent writes
  savePromise = (savePromise || Promise.resolve()).then(doSave);
  return savePromise;
}

// The renderer persists the full app state after every mutation (tab switch,
// label edit, ...). Debounce writes so bursts collapse into one disk write of
// the latest state; flushPendingSave() runs on quit so nothing is lost.
const SAVE_DEBOUNCE_MS = 400;
let debouncedState: AppState | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

function scheduleSaveAppState(state: AppState): void {
  lastKnownState = state;
  debouncedState = state;
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const toSave = debouncedState;
    debouncedState = null;
    if (toSave) {
      saveAppState(toSave).catch((error) => {
        console.error('[Storage] Debounced save failed:', error);
      });
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Write any pending debounced state immediately. Call on app quit.
 */
export async function flushPendingSave(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const toSave = debouncedState;
  debouncedState = null;
  if (toSave) {
    await saveAppState(toSave);
  }
}

/**
 * Latest state handed to the debouncer but not yet written. Readers that
 * load state from disk must prefer this to avoid seeing stale data.
 */
export function getPendingAppState(): AppState | null {
  return debouncedState;
}

const CONFIG_FILENAME = 'termpad.json';

export async function loadTermpadConfig(repoPath: string): Promise<TermpadConfigFile | null> {
  try {
    const configPath = path.join(repoPath, CONFIG_FILENAME);
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data) as TermpadConfigFile;
  } catch {
    return null;
  }
}

export function setupStorageIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('app:getDataPath', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('storage:loadState', async () => {
    return loadAppState();
  });

  ipcMain.handle('storage:saveState', async (_, state: AppState) => {
    scheduleSaveAppState(state);
  });

  ipcMain.handle('config:loadTermpadConfig', async (_, repoPath: string) => {
    return loadTermpadConfig(repoPath);
  });
}
