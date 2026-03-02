import { exec, execFile, ExecOptions, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import type { IpcMain } from 'electron';
import type {
  GitStatus,
  WorktreeResult,
  RemoveWorktreeResult,
  WorktreeInfo,
  BranchInfo,
  CloneResult,
  GetFileLinesResult,
  GetFileLineCountResult,
  FileStatusResult,
  FileStatus,
  FileChangeType,
  GitOperationResult,
  CommitResult,
  AheadBehindResult,
  CommitWithOutputResult,
  ShellInfo,
  GitHookType,
  HookManifest,
  OperationProgressStatus,
  OperationWithHooksResult,
} from '../shared/types';
import { loadAppState } from './storage';
import { detectAvailableShells, validateShellPath } from './services/shellDetector';
import type {
  DiffFile,
  DiffFileStat,
  DiffFileStatus,
  GitDiffResult,
  WorkingTreeDiffResult,
  WorkingTreeStatsResult,
} from '../shared/reviewTypes';
import { parseDiff } from './utils/diffParser';
import simpleGit, { SimpleGit } from 'simple-git';

const execAsyncRaw = promisify(exec);
const execFileAsync = promisify(execFile);

// Cache for simple-git instances to avoid creating new ones on every operation
const simpleGitCache = new Map<string, SimpleGit>();

// Track active operations per repo for cancellation support
const activeOperations = new Map<string, { process: ChildProcess; aborted: boolean }>();

/**
 * Abort any active operation for a repository.
 * @param repoPath - Path to the git repository
 * @returns true if an operation was aborted, false if no active operation
 */
export function abortOperation(repoPath: string): boolean {
  const operation = activeOperations.get(repoPath);
  if (operation && !operation.aborted) {
    operation.aborted = true;
    try {
      // Kill the process and all children
      if (process.platform === 'win32') {
        // On Windows, use taskkill to kill the process tree
        spawn('taskkill', ['/pid', String(operation.process.pid), '/f', '/t']);
      } else {
        // On Unix, kill the process group
        process.kill(-operation.process.pid!, 'SIGTERM');
      }
    } catch (err) {
      // Process may have already exited, try direct kill as fallback
      try {
        operation.process.kill('SIGKILL');
      } catch {
        // Process already terminated
      }
    }
    activeOperations.delete(repoPath);
    return true;
  }
  return false;
}

/**
 * Check if an operation was aborted for a repository.
 */
function isOperationAborted(repoPath: string): boolean {
  const operation = activeOperations.get(repoPath);
  return operation?.aborted === true;
}

/**
 * Register an active operation process for a repository.
 */
function registerOperation(repoPath: string, proc: ChildProcess): void {
  // Abort any existing operation first
  abortOperation(repoPath);
  activeOperations.set(repoPath, { process: proc, aborted: false });
}

/**
 * Unregister an operation when it completes.
 */
function unregisterOperation(repoPath: string): void {
  activeOperations.delete(repoPath);
}

/**
 * Check if a directory exists synchronously.
 * Used for fast pre-validation before git operations to avoid
 * unnecessary work when the directory has been deleted externally.
 */
function directoryExistsSync(dirPath: string): boolean {
  try {
    const stats = fsSync.statSync(dirPath);
    return stats.isDirectory();
  } catch (error) {
    // Check for ENOENT specifically - other errors should be logged
    if (error instanceof Error && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return false;
      }
      // Log unexpected filesystem errors (permissions, I/O errors, etc.)
      console.error(
        `[Git] Unexpected error checking directory existence for ${dirPath}:`,
        fsError.code,
        fsError.message
      );
    }
    return false;
  }
}

/**
 * Custom error for when a repository directory no longer exists.
 */
export class RepositoryNotFoundError extends Error {
  constructor(repoPath: string) {
    super(`Repository directory does not exist: ${repoPath}`);
    this.name = 'RepositoryNotFoundError';
  }
}

/**
 * Get or create a cached simple-git instance for a repository path.
 * This reduces memory usage by reusing instances instead of creating new ones.
 * Throws RepositoryNotFoundError if the directory doesn't exist.
 */
function getSimpleGit(repoPath: string): SimpleGit {
  // Check if directory exists before creating/reusing instance
  if (!directoryExistsSync(repoPath)) {
    // Clear from cache if it existed
    simpleGitCache.delete(repoPath);
    throw new RepositoryNotFoundError(repoPath);
  }

  let git = simpleGitCache.get(repoPath);
  if (!git) {
    git = simpleGit(repoPath);
    simpleGitCache.set(repoPath, git);
  }
  return git;
}

/**
 * Clear the cached simple-git instance for a repository path.
 * Call this when a repository is removed to prevent memory leaks.
 */
export function clearSimpleGitCache(repoPath: string): void {
  simpleGitCache.delete(repoPath);
}

/**
 * Check if a path is a WSL UNC path (Windows accessing WSL filesystem).
 * Matches: \\wsl$\distro\... or \\wsl.localhost\distro\... or //wsl$/...
 */
function isWslPath(filePath: string): boolean {
  if (process.platform !== 'win32') return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('//wsl$/') || normalized.startsWith('//wsl.localhost/');
}

/**
 * Normalize a WSL path to use forward slashes.
 */
function normalizeWslPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Join paths, handling WSL UNC paths correctly.
 * Windows path.join converts forward slashes to backslashes, which breaks UNC paths.
 */
function joinPath(basePath: string, ...segments: string[]): string {
  if (isWslPath(basePath)) {
    // For WSL paths, normalize to forward slashes for processing
    const normalized = normalizeWslPath(basePath);
    const normalizedSegments = segments.map((s) => s.replace(/\\/g, '/'));
    const joined = [normalized, ...normalizedSegments].join('/');
    // Collapse multiple slashes but preserve the leading // for UNC paths
    const prefixMatch = joined.match(/^(\/\/wsl(?:\$|\.localhost))/i);
    let result: string;
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const rest = joined.substring(prefix.length).replace(/\/+/g, '/');
      result = prefix + rest;
    } else {
      result = joined.replace(/\/+/g, '/');
    }
    // Convert back to Windows UNC format with backslashes
    return result.replace(/\//g, '\\');
  }
  return path.join(basePath, ...segments);
}

/**
 * Get the directory name of a path, handling WSL UNC paths correctly.
 */
