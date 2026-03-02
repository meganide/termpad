/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
import type { IPty, IDisposable } from 'node-pty';
import type { IpcMain, BrowserWindow } from 'electron';
import type { AppSettings, ShellInfo, Repository, WorktreeSession } from '../shared/types';
import { loadAppState } from './storage';
import { execFile } from 'child_process';

/**
 * Extracts the worktree session ID from a terminal ID.
 * Terminal ID formats:
 * - Claude terminals: {worktreeSessionId}:{tabId}
 * - User terminals: user:{worktreeSessionId}:{tabId}
 */
function extractWorktreeSessionId(terminalId: string): string {
  if (terminalId.startsWith('user:')) {
    // User terminal: user:{worktreeSessionId}:{tabId}
    const parts = terminalId.split(':');
    return parts[1]; // Return the worktreeSessionId part
  }
  // Claude terminal: {worktreeSessionId}:{tabId}
  const parts = terminalId.split(':');
  return parts[0]; // Return the worktreeSessionId part
}

/**
 * Finds the worktree session and its parent repository from the app state.
 */
function findWorktreeSessionAndRepository(
  repositories: Repository[],
  worktreeSessionId: string
): { worktreeSession: WorktreeSession; repository: Repository } | null {
  for (const repository of repositories) {
    const worktreeSession = repository.worktreeSessions.find((ws) => ws.id === worktreeSessionId);
    if (worktreeSession) {
      return { worktreeSession, repository };
    }
  }
  return null;
}

/**
 * Calculates the TERMPAD_PORT for a worktree.
 * Each repository gets a 100-port range (portRangeStart).
 * Each worktree within a repo gets a unique offset (0-99).
 */
function calculatePort(repository: Repository, worktreeSession: WorktreeSession): number | null {
  const portRangeStart = repository.portRangeStart;
  const portOffset = worktreeSession.portOffset;

  // If either is not set, we can't calculate the port
  if (portRangeStart === undefined || portOffset === undefined) {
    return null;
  }

  return portRangeStart + portOffset;
}
import { detectAvailableShells, validateShellPath } from './services/shellDetector';
import { showNotification } from './notifications';
import { extractDistroFromWslPath } from './gitOperations';
import { getShellEnv } from './utils/shellEnv';

// Use native require for node-pty to avoid Vite bundling issues
const pty = require('node-pty') as typeof import('node-pty');

/**
 * Kills an entire process tree on Windows using taskkill.
 * On Windows, pty.kill() only kills the parent process, leaving child processes
 * (like Claude Code running inside PowerShell) still running and holding file locks.
 * This function uses taskkill /F /T to force-kill the entire process tree.
 *
 * @param pid - The process ID to kill
 * @returns Promise that resolves when the kill command completes and handles are released
 */
function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // /F = Force kill, /T = Kill child processes (tree), /PID = Process ID
      execFile('taskkill', ['/F', '/T', '/PID', String(pid)], (error) => {
        if (error) {
          // Process may already be dead, or other transient error - log but don't fail
          console.log(
            `[TerminalManager] taskkill returned error (may be already dead): ${error.message}`
          );
        }
        // Brief delay for Windows to release file handles after process termination
        setTimeout(resolve, 50);
      });
    } else {
      // On Unix-like systems, pty.kill() sends SIGHUP which propagates to children
      resolve();
    }
  });
}

function countNewlines(data: string): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === '\n') count++;
  }
  return count;
}

export class TerminalOutputBuffer {
  private chunks: string[] = [];
  private lineCount = 0;
  private maxLines: number;

  constructor(maxLines = 10_000) {
    this.maxLines = maxLines;
  }

  append(data: string): void {
    this.chunks.push(data);
    this.lineCount += countNewlines(data);
    this.trim();
  }

  getAll(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks = [];
    this.lineCount = 0;
  }

  getLineCount(): number {
    return this.lineCount;
  }

  private trim(): void {
    while (this.lineCount > this.maxLines && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.lineCount -= countNewlines(removed);
    }
  }
}

interface TerminalEntry {
  pty: IPty;
  disposables: IDisposable[];
  hasReceivedOutput: boolean;
  readyPromise: Promise<void>;
  resolveReady: () => void;
}

