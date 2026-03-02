import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ShellInfo } from '../../shared/types';

const execAsync = promisify(exec);

export interface ShellValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Icon identifiers for known shells.
 * These map to SVG assets in the renderer.
 */
const SHELL_ICONS: Record<string, string> = {
  powershell: 'powershell',
  pwsh: 'powershell',
  cmd: 'cmd',
  bash: 'bash',
  zsh: 'zsh',
  fish: 'fish',
  sh: 'bash',
  dash: 'bash',
  ksh: 'bash',
  tcsh: 'bash',
  csh: 'bash',
};

/**
 * Checks if a file exists at the given path.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect PowerShell on Windows.
 */
async function detectPowerShell(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];

  // Windows PowerShell 5.x
  const winPowerShellPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  if (await fileExists(winPowerShellPath)) {
    shells.push({
      id: 'powershell',
      name: 'Windows PowerShell',
      path: winPowerShellPath,
      icon: 'powershell',
    });
  }

  // PowerShell Core (pwsh)
  try {
    const { stdout } = await execAsync('where pwsh', { timeout: 5000 });
    const pwshPath = stdout.trim().split('\n')[0]?.trim();
    if (pwshPath && (await fileExists(pwshPath))) {
      shells.push({
        id: 'pwsh',
        name: 'PowerShell',
        path: pwshPath,
        icon: 'powershell',
      });
    }
  } catch {
    // pwsh not found
  }

  return shells;
}

/**
 * Detect Command Prompt on Windows.
 */
async function detectCmd(): Promise<ShellInfo | null> {
  const cmdPath =
    process.env.COMSPEC ||
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');

  if (await fileExists(cmdPath)) {
    return {
      id: 'cmd',
      name: 'Command Prompt',
      path: cmdPath,
      icon: 'cmd',
    };
  }
  return null;
}

/**
 * Detect Git Bash on Windows.
 */
async function detectGitBash(): Promise<ShellInfo | null> {
  const possiblePaths = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'Git',
      'bin',
      'bash.exe'
    ),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ];

  for (const bashPath of possiblePaths) {
    if (await fileExists(bashPath)) {
      return {
        id: 'git-bash',
        name: 'Git Bash',
        path: bashPath,
        icon: 'git-bash',
      };
    }
  }
  return null;
}

/**
 * Map WSL distro name to icon identifier.
 */
function getWslDistroIcon(distroName: string): string {
  const lowerName = distroName.toLowerCase();
  if (lowerName.includes('ubuntu')) return 'ubuntu';
  if (lowerName.includes('debian')) return 'debian';
  if (lowerName.includes('arch')) return 'arch';
  if (lowerName.includes('fedora')) return 'fedora';
  if (lowerName.includes('opensuse') || lowerName.includes('suse')) return 'suse';
  if (lowerName.includes('kali')) return 'kali';
  if (lowerName.includes('alpine')) return 'alpine';
  return 'generic';
}

/**
 * Detect WSL distributions on Windows.
 */
async function detectWslDistros(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];

  try {
    // Run wsl --list --quiet to get installed distros
    // Use encoding: 'utf16le' because wsl.exe outputs UTF-16LE
    const { stdout } = await execAsync('wsl --list --quiet', {
      timeout: 10000,
      encoding: 'buffer',
    });

    // Decode UTF-16LE output
    const output = stdout.toString('utf16le');
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const distroName of lines) {
      // Skip Docker or special distros
      if (distroName.toLowerCase().includes('docker')) continue;

      const wslPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe');
      if (await fileExists(wslPath)) {
        shells.push({
          id: `wsl-${distroName.toLowerCase().replace(/\s+/g, '-')}`,
          name: `${distroName} (WSL)`,
          path: wslPath,
          args: ['-d', distroName],
          icon: getWslDistroIcon(distroName),
        });
      }
    }
  } catch {
    // WSL not installed or no distros
  }

  return shells;
}

/**
 * Detect shells on Windows.
 */
async function detectWindowsShells(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];

  // Detect in parallel for performance
  const [powerShells, cmd, gitBash, wslDistros] = await Promise.all([
    detectPowerShell(),
    detectCmd(),
    detectGitBash(),
    detectWslDistros(),
  ]);

  shells.push(...powerShells);
  if (cmd) shells.push(cmd);
  if (gitBash) shells.push(gitBash);
  shells.push(...wslDistros);

  return shells;
}