function dirnamePath(filePath: string): string {
  if (isWslPath(filePath)) {
    const normalized = normalizeWslPath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return normalized.replace(/\//g, '\\');
    // Convert back to Windows UNC format with backslashes
    return normalized.substring(0, lastSlash).replace(/\//g, '\\');
  }
  return path.dirname(filePath);
}

/**
 * Get the base name of a path, handling WSL UNC paths correctly.
 */
function basenamePath(filePath: string): string {
  if (isWslPath(filePath)) {
    const normalized = normalizeWslPath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  }
  return path.basename(filePath);
}

/**
 * Resolve a path relative to a base, handling WSL UNC paths.
 * Handles both relative paths (../../foo) and absolute WSL-internal paths (/home/user/...).
 */
function resolvePath(basePath: string, ...segments: string[]): string {
  if (isWslPath(basePath)) {
    const normalized = normalizeWslPath(basePath);
    const prefixMatch = normalized.match(/^(\/\/wsl(?:\$|\.localhost)\/[^/]+)/i);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    // Start with the path parts after the WSL prefix
    const baseParts = normalized
      .substring(prefix.length)
      .split('/')
      .filter((p) => p && p !== '.');

    let currentParts = [...baseParts];

    for (const segment of segments) {
      const normalizedSeg = segment.replace(/\\/g, '/');

      // Check if this segment is an absolute WSL-internal path (starts with /)
      // This happens when git writes absolute paths in .git files
      if (normalizedSeg.startsWith('/')) {
        // Reset to the absolute path (within the WSL prefix)
        currentParts = normalizedSeg.split('/').filter((p) => p && p !== '.');
        continue;
      }

      // Handle relative path segments
      const segParts = normalizedSeg.split('/').filter((p) => p && p !== '.');
      for (const part of segParts) {
        if (part === '..') {
          currentParts.pop();
        } else {
          currentParts.push(part);
        }
      }
    }

    // Convert back to Windows UNC format with backslashes
    const result = prefix + '/' + currentParts.join('/');
    return result.replace(/\//g, '\\');
  }
  return path.resolve(basePath, ...segments);
}

/**
 * Get the WSL distribution name from a WSL path.
 * E.g., \\wsl$\Ubuntu\home\user -> Ubuntu
 */
function getWslDistro(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/^\/\/wsl(?:\$|\.localhost)\/([^/]+)/i);
  return match ? match[1] : null;
}

/**
 * Extract the WSL distro name from a WSL UNC path and normalize to lowercase.
 * Handles both \\wsl$\distro\... and \\wsl.localhost\distro\... formats.
 * @param filePath - The path to check (e.g., '\\wsl$\archlinux\home\user')
 * @returns The distro name in lowercase (e.g., 'archlinux') or null if not a WSL path
 */
export function extractDistroFromWslPath(filePath: string): string | null {
  const distro = getWslDistro(filePath);
  return distro ? distro.toLowerCase() : null;
}

/**
 * Convert a Windows WSL path to a WSL-internal path.
 * E.g., \\wsl$\Ubuntu\home\user -> /home/user
 */
function toWslInternalPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  // Remove the //wsl$/distro or //wsl.localhost/distro prefix
  const match = normalized.match(/^\/\/wsl(?:\$|\.localhost)\/[^/]+(.*)$/i);
  return match ? match[1] || '/' : filePath;
}

/**
 * Normalize a WSL path to a canonical format for comparison.
 * Converts both \\wsl$\distro\path and \\wsl.localhost\distro\path to lowercase
 * //wsl.localhost/distro/path format.
 */
function normalizeWslPathForComparison(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  // Convert wsl$ to wsl.localhost for consistency
  return normalized.replace(/^\/\/wsl\$\//i, '//wsl.localhost/');
}

/**
 * Execute a command, handling WSL paths on Windows.
 * When the cwd is a WSL path, the command is executed through WSL.
 */
async function execAsync(
  command: string,
  options?: ExecOptions & { cwd?: string; maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  const cwd = options?.cwd;

  // If on Windows with a WSL path, execute through WSL
  if (cwd && isWslPath(cwd)) {
    const distro = getWslDistro(cwd);
    const wslPath = toWslInternalPath(cwd);

    if (!distro) {
      throw new Error(`Invalid WSL path: ${cwd}`);
    }

    // Build WSL command using bash -c with proper escaping for Windows
    // Windows cmd.exe doesn't recognize single quotes, so we use double quotes
    // and escape inner double quotes with backslash (for bash)
    const escapedPath = wslPath.replace(/"/g, '\\"');
    const escapedCommand = command.replace(/"/g, '\\"');
    // Use bash instead of sh for better compatibility, and double quotes for Windows
    const wslCommand = `wsl -d ${distro} -e bash -c "cd '${escapedPath}' && ${escapedCommand}"`;

    const result = await execAsyncRaw(wslCommand, {
      ...options,
      cwd: undefined, // Don't use cwd for the wsl command itself
      encoding: 'utf8',
    });
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  }

  const result = await execAsyncRaw(command, { ...options, encoding: 'utf8' });
  return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

export async function isGitRepo(folderPath: string): Promise<boolean> {
  try {
    const gitPath = joinPath(folderPath, '.git');
    const stats = await fs.stat(gitPath);
    // .git can be a file for worktrees/submodules
    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

export async function getGitStatus(repoPath: string): Promise<GitStatus | null> {
  try {
    // Check if directory exists before attempting git operations
    if (!directoryExistsSync(repoPath)) {
      console.log(`[Git] Repository directory does not exist: ${repoPath}`);
      return null;
    }

    // Get current branch and status in parallel
    const [branchResult, statusResult] = await Promise.allSettled([
      execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }),
      execAsync('git status --porcelain -u', { cwd: repoPath }),
    ]);

    // Handle potential failures in parallel operations
    if (branchResult.status === 'rejected') {
      console.error(`[Git] Failed to get branch for ${repoPath}:`, branchResult.reason);
      return null;
    }
    if (statusResult.status === 'rejected') {
      console.error(`[Git] Failed to get status for ${repoPath}:`, statusResult.reason);
      return null;
    }

    const branch = branchResult.value.stdout.trim();
    const statusOutput = statusResult.value.stdout;
    const isDirty = statusOutput.trim().length > 0;

    // Get additions and deletions from working tree diff
    let additions = 0;
    let deletions = 0;

    if (isDirty) {
      // Parse status to find untracked files
      const untrackedFiles: string[] = [];
      const statusLines = statusOutput.trim().split('\n').filter(Boolean);
      for (const line of statusLines) {
        if (line.startsWith('??')) {
          // Untracked file: "?? path/to/file"
          const filePath = line.substring(3);
          // Skip if it looks like a directory (ends with /)
          if (!filePath.endsWith('/')) {
            untrackedFiles.push(filePath);
          }
        }
      }

      try {
        // Get numstat for tracked changes (staged + unstaged)
        const { stdout: diffOutput } = await execAsync('git diff --numstat HEAD', {
          cwd: repoPath,
        });

        // Parse numstat output: "added\tdeleted\tfilename"
        const lines = diffOutput.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const [added, deleted] = line.split('\t');
          // Binary files show '-' for additions/deletions
          if (added !== '-' && deleted !== '-') {
            additions += parseInt(added, 10) || 0;
            deletions += parseInt(deleted, 10) || 0;
          }
        }
      } catch (error) {
        // If diff fails (e.g., no commits yet), just leave as 0
        console.debug(`[Git] Failed to get diff numstat for ${repoPath}:`, error);
      }

      // Get line counts for untracked files using git diff --no-index
      // Limit to first 50 files to avoid performance issues with many untracked files
      const filesToCount = untrackedFiles.slice(0, 50);
      if (filesToCount.length > 0) {
        // Use /dev/null for Linux/WSL, NUL for native Windows
        const nullDevice =
          process.platform === 'win32' && !isWslPath(repoPath) ? 'NUL' : '/dev/null';
        const lineCountPromises = filesToCount.map(async (filePath) => {
          try {
            // Use execFileAsync to avoid shell injection with file paths
            const { stdout } = await execFileAsync(
              'git',
              ['diff', '--no-index', '--numstat', '--', nullDevice, filePath],
              { cwd: repoPath }
            ).catch((err) => {
              // git diff --no-index exits with code 1 when files differ (expected)
              if (err.stdout) return { stdout: err.stdout };
              throw err;
            });

            const match = stdout.trim().match(/^(\d+|-)\s+/);
            if (match && match[1] !== '-') {
              return parseInt(match[1], 10) || 0;
            }
            return 0;
          } catch (error) {
            console.debug(`[Git] Failed to count lines for ${filePath}:`, error);
            return 0;
          }
        });

        const lineCounts = await Promise.all(lineCountPromises);
        for (const count of lineCounts) {
          additions += count;
        }
      }
    }

    return { branch, isDirty, additions, deletions };
  } catch (error) {
    console.error(`[Git] Failed to get git status for ${repoPath}:`, error);
    return null;
  }
}

export function sanitizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to dashes
    .replace(/[^a-z0-9\-_]/g, '') // remove invalid chars
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .replace(/-{2,}/g, '-') // collapse multiple dashes
    .slice(0, 50); // limit length
}

export function previewSanitizedName(name: string): string {
  return sanitizeBranchName(name);
}

export async function createWorktree(
  repoPath: string,
  taskName: string,
  basePath: string | null,
  sourceBranch?: string
): Promise<WorktreeResult> {
  try {
    // Sanitize task name for branch/folder name
    const sanitized = sanitizeBranchName(taskName);

    if (!sanitized) {
      return { success: false, error: 'Invalid task name after sanitization' };
    }

    // Determine worktree path
    const repoName = basenamePath(repoPath);
    const worktreePath = basePath
      ? joinPath(basePath, `${repoName}-${sanitized}`)
      : joinPath(dirnamePath(repoPath), `${repoName}-${sanitized}`);

    // For WSL paths, we need to use the WSL-internal path format in the git command
    const worktreePathForGit = isWslPath(worktreePath)
      ? toWslInternalPath(worktreePath)
      : worktreePath;

    // Create worktree with new branch, optionally from a source branch
    const command = sourceBranch
      ? `git worktree add "${worktreePathForGit}" -b "${sanitized}" "${sourceBranch}"`
      : `git worktree add "${worktreePathForGit}" -b "${sanitized}"`;

    await execAsync(command, {
      cwd: repoPath,
    });

    return { success: true, path: worktreePath };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create worktree';
    return { success: false, error: message };
  }
}

export async function removeWorktree(
  worktreePath: string,
  prune: boolean,
  branchName?: string
): Promise<RemoveWorktreeResult> {
  try {
    // Find the main repo from the worktree
    const { stdout } = await execAsync('git rev-parse --git-common-dir', {
      cwd: worktreePath,
    });
    const mainGitDir = stdout.trim();
    // For WSL, the git command returns a WSL-internal path, but worktreePath is UNC
    // We need to construct the main repo path based on the worktree path format
    const mainRepoPath = isWslPath(worktreePath)
      ? resolvePath(worktreePath, mainGitDir, '..')
      : path.dirname(mainGitDir);

    // Remove the worktree
    // For WSL paths, convert to WSL-internal format for git
    const worktreePathForGit = isWslPath(worktreePath)
      ? toWslInternalPath(worktreePath)
      : worktreePath;
    await execAsync(`git worktree remove "${worktreePathForGit}"`, {
      cwd: mainRepoPath,
    });

    // Optionally prune
    if (prune) {
      await execAsync('git worktree prune', { cwd: mainRepoPath });
    }

    // Delete the associated branch if provided
    if (branchName) {
      await deleteBranch(mainRepoPath, branchName);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove worktree';
    return { success: false, error: message };
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get specific lines from a file.
 * @param filePath - Absolute path to the file
 * @param startLine - 1-based start line number (inclusive)
 * @param endLine - 1-based end line number (inclusive)
 * @returns Object with lines array and optional error message
 */
export async function getFileLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<GetFileLinesResult> {
  try {
    // Validate line range
    if (startLine < 1 || endLine < 1) {
      return { lines: [], error: 'Line numbers must be >= 1' };
    }
    if (startLine > endLine) {
      return { lines: [], error: 'Start line must be <= end line' };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const allLines = content.split('\n');

    // Convert to 0-based index for slicing
    const startIndex = startLine - 1;
    const endIndex = endLine; // slice end is exclusive, so no -1

    // Handle case where requested range exceeds file length
    if (startIndex >= allLines.length) {
      return { lines: [] };
    }

    const lines = allLines.slice(startIndex, Math.min(endIndex, allLines.length));
    return { lines };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error reading file';
    // Provide specific error messages for common cases
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { lines: [], error: 'File not found' };
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      return { lines: [], error: 'Permission denied' };
    }
    return { lines: [], error };
  }
}

/**
 * Get the total line count of a file.
 * @param filePath - Absolute path to the file
 * @returns Object with lineCount and optional error message
 */
export async function getFileLineCount(filePath: string): Promise<GetFileLineCountResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    return { lineCount };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error reading file';
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { lineCount: 0, error: 'File not found' };
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      return { lineCount: 0, error: 'Permission denied' };
    }
    return { lineCount: 0, error };
  }
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    });

    const worktrees: WorktreeInfo[] = [];
    const entries = stdout.trim().split('\n\n');

    // For WSL paths, we need to convert the WSL-internal paths back to Windows UNC format
    const isWsl = isWslPath(repoPath);
    const wslDistro = isWsl ? getWslDistro(repoPath) : null;

    for (const entry of entries) {
      if (!entry.trim()) continue;

      const lines = entry.split('\n');
      const worktree: Partial<WorktreeInfo> = {
        isMain: false,
        isBare: false,
        isLocked: false,
        prunable: false,
        head: '',
        branch: '',
      };

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          let worktreePath = line.substring(9);
          // Convert WSL-internal path to Windows UNC format (use wsl.localhost for consistency)
          if (isWsl && wslDistro && worktreePath.startsWith('/')) {
            worktreePath = `\\\\wsl.localhost\\${wslDistro}${worktreePath.replace(/\//g, '\\')}`;
          }
          worktree.path = worktreePath;
        } else if (line.startsWith('HEAD ')) {
          worktree.head = line.substring(5);
        } else if (line.startsWith('branch ')) {
          // refs/heads/branch-name -> branch-name
          worktree.branch = line.substring(7).replace('refs/heads/', '');
        } else if (line === 'bare') {
          worktree.isBare = true;
          worktree.isMain = true;
        } else if (line === 'detached') {
          worktree.branch = `detached@${worktree.head?.substring(0, 7)}`;
        } else if (line === 'locked') {
          worktree.isLocked = true;
        } else if (line.startsWith('locked ')) {
          worktree.isLocked = true;
        } else if (line === 'prunable') {
          worktree.prunable = true;
        }
      }

      // First worktree is always the main one (unless bare)
      if (worktrees.length === 0 && !worktree.isBare) {
        worktree.isMain = true;
      }

      if (worktree.path && (worktree.branch || worktree.isBare)) {
        worktrees.push(worktree as WorktreeInfo);
      }
    }

    return worktrees;
  } catch (error) {
    console.error('[Git] Failed to list worktrees:', error);
    return [];
  }
}

export async function getWorktreeInfo(worktreePath: string): Promise<WorktreeInfo | null> {
  try {
    // Find the main repo by reading .git file
    const gitPath = joinPath(worktreePath, '.git');
    const stat = await fs.stat(gitPath);

    let repoPath: string;
    if (stat.isFile()) {
      // This is a worktree - .git is a file pointing to main repo
      const content = await fs.readFile(gitPath, 'utf-8');
      const match = content.match(/gitdir: (.+)/);
      if (match) {
        // gitdir points to .git/worktrees/name, go up to get repo
        repoPath = resolvePath(worktreePath, match[1], '..', '..', '..');
      } else {
        return null;
      }
    } else {
      // This is the main repo
      repoPath = worktreePath;
    }

    const worktrees = await listWorktrees(repoPath);
    // Use normalized paths for comparison to handle different formats
    const normalizedTarget = normalizeWslPathForComparison(worktreePath);
    return (
      worktrees.find((w) => normalizeWslPathForComparison(w.path) === normalizedTarget) || null
    );
  } catch {
    return null;
  }
}

export interface WorktreeDetectionResult {
  isWorktree: boolean;
  mainRepoPath: string | null;
}

export async function detectWorktree(folderPath: string): Promise<WorktreeDetectionResult> {
  try {
    const gitPath = joinPath(folderPath, '.git');
    const stat = await fs.stat(gitPath);

    if (stat.isFile()) {
      // This is a worktree - .git is a file pointing to main repo
      const content = await fs.readFile(gitPath, 'utf-8');
      const match = content.match(/gitdir: (.+)/);
      if (match) {
        // gitdir points to .git/worktrees/name, go up to get main repo
        const mainRepoPath = resolvePath(folderPath, match[1], '..', '..', '..');
        return { isWorktree: true, mainRepoPath };
      }
    }

    // Not a worktree (either main repo or not a git repo)
    return { isWorktree: false, mainRepoPath: null };
  } catch {
    return { isWorktree: false, mainRepoPath: null };
  }
}

export async function isWorktreeDirty(worktreePath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: worktreePath,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function isBareRepo(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git rev-parse --is-bare-repository', {
      cwd: repoPath,
    });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function forceRemoveWorktree(
  repoPath: string,
  worktreePath: string,
  branchName?: string
): Promise<void> {
  try {
    // For WSL paths, convert to WSL-internal format for git
    const worktreePathForGit = isWslPath(worktreePath)
      ? toWslInternalPath(worktreePath)
      : worktreePath;
    // Use double --force to remove even with untracked files
    await execAsync(`git worktree remove --force --force "${worktreePathForGit}"`, {
      cwd: repoPath,
    });
    // Also prune to clean up
    await execAsync('git worktree prune', { cwd: repoPath });

    // Delete the associated branch if provided
    if (branchName) {
      await deleteBranch(repoPath, branchName);
    }
  } catch (error) {
    console.error('[Git] Failed to force remove worktree:', error);
    throw error;
  }
}

export async function deleteBranch(
  repoPath: string,
  branchName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use -D to force delete (handles unmerged branches)
    await execAsync(`git branch -D "${branchName}"`, {
      cwd: repoPath,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete branch';
    console.error(`[Git] Failed to delete branch ${branchName}:`, message);
    // Don't throw - branch deletion failure shouldn't block worktree removal
    return { success: false, error: message };
  }
}

export async function listBranches(repoPath: string): Promise<BranchInfo[]> {
  try {
    const { stdout } = await execAsync('git branch -a', {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    });

    const branches: BranchInfo[] = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const isCurrent = line.startsWith('*');
      // Strip both * (current branch) and + (checked out in other worktree) prefixes
      const rawName = line.replace(/^[*+]?\s+/, '').trim();

      // Skip HEAD pointer entries (e.g., "remotes/origin/HEAD -> origin/main")
      if (rawName.includes(' -> ')) continue;

      const isRemote = rawName.startsWith('remotes/');
      let name = rawName;
      let remoteName: string | undefined;

      if (isRemote) {
        // remotes/origin/branch-name -> origin/branch-name
        name = rawName.replace('remotes/', '');
        // Extract remote name (first part before /)
        const slashIndex = name.indexOf('/');
        if (slashIndex > 0) {
          remoteName = name.substring(0, slashIndex);
        }
      }

      const isDefault =
        /^(main|master)$/.test(name) || /^(origin\/main|origin\/master)$/.test(name);

      branches.push({
        name,
        isRemote,
        isCurrent,
        isDefault,
        remoteName,
      });
    }

    // Sort: default branches first, then local, then remote
    branches.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      if (a.isRemote && !b.isRemote) return 1;
      if (!a.isRemote && b.isRemote) return -1;
      return a.name.localeCompare(b.name);
    });

    return branches;
  } catch (error) {
    console.error('[Git] Failed to list branches:', error);
    return [];
  }
}