class TerminalManager {
  private terminals: Map<string, TerminalEntry> = new Map();
  private outputBuffers: Map<string, TerminalOutputBuffer> = new Map();
  private spawningInProgress: Set<string> = new Set();
  private mainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.mainWindow = getMainWindow;
  }

  getBuffer(terminalId: string): string {
    return this.outputBuffers.get(terminalId)?.getAll() ?? '';
  }

  clearBuffer(terminalId: string): void {
    this.outputBuffers.delete(terminalId);
  }

  setupIpcHandlers(ipcMain: IpcMain): void {
    ipcMain.handle(
      'terminal:spawn',
      async (_, worktreeSessionId: string, cwd: string, initialCommand?: string): Promise<void> => {
        await this.spawn(worktreeSessionId, cwd, initialCommand);
      }
    );

    ipcMain.on('terminal:write', (_: unknown, worktreeSessionId: string, data: string) => {
      this.write(worktreeSessionId, data);
    });

    ipcMain.on(
      'terminal:resize',
      (_: unknown, worktreeSessionId: string, cols: number, rows: number) => {
        this.resize(worktreeSessionId, cols, rows);
      }
    );

    ipcMain.handle(
      'terminal:kill',
      async (_: unknown, worktreeSessionId: string, waitForExit?: boolean): Promise<void> => {
        await this.kill(worktreeSessionId, waitForExit);
      }
    );

    ipcMain.handle(
      'terminal:killAllForWorktree',
      async (_: unknown, worktreeSessionId: string): Promise<void> => {
        await this.killAllForWorktree(worktreeSessionId);
      }
    );

    ipcMain.handle('terminal:getResolvedShellName', async (): Promise<string> => {
      return this.getResolvedShellName();
    });

    ipcMain.handle(
      'terminal:waitForReady',
      async (_: unknown, terminalId: string, timeoutMs = 10000): Promise<void> => {
        await this.waitForReady(terminalId, timeoutMs);
      }
    );

    ipcMain.handle('terminal:getBuffer', (_: unknown, terminalId: string): string => {
      return this.getBuffer(terminalId);
    });
  }

  /**
   * Returns the system default shell for the current platform.
   */
  private getSystemDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Resolves the shell to use based on user settings.
   * Checks defaultShell setting, looks it up in detected/custom shells,
   * and falls back to system default if not found or unavailable.
   */
  private async resolveShell(settings: AppSettings): Promise<{
    shell: string;
    args: string[];
    shellInfo?: ShellInfo;
    fallback?: { unavailableShellName: string; fallbackShellName: string };
  }> {
    const systemDefault = this.getSystemDefaultShell();
    const systemDefaultName = process.platform === 'win32' ? 'PowerShell' : 'system shell';

    // If no shell configured, use system default
    if (!settings.defaultShell) {
      return { shell: systemDefault, args: [] };
    }

    // Look for the shell in custom shells first, then detected shells
    let shellInfo: ShellInfo | undefined;

    // Check custom shells
    shellInfo = settings.customShells.find((s) => s.id === settings.defaultShell);

    // If not found in custom shells, check detected shells
    if (!shellInfo) {
      const detectedShells = await detectAvailableShells();
      shellInfo = detectedShells.find((s) => s.id === settings.defaultShell);
    }

    // If shell not found at all, fall back to system default
    if (!shellInfo) {
      console.log(
        `[TerminalManager] Configured shell '${settings.defaultShell}' not found, using system default`
      );
      return {
        shell: systemDefault,
        args: [],
        fallback: {
          unavailableShellName: settings.defaultShell,
          fallbackShellName: systemDefaultName,
        },
      };
    }

    // Validate that the shell path still exists and is executable
    const validation = await validateShellPath(shellInfo.path);
    if (!validation.valid) {
      console.log(
        `[TerminalManager] Configured shell '${shellInfo.name}' at '${shellInfo.path}' is no longer available: ${validation.error}`
      );
      return {
        shell: systemDefault,
        args: [],
        shellInfo,
        fallback: {
          unavailableShellName: shellInfo.name,
          fallbackShellName: systemDefaultName,
        },
      };
    }

    return { shell: shellInfo.path, args: shellInfo.args || [], shellInfo };
  }

  async spawn(worktreeSessionId: string, cwd: string, initialCommand?: string): Promise<void> {
    // If terminal already exists for this session, don't recreate it
    // This prevents issues with React Strict Mode double-mounting
    if (this.terminals.has(worktreeSessionId)) {
      return;
    }

    // Prevent concurrent spawn calls for the same session
    // This guards against race conditions during async operations
    if (this.spawningInProgress.has(worktreeSessionId)) {
      return;
    }
    this.spawningInProgress.add(worktreeSessionId);

    try {
      // Load settings and resolve the shell to use
      const appState = await loadAppState();
      const resolved = await this.resolveShell(appState.settings);
      let { shell, args, shellInfo } = resolved;
      const { fallback } = resolved;

      // Check if the cwd is a WSL path and auto-detect the appropriate distro
      const pathDistro = extractDistroFromWslPath(cwd);
      if (pathDistro) {
        // Find the matching WSL shell for this distro
        const availableShells = await detectAvailableShells();
        const matchingWslShell = availableShells.find((s) => s.id === `wsl-${pathDistro}`);

        if (matchingWslShell) {
          // Check if we're already using the correct distro
          const currentShellDistro = shellInfo?.id?.startsWith('wsl-')
            ? shellInfo.id.replace('wsl-', '')
            : null;

          if (currentShellDistro !== pathDistro) {
            // Switch to the matching distro
            console.log(
              `[TerminalManager] Auto-switching from ${shellInfo?.id || 'default'} to ${matchingWslShell.id} for path in ${pathDistro}`
            );

            const fromDistro =
              currentShellDistro || appState.settings.defaultShell || 'system default';
            shell = matchingWslShell.path;
            args = matchingWslShell.args || [];
            shellInfo = matchingWslShell;

            // Send IPC event about the distro switch so renderer can show toast
            const win = this.mainWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send('terminal:distro-switched', {
                sessionId: worktreeSessionId,
                fromDistro,
                toDistro: pathDistro,
                reason: `Path "${cwd}" is in WSL ${pathDistro}`,
              });
            }
          }
        } else {
          // Distro not installed - show error and refuse to spawn
          const errorMessage = `WSL distro "${pathDistro}" is not installed. The path "${cwd}" is in this distro but it's not available on your system.`;
          console.error(`[TerminalManager] ${errorMessage}`);
          showNotification('WSL Error', errorMessage);
          return; // Refuse to spawn
        }
      }

      // Notify renderer if configured shell was unavailable (shows toast instead of system notification)
      if (fallback) {
        const win = this.mainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('terminal:shell-unavailable', {
            unavailableShellName: fallback.unavailableShellName,
            fallbackShellName: fallback.fallbackShellName,
          });
        }
      }

      // Build environment with TERMPAD_* variables injected
      // Use getShellEnv() to get the user's full shell PATH, which includes
      // paths like /opt/homebrew/bin, ~/.local/bin, npm globals, etc.
      // This is necessary because packaged Electron apps don't inherit shell PATH.
      const baseEnv = getShellEnv();
      const termpadEnv: Record<string, string> = {};

      // Extract the worktree session ID from the terminal ID
      const actualWorktreeSessionId = extractWorktreeSessionId(worktreeSessionId);
      const sessionInfo = findWorktreeSessionAndRepository(
        appState.repositories,
        actualWorktreeSessionId
      );

      if (sessionInfo) {
        const { worktreeSession, repository } = sessionInfo;
        termpadEnv['TERMPAD_WORKSPACE_NAME'] = worktreeSession.label;
        termpadEnv['TERMPAD_WORKSPACE_PATH'] = worktreeSession.path;
        termpadEnv['TERMPAD_ROOT_PATH'] = repository.path;

        const port = calculatePort(repository, worktreeSession);
        if (port !== null) {
          termpadEnv['TERMPAD_PORT'] = port.toString();
        }
      }

      // For WSL shells, configure WSLENV to pass TERMPAD_* variables to the Linux environment
      // WSLENV is a colon-separated list of variable names with optional flags:
      // - /p: Translate Windows paths to WSL paths (used for path variables)
      // - No flag: Pass the variable as-is
      const isWslShell = shellInfo?.id?.startsWith('wsl-');
      if (isWslShell && Object.keys(termpadEnv).length > 0) {
        const wslEnvParts: string[] = [];

        // Add path variables with /p flag for automatic path translation
        if (termpadEnv['TERMPAD_WORKSPACE_PATH']) {
          wslEnvParts.push('TERMPAD_WORKSPACE_PATH/p');
        }
        if (termpadEnv['TERMPAD_ROOT_PATH']) {
          wslEnvParts.push('TERMPAD_ROOT_PATH/p');
        }

        // Add non-path variables without flags
        if (termpadEnv['TERMPAD_WORKSPACE_NAME']) {
          wslEnvParts.push('TERMPAD_WORKSPACE_NAME');
        }
        if (termpadEnv['TERMPAD_PORT']) {
          wslEnvParts.push('TERMPAD_PORT');
        }

        // Append to existing WSLENV if present, otherwise set new
        const existingWslEnv = baseEnv['WSLENV'] || '';
        const newWslEnv = existingWslEnv
          ? `${existingWslEnv}:${wslEnvParts.join(':')}`
          : wslEnvParts.join(':');
        termpadEnv['WSLENV'] = newWslEnv;
      }

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cwd,
        env: { ...baseEnv, ...termpadEnv },
        cols: 80,
        rows: 24,
      });

      const disposables: IDisposable[] = [];

      // Create a deferred promise that resolves when shell is ready for input
      // We wait for a "quiet period" after output to ensure shell initialization is complete
      let resolveReady!: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });

      const terminalEntry: TerminalEntry = {
        pty: ptyProcess,
        disposables,
        hasReceivedOutput: false,
        readyPromise,
        resolveReady,
      };

      // Track quiet period - wait for output to settle before considering shell ready
      let quietPeriodTimer: NodeJS.Timeout | null = null;
      const QUIET_PERIOD_MS = 150; // Wait for 150ms of no output before considering ready

      // Set up a timeout fallback in case shell doesn't produce output
      const readyTimeout = setTimeout(() => {
        if (!terminalEntry.hasReceivedOutput) {
          terminalEntry.hasReceivedOutput = true;
          terminalEntry.resolveReady();
        }
      }, 10000);

      // Buffer output for user terminals so it can be replayed on remount
      if (worktreeSessionId.startsWith('user:')) {
        this.outputBuffers.set(worktreeSessionId, new TerminalOutputBuffer());
      }

      disposables.push(
        ptyProcess.onData((data) => {
          // If we haven't marked as ready yet, set up quiet period detection
          if (!terminalEntry.hasReceivedOutput) {
            // Clear any existing quiet period timer
            if (quietPeriodTimer) {
              clearTimeout(quietPeriodTimer);
            }

            // Set a new timer - if no more output for QUIET_PERIOD_MS, shell is ready
            quietPeriodTimer = setTimeout(() => {
              if (!terminalEntry.hasReceivedOutput) {
                terminalEntry.hasReceivedOutput = true;
                clearTimeout(readyTimeout);
                terminalEntry.resolveReady();
              }
            }, QUIET_PERIOD_MS);
          }

          // Buffer output for user terminals
          const buffer = this.outputBuffers.get(worktreeSessionId);
          if (buffer) {
            buffer.append(data);
          }

          const win = this.mainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:data', worktreeSessionId, data);
          }
        })
      );

      disposables.push(
        ptyProcess.onExit(({ exitCode, signal }) => {
          clearTimeout(readyTimeout);
          if (quietPeriodTimer) {
            clearTimeout(quietPeriodTimer);
          }
          this.terminals.delete(worktreeSessionId);
          const win = this.mainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:exit', worktreeSessionId, exitCode, signal);
          }
        })
      );

      this.terminals.set(worktreeSessionId, terminalEntry);

      // Wait for shell to be ready before running any commands
      await readyPromise;

      // Auto-run command after shell is confirmed ready
      if (initialCommand) {
        ptyProcess.write(`${initialCommand}\r`);
      }
    } finally {
      this.spawningInProgress.delete(worktreeSessionId);
    }
  }

  write(worktreeSessionId: string, data: string): void {
    const entry = this.terminals.get(worktreeSessionId);
    if (entry) {
      entry.pty.write(data);
    }
  }

  resize(worktreeSessionId: string, cols: number, rows: number): void {
    const entry = this.terminals.get(worktreeSessionId);
    if (entry) {
      entry.pty.resize(cols, rows);
    }
  }

  /**
   * Kill a terminal and optionally wait for it to fully exit.
   * @param worktreeSessionId The terminal session ID to kill
   * @param waitForExit If true, returns a Promise that resolves when the process exits
   * @returns Promise that resolves when the terminal is killed (and exited if waitForExit is true)
   */
  async kill(worktreeSessionId: string, waitForExit = false): Promise<void> {
    const entry = this.terminals.get(worktreeSessionId);
    if (!entry) return;

    const pid = entry.pty.pid;

    if (waitForExit) {
      return new Promise<void>((resolve) => {
        // Set up a timeout in case the process hangs
        const timeout = setTimeout(resolve, 5000);

        const wrappedResolve = () => {
          clearTimeout(timeout);
          resolve();
        };

        // Set up exit handler
        const exitDisposable = entry.pty.onExit(() => {
          exitDisposable.dispose();
          wrappedResolve();
        });

        // Dispose other event listeners to prevent "Object has been destroyed" errors
        for (const disposable of entry.disposables) {
          disposable.dispose();
        }

        // On Windows, kill the entire process tree first to release file locks
        // This ensures child processes (like Claude Code) are terminated
        killProcessTree(pid).then(() => {
          entry.pty.kill();
          this.terminals.delete(worktreeSessionId);
          this.clearBuffer(worktreeSessionId);
        });
      });
    } else {
      // Dispose event listeners first to prevent "Object has been destroyed" errors
      for (const disposable of entry.disposables) {
        disposable.dispose();
      }
      // On Windows, kill the entire process tree first to release file locks
      await killProcessTree(pid);
      entry.pty.kill();
      this.terminals.delete(worktreeSessionId);
      this.clearBuffer(worktreeSessionId);
    }
  }

  /**
   * Wait for a terminal to be ready to receive input.
   * Returns immediately if terminal is already ready.
   * @param terminalId The terminal session ID
   * @param timeoutMs Maximum time to wait (default 10000ms)
   */
  async waitForReady(terminalId: string, timeoutMs = 10000): Promise<void> {
    const entry = this.terminals.get(terminalId);
    if (!entry) {
      // Terminal doesn't exist yet, wait for it to appear
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const newEntry = this.terminals.get(terminalId);
        if (newEntry) {
          await newEntry.readyPromise;
          return;
        }
      }
      return;
    }

    // Terminal exists, wait for ready promise
    await entry.readyPromise;
  }

  getActiveCount(): number {
    return this.terminals.size;
  }

  getActiveWorktreeSessionIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Kill all terminals associated with a specific worktree session.
   * This includes both Claude terminals ({worktreeSessionId}:{tabId}) and
   * user terminals (user:{worktreeSessionId}:{tabId}).
   *
   * @param worktreeSessionId The worktree session ID
   * @returns Promise that resolves when all terminals are killed
   */
  async killAllForWorktree(worktreeSessionId: string): Promise<void> {
    // Find all terminal IDs that belong to this worktree session
    const terminalsToKill: string[] = [];
    for (const terminalId of this.terminals.keys()) {
      const extractedId = extractWorktreeSessionId(terminalId);
      if (extractedId === worktreeSessionId) {
        terminalsToKill.push(terminalId);
      }
    }

    if (terminalsToKill.length === 0) return;

    // Kill all terminals for this worktree in parallel
    await Promise.all(terminalsToKill.map((terminalId) => this.kill(terminalId, true)));
  }

  async killAll(): Promise<void> {
    // Kill all process trees in parallel on Windows
    const killPromises: Promise<void>[] = [];
    for (const [, entry] of this.terminals) {
      // Dispose event listeners first to prevent "Object has been destroyed" errors
      for (const disposable of entry.disposables) {
        disposable.dispose();
      }
      killPromises.push(killProcessTree(entry.pty.pid));
    }
    await Promise.all(killPromises);

    // Now call pty.kill() on each
    for (const entry of this.terminals.values()) {
      entry.pty.kill();
    }
    this.terminals.clear();
    this.outputBuffers.clear();
  }

  /**
   * Returns the display name of the currently configured shell.
   */
  async getResolvedShellName(): Promise<string> {
    const appState = await loadAppState();
    const { shellInfo } = await this.resolveShell(appState.settings);

    if (shellInfo) {
      return shellInfo.name;
    }

    // Return system default name
    if (process.platform === 'win32') {
      return 'PowerShell';
    }
    // Try to get a nice name from the shell path
    const shell = this.getSystemDefaultShell();
    const shellName = shell.split('/').pop() || 'Terminal';
    // Capitalize first letter
    return shellName.charAt(0).toUpperCase() + shellName.slice(1);
  }
}

export default TerminalManager;