/**
 * Get display name for a shell from its path.
 */
function getShellDisplayName(shellPath: string): string {
  const basename = path.basename(shellPath);
  const nameMap: Record<string, string> = {
    bash: 'Bash',
    zsh: 'Zsh',
    fish: 'Fish',
    sh: 'sh',
    dash: 'Dash',
    ksh: 'Korn Shell',
    tcsh: 'tcsh',
    csh: 'C Shell',
  };
  return nameMap[basename] || basename;
}

/**
 * Get icon for a shell from its path.
 */
function getShellIcon(shellPath: string): string {
  const basename = path.basename(shellPath);
  return SHELL_ICONS[basename] || 'generic';
}

/**
 * Parse /etc/shells and detect available shells on Unix.
 */
async function detectUnixShells(): Promise<ShellInfo[]> {
  const shells: ShellInfo[] = [];
  const seenPaths = new Set<string>();

  // Common shells to prioritize
  const commonShells = ['zsh', 'bash', 'fish', 'sh'];

  try {
    const etcShellsContent = await fs.readFile('/etc/shells', 'utf-8');
    const lines = etcShellsContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    for (const shellPath of lines) {
      if (seenPaths.has(shellPath)) continue;

      // Check if shell exists and is executable
      if (await fileExists(shellPath)) {
        seenPaths.add(shellPath);

        const basename = path.basename(shellPath);
        const id = basename;

        shells.push({
          id,
          name: getShellDisplayName(shellPath),
          path: shellPath,
          icon: getShellIcon(shellPath),
        });
      }
    }

    // Sort to prioritize common shells
    shells.sort((a, b) => {
      const aIndex = commonShells.indexOf(a.id);
      const bIndex = commonShells.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  } catch {
    // /etc/shells doesn't exist or can't be read
    // Fall back to checking common shell paths
    const fallbackShells = ['/bin/zsh', '/bin/bash', '/usr/bin/zsh', '/usr/bin/bash', '/bin/sh'];

    for (const shellPath of fallbackShells) {
      if (seenPaths.has(shellPath)) continue;

      if (await fileExists(shellPath)) {
        seenPaths.add(shellPath);

        const basename = path.basename(shellPath);
        shells.push({
          id: basename,
          name: getShellDisplayName(shellPath),
          path: shellPath,
          icon: getShellIcon(shellPath),
        });
      }
    }
  }

  return shells;
}

/**
 * Detect available shells based on the current platform.
 * Returns an array of ShellInfo objects representing shells that can be used.
 */
export async function detectAvailableShells(): Promise<ShellInfo[]> {
  if (process.platform === 'win32') {
    return detectWindowsShells();
  }
  return detectUnixShells();
}

/**
 * Validates a shell path to ensure it's a valid executable.
 * Checks that the file exists, is not a directory, and is executable.
 * @param shellPath The path to the shell executable to validate
 * @returns Object with valid: true if valid, or valid: false with error message
 */
export async function validateShellPath(shellPath: string): Promise<ShellValidationResult> {
  // Check if the path is empty or whitespace
  if (!shellPath || shellPath.trim().length === 0) {
    return { valid: false, error: 'Shell path cannot be empty' };
  }

  try {
    // Get file stats to check if path exists and what type it is
    const stats = await fs.stat(shellPath);

    // Check if it's a directory
    if (stats.isDirectory()) {
      return { valid: false, error: 'Path points to a directory, not a file' };
    }

    // Check if it's executable (on Unix systems)
    // On Windows, we check if the file exists with the right extension
    if (process.platform !== 'win32') {
      try {
        await fs.access(shellPath, fs.constants.X_OK);
      } catch {
        return { valid: false, error: 'File exists but is not executable' };
      }
    } else {
      // On Windows, check for executable extensions
      const ext = path.extname(shellPath).toLowerCase();
      const executableExtensions = ['.exe', '.cmd', '.bat', '.com'];
      if (!executableExtensions.includes(ext)) {
        return { valid: false, error: 'File does not have an executable extension (.exe, .cmd, .bat, .com)' };
      }
    }

    return { valid: true };
  } catch (error) {
    // File doesn't exist
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { valid: false, error: 'Shell not found at specified path' };
    }
    // Other errors
    return { valid: false, error: 'Unable to validate shell path' };
  }
}
