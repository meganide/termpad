import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  shell,
  nativeImage,
} from 'electron';
import path from 'path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers, getTerminalManager, setCloseCallback } from './ipc/handlers';
import { loadAppState, saveAppState } from './storage';
import { getConstrainedWindowSize } from './utils/windowUtils';
import { initShellPath } from './utils/shellEnv';
import type { AppState } from '../shared/types';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Custom protocol for notification clicks
// Use different protocol in dev mode to avoid conflicts with installed app
const PROTOCOL = app.isPackaged ? 'termpad' : 'termpad-dev';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Use a different app name in dev mode to allow running alongside the installed app
// This gives the dev instance a separate userData directory, storage, and settings
if (!app.isPackaged) {
  app.setName('termpad-dev');
}

// Required for Windows notifications to work in packaged apps
// AUMID must match the Squirrel installer name (MakerSquirrel 'name' option)
// Format: com.squirrel.{name}.{name}
if (process.platform === 'win32') {
  app.setAppUserModelId(app.isPackaged ? 'com.squirrel.Termpad.Termpad' : 'com.termpad.dev');
}

// Register custom protocol for notification deep links
if (process.defaultApp) {
  // Dev mode - need to register with path to electron
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Packaged app
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Ensure single instance and handle protocol URLs
// Skip single instance lock in development to allow running alongside installed app
const gotTheLock = app.isPackaged ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let isForceClosing = false;
let appState: AppState | null = null;
let saveWindowStateTimeout: NodeJS.Timeout | null = null;
let allowSavingWindowState = false;

// Debounced window state saver
function saveWindowState() {
  // Don't save during initial window setup
  if (!allowSavingWindowState) return;

  if (saveWindowStateTimeout) {
    clearTimeout(saveWindowStateTimeout);
  }

  saveWindowStateTimeout = setTimeout(async () => {
    if (!mainWindow) return;

    // Load fresh state from disk to avoid overwriting other changes
    const currentState = await loadAppState();
    const isMaximized = mainWindow.isMaximized();

    // Only save bounds when NOT maximized (maximized bounds are meaningless and cause issues)
    if (!isMaximized) {
      const bounds = mainWindow.getBounds();
      currentState.window = {
        ...currentState.window,
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: false,
      };
    } else {
      // Just update the maximized flag, keep existing bounds for when user unmaximizes
      currentState.window = {
        ...currentState.window,
        isMaximized: true,
      };
    }

    await saveAppState(currentState);
  }, 500); // Debounce 500ms
}

function createApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu (required)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => mainWindow?.webContents.send('menu:settings'),
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        ...(!isMac
          ? [
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => mainWindow?.webContents.send('menu:settings'),
              },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Exit' },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    // Edit menu (required for copy/paste keyboard shortcuts to work)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'F1',
          click: () => mainWindow?.webContents.send('menu:keyboardShortcuts'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Main] Creating window with preload:', preloadPath);

  // Load icon for Linux/Windows taskbar (macOS uses icns from forge.config.ts)
  // In dev mode, use source path. In packaged mode, icon is copied to resources via extraResource
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app-icon.png')
    : path.join(app.getAppPath(), 'src/renderer/assets/icons/app-icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);
  console.log(
    '[Main] Loading app icon from:',
    iconPath,
    '- isEmpty:',
    appIcon.isEmpty(),
    '- size:',
    appIcon.getSize()
  );

  // Load saved state
  appState = await loadAppState();
  const { window: windowState } = appState;

  const isWindows = process.platform === 'win32';

  // Detect first launch (default x/y values of 100, 100)
  // On first launch, center the window and constrain size to screen
  const isFirstLaunch = windowState.x === 100 && windowState.y === 100;
  const constrainedSize = getConstrainedWindowSize(windowState.width, windowState.height);

  mainWindow = new BrowserWindow({
    width: isFirstLaunch ? constrainedSize.width : windowState.width,
    height: isFirstLaunch ? constrainedSize.height : windowState.height,
    // Use center:true for first launch, saved position for subsequent launches
    ...(isFirstLaunch ? { center: true } : { x: windowState.x, y: windowState.y }),
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload scripts on some Linux systems
    },
    // Windows: frameless with custom controls
    // macOS/Linux: native title bar
    ...(isWindows ? { frame: false } : {}),
    // Hide menu bar on Linux (can still be accessed with Alt key)
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show: false,
    icon: appIcon,
  });

  // Graceful show to prevent white flash
  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();

    // Allow saving window state after a brief delay to let window manager position the window
    setTimeout(() => {
      allowSavingWindowState = true;
      console.log('[Main] Window state saving enabled');
    }, 1000);
  });

  // Hidden DevTools shortcut (F12) - not visible in menu
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation to the dev server or the app itself
    const appOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
      : 'file://';

    if (!url.startsWith(appOrigin)) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
  });

  // Send maximize state changes to renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized-change', true);
    saveWindowState();
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized-change', false);
    saveWindowState();
  });

  // Save window state on resize and move
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  // Handle close with active terminals warning
  mainWindow.on('close', (e) => {
    // Clear pending save timeout and disable saving
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
      saveWindowStateTimeout = null;
    }
    allowSavingWindowState = false;

    if (isForceClosing) {
      return; // Allow close
    }

    const terminalManager = getTerminalManager();
    const activeCount = terminalManager?.getActiveCount() ?? 0;

    if (activeCount > 0) {
      e.preventDefault();

      // Set up callback for when user confirms close
      setCloseCallback(() => {
        isForceClosing = true;
        terminalManager?.killAll();
        mainWindow?.close();
      });

      // Send active worktree sessions to renderer for confirmation dialog
      const activeWorktreeSessionIds = terminalManager?.getActiveWorktreeSessionIds() ?? [];
      mainWindow?.webContents.send('app:beforeClose', activeCount, activeWorktreeSessionIds);
    }
  });

  // Log any render process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Render process gone:', details.reason, details.exitCode);
  });

  // Log page load failures
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[Main] Failed to load:', errorCode, errorDescription, validatedURL);
    }
  );

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[Main] Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  registerIpcHandlers(ipcMain, () => mainWindow);
}

