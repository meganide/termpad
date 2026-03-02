import { dialog, BrowserWindow, IpcMain } from 'electron';
import fs from 'fs/promises';

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  content: string;
}

export interface SaveFileResult {
  success: boolean;
  path?: string;
}

export async function selectFolder(): Promise<string | null> {
  console.log('[Dialog] selectFolder called');

  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    console.error('[Dialog] No main window found');
    throw new Error('No main window available');
  }

  try {
    console.log('[Dialog] Opening folder selection dialog...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });

    console.log('[Dialog] Dialog result:', result);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    console.error('[Dialog] Error showing dialog:', error);
    throw error;
  }
}

export async function saveFile(options: SaveFileOptions): Promise<SaveFileResult> {
  console.log('[Dialog] saveFile called');

  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (!mainWindow) {
    console.error('[Dialog] No main window found');
    throw new Error('No main window available');
  }

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options.title ?? 'Save File',
      defaultPath: options.defaultPath,
      filters: options.filters,
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    await fs.writeFile(result.filePath, options.content, 'utf-8');
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('[Dialog] Error saving file:', error);
    throw error;
  }
}

export function setupDialogIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('dialog:selectFolder', async () => {
    return selectFolder();
  });

  ipcMain.handle('dialog:saveFile', async (_, options: SaveFileOptions) => {
    return saveFile(options);
  });
}