export async function fetchBranches(repoPath: string): Promise<void> {
  try {
    await execAsync('git fetch --all', {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    console.error('[Git] Failed to fetch branches:', error);
    throw error;
  }
}

export async function cloneRepository(url: string, destPath: string): Promise<CloneResult> {
  try {
    const git = simpleGit();
    await git.clone(url, destPath);
    return { success: true, path: destPath };
  } catch (error: unknown) {
    // Pass through git's error message for auth/network failures
    const message = error instanceof Error ? error.message : 'Failed to clone repository';
    return { success: false, error: message };
  }
}

/**
 * Get the full diff between two branches.
 */
export async function getDiff(
  repoPath: string,
  baseBranch: string,
  compareBranch: string
): Promise<GitDiffResult> {
  // For WSL paths, use execAsync instead of simpleGit
  if (isWslPath(repoPath)) {
    const { stdout: baseCommit } = await execAsync(`git rev-parse "${baseBranch}"`, {
      cwd: repoPath,
    });
    const { stdout: compareCommit } = await execAsync(`git rev-parse "${compareBranch}"`, {
      cwd: repoPath,
    });
    const { stdout: diffOutput } = await execAsync(`git diff "${baseBranch}...${compareBranch}"`, {
      cwd: repoPath,
    });

    const files = parseDiff(diffOutput);
    return {
      files,
      baseCommit: baseCommit.trim(),
      compareCommit: compareCommit.trim(),
    };
  }

  const git = getSimpleGit(repoPath);

  // Get commit hashes for the branches
  const baseCommit = await git.revparse([baseBranch]);
  const compareCommit = await git.revparse([compareBranch]);

  // Get the full diff
  const diffOutput = await git.diff([`${baseBranch}...${compareBranch}`]);

  // Parse the diff output into structured data
  const files = parseDiff(diffOutput);

  return {
    files,
    baseCommit: baseCommit.trim(),
    compareCommit: compareCommit.trim(),
  };
}

/**
 * Get the diff for a specific file between two branches.
 */
export async function getFileDiff(
  repoPath: string,
  baseBranch: string,
  compareBranch: string,
  filePath: string
): Promise<DiffFile | null> {
  // For WSL paths, use execAsync instead of simpleGit
  if (isWslPath(repoPath)) {
    const { stdout: diffOutput } = await execAsync(
      `git diff "${baseBranch}...${compareBranch}" -- "${filePath}"`,
      { cwd: repoPath }
    );

    if (!diffOutput.trim()) {
      return null;
    }

    const files = parseDiff(diffOutput);
    return files[0] || null;
  }

  const git = getSimpleGit(repoPath);

  // Get the diff for the specific file
  const diffOutput = await git.diff([`${baseBranch}...${compareBranch}`, '--', filePath]);

  if (!diffOutput.trim()) {
    return null;
  }

  // Parse the diff output
  const files = parseDiff(diffOutput);

  return files[0] || null;
}

/**
 * Get the current commit hash for a branch.
 */
export async function getCommitHash(repoPath: string, branch: string): Promise<string> {
  if (isWslPath(repoPath)) {
    const { stdout } = await execAsync(`git rev-parse "${branch}"`, { cwd: repoPath });
    return stdout.trim();
  }

  const git = getSimpleGit(repoPath);
  const commit = await git.revparse([branch]);
  return commit.trim();
}

/**
 * Get the default branch name (main or master).
 */
export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    if (isWslPath(repoPath)) {
      // Try to get the default branch from origin
      const { stdout } = await execAsync('git remote show origin', { cwd: repoPath });
      const match = stdout.match(/HEAD branch: (\S+)/);
      if (match) {
        return match[1];
      }
    } else {
      const git = getSimpleGit(repoPath);
      // Try to get the default branch from origin
      const remotes = await git.remote(['show', 'origin']);
      if (remotes) {
        const match = remotes.match(/HEAD branch: (\S+)/);
        if (match) {
          return match[1];
        }
      }
    }
  } catch {
    // If remote check fails, fall back to checking local branches
  }

  // Fall back to checking if main or master exists
  const branches = await listBranches(repoPath);
  const mainBranch = branches.find(
    (b) => !b.isRemote && (b.name === 'main' || b.name === 'master')
  );
  return mainBranch?.name || 'main';
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  // Check if directory exists before attempting git operations
  if (!directoryExistsSync(repoPath)) {
    console.log(`[Git] Repository directory does not exist: ${repoPath}`);
    return '';
  }

  if (isWslPath(repoPath)) {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
    return stdout.trim();
  }

  const git = getSimpleGit(repoPath);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
  return branch.trim();
}

/**
 * Get the diff of working tree vs HEAD (uncommitted changes).
 */
export async function getWorkingTreeDiff(repoPath: string): Promise<WorkingTreeDiffResult> {
  if (isWslPath(repoPath)) {
    const { stdout: headCommit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
    const { stdout: diffOutput } = await execAsync('git diff HEAD', { cwd: repoPath });

    const files = parseDiff(diffOutput);
    return {
      files,
      headCommit: headCommit.trim(),
      isDirty: files.length > 0,
    };
  }

  const git = getSimpleGit(repoPath);

  // Get HEAD commit hash
  const headCommit = await git.revparse(['HEAD']);

  // Get diff of working tree vs HEAD (includes both staged and unstaged changes)
  const diffOutput = await git.diff(['HEAD']);

  // Parse the diff output into structured data
  const files = parseDiff(diffOutput);

  return {
    files,
    headCommit: headCommit.trim(),
    isDirty: files.length > 0,
  };
}

/**
 * Get lightweight stats for working tree changes (without hunks).
 * Much faster than getWorkingTreeDiff for initial load and polling.
 * Includes untracked files as 'added' with their line counts.
 */
export async function getWorkingTreeStats(repoPath: string): Promise<WorkingTreeStatsResult> {
  let headCommit: string;
  let numstatOutput: string;
  let statusOutput: string;
  let porcelainOutput: string;

  if (isWslPath(repoPath)) {
    const [headResult, numstatResult, statusResult, porcelainResult] = await Promise.all([
      execAsync('git rev-parse HEAD', { cwd: repoPath }),
      execAsync('git diff --numstat HEAD', { cwd: repoPath }),
      execAsync('git diff --name-status HEAD', { cwd: repoPath }),
      execAsync('git status --porcelain -u', { cwd: repoPath }),
    ]);
    headCommit = headResult.stdout.trim();
    numstatOutput = numstatResult.stdout;
    statusOutput = statusResult.stdout;
    porcelainOutput = porcelainResult.stdout;
  } else {
    const git = getSimpleGit(repoPath);
    const [head, numstat, status, porcelainResult] = await Promise.all([
      git.revparse(['HEAD']),
      git.diff(['--numstat', 'HEAD']),
      git.diff(['--name-status', 'HEAD']),
      // Use execAsync for porcelain since simple-git returns a StatusResult object
      execAsync('git status --porcelain -u', { cwd: repoPath }),
    ]);
    headCommit = head.trim();
    numstatOutput = numstat;
    statusOutput = status;
    porcelainOutput = porcelainResult.stdout;
  }

  // Parse numstat: "10\t5\tpath/to/file"
  const numstatMap = new Map<string, { additions: number; deletions: number }>();
  for (const line of numstatOutput.trim().split('\n').filter(Boolean)) {
    const [additions, deletions, ...pathParts] = line.split('\t');
    const filePath = pathParts.join('\t');
    if (filePath) {
      numstatMap.set(filePath, {
        additions: additions === '-' ? 0 : parseInt(additions, 10) || 0,
        deletions: deletions === '-' ? 0 : parseInt(deletions, 10) || 0,
      });
    }
  }

  // Parse name-status: "M\tpath/to/file" or "R100\told\tnew"
  const files: DiffFileStat[] = [];
  const trackedPaths = new Set<string>();

  for (const line of statusOutput.trim().split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const statusCode = parts[0];
    let filePath: string;
    let oldPath: string | undefined;
    let status: DiffFileStatus;

    if (statusCode.startsWith('R')) {
      // Rename: R100\told-path\tnew-path
      oldPath = parts[1];
      filePath = parts[2];
      status = 'renamed';
    } else {
      filePath = parts[1];
      switch (statusCode) {
        case 'A':
          status = 'added';
          break;
        case 'D':
          status = 'deleted';
          break;
        case 'M':
          status = 'modified';
          break;
        default:
          status = 'modified';
      }
    }

    const stats = numstatMap.get(filePath) || { additions: 0, deletions: 0 };
    const isBinary = numstatOutput.includes(`-\t-\t${filePath}`);

    trackedPaths.add(filePath);
    files.push({
      path: filePath,
      oldPath,
      status,
      additions: stats.additions,
      deletions: stats.deletions,
      isBinary,
    });
  }

  // Parse porcelain output to find untracked files (status "??")
  const untrackedFiles: string[] = [];
  for (const line of porcelainOutput.trim().split('\n').filter(Boolean)) {
    if (line.startsWith('??')) {
      // Untracked file: "?? path/to/file"
      const filePath = unquoteGitPath(line.substring(3));
      if (!trackedPaths.has(filePath)) {
        untrackedFiles.push(filePath);
      }
    }
  }

  // Get line counts for untracked files using git diff --no-index
  // This is efficient: git counts lines without us loading files into memory
  // Limit to first 100 files to avoid performance issues with many untracked files
  const filesToCount = untrackedFiles.slice(0, 100);
  if (filesToCount.length > 0) {
    // Use /dev/null for Linux/WSL, NUL for native Windows
    const nullDevice = process.platform === 'win32' && !isWslPath(repoPath) ? 'NUL' : '/dev/null';
    const lineCountPromises = filesToCount.map(async (filePath) => {
      try {
        // Use execFileAsync to avoid shell injection with file paths
        const { stdout } = await execFileAsync(
          'git',
          ['diff', '--no-index', '--numstat', '--', nullDevice, filePath],
          { cwd: repoPath }
        ).catch((err) => {
          // git diff --no-index exits with code 1 when files differ (expected for new files)
          if (err.stdout) return { stdout: err.stdout };
          throw err;
        });

        // Parse numstat output: "42    0    path/to/file"
        const match = stdout.trim().match(/^(\d+|-)\s+(\d+|-)\s+/);
        if (match) {
          const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
          const isBinary = match[1] === '-'; // Binary files show "-" for line counts
          return { filePath, lineCount: additions, isBinary };
        }
        return { filePath, lineCount: 0, isBinary: false };
      } catch {
        return { filePath, lineCount: 0, isBinary: false };
      }
    });

    const lineCountResults = await Promise.all(lineCountPromises);
    for (const lineResult of lineCountResults) {
      files.push({
        path: lineResult.filePath,
        status: 'added',
        additions: lineResult.lineCount,
        deletions: 0,
        isBinary: lineResult.isBinary,
      });
    }
  }

  return {
    files,
    headCommit,
    isDirty: files.length > 0,
  };
}

/**
 * Get full diff (with hunks) for a single file from working tree.
 * Used for lazy loading individual file diffs.
 * Handles untracked files by generating a synthetic diff showing all content as additions.
 */
export async function getSingleWorkingTreeFileDiff(
  repoPath: string,
  filePath: string
): Promise<DiffFile | null> {
  let diffOutput: string;

  if (isWslPath(repoPath)) {
    const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, {
      cwd: repoPath,
    });
    diffOutput = stdout;
  } else {
    const git = getSimpleGit(repoPath);
    diffOutput = await git.diff(['HEAD', '--', filePath]);
  }

  if (diffOutput.trim()) {
    const files = parseDiff(diffOutput);
    return files.length > 0 ? files[0] : null;
  }

  // No diff output - could be an untracked file
  // Check if file is untracked and generate a synthetic diff
  const isUntracked = await isFileUntracked(repoPath, filePath);
  if (isUntracked) {
    return generateUntrackedFileDiff(repoPath, filePath);
  }

  return null;
}

/**
 * Check if a file is untracked (not in git index).
 */
async function isFileUntracked(repoPath: string, filePath: string): Promise<boolean> {
  try {
    // Use execFileAsync to avoid shell injection with file paths
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', filePath], {
      cwd: repoPath,
    });
    // Untracked files show as "?? path"
    return stdout.trim().startsWith('??');
  } catch {
    return false;
  }
}

/**
 * Generate a diff for an untracked file using git diff --no-index.
 * This lets git handle binary detection and efficient file reading.
 */
async function generateUntrackedFileDiff(
  repoPath: string,
  filePath: string
): Promise<DiffFile | null> {
  try {
    // Use /dev/null for Linux/WSL, NUL for native Windows
    const nullDevice = process.platform === 'win32' && !isWslPath(repoPath) ? 'NUL' : '/dev/null';

    // Use execFileAsync to avoid shell injection with file paths
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--no-index', '--', nullDevice, filePath],
      { cwd: repoPath }
    ).catch((err) => {
      // git diff --no-index exits with code 1 when files differ (expected for new files)
      if (err.stdout !== undefined) return { stdout: err.stdout };
      throw err;
    });

    const files = parseDiff(stdout);
    if (files.length === 0) {
      return null;
    }

    // Return the first (and only) file, with corrected path
    const diffFile = files[0];
    // Ensure we use the original filePath (git may normalize the path differently)
    diffFile.path = filePath;
    return diffFile;
  } catch {
    // File might be unreadable or other git error
    return {
      path: filePath,
      status: 'added',
      additions: 0,
      deletions: 0,
      isBinary: true,
      hunks: [],
    };
  }
}

/**
 * Unquote a git path that may be C-style quoted.
 * Git quotes paths containing spaces/special chars: "path with spaces" or "path\twith\ttabs"
 */
function unquoteGitPath(quotedPath: string): string {
  // If not quoted, return as-is
  if (!quotedPath.startsWith('"') || !quotedPath.endsWith('"')) {
    return quotedPath;
  }

  // Remove surrounding quotes
  const inner = quotedPath.slice(1, -1);

  // Unescape C-style escape sequences
  return inner.replace(/\\(.)/g, (_, char) => {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case '\\':
        return '\\';
      case '"':
        return '"';
      default:
        return char;
    }
  });
}

/**
 * Parse a git status --porcelain line and return file status info.
 * Porcelain format: XY PATH or XY ORIG_PATH -> PATH (for renames)
 * X = index status, Y = worktree status
 * Paths with spaces/special chars are C-style quoted by git.
 */