// Handle protocol URL when app is already running (second instance tries to open)
app.on('second-instance', (_event, commandLine) => {
  const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (url) {
    handleProtocolUrl(url);
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Handle protocol URL (termpad://notification?session=xxx&tab=yyy)
function handleProtocolUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'notification') {
      const sessionId = parsed.searchParams.get('session');
      const tabId = parsed.searchParams.get('tab');

      if (sessionId && mainWindow) {
        if (process.platform === 'win32') {
          mainWindow.setAlwaysOnTop(true);
          mainWindow.setAlwaysOnTop(false);
        }
        app.focus({ steal: true });
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();

        setTimeout(() => {
          mainWindow?.webContents.send(
            'notification:switch-worktree-session',
            sessionId,
            tabId || undefined
          );
        }, 100);
      }
    }
  } catch {
    // Invalid URL, ignore
  }
}

app.whenReady().then(async () => {
  // Initialize shell PATH early - this ensures terminals get the user's full PATH
  // even when the app is launched from Finder/Spotlight instead of terminal
  await initShellPath();

  // Set up application menu with File, Edit, Help
  Menu.setApplicationMenu(createApplicationMenu());
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup terminals on graceful quit (File > Quit, Cmd+Q, etc.)
app.on('before-quit', () => {
  console.log('[Main] before-quit: cleaning up terminals');
  getTerminalManager()?.killAll();
});

// Cleanup terminals on SIGINT (Ctrl+C in dev mode)
process.on('SIGINT', () => {
  console.log('[Main] SIGINT received: cleaning up terminals');
  getTerminalManager()?.killAll();
  app.quit();
});

// Cleanup terminals on SIGTERM (kill command, system shutdown)
process.on('SIGTERM', () => {
  console.log('[Main] SIGTERM received: cleaning up terminals');
  getTerminalManager()?.killAll();
  app.quit();
});

// Cleanup terminals on SIGHUP (terminal closed)
process.on('SIGHUP', () => {
  console.log('[Main] SIGHUP received: cleaning up terminals');
  getTerminalManager()?.killAll();
  app.quit();
});
