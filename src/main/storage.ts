import { app } from 'electron';
import type { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { AppState } from '../shared/types';
import { getDefaultAppState } from '../shared/types';

const DATA_FILE = 'projects.json';

// Track pending saves to prevent concurrent writes
let savePromise: Promise<void> | null = null;

function getDataFilePath(): string {
  return path.join(app.getPath('userData'), DATA_FILE);
}

export async function loadAppState(): Promise<AppState> {
  try {
    const filePath = getDataFilePath();
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    const defaults = getDefaultAppState();
    // Merge with defaults to ensure all required fields exist
    // Note: Old stored data may contain worktreeTabs/userTerminalTabs which will be ignored
    return {
      ...defaults,
      ...parsed,
      // Ensure arrays exist (don't let undefined override defaults)
      repositories: parsed.repositories ?? defaults.repositories,
      settings: { ...defaults.settings, ...parsed.settings },
      window: { ...defaults.window, ...parsed.window },
    };
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

        // Write to temp file first
        await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
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

export function setupStorageIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('app:getDataPath', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('storage:loadState', async () => {
    return loadAppState();
  });

  ipcMain.handle('storage:saveState', async (_, state: AppState) => {
    await saveAppState(state);
  });
}