function parseStatusLine(line: string): {
  indexStatus: string;
  worktreeStatus: string;
  path: string;
  oldPath?: string;
} | null {
  if (line.length < 4) return null;

  const indexStatus = line[0];
  const worktreeStatus = line[1];
  // Skip the space at position 2
  let filePath = line.substring(3);
  let oldPath: string | undefined;

  // Handle renames: "R  old_path -> new_path" or "R  \"quoted old\" -> \"quoted new\""
  // For quoted paths, the arrow is outside quotes: "old" -> "new"
  const renameMatch = filePath.match(/^(.+) -> (.+)$/);
  if (renameMatch) {
    oldPath = unquoteGitPath(renameMatch[1]);
    filePath = renameMatch[2];
  }

  // Unquote the path (handles paths with spaces/special chars)
  filePath = unquoteGitPath(filePath);

  return { indexStatus, worktreeStatus, path: filePath, oldPath };
}

/**
 * Get the change type from a status character.
 */
function getChangeType(statusChar: string): FileChangeType {
  switch (statusChar) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Get diff stats for all files in a single git command (batched).
 * Returns a map of filePath -> { additions, deletions }
 * This avoids the N+1 problem of calling getDiffStats for each file individually.
 */
async function getBatchDiffStats(
  repoPath: string,
  staged: boolean
): Promise<Map<string, { additions: number; deletions: number }>> {
  const stats = new Map<string, { additions: number; deletions: number }>();

  try {
    const args = staged ? ['diff', '--cached', '--numstat'] : ['diff', '--numstat'];

    let stdout: string;
    if (isWslPath(repoPath)) {
      const command = staged ? 'git diff --cached --numstat' : 'git diff --numstat';
      const result = await execAsync(command, {
        cwd: repoPath,
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
    } else {
      const result = await execFileAsync('git', args, {
        cwd: repoPath,
        maxBuffer: 1024 * 1024,
      });
      stdout = result.stdout;
    }

    // Parse output: "10\t5\tpath/to/file.ts"
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const [additions, deletions, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t'); // Handle paths with tabs (rare but possible)

      if (filePath && additions !== '-' && deletions !== '-') {
        stats.set(filePath, {
          additions: parseInt(additions, 10) || 0,
          deletions: parseInt(deletions, 10) || 0,
        });
      } else if (filePath) {
        // Binary files show "-" for additions/deletions
        stats.set(filePath, { additions: 0, deletions: 0 });
      }
    }
  } catch {
    // Return empty map on error
  }

  return stats;
}

/**
 * Get detailed file statuses grouped by staged, unstaged, and untracked.
 * Parses 'git status --porcelain' output.
 * Uses batched diff stats to avoid N+1 git process spawning.
 */
export async function getFileStatuses(repoPath: string): Promise<FileStatusResult> {
  const result: FileStatusResult = {
    staged: [],
    unstaged: [],
    untracked: [],
  };

  // Check if directory exists before attempting git operations
  if (!directoryExistsSync(repoPath)) {
    console.log(`[Git] Repository directory does not exist: ${repoPath}`);
    return result;
  }

  try {
    // Use -u flag to show individual files in untracked directories instead of just directory names
    const { stdout } = await execAsync('git status --porcelain -u', {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    });

    if (!stdout.trim()) {
      return result;
    }

    const lines = stdout.split('\n').filter((line) => line.length > 0);

    // Collect untracked file paths for batch line counting
    const untrackedFilePaths: string[] = [];

    // Batch fetch all diff stats in 2 commands instead of N (one per file)
    const [stagedStats, unstagedStats] = await Promise.all([
      getBatchDiffStats(repoPath, true),
      getBatchDiffStats(repoPath, false),
    ]);

    for (const line of lines) {
      const parsed = parseStatusLine(line);
      if (!parsed) continue;

      const { indexStatus, worktreeStatus, path: filePath, oldPath } = parsed;

      // Untracked files (both columns show ?) - collect for batch processing
      if (indexStatus === '?' && worktreeStatus === '?') {
        untrackedFilePaths.push(filePath);
        continue;
      }

      // Staged changes (index has a status)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        const stats = stagedStats.get(filePath) || { additions: 0, deletions: 0 };
        const stagedFile: FileStatus = {
          path: filePath,
          type: getChangeType(indexStatus),
          additions: stats.additions,
          deletions: stats.deletions,
        };
        if (oldPath) {
          stagedFile.oldPath = oldPath;
        }
        result.staged.push(stagedFile);
      }

      // Unstaged changes (worktree has a status, but not untracked)
      if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
        const stats = unstagedStats.get(filePath) || { additions: 0, deletions: 0 };
        result.unstaged.push({
          path: filePath,
          type: getChangeType(worktreeStatus),
          additions: stats.additions,
          deletions: stats.deletions,
        });
      }
    }

    // Get line counts for untracked files using git diff --no-index
    // This is efficient: git counts lines without us loading files into memory
    // Limit to first 100 files to avoid performance issues with many untracked files
    const filesToCount = untrackedFilePaths.slice(0, 100);
    if (filesToCount.length > 0) {
      // Use /dev/null for Linux/WSL, NUL for native Windows
      const nullDevice = process.platform === 'win32' && !isWslPath(repoPath) ? 'NUL' : '/dev/null';
      const lineCountPromises = filesToCount.map(async (filePath) => {
        try {
          // Use execFileAsync to avoid shell injection with file paths
          const { stdout } = await execFileAsync(
            'git',
            ['diff', '--no-index', '--numstat', '--', nullDevice, filePath],
            { cwd: repoPath }
          ).catch((err) => {
            // git diff --no-index exits with code 1 when files differ (which is always for new files)
            // but still outputs the numstat, so we capture stdout from the error
            if (err.stdout) return { stdout: err.stdout };
            throw err;
          });

          // Parse numstat output: "42    0    path/to/file" (additions, deletions, path)
          const match = stdout.trim().match(/^(\d+|-)\s+(\d+|-)\s+/);
          if (match) {
            const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
            return { filePath, lineCount: additions };
          }
          return { filePath, lineCount: 0 };
        } catch {
          // Could be binary, unreadable, or deleted
          return { filePath, lineCount: 0 };
        }
      });

      const lineCountResults = await Promise.all(lineCountPromises);
      for (const lineResult of lineCountResults) {
        result.untracked.push({
          path: lineResult.filePath,
          type: 'added',
          additions: lineResult.lineCount,
          deletions: 0,
        });
      }
    }

    return result;
  } catch (error) {
    console.error('[Git] Failed to get file statuses:', error);
    return result;
  }
}

/**
 * Stage specific files for commit.
 * @param repoPath - Path to the git repository
 * @param files - Array of file paths to stage (relative to repo root)
 */
export async function stageFiles(repoPath: string, files: string[]): Promise<GitOperationResult> {
  try {
    if (files.length === 0) {
      return { success: true };
    }

    // For WSL paths, use shell command with proper escaping
    if (isWslPath(repoPath)) {
      // Use single quotes to avoid shell interpretation, escape any single quotes in paths
      const escapedFiles = files.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
      await execAsync(`git add -- ${escapedFiles}`, { cwd: repoPath });
    } else {
      // For native paths, use execFile to bypass shell entirely (safest)
      await execFileAsync('git', ['add', '--', ...files], { cwd: repoPath });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stage files';
    console.error('[Git] Failed to stage files:', message);
    return { success: false, error: message };
  }
}

/**
 * Stage all changes (including untracked files).
 * @param repoPath - Path to the git repository
 */
export async function stageAll(repoPath: string): Promise<GitOperationResult> {
  try {
    await execAsync('git add -A', { cwd: repoPath });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stage all files';
    console.error('[Git] Failed to stage all files:', message);
    return { success: false, error: message };
  }
}

/**
 * Unstage specific files (remove from staging area, keep working tree changes).
 * @param repoPath - Path to the git repository
 * @param files - Array of file paths to unstage (relative to repo root)
 */
export async function unstageFiles(repoPath: string, files: string[]): Promise<GitOperationResult> {
  try {
    if (files.length === 0) {
      return { success: true };
    }

    // For WSL paths, use shell command with proper escaping
    if (isWslPath(repoPath)) {
      // Use single quotes to avoid shell interpretation, escape any single quotes in paths
      const escapedFiles = files.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
      await execAsync(`git restore --staged -- ${escapedFiles}`, { cwd: repoPath });
    } else {
      // For native paths, use execFile to bypass shell entirely (safest)
      await execFileAsync('git', ['restore', '--staged', '--', ...files], { cwd: repoPath });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unstage files';
    console.error('[Git] Failed to unstage files:', message);
    return { success: false, error: message };
  }
}

/**
 * Unstage all files (remove all from staging area, keep working tree changes).
 * @param repoPath - Path to the git repository
 */
export async function unstageAll(repoPath: string): Promise<GitOperationResult> {
  try {
    await execAsync('git restore --staged .', { cwd: repoPath });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unstage all files';
    console.error('[Git] Failed to unstage all files:', message);
    return { success: false, error: message };
  }
}

/**
 * Discard changes to specific files.
 * Uses 'git restore' for tracked files and 'git clean -f' for untracked files.
 * @param repoPath - Path to the git repository
 * @param files - Array of file paths to discard (relative to repo root)
 * @param untracked - Array of untracked file paths to remove (relative to repo root)
 */
export async function discardFiles(
  repoPath: string,
  files: string[],
  untracked: string[] = []
): Promise<GitOperationResult> {
  try {
    if (files.length === 0 && untracked.length === 0) {
      return { success: true };
    }

    // Restore tracked files (discard working tree changes)
    if (files.length > 0) {
      const quotedFiles = files.map((f) => `"${f}"`).join(' ');
      await execAsync(`git restore ${quotedFiles}`, { cwd: repoPath });
    }

    // Clean untracked files
    if (untracked.length > 0) {
      const quotedUntracked = untracked.map((f) => `"${f}"`).join(' ');
      await execAsync(`git clean -f -- ${quotedUntracked}`, { cwd: repoPath });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to discard files';
    console.error('[Git] Failed to discard files:', message);
    return { success: false, error: message };
  }
}

/**
 * Discard all changes in the working tree.
 * Uses 'git restore .' for tracked files and 'git clean -fd' for untracked files/directories.
 * @param repoPath - Path to the git repository
 */
export async function discardAll(repoPath: string): Promise<GitOperationResult> {
  try {
    // Restore all tracked files to HEAD state
    await execAsync('git restore .', { cwd: repoPath });

    // Clean all untracked files and directories
    await execAsync('git clean -fd', { cwd: repoPath });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to discard all changes';
    console.error('[Git] Failed to discard all changes:', message);
    return { success: false, error: message };
  }
}

/**
 * Commit staged changes with a message.
 * @param repoPath - Path to the git repository
 * @param message - Commit message
 * @returns CommitResult with success status and commit hash
 */
export async function commit(repoPath: string, message: string): Promise<CommitResult> {
  try {
    if (!message.trim()) {
      return { success: false, error: 'Commit message cannot be empty' };
    }

    if (isWslPath(repoPath)) {
      // Escape the message for shell
      const escapedMessage = message.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`git commit -m '${escapedMessage}'`, { cwd: repoPath });
      // Extract commit hash from output (e.g., "[main abc1234] message")
      const match = stdout.match(/\[[\w/-]+ ([a-f0-9]+)\]/);
      if (match) {
        return { success: true, commitHash: match[1] };
      }
      return { success: false, error: 'Nothing to commit' };
    }

    // Use simple-git for commit to avoid shell escaping issues
    const git = getSimpleGit(repoPath);
    const commitResult = await git.commit(message);

    // simple-git returns an empty commit hash when nothing was committed
    if (!commitResult.commit) {
      return { success: false, error: 'Nothing to commit' };
    }

    return { success: true, commitHash: commitResult.commit };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to commit';
    console.error('[Git] Failed to commit:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Strip ANSI escape codes from a string.
 * @param str - String potentially containing ANSI codes
 * @returns Clean string without ANSI codes
 */
function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Escape a string for safe use in shell single quotes.
 * Handles single quotes by ending the string, adding escaped quote, and resuming.
 * @param str - String to escape
 * @returns Shell-safe escaped string wrapped in single quotes
 */
function escapeForShell(str: string): string {
  // Replace single quotes with: end quote, escaped quote, start quote
  // e.g., "it's" becomes 'it'\''s'
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Detect which package manager is used in a repository.
 * @param repoPath - Path to the repository
 * @returns Package manager name or null if none detected
 */
async function detectPackageManager(
  repoPath: string
): Promise<'npm' | 'yarn' | 'pnpm' | 'bun' | null> {
  const lockFiles = [
    { file: 'bun.lockb', pm: 'bun' as const },
    { file: 'pnpm-lock.yaml', pm: 'pnpm' as const },
    { file: 'yarn.lock', pm: 'yarn' as const },
    { file: 'package-lock.json', pm: 'npm' as const },
  ];

  for (const { file, pm } of lockFiles) {
    try {
      await fs.access(path.join(repoPath, file));
      return pm;
    } catch {
      // File doesn't exist, try next
    }
  }

  // Check if package.json exists (default to npm)
  try {
    await fs.access(path.join(repoPath, 'package.json'));
    return 'npm';
  } catch {
    return null;
  }
}

/**
 * Check if husky hooks are properly configured and dependencies are installed.
 * @param repoPath - Path to the repository
 * @returns true if husky is set up and ready to run
 */
async function isHuskyConfigured(repoPath: string): Promise<boolean> {
  try {
    // Check if core.hooksPath is set (husky sets this during install)
    const { stdout } = await execAsync('git config core.hooksPath', { cwd: repoPath });
    const hooksPath = stdout.trim();

    // If core.hooksPath is set and contains .husky, check if node_modules exists
    // (hooks need node_modules to run npx lint-staged, etc.)
    if (hooksPath.includes('.husky')) {
      try {
        await fs.access(path.join(repoPath, 'node_modules'));
        return true;
      } catch {
        return false;
      }
    }

    return false;
  } catch {
    // core.hooksPath not set - husky not configured
    return false;
  }
}

/**
 * Spawn a shell process, routing through WSL if the path is a WSL path.
 * @param repoPath - Path to the repository (used to detect WSL)
 * @param command - Command to run
 * @returns Spawned child process
 */
function spawnShellForRepo(repoPath: string, command: string): ReturnType<typeof spawn> {
  if (isWslPath(repoPath)) {
    const distro = getWslDistro(repoPath);
    const wslPath = toWslInternalPath(repoPath);

    if (!distro) {
      throw new Error(`Invalid WSL path: ${repoPath}`);
    }

    // Route through WSL's native bash
    const wslCommand = `cd '${wslPath}' && ${command}`;
    return spawn('wsl', ['-d', distro, '-e', 'bash', '-l', '-c', wslCommand], {
      env: { ...process.env },
    });
  }

  // Non-WSL path: use local shell
  // On Windows, use bash if available (e.g., Git Bash), otherwise fall back to sh
  // On Unix, use the user's preferred shell or sh as fallback
  const shell = process.platform === 'win32' ? 'bash' : process.env.SHELL || 'sh';
  return spawn(shell, ['-l', '-c', command], {
    cwd: repoPath,
    env: { ...process.env },
    detached: process.platform !== 'win32', // Enable process group for Unix kill
  });
}

/**
 * Ensure husky hooks are set up by running package manager install if needed.
 * @param repoPath - Path to the repository
 * @param onOutput - Callback for output lines
 * @returns true if hooks are ready, false if setup failed
 */
async function ensureHooksConfigured(
  repoPath: string,
  onOutput?: (line: string) => void
): Promise<boolean> {
  // Check if already configured
  const alreadyConfigured = await isHuskyConfigured(repoPath);
  if (alreadyConfigured) {
    return true;
  }

  // Check if .husky directory exists (repo uses husky)
  const huskyDir = joinPath(repoPath, '.husky');
  try {
    await fs.access(huskyDir);
  } catch {
    // No .husky directory, repo doesn't use husky
    return true;
  }

  // Detect package manager
  const pm = await detectPackageManager(repoPath);
  if (!pm) {
    return true; // No package.json, nothing to install
  }

  onOutput?.(`Setting up git hooks (running ${pm} install)...`);

  // Run install command
  const installCmd = pm === 'npm' ? 'npm install' : `${pm} install`;

  return new Promise((resolve) => {
    let installProcess: ReturnType<typeof spawn>;
    try {
      installProcess = spawnShellForRepo(repoPath, installCmd);
    } catch (err) {
      onOutput?.(
        `Warning: Failed to spawn shell: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      resolve(false);
      return;
    }

    installProcess.stdout?.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((l: string) => l.trim());
      lines.forEach((line: string) => onOutput?.(line));
    });

    installProcess.stderr?.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((l: string) => l.trim());
      lines.forEach((line: string) => onOutput?.(line));
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        onOutput?.('Git hooks configured successfully.');
        resolve(true);
      } else {
        onOutput?.('Warning: Failed to set up git hooks. Continuing with commit...');
        resolve(false);
      }
    });

    installProcess.on('error', () => {
      onOutput?.('Warning: Failed to run package manager. Continuing with commit...');
      resolve(false);
    });
  });
}

/**
 * Commit staged changes with streaming output for pre-commit hooks.
 * Uses child_process.spawn for real-time output streaming.
 * @param repoPath - Path to the git repository
 * @param message - Commit message
 * @param onOutput - Callback for each line of output (optional)
 * @returns CommitWithOutputResult with success status, commit hash, and captured output
 */
export async function commitWithOutput(
  repoPath: string,
  message: string,
  onOutput?: (line: string) => void
): Promise<CommitWithOutputResult> {
  if (!message.trim()) {
    return { success: false, error: 'Commit message cannot be empty', output: [] };
  }

  // Ensure husky hooks are configured before committing
  const output: string[] = [];
  const wrappedOnOutput = (line: string) => {
    output.push(line);
    onOutput?.(line);
  };

  await ensureHooksConfigured(repoPath, wrappedOnOutput);

  return new Promise((resolve) => {
    // Use a login shell (-l) to ensure full environment (PATH with node/npm/npx)
    // This is required for husky/lint-staged hooks which need to find npx
    // Escape the message to prevent shell injection
    const escapedMessage = escapeForShell(message);
    const command = `git commit -m ${escapedMessage}`;

    let gitProcess: ReturnType<typeof spawn>;
    try {
      gitProcess = spawnShellForRepo(repoPath, command);
    } catch (err) {
      resolve({
        success: false,
        error: `Failed to spawn shell: ${err instanceof Error ? err.message : 'Unknown error'}`,
        output,
      });
      return;
    }

    let buffer = '';

    const processLine = (line: string) => {
      const cleanLine = stripAnsiCodes(line);
      if (cleanLine.trim()) {
        wrappedOnOutput(cleanLine);
      }
    };

    const processBuffer = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
      }
    };

    gitProcess.stdout?.on('data', processBuffer);
    gitProcess.stderr?.on('data', processBuffer);

    gitProcess.on('close', async (code) => {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        processLine(buffer);
      }

      if (code === 0) {
        // Get the commit hash
        try {
          const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
          const commitHash = stdout.trim().substring(0, 7);
          resolve({ success: true, commitHash, output });
        } catch {
          // Commit succeeded but couldn't get hash
          resolve({ success: true, output });
        }
      } else {
        // Hook or commit failed
        const errorMessage = output.join('\n') || 'Commit failed';
        resolve({ success: false, error: errorMessage, output });
      }
    });

    gitProcess.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to spawn git process: ${err.message}`,
        output,
      });
    });
  });
}

/**
 * Execute a hook script and stream its output.
 * @param repoPath - Path to the git repository
 * @param hookType - Type of hook to execute
 * @param onOutput - Callback for each line of output
 * @returns Promise that resolves to { success: true } if hook succeeded,
 *          { success: false, aborted: true } if aborted, or { success: false, error } on failure
 */
async function executeHook(
  repoPath: string,
  hookType: GitHookType,
  onOutput?: (line: string) => void
): Promise<{ success: boolean; aborted?: boolean; error?: string }> {
  // Check if operation was aborted before starting
  if (isOperationAborted(repoPath)) {
    return { success: false, aborted: true };
  }

  // Determine hook path (prefer .husky over .git/hooks)
  const huskyPath = joinPath(repoPath, '.husky', hookType);
  const gitHooksPath = joinPath(repoPath, '.git', 'hooks', hookType);

  let hookPath: string | null = null;

  try {
    await fs.stat(huskyPath);
    hookPath = huskyPath;
  } catch (huskyErr: unknown) {
    // Only continue if husky path doesn't exist; rethrow permission errors etc.
    if ((huskyErr as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { success: false, error: `Cannot access hook: ${(huskyErr as Error).message}` };
    }
    try {
      await fs.stat(gitHooksPath);
      hookPath = gitHooksPath;
    } catch (gitErr: unknown) {
      // Only treat ENOENT as "no hook"; other errors should fail
      if ((gitErr as NodeJS.ErrnoException).code !== 'ENOENT') {
        return { success: false, error: `Cannot access hook: ${(gitErr as Error).message}` };
      }
      // No hook exists
      return { success: true };
    }
  }

  return new Promise((resolve) => {
    // Execute the hook script using a shell
    // For husky hooks, we need to run them through the shell to get proper environment
    let hookProcess: ReturnType<typeof spawn>;

    try {
      // Use relative path for the hook to work properly with husky
      const relativeHookPath = hookType;
      const command = isWslPath(repoPath)
        ? `./.husky/${relativeHookPath}`
        : hookPath === huskyPath
          ? `./.husky/${relativeHookPath}`
          : `./.git/hooks/${relativeHookPath}`;

      hookProcess = spawnShellForRepo(repoPath, command);
    } catch (err) {
      onOutput?.(`Failed to spawn hook: ${err instanceof Error ? err.message : 'Unknown error'}`);
      resolve({ success: false });
      return;
    }

    // Register this process so it can be cancelled
    registerOperation(repoPath, hookProcess);

    let buffer = '';

    const processLine = (line: string) => {
      const cleanLine = stripAnsiCodes(line);
      if (cleanLine.trim()) {
        onOutput?.(cleanLine);
      }
    };

    const processBuffer = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
      }
    };

    hookProcess.stdout?.on('data', processBuffer);
    hookProcess.stderr?.on('data', processBuffer);

    hookProcess.on('close', (code) => {
      if (buffer.trim()) {
        processLine(buffer);
      }
      const aborted = isOperationAborted(repoPath);
      resolve({ success: code === 0 && !aborted, aborted });
    });

    hookProcess.on('error', (err) => {
      onOutput?.(`Hook execution error: ${err.message}`);
      resolve({ success: false });
    });
  });
}

/**
 * Commit staged changes with full hook lifecycle support.
 * Executes pre-commit, commit-msg, git commit, and post-commit in sequence.
 * Pre-hooks block on failure, post-hook failure returns success with error flag.
 *
 * @param repoPath - Path to the git repository
 * @param message - Commit message
 * @param onOutput - Callback for each line of output with phase and hook info
 * @returns OperationWithHooksResult with success status and hook failure info
 */
export async function commitWithHooks(
  repoPath: string,
  message: string,
  onOutput?: (line: string, phase: OperationProgressStatus, hook?: GitHookType) => void
): Promise<OperationWithHooksResult> {
  if (!message.trim()) {
    return { success: false, error: 'Commit message cannot be empty', output: [] };
  }

  const output: string[] = [];
  const addOutput = (line: string, phase: OperationProgressStatus, hook?: GitHookType) => {
    output.push(line);
    onOutput?.(line, phase, hook);
  };

  // Ensure husky hooks are configured
  await ensureHooksConfigured(repoPath, (line) => addOutput(line, 'checking-hooks'));

  // Get hook manifest to know which hooks exist
  const manifest = await getHookManifest(repoPath);

  // Run pre-commit hook if it exists
  if (manifest['pre-commit']) {
    addOutput('Running pre-commit hook...', 'running-hook', 'pre-commit');
    const preCommitResult = await executeHook(repoPath, 'pre-commit', (line) =>
      addOutput(line, 'running-hook', 'pre-commit')
    );

    if (preCommitResult.aborted) {
      unregisterOperation(repoPath);
      return {
        success: false,
        error: 'Operation cancelled',
        output,
        failedHook: 'pre-commit',
      };
    }

    if (!preCommitResult.success) {
      unregisterOperation(repoPath);
      return {
        success: false,
        error: 'pre-commit hook failed',
        output,
        failedHook: 'pre-commit',
      };
    }
  }

  // Note: commit-msg hook is handled by git itself during the commit command
  // because it requires the message file path as an argument

  // Check if operation was aborted before commit
  if (isOperationAborted(repoPath)) {
    unregisterOperation(repoPath);
    return { success: false, error: 'Operation cancelled', output };
  }

  // Execute the commit
  addOutput('Committing changes...', 'executing');

  const commitResult = await new Promise<{
    success: boolean;
    commitHash?: string;
    error?: string;
    aborted?: boolean;
  }>((resolve) => {
    const escapedMessage = escapeForShell(message);
    const command = `git commit -m ${escapedMessage}`;

    let gitProcess: ReturnType<typeof spawn>;
    try {
      gitProcess = spawnShellForRepo(repoPath, command);
    } catch (err) {
      resolve({
        success: false,
        error: `Failed to spawn git process: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
      return;
    }

    // Register this process so it can be cancelled
    registerOperation(repoPath, gitProcess);

    let buffer = '';
    const hasCommitMsgHook = manifest['commit-msg'];
    let inCommitMsgHook = false;

    const processLine = (line: string) => {
      const cleanLine = stripAnsiCodes(line);
      if (cleanLine.trim()) {
        // Detect if we're running commit-msg hook (git outputs this)
        if (hasCommitMsgHook && cleanLine.includes('commit-msg')) {
          inCommitMsgHook = true;
        }
        const phase: OperationProgressStatus = inCommitMsgHook ? 'running-hook' : 'executing';
        const hook: GitHookType | undefined = inCommitMsgHook ? 'commit-msg' : undefined;
        addOutput(cleanLine, phase, hook);
      }
    };

    const processBuffer = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
      }
    };

    gitProcess.stdout?.on('data', processBuffer);
    gitProcess.stderr?.on('data', processBuffer);

    gitProcess.on('close', async (code) => {
      if (buffer.trim()) {
        processLine(buffer);
      }

      // Check if operation was aborted
      if (isOperationAborted(repoPath)) {
        resolve({ success: false, error: 'Operation cancelled', aborted: true });
        return;
      }

      if (code === 0) {
        try {
          const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
          const commitHash = stdout.trim().substring(0, 7);
          resolve({ success: true, commitHash });
        } catch {
          resolve({ success: true });
        }
      } else {
        // Check if it was a commit-msg hook failure
        const errorMessage = output.join('\n') || 'Commit failed';
        if (manifest['commit-msg'] && errorMessage.toLowerCase().includes('commit-msg')) {
          resolve({ success: false, error: 'commit-msg hook failed' });
        } else {
          resolve({ success: false, error: errorMessage });
        }
      }
    });

    gitProcess.on('error', (err) => {
      resolve({ success: false, error: `Failed to spawn git process: ${err.message}` });
    });
  });

  if (commitResult.aborted) {
    unregisterOperation(repoPath);
    return { success: false, error: 'Operation cancelled', output };
  }

  if (!commitResult.success) {
    unregisterOperation(repoPath);
    // Check if this was a commit-msg hook failure
    const failedHook: GitHookType | undefined = commitResult.error?.includes('commit-msg')
      ? 'commit-msg'
      : undefined;
    return {
      success: false,
      error: commitResult.error,
      output,
      failedHook,
    };
  }

  // Run post-commit hook if it exists
  if (manifest['post-commit']) {
    addOutput('Running post-commit hook...', 'running-hook', 'post-commit');
    const postCommitResult = await executeHook(repoPath, 'post-commit', (line) =>
      addOutput(line, 'running-hook', 'post-commit')
    );

    if (postCommitResult.aborted) {
      unregisterOperation(repoPath);
      return {
        success: false,
        commitHash: commitResult.commitHash,
        error: 'Operation cancelled',
        output,
        operationSucceeded: true,
      };
    }

    if (!postCommitResult.success) {
      unregisterOperation(repoPath);
      // Post-hook failed but commit succeeded
      return {
        success: false,
        commitHash: commitResult.commitHash,
        error: 'post-commit hook failed',
        output,
        postHookFailed: true,
        failedHook: 'post-commit',
        operationSucceeded: true,
      };
    }
  }

  unregisterOperation(repoPath);
  return {
    success: true,
    commitHash: commitResult.commitHash,
    output,
  };
}

/**
 * Push commits to the remote repository with full hook lifecycle support.
 * Executes pre-push, git push, and post-push in sequence.
 * Pre-push blocks on failure, post-push failure returns success with error flag.
 *
 * @param repoPath - Path to the git repository
 * @param onOutput - Callback for each line of output with phase and hook info
 * @returns OperationWithHooksResult with success status and hook failure info
 */
export async function pushWithHooks(
  repoPath: string,
  onOutput?: (line: string, phase: OperationProgressStatus, hook?: GitHookType) => void
): Promise<OperationWithHooksResult> {
  const output: string[] = [];
  const addOutput = (line: string, phase: OperationProgressStatus, hook?: GitHookType) => {
    output.push(line);
    onOutput?.(line, phase, hook);
  };

  // Ensure husky hooks are configured
  await ensureHooksConfigured(repoPath, (line) => addOutput(line, 'checking-hooks'));

  // Get hook manifest to know which hooks exist
  const manifest = await getHookManifest(repoPath);

  // Run pre-push hook if it exists
  if (manifest['pre-push']) {
    addOutput('Running pre-push hook...', 'running-hook', 'pre-push');
    const prePushResult = await executeHook(repoPath, 'pre-push', (line) =>
      addOutput(line, 'running-hook', 'pre-push')
    );

    if (prePushResult.aborted) {
      unregisterOperation(repoPath);
      return {
        success: false,
        error: 'Operation cancelled',
        output,
        failedHook: 'pre-push',
      };
    }

    if (!prePushResult.success) {
      unregisterOperation(repoPath);
      return {
        success: false,
        error: 'pre-push hook failed',
        output,
        failedHook: 'pre-push',
      };
    }
  }

  // Check if operation was aborted before push
  if (isOperationAborted(repoPath)) {
    unregisterOperation(repoPath);
    return { success: false, error: 'Operation cancelled', output };
  }

  // Execute the push
  addOutput('Pushing to remote...', 'executing');

  const pushResult = await new Promise<{ success: boolean; error?: string; aborted?: boolean }>(
    (resolve) => {
      // Get current branch first
      const getCurrentBranch = async (): Promise<string | null> => {
        try {
          const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
          return stdout.trim();
        } catch {
          return null;
        }
      };

      getCurrentBranch().then((currentBranch) => {
        if (!currentBranch) {
          resolve({ success: false, error: 'Could not determine current branch' });
          return;
        }

        const command = `git push --set-upstream origin "${currentBranch}"`;

        let gitProcess: ReturnType<typeof spawn>;
        try {
          gitProcess = spawnShellForRepo(repoPath, command);
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to spawn git process: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
          return;
        }

        // Register this process so it can be cancelled
        registerOperation(repoPath, gitProcess);

        let buffer = '';

        const processLine = (line: string) => {
          const cleanLine = stripAnsiCodes(line);
          if (cleanLine.trim()) {
            addOutput(cleanLine, 'executing');
          }
        };

        const processBuffer = (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            processLine(line);
          }
        };

        gitProcess.stdout?.on('data', processBuffer);
        gitProcess.stderr?.on('data', processBuffer);

        gitProcess.on('close', async (code) => {
          if (buffer.trim()) {
            processLine(buffer);
          }

          // Check if operation was aborted
          if (isOperationAborted(repoPath)) {
            resolve({ success: false, error: 'Operation cancelled', aborted: true });
            return;
          }

          if (code === 0) {
            // Fetch to update local refs so ahead/behind count is accurate immediately
            try {
              await execAsync(`git fetch origin "${currentBranch}"`, { cwd: repoPath });
            } catch {
              // Ignore fetch errors - push succeeded, fetch is best-effort
            }
            resolve({ success: true });
          } else {
            const errorMessage = output.join('\n') || 'Push failed';
            if (errorMessage.includes('rejected')) {
              resolve({ success: false, error: 'Push rejected - pull remote changes first' });
            } else if (
              errorMessage.includes('Authentication') ||
              errorMessage.includes('Permission denied')
            ) {
              resolve({ success: false, error: 'Authentication failed' });
            } else {
              resolve({ success: false, error: errorMessage });
            }
          }
        });

        gitProcess.on('error', (err) => {
          resolve({ success: false, error: `Failed to spawn git process: ${err.message}` });
        });
      });
    }
  );

  if (pushResult.aborted) {
    unregisterOperation(repoPath);
    return { success: false, error: 'Operation cancelled', output };
  }

  if (!pushResult.success) {
    unregisterOperation(repoPath);
    return {
      success: false,
      error: pushResult.error,
      output,
    };
  }

  // Run post-push hook if it exists
  if (manifest['post-push']) {
    addOutput('Running post-push hook...', 'running-hook', 'post-push');
    const postPushResult = await executeHook(repoPath, 'post-push', (line) =>
      addOutput(line, 'running-hook', 'post-push')
    );

    if (postPushResult.aborted) {
      unregisterOperation(repoPath);
      return {
        success: false,
        error: 'Operation cancelled',
        output,
        operationSucceeded: true,
      };
    }

    if (!postPushResult.success) {
      unregisterOperation(repoPath);
      // Post-hook failed but push succeeded
      return {
        success: false,
        error: 'post-push hook failed',
        output,
        postHookFailed: true,
        failedHook: 'post-push',
        operationSucceeded: true,
      };
    }
  }

  unregisterOperation(repoPath);
  return {
    success: true,
    output,
  };
}

/**
 * Push commits to the remote repository.
 * @param repoPath - Path to the git repository
 * @returns GitOperationResult with success status
 */
export async function push(repoPath: string): Promise<GitOperationResult> {
  try {
    if (isWslPath(repoPath)) {
      // Check for remotes
      const { stdout: remotesOut } = await execAsync('git remote', { cwd: repoPath });
      if (!remotesOut.trim()) {
        return { success: false, error: 'No remote configured' };
      }

      // Get current branch
      const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
      });
      const currentBranch = branchOut.trim();

      try {
        await execAsync(`git push --set-upstream origin "${currentBranch}"`, { cwd: repoPath });
        // Fetch to update local refs so ahead/behind count is accurate immediately
        await execAsync(`git fetch origin "${currentBranch}"`, { cwd: repoPath }).catch(() => {
          // Ignore fetch errors - push succeeded, fetch is best-effort
        });
        return { success: true };
      } catch (pushError) {
        const errorMessage = pushError instanceof Error ? pushError.message : 'Failed to push';
        if (errorMessage.includes('rejected')) {
          return { success: false, error: 'Push rejected - pull remote changes first' };
        }
        if (errorMessage.includes('Authentication') || errorMessage.includes('Permission denied')) {
          return { success: false, error: 'Authentication failed' };
        }
        return { success: false, error: errorMessage };
      }
    }

    const git = getSimpleGit(repoPath);

    // Check if there's a remote configured
    const remotes = await git.getRemotes();
    if (remotes.length === 0) {
      return { success: false, error: 'No remote configured' };
    }

    // Check if the current branch has an upstream
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const currentBranch = branch.trim();

    try {
      // Try to push with upstream tracking
      await git.push('origin', currentBranch, ['--set-upstream']);
      // Fetch to update local refs so ahead/behind count is accurate immediately
      await git.fetch('origin', currentBranch).catch(() => {
        // Ignore fetch errors - push succeeded, fetch is best-effort
      });
      return { success: true };
    } catch (pushError) {
      const errorMessage = pushError instanceof Error ? pushError.message : 'Failed to push';

      // Check for common error cases
      if (errorMessage.includes('rejected')) {
        return {
          success: false,
          error: 'Push rejected - pull remote changes first',
        };
      }
      if (
        errorMessage.includes('Authentication') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('Permission denied')
      ) {
        return { success: false, error: 'Authentication failed' };
      }

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to push';
    console.error('[Git] Failed to push:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Pull changes from the remote repository.
 * @param repoPath - Path to the git repository
 * @returns GitOperationResult with success status
 */
export async function pull(repoPath: string): Promise<GitOperationResult> {
  try {
    if (isWslPath(repoPath)) {
      // Check for remotes
      const { stdout: remotesOut } = await execAsync('git remote', { cwd: repoPath });
      if (!remotesOut.trim()) {
        return { success: false, error: 'No remote configured' };
      }

      try {
        await execAsync('git pull', { cwd: repoPath });
        return { success: true };
      } catch (pullError) {
        const errorMessage = pullError instanceof Error ? pullError.message : 'Failed to pull';
        if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT')) {
          return { success: false, error: 'Merge conflict - resolve manually' };
        }
        if (
          errorMessage.includes('uncommitted changes') ||
          errorMessage.includes('local changes')
        ) {
          return { success: false, error: 'Uncommitted changes - commit or stash first' };
        }
        if (errorMessage.includes('Authentication') || errorMessage.includes('Permission denied')) {
          return { success: false, error: 'Authentication failed' };
        }
        return { success: false, error: errorMessage };
      }
    }

    const git = getSimpleGit(repoPath);

    // Check if there's a remote configured
    const remotes = await git.getRemotes();
    if (remotes.length === 0) {
      return { success: false, error: 'No remote configured' };
    }

    try {
      await git.pull();
      return { success: true };
    } catch (pullError) {
      const errorMessage = pullError instanceof Error ? pullError.message : 'Failed to pull';

      // Check for common error cases
      if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT')) {
        return { success: false, error: 'Merge conflict - resolve manually' };
      }
      if (errorMessage.includes('uncommitted changes') || errorMessage.includes('local changes')) {
        return {
          success: false,
          error: 'Uncommitted changes - commit or stash first',
        };
      }
      if (
        errorMessage.includes('Authentication') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('Permission denied')
      ) {
        return { success: false, error: 'Authentication failed' };
      }

      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to pull';
    console.error('[Git] Failed to pull:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get the number of commits ahead and behind the remote.
 * @param repoPath - Path to the git repository
 * @returns AheadBehindResult with ahead/behind counts and remote info
 */
/**
 * Get the URL of a remote repository.
 * @param repoPath - Path to the git repository
 * @param remoteName - Name of the remote (defaults to 'origin')
 * @returns The remote URL or null if not configured
 */
export async function getRemoteUrl(
  repoPath: string,
  remoteName = 'origin'
): Promise<string | null> {
  // Check if directory exists before attempting git operations
  if (!directoryExistsSync(repoPath)) {
    console.log(`[Git] Repository directory does not exist: ${repoPath}`);
    return null;
  }

  try {
    if (isWslPath(repoPath)) {
      const { stdout } = await execAsync(`git remote get-url "${remoteName}"`, { cwd: repoPath });
      const url = stdout.trim();
      return url || null;
    }

    const git = getSimpleGit(repoPath);
    const remotes = await git.getRemotes(true);

    const remote = remotes.find((r) => r.name === remoteName);
    if (!remote || !remote.refs.fetch) {
      return null;
    }

    return remote.refs.fetch;
  } catch (error) {
    console.error('[Git] Failed to get remote URL:', error);
    return null;
  }
}

/**
 * Add a remote to the repository.
 * @param repoPath - Path to the git repository
 * @param name - Name of the remote (typically 'origin')
 * @param url - URL of the remote repository
 * @returns GitOperationResult with success status
 */
export async function addRemote(
  repoPath: string,
  name: string,
  url: string
): Promise<GitOperationResult> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Remote name cannot be empty' };
    }

    if (!url.trim()) {
      return { success: false, error: 'Remote URL cannot be empty' };
    }

    if (isWslPath(repoPath)) {
      // Check if remote already exists
      const { stdout: remotesOut } = await execAsync('git remote', { cwd: repoPath });
      const existingRemotes = remotesOut.trim().split('\n').filter(Boolean);
      if (existingRemotes.includes(name)) {
        return { success: false, error: `Remote '${name}' already exists` };
      }

      await execAsync(`git remote add "${name}" "${url}"`, { cwd: repoPath });
      return { success: true };
    }

    const git = getSimpleGit(repoPath);

    // Check if remote already exists
    const remotes = await git.getRemotes();
    if (remotes.find((r) => r.name === name)) {
      return { success: false, error: `Remote '${name}' already exists` };
    }

    await git.addRemote(name, url);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add remote';
    console.error('[Git] Failed to add remote:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if a repository has pre-commit hooks configured.
 * Looks for .husky/pre-commit or .git/hooks/pre-commit.
 * @param repoPath - Path to the git repository
 * @returns true if pre-commit hooks exist and are executable
 */
export async function hasPreCommitHooks(repoPath: string): Promise<boolean> {
  const hookPaths = [
    path.join(repoPath, '.husky', 'pre-commit'),
    path.join(repoPath, '.git', 'hooks', 'pre-commit'),
  ];

  console.log('[hasPreCommitHooks] Checking repo:', repoPath);

  for (const hookPath of hookPaths) {
    console.log('[hasPreCommitHooks] Checking path:', hookPath);
    try {
      const stats = await fs.stat(hookPath);
      console.log('[hasPreCommitHooks] File exists, isFile:', stats.isFile(), 'size:', stats.size);
      if (stats.isFile()) {
        // Check if file is executable (on Unix) or just exists (on Windows)
        try {
          await fs.access(hookPath, fs.constants.X_OK);
          console.log('[hasPreCommitHooks] File is executable, returning true');
          return true;
        } catch {
          // On Windows, X_OK check may fail, but hooks can still run
          // Check if file has content (not empty)
          console.log('[hasPreCommitHooks] X_OK check failed, checking size');
          if (stats.size > 0) {
            console.log('[hasPreCommitHooks] File has content, returning true');
            return true;
          }
        }
      }
    } catch (err) {
      // File doesn't exist, continue to next path
      console.log('[hasPreCommitHooks] File not found:', hookPath);
    }
  }

  console.log('[hasPreCommitHooks] No hooks found, returning false');
  return false;
}

/**
 * Check if a repository has a specific git hook configured.
 * Looks for .husky/<hookType> or .git/hooks/<hookType>.
 * @param repoPath - Path to the git repository
 * @param hookType - Type of hook to check for
 * @returns true if the hook exists and is executable/has content
 */
export async function hasHook(repoPath: string, hookType: GitHookType): Promise<boolean> {
  const hookPaths = [
    joinPath(repoPath, '.husky', hookType),
    joinPath(repoPath, '.git', 'hooks', hookType),
  ];

  for (const hookPath of hookPaths) {
    try {
      const stats = await fs.stat(hookPath);
      if (stats.isFile()) {
        // Check if file is executable (on Unix) or just exists (on Windows)
        try {
          await fs.access(hookPath, fs.constants.X_OK);
          return true;
        } catch {
          // On Windows, X_OK check may fail, but hooks can still run
          // Check if file has content (not empty)
          if (stats.size > 0) {
            return true;
          }
        }
      }
    } catch {
      // File doesn't exist, continue to next path
    }
  }

  return false;
}

/**
 * Get a manifest of which hooks exist in a repository.
 * @param repoPath - Path to the git repository
 * @returns HookManifest with boolean for each hook type
 */
export async function getHookManifest(repoPath: string): Promise<HookManifest> {
  const hookTypes: GitHookType[] = [
    'pre-commit',
    'commit-msg',
    'post-commit',
    'pre-push',
    'post-push',
  ];

  // Check all hooks in parallel for performance
  const results = await Promise.all(hookTypes.map((hookType) => hasHook(repoPath, hookType)));

  return {
    'pre-commit': results[0],
    'commit-msg': results[1],
    'post-commit': results[2],
    'pre-push': results[3],
    'post-push': results[4],
  };
}

export async function getAheadBehind(repoPath: string): Promise<AheadBehindResult> {
  // Check if directory exists before attempting git operations
  if (!directoryExistsSync(repoPath)) {
    console.log(`[Git] Repository directory does not exist: ${repoPath}`);
    return { ahead: 0, behind: 0, hasRemote: false };
  }

  try {
    let currentBranch: string;

    if (isWslPath(repoPath)) {
      // Check if there's a remote configured
      const { stdout: remotesOut } = await execAsync('git remote', { cwd: repoPath });
      if (!remotesOut.trim()) {
        return { ahead: 0, behind: 0, hasRemote: false };
      }

      // Get current branch
      const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
      });
      currentBranch = branchOut.trim();
    } else {
      const git = getSimpleGit(repoPath);

      // Check if there's a remote configured
      const remotes = await git.getRemotes();
      if (remotes.length === 0) {
        return { ahead: 0, behind: 0, hasRemote: false };
      }

      // Get current branch
      const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
      currentBranch = branch.trim();
    }

    // Check if origin/<currentBranch> exists
    // This is the only meaningful comparison for ahead/behind
    const remoteBranch = `origin/${currentBranch}`;
    try {
      const { stdout: remoteBranches } = await execAsync(`git branch -r --list "${remoteBranch}"`, {
        cwd: repoPath,
      });

      if (!remoteBranches.trim()) {
        // No remote branch with this name - repo has remote but branch doesn't
        // Count commits ahead of origin/<defaultBranch> to show how many will be pushed
        try {
          const defaultBranch = await getDefaultBranch(repoPath);
          const remoteDefaultBranch = `origin/${defaultBranch}`;

          // Check if remote default branch exists
          const { stdout: remoteDefaultExists } = await execAsync(
            `git branch -r --list "${remoteDefaultBranch}"`,
            { cwd: repoPath }
          );

          if (remoteDefaultExists.trim()) {
            // Count commits in HEAD that aren't in origin/<defaultBranch>
            const { stdout: aheadCount } = await execAsync(
              `git rev-list --count ${remoteDefaultBranch}..HEAD`,
              { cwd: repoPath }
            );

            return {
              ahead: parseInt(aheadCount.trim(), 10) || 0,
              behind: 0, // Nothing to pull from non-existent remote branch
              hasRemote: true,
            };
          }
        } catch {
          // If we can't determine ahead count, fall back to 0
        }

        return { ahead: 0, behind: 0, hasRemote: true };
      }

      // Remote branch exists, get counts
      const { stdout: counts } = await execAsync(
        `git rev-list --left-right --count HEAD...${remoteBranch}`,
        { cwd: repoPath }
      );

      const [ahead, behind] = counts.trim().split(/\s+/).map(Number);

      return {
        ahead: ahead || 0,
        behind: behind || 0,
        hasRemote: true,
        remoteBranch,
      };
    } catch {
      // Error checking remote branch - still has remote, just can't compare
      return { ahead: 0, behind: 0, hasRemote: true };
    }
  } catch (error) {
    console.error('[Git] Failed to get ahead/behind:', error);
    return { ahead: 0, behind: 0, hasRemote: false };
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Remove a directory recursively with retry logic for Windows file locking.
 * On Windows, file locks may persist briefly after processes are killed,
 * so we retry with exponential backoff.
 * For WSL paths, uses 'wsl -e rm -rf' which handles locks better.
 * @param dirPath - Path to the directory to remove
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns Result with success status
 */
export async function removeDirectory(
  dirPath: string,
  maxRetries = 5
): Promise<{ success: boolean; error?: string }> {
  let lastError = '';

  // For WSL paths, try wsl command first (handles file locks better),
  // then fall back to fs.rm if WSL is not available
  if (isWslPath(dirPath)) {
    const distro = getWslDistro(dirPath);
    const wslPath = toWslInternalPath(dirPath);

    if (distro) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await execAsyncRaw(`wsl -d ${distro} -e rm -rf "${wslPath}"`);
          return { success: true };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to remove directory';
          lastError = errorMessage;

          // If WSL itself is not available, fall back to fs.rm
          const isWslUnavailable =
            errorMessage.includes('is not recognized') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('cannot find the path') ||
            errorMessage.includes('The Windows Subsystem for Linux');

          if (isWslUnavailable) {
            console.log('[FS] WSL not available, falling back to fs.rm');
            break; // Fall through to fs.rm
          }

          // Check if it's a retryable error (device busy, etc.)
          const isRetryableError =
            errorMessage.includes('Device or resource busy') ||
            errorMessage.includes('cannot remove');

          if (isRetryableError && attempt < maxRetries) {
            const delayMs = 200 * Math.pow(2, attempt);
            console.log(
              `[FS] WSL directory removal failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
            );
            await sleep(delayMs);
          } else {
            // WSL available but removal failed - still try fs.rm as last resort
            console.log('[FS] WSL removal failed, trying fs.rm as fallback');
            break; // Fall through to fs.rm
          }
        }
      }
    }
    // Fall through to fs.rm below (WSL failed or distro not found)
  }

  // For non-WSL paths, use Node's fs.rm with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove directory';
      const errorCode = (error as NodeJS.ErrnoException).code;
      lastError = errorMessage;

      // On Windows, EBUSY means the file/directory is locked by another process
      // ENOTEMPTY can also occur if a subprocess is still writing
      const isRetryableError =
        errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY' || errorCode === 'EPERM';

      if (isRetryableError && attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms, 4000ms, 8000ms (~15.5s total)
        const delayMs = 500 * Math.pow(2, attempt);
        console.log(
          `[FS] Directory removal failed with ${errorCode}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(delayMs);
      } else {
        // On Windows, try PowerShell with detached process as last resort
        // A detached process doesn't inherit file handles from the parent
        if (process.platform === 'win32') {
          try {
            console.log('[FS] Attempting PowerShell Remove-Item as fallback');
            // Use spawn with detached:true to create independent process
            const result = await new Promise<boolean>((resolve) => {
              const ps = spawn(
                'powershell.exe',
                [
                  '-Command',
                  `Remove-Item -Path '${dirPath}' -Recurse -Force -ErrorAction SilentlyContinue`,
                ],
                { detached: true, shell: false, stdio: 'ignore' }
              );
              ps.unref(); // Let the process run independently
              // Give it time to execute
              setTimeout(() => {
                // Check if directory still exists
                fs.access(dirPath)
                  .then(() => resolve(false)) // Still exists
                  .catch(() => resolve(true)); // Deleted successfully
              }, 2000);
            });
            if (result) {
              return { success: true };
            }
            console.log('[FS] PowerShell fallback did not delete directory');
          } catch (psError) {
            console.error('[FS] PowerShell fallback also failed:', psError);
          }
        }
        console.error('[FS] Failed to remove directory:', errorMessage);
        break;
      }
    }
  }

  return { success: false, error: lastError };
}

/**
 * Run a script in the background without spawning a terminal UI.
 * @param cwd - Working directory to run the script in
 * @param script - The script/command to run
 * @param envVars - Optional environment variables to set
 * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
 * @returns Result with success status and output
 */
/**
 * Returns the system default shell for the current platform.
 */
function getSystemDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * Gets the appropriate command-line args to execute a script with the given shell.
 */
function getScriptArgs(shellPath: string, script: string): string[] {
  const shellName = path
    .basename(shellPath)
    .toLowerCase()
    .replace(/\.exe$/, '');

  switch (shellName) {
    case 'powershell':
    case 'pwsh':
      return ['-NoProfile', '-Command', script];
    case 'cmd':
      return ['/c', script];
    case 'fish':
      return ['-c', script];
    case 'bash':
    case 'zsh':
    case 'sh':
    case 'dash':
    case 'ksh':
    case 'tcsh':
    case 'csh':
    default:
      // For bash-like shells, use login shell
      return ['-l', '-c', script];
  }
}

/**
 * Resolves which shell to use based on user settings.
 */
async function resolveShellForScript(): Promise<{ shell: string; shellInfo?: ShellInfo }> {
  const systemDefault = getSystemDefaultShell();

  try {
    const appState = await loadAppState();
    const settings = appState.settings;

    // If no shell configured, use system default
    if (!settings.defaultShell) {
      return { shell: systemDefault };
    }

    // Look for the shell in custom shells first
    let shellInfo: ShellInfo | undefined = settings.customShells.find(
      (s) => s.id === settings.defaultShell
    );

    // If not found in custom shells, check detected shells
    if (!shellInfo) {
      const detectedShells = await detectAvailableShells();
      shellInfo = detectedShells.find((s) => s.id === settings.defaultShell);
    }

    // If shell not found, fall back to system default
    if (!shellInfo) {
      return { shell: systemDefault };
    }

    // Validate that the shell path still exists and is executable
    const validation = await validateShellPath(shellInfo.path);
    if (!validation.valid) {
      return { shell: systemDefault };
    }

    return { shell: shellInfo.path, shellInfo };
  } catch {
    // If anything fails, fall back to system default
    return { shell: systemDefault };
  }
}

export async function runScript(
  cwd: string,
  script: string,
  envVars?: Record<string, string>,
  timeoutMs = 30000
): Promise<{ success: boolean; output?: string; error?: string }> {
  // Resolve the user's preferred shell
  const { shell } = await resolveShellForScript();
  const args = getScriptArgs(shell, script);

  return new Promise((resolve) => {
    const env = { ...process.env, ...envVars };

    const scriptProcess = spawn(shell, args, {
      cwd,
      env,
    });

    let stdout = '';
    let stderr = '';

    scriptProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    scriptProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      scriptProcess.kill('SIGTERM');
      resolve({
        success: false,
        error: `Script timed out after ${timeoutMs}ms`,
        output: stdout + stderr,
      });
    }, timeoutMs);

    scriptProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({
          success: false,
          error: stderr || `Script exited with code ${code}`,
          output: stdout,
        });
      }
    });

    scriptProcess.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `Failed to spawn script: ${err.message}`,
      });
    });
  });
}

/**
 * Initialize a Git repository in a folder and create an initial commit.
 * @param folderPath - Path to the folder to initialize
 * @returns GitOperationResult with success status
 */
export async function initGitRepo(folderPath: string): Promise<GitOperationResult> {
  try {
    // Initialize git repository
    await execAsync('git init', { cwd: folderPath });

    // Create an initial empty commit
    await execAsync('git commit --allow-empty -m "Initial commit"', { cwd: folderPath });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to initialize git repository';
    console.error('[Git] Failed to init repo:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Execute a command with a timeout using spawn.
 * Rejects if the command takes longer than timeoutMs.
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Spawn options
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise with stdout
 */
export function execWithTimeout(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
  timeoutMs = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(command, args, {
      ...options,
      shell: false,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return; // Already rejected
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (!timedOut) {
        reject(err);
      }
    });
  });
}

/**
 * Check if the gh CLI is available and authenticated.
 * @returns true if gh is available and authenticated
 */
export async function isGhCliAvailable(): Promise<boolean> {
  try {
    await execWithTimeout('gh', ['auth', 'status'], {}, 10000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the gh CLI is authenticated and return detailed status.
 * @returns CheckGhAuthResult with authenticated status and optional error message
 */
export async function checkGhAuth(): Promise<import('../shared/types').CheckGhAuthResult> {
  try {
    await execWithTimeout('gh', ['auth', 'status'], {}, 10000);
    return { authenticated: true };
  } catch (error) {
    // Check if gh is not installed
    if (
      error instanceof Error &&
      (error.message.includes('ENOENT') || error.message.includes('not found'))
    ) {
      return {
        authenticated: false,
        error: 'GitHub CLI not found. Install it from https://cli.github.com',
      };
    }
    // gh is installed but not authenticated
    return {
      authenticated: false,
      error: 'Not logged in to GitHub. Run `gh auth login` in your terminal.',
    };
  }
}

/**
 * List GitHub repositories accessible to the authenticated user.
 * @returns ListGitHubReposResult with repos array and optional error message
 */
export async function listGitHubRepos(): Promise<import('../shared/types').ListGitHubReposResult> {
  try {
    const stdout = await execWithTimeout(
      'gh',
      [
        'repo',
        'list',
        '--json',
        'nameWithOwner,url,description,isPrivate,updatedAt',
        '--limit',
        '100',
      ],
      {},
      30000 // 30 second timeout for network operation
    );

    const repos = JSON.parse(stdout) as import('../shared/types').GitHubRepo[];
    return { repos };
  } catch (error) {
    // Check if gh is not installed
    if (
      error instanceof Error &&
      (error.message.includes('ENOENT') || error.message.includes('not found'))
    ) {
      return {
        repos: [],
        error: 'GitHub CLI not found. Install it from https://cli.github.com',
      };
    }
    // Check for auth error
    if (error instanceof Error && error.message.includes('auth')) {
      return {
        repos: [],
        error: 'Not logged in to GitHub. Run `gh auth login` in your terminal.',
      };
    }
    // Network or other error
    return {
      repos: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch repositories. Check your internet connection.',
    };
  }
}

/**
 * Parse repository owner/name from a GitHub remote URL.
 * Supports both HTTPS and SSH formats.
 * @param url - Remote URL (e.g., https://github.com/owner/repo.git or git@github.com:owner/repo.git)
 * @returns owner/repo string or null if not a GitHub URL
 */
export function parseGitHubRepo(url: string): string | null {
  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  return null;
}

/**
 * Batch an array into chunks of a given size.
 */
export function batchArray<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * Build a GraphQL query to fetch open PRs for multiple repositories.
 * Fetches at most 10 open PRs per repo (sorted by most recently updated).
 * @param repos - Array of owner/repo strings
 * @returns GraphQL query string
 */
export function buildPRStatusQuery(repos: string[]): string {
  const repoQueries = repos
    .map((repo, index) => {
      const [owner, name] = repo.split('/');
      return `
    repo${index}: repository(owner: "${owner}", name: "${name}") {
      pullRequests(first: 10, states: [OPEN, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          headRefName
          state
          url
          number
          mergedAt
        }
      }
    }`;
    })
    .join('\n');

  return `query { ${repoQueries} }`;
}

/**
 * Parse the GraphQL response into a PRStatusMap.
 * @param response - Raw JSON response from gh api graphql
 * @param repos - Array of owner/repo strings (in same order as query)
 * @returns PRStatusMap keyed by branch name
 */
export function parsePRStatusResponse(
  response: Record<string, unknown>,
  repos: string[]
): import('../shared/types').PRStatusMap {
  const result: import('../shared/types').PRStatusMap = {};
  const data = response.data as Record<string, unknown> | undefined;
  if (!data) return result;

  repos.forEach((repo, index) => {
    const repoData = data[`repo${index}`] as { pullRequests?: { nodes?: unknown[] } } | undefined;
    const prs = repoData?.pullRequests?.nodes as
      | Array<{
          headRefName: string;
          state: import('../shared/types').PRState;
          url: string;
          number: number;
          mergedAt: string | null;
        }>
      | undefined;
    if (!prs) return;

    for (const pr of prs) {
      // Only store one PR per branch (first one is most recently updated)
      if (!result[pr.headRefName]) {
        result[pr.headRefName] = {
          headRefName: pr.headRefName,
          state: pr.state,
          url: pr.url,
          number: pr.number,
          mergedAt: pr.mergedAt,
          repository: repo,
        };
      }
    }
  });

  return result;
}

/**
 * Get PR statuses for multiple repositories using gh CLI.
 * Batches repos into groups of 5 to avoid GraphQL query size limits.
 * @param repos - Array of owner/repo strings
 * @returns PRStatusMap keyed by branch name
 */
export async function getPRStatuses(
  repos: string[]
): Promise<import('../shared/types').PRStatusMap> {
  if (repos.length === 0) {
    return {};
  }

  // Deduplicate repos
  const uniqueRepos = [...new Set(repos)];

  // Batch into groups of 5
  const batches = batchArray(uniqueRepos, 5);
  const results: import('../shared/types').PRStatusMap = {};

  for (const batch of batches) {
    try {
      const query = buildPRStatusQuery(batch);
      const stdout = await execWithTimeout(
        'gh',
        ['api', 'graphql', '-f', `query=${query}`],
        {},
        10000
      );
      const response = JSON.parse(stdout) as Record<string, unknown>;
      const batchResult = parsePRStatusResponse(response, batch);
      Object.assign(results, batchResult);
    } catch (error) {
      console.error('[Git] Failed to fetch PR statuses for batch:', batch, error);
      // Continue with other batches even if one fails
    }
  }

  return results;
}

export function setupGitIpcHandlers(ipcMain: IpcMain): void {
  // Note: For commitWithOutput, we use event.sender.send to stream output back to renderer
  ipcMain.handle('git:clearCache', (_, repoPath: string) => {
    clearSimpleGitCache(repoPath);
  });

  ipcMain.handle('git:isRepo', async (_, folderPath: string) => {
    return isGitRepo(folderPath);
  });

  ipcMain.handle('git:initRepo', async (_, folderPath: string) => {
    return initGitRepo(folderPath);
  });

  ipcMain.handle('git:getStatus', async (_, repoPath: string) => {
    return getGitStatus(repoPath);
  });

  ipcMain.handle('git:listBranches', async (_, repoPath: string) => {
    return listBranches(repoPath);
  });

  ipcMain.handle('git:fetchBranches', async (_, repoPath: string) => {
    return fetchBranches(repoPath);
  });

  ipcMain.handle(
    'git:createWorktree',
    async (
      _,
      repoPath: string,
      taskName: string,
      basePath: string | null,
      sourceBranch?: string
    ) => {
      return createWorktree(repoPath, taskName, basePath, sourceBranch);
    }
  );

  ipcMain.handle(
    'git:removeWorktree',
    async (_, worktreePath: string, prune: boolean, branchName?: string) => {
      return removeWorktree(worktreePath, prune, branchName);
    }
  );

  ipcMain.handle('git:listWorktrees', async (_, repoPath: string) => {
    return listWorktrees(repoPath);
  });

  ipcMain.handle('git:getWorktreeInfo', async (_, worktreePath: string) => {
    return getWorktreeInfo(worktreePath);
  });

  ipcMain.handle('git:detectWorktree', async (_, folderPath: string) => {
    return detectWorktree(folderPath);
  });

  ipcMain.handle('git:isWorktreeDirty', async (_, worktreePath: string) => {
    return isWorktreeDirty(worktreePath);
  });

  ipcMain.handle('git:isBareRepo', async (_, repoPath: string) => {
    return isBareRepo(repoPath);
  });

  ipcMain.handle(
    'git:forceRemoveWorktree',
    async (_, repoPath: string, worktreePath: string, branchName?: string) => {
      return forceRemoveWorktree(repoPath, worktreePath, branchName);
    }
  );

  ipcMain.handle('fs:pathExists', async (_, filePath: string) => {
    return pathExists(filePath);
  });

  ipcMain.handle(
    'fs:getFileLines',
    async (_, filePath: string, startLine: number, endLine: number) => {
      return getFileLines(filePath, startLine, endLine);
    }
  );

  ipcMain.handle('fs:getFileLineCount', async (_, filePath: string) => {
    return getFileLineCount(filePath);
  });

  ipcMain.handle('git:cloneRepository', async (_, url: string, destPath: string) => {
    return cloneRepository(url, destPath);
  });

  ipcMain.handle(
    'git:getDiff',
    async (_, repoPath: string, baseBranch: string, compareBranch: string) => {
      return getDiff(repoPath, baseBranch, compareBranch);
    }
  );

  ipcMain.handle(
    'git:getFileDiff',
    async (_, repoPath: string, baseBranch: string, compareBranch: string, filePath: string) => {
      return getFileDiff(repoPath, baseBranch, compareBranch, filePath);
    }
  );

  ipcMain.handle('git:getCommitHash', async (_, repoPath: string, branch: string) => {
    return getCommitHash(repoPath, branch);
  });

  ipcMain.handle('git:getDefaultBranch', async (_, repoPath: string) => {
    return getDefaultBranch(repoPath);
  });

  ipcMain.handle('git:getCurrentBranch', async (_, repoPath: string) => {
    return getCurrentBranch(repoPath);
  });

  ipcMain.handle('git:getWorkingTreeDiff', async (_, repoPath: string) => {
    return getWorkingTreeDiff(repoPath);
  });

  ipcMain.handle('git:getWorkingTreeStats', async (_, repoPath: string) => {
    return getWorkingTreeStats(repoPath);
  });

  ipcMain.handle(
    'git:getSingleWorkingTreeFileDiff',
    async (_, repoPath: string, filePath: string) => {
      return getSingleWorkingTreeFileDiff(repoPath, filePath);
    }
  );

  // Source control operations
  ipcMain.handle('git:getFileStatuses', async (_, repoPath: string) => {
    return getFileStatuses(repoPath);
  });

  ipcMain.handle('git:stageFiles', async (_, repoPath: string, files: string[]) => {
    return stageFiles(repoPath, files);
  });

  ipcMain.handle('git:stageAll', async (_, repoPath: string) => {
    return stageAll(repoPath);
  });

  ipcMain.handle('git:unstageFiles', async (_, repoPath: string, files: string[]) => {
    return unstageFiles(repoPath, files);
  });

  ipcMain.handle('git:unstageAll', async (_, repoPath: string) => {
    return unstageAll(repoPath);
  });

  ipcMain.handle(
    'git:discardFiles',
    async (_, repoPath: string, files: string[], untracked: string[]) => {
      return discardFiles(repoPath, files, untracked);
    }
  );

  ipcMain.handle('git:discardAll', async (_, repoPath: string) => {
    return discardAll(repoPath);
  });

  ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
    return commit(repoPath, message);
  });

  ipcMain.handle('git:push', async (_, repoPath: string) => {
    return push(repoPath);
  });

  ipcMain.handle('git:pull', async (_, repoPath: string) => {
    return pull(repoPath);
  });

  ipcMain.handle('git:getAheadBehind', async (_, repoPath: string) => {
    return getAheadBehind(repoPath);
  });

  ipcMain.handle('git:getRemoteUrl', async (_, repoPath: string, remoteName?: string) => {
    return getRemoteUrl(repoPath, remoteName);
  });

  ipcMain.handle('git:addRemote', async (_, repoPath: string, name: string, url: string) => {
    return addRemote(repoPath, name, url);
  });

  ipcMain.handle('git:hasPreCommitHooks', async (_, repoPath: string) => {
    return hasPreCommitHooks(repoPath);
  });

  ipcMain.handle('git:getHookManifest', async (_, repoPath: string) => {
    return getHookManifest(repoPath);
  });

  ipcMain.handle('git:commitWithOutput', async (event, repoPath: string, message: string) => {
    return commitWithOutput(repoPath, message, (line) => {
      // Stream each line of output back to the renderer, scoped by repoPath
      event.sender.send('git:commit-output', repoPath, line);
    });
  });

  ipcMain.handle('git:commitWithHooks', async (event, repoPath: string, message: string) => {
    return commitWithHooks(repoPath, message, (line, phase, hook) => {
      // Stream each line of output with phase and hook info back to the renderer
      event.sender.send('git:operation-output', repoPath, line, phase, hook);
    });
  });

  ipcMain.handle('git:pushWithHooks', async (event, repoPath: string) => {
    return pushWithHooks(repoPath, (line, phase, hook) => {
      // Stream each line of output with phase and hook info back to the renderer
      event.sender.send('git:operation-output', repoPath, line, phase, hook);
    });
  });

  ipcMain.handle('git:abortOperation', async (_, repoPath: string) => {
    return abortOperation(repoPath);
  });

  ipcMain.handle('fs:removeDirectory', async (_, dirPath: string) => {
    return removeDirectory(dirPath);
  });

  ipcMain.handle(
    'fs:runScript',
    async (
      _,
      cwd: string,
      script: string,
      envVars?: Record<string, string>,
      timeoutMs?: number
    ) => {
      return runScript(cwd, script, envVars, timeoutMs);
    }
  );

  // PR status operations (gh CLI)
  ipcMain.handle('git:isGhCliAvailable', async () => {
    return isGhCliAvailable();
  });

  ipcMain.handle('git:getPRStatuses', async (_, repos: string[]) => {
    return getPRStatuses(repos);
  });

  // GitHub repo operations (gh CLI)
  ipcMain.handle('git:checkGhAuth', async () => {
    return checkGhAuth();
  });

  ipcMain.handle('git:listGitHubRepos', async () => {
    return listGitHubRepos();
  });
}
