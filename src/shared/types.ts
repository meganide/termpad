// Auto-update types
export type UpdateStatusType =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateStatus {
  status: UpdateStatusType;
  currentVersion: string;
  availableVersion: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  releaseNotes?: string;
  supportsAutoUpdate: boolean;
}

export interface UpdaterAPI {
  checkForUpdates(): Promise<UpdateStatus>;
  downloadUpdate(): Promise<void>;
  installUpdate(): void;
  getStatus(): Promise<UpdateStatus>;
  dismissUpdate(): void;
  onStatusChange(callback: (status: UpdateStatus) => void): () => void;
}

// Repository script configuration
export interface RepositoryScript {
  id: string;
  name: string;
  command: string;
}

export interface RepositoryScriptsConfig {
  setupScript: string | null;
  runScripts: RepositoryScript[];
  cleanupScript: string | null;
  exclusiveMode: boolean;
  lastUsedRunScriptId: string | null;
}

// Persisted user terminal tab state per worktree (parallel to WorktreeTabState)
export interface UserTerminalTabState {
  worktreeSessionId: string;
  tabs: TerminalTab[];
  activeTabId: string | null; // Persisted - restored on app restart
  tabScrollPosition?: number; // Horizontal scroll position of tab bar
}

// App State persisted to JSON
export interface AppState {
  version: number;
  settings: AppSettings;
  repositories: Repository[];
  window: WindowState;
}

// Worktree info from git worktree list
export interface WorktreeInfo {
  path: string; // Full path to worktree directory
  branch: string; // Branch name (e.g., 'feature/foo')
  head: string; // Current commit SHA
  isMain: boolean; // True if this is the main working tree
  isBare: boolean; // True if parent repo is bare
  isLocked: boolean; // True if worktree is locked
  prunable: boolean; // True if worktree can be pruned (missing directory)
}

export interface NotificationSettings {
  enabled: boolean; // default: true
  backgroundOnly: boolean; // default: true - only notify when window not focused
  cooldownMs: number; // default: 8000 - minimum time between notifications
}

// Shell configuration for default terminal settings
export interface ShellInfo {
  id: string; // Unique identifier (e.g., 'powershell', 'wsl-ubuntu')
  name: string; // Display name (e.g., 'PowerShell', 'Ubuntu (WSL)')
  path: string; // Executable path
  args?: string[]; // Default arguments (e.g., ['-d', 'Ubuntu'] for WSL)
  icon: string; // Icon identifier for lookup
  isCustom?: boolean; // True if user-added
}

// Terminal preset for quick terminal creation
export interface TerminalPreset {
  id: string; // Unique identifier (e.g., 'preset-1234567890-abc')
  name: string; // Display name (e.g., 'Claude', 'Gemini')
  command: string; // Command to run (e.g., 'claude', 'gemini'), empty = plain shell
  icon: string; // Icon name from preset list (e.g., 'sparkles', 'bot')
  isBuiltIn?: boolean; // True only for "Terminal" (cannot edit/delete)
  order: number; // Display order (0 = top)
}

export interface AppSettings {
  worktreeBasePath: string | null; // null = use sibling folder
  gitPollIntervalMs: number; // default: 5000
  notifications: NotificationSettings;
  preferredEditor: 'cursor' | 'vscode' | 'folder'; // default: 'cursor'
  defaultShell: string | null; // Shell ID or null for system default
  customShells: ShellInfo[]; // User-added custom shells
  terminalPresets: TerminalPreset[]; // User's terminal presets
  defaultPresetId: string | null; // ID of default preset, null = "Terminal"
  suppressCloseWarning?: boolean; // default: false - skip warning when closing with active terminals
  suppressDiscardWarning?: boolean; // default: false - skip warning when discarding changes
}

export interface CustomShortcut {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface WorktreeSession {
  id: string;
  label: string; // Worktree task name
  path: string; // Full path to worktree folder
  branchName?: string; // For git projects
  worktreeName?: string; // Worktree name
  createdAt: string;
  isExternal: boolean; // True if discovered externally (not created by app)
  customShortcut?: CustomShortcut; // Custom keyboard shortcut object
  portOffset?: number; // Offset within repo's port range (0-99), assigned on creation
  isMainWorktree?: boolean; // True if this is the main worktree session (always first, cannot be deleted)
  notes?: string; // User notes for this worktree
}

// Individual terminal tab within a worktree
export interface TerminalTab {
  id: string; // Unique ID (e.g., uuid)
  name: string; // Display name (editable, default: command name)
  createdAt: string; // ISO timestamp
  order: number; // Position in tab bar (for ordering)
  scriptId?: string; // ID of the script this tab is running (for exclusive mode)
  command?: string; // Command to auto-run on terminal start (e.g., 'claude', 'gemini')
  icon?: string; // Icon name from preset list (e.g., 'sparkles', 'bot')
}

// Persisted tab state per worktree
export interface WorktreeTabState {
  worktreeSessionId: string; // Links to WorktreeSession
  tabs: TerminalTab[]; // Ordered list of tabs
  activeTabId: string | null; // Currently selected tab
  tabScrollPosition?: number; // Horizontal scroll position of tab bar
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  isBare: boolean; // True if repo is bare
  isExpanded: boolean;
  worktreeSessions: WorktreeSession[];
  createdAt: string;
  scriptsConfig?: RepositoryScriptsConfig; // Optional scripts configuration
  portRangeStart?: number; // Base port for this repo (e.g., 10000), assigned on creation
  notes?: string; // User notes for this repository
}

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
  sidebarWidth: number;
  fileChangesPaneWidth: number;
  userTerminalPanelRatio: number; // 0-1, default 0.5 (ratio of user terminal section in right panel)
}

// Focus area for keyboard navigation
// - 'mainTerminal': Main (Claude) terminal is focused, captures keyboard input
// - 'userTerminal': User terminal is focused, captures keyboard input
// - 'sidebar': Sidebar is focused, allows keyboard navigation
// - 'app': Neither terminal nor sidebar captures keyboard input (e.g., when on add worktree screen)
export type FocusArea = 'mainTerminal' | 'userTerminal' | 'sidebar' | 'app';

// Status indicator focus state for keyboard navigation within sidebar
export interface SidebarStatusFocus {
  worktreeSessionId: string; // Which worktree's status indicators are being navigated
  indicatorIndex: number; // Which indicator is focused (0-based)
}

// Runtime State (React Context/Store)
export type TerminalStatus = 'starting' | 'running' | 'waiting' | 'idle' | 'stopped' | 'error';

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  additions: number;
  deletions: number;
}

export interface TerminalState {
  id: string; // matches Session.id
  status: TerminalStatus;
  gitStatus?: GitStatus;
  lastActivityTime: number; // Timestamp of last activity (for cooldown logic)
  hasReceivedOutput: boolean; // True if terminal has received any output
}

export interface AppRuntimeState {
  terminals: Map<string, TerminalState>;
  activeTerminalId: string | null;
}

// Branch info from git branch -a
export interface BranchInfo {
  name: string; // Branch name (e.g., 'main', 'feature/foo')
  isRemote: boolean; // True if remote branch (e.g., 'origin/main')
  isCurrent: boolean; // True if this is the current branch
  isDefault: boolean; // True if this is main/master
  remoteName?: string; // Remote name if isRemote (e.g., 'origin')
}

// Git operation results
export interface WorktreeResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface RemoveWorktreeResult {
  success: boolean;
  error?: string;
}

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

// File lines result for hunk expansion
export interface GetFileLinesResult {
  lines: string[];
  error?: string;
}

// File line count result
export interface GetFileLineCountResult {
  lineCount: number;
  error?: string;
}

// Source control types
export type FileChangeType = 'modified' | 'added' | 'deleted' | 'renamed';

export interface FileStatus {
  path: string;
  type: FileChangeType;
  oldPath?: string; // for renames
  additions: number;
  deletions: number;
}

export interface FileStatusResult {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

export interface GitOperationResult {
  success: boolean;
  error?: string;
}

export interface CommitResult {
  success: boolean;
  commitHash?: string;
  error?: string;
}

// Extended hook support types
export type GitHookType = 'pre-commit' | 'commit-msg' | 'post-commit' | 'pre-push' | 'post-push';
export type GitOperationType = 'commit' | 'push';

// Which hooks exist in a repository
export interface HookManifest {
  'pre-commit': boolean;
  'commit-msg': boolean;
  'post-commit': boolean;
  'pre-push': boolean;
  'post-push': boolean;
}

// Unified progress status for all git operations with hooks
export type OperationProgressStatus =
  | 'idle'
  | 'checking-hooks'
  | 'running-hook'
  | 'executing'
  | 'success'
  | 'error';

// Unified progress tracking for commit and push operations
export interface OperationProgress {
  status: OperationProgressStatus;
  operationType: GitOperationType | null;
  currentHook: GitHookType | null;
  output: string[];
  error?: string;
  hookManifest?: HookManifest;
  // For post-hook failures: the operation succeeded but the hook failed
  operationSucceeded?: boolean;
}

// Result type for operations that run hooks
export interface OperationWithHooksResult {
  success: boolean;
  commitHash?: string; // For commit operations
  error?: string;
  output: string[];
  // True if operation completed but a post-hook failed
  postHookFailed?: boolean;
  failedHook?: GitHookType;
  // True if main operation succeeded (even if post-hook failed)
  operationSucceeded?: boolean;
}

export interface CommitWithOutputResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  output: string[];
}

export interface AheadBehindResult {
  ahead: number;
  behind: number;
  hasRemote: boolean;
  remoteBranch?: string;
}

// PR Status types for gh CLI integration
export type PRState = 'OPEN' | 'CLOSED' | 'MERGED';

export interface PRStatus {
  headRefName: string; // Branch name
  state: PRState;
  url: string; // Full PR URL
  number: number; // PR number
  mergedAt: string | null; // ISO timestamp if merged
  repository: string; // owner/repo format
}

// Map from branch name to PR status
export type PRStatusMap = Record<string, PRStatus>;

// GitHub repo info from gh CLI
export interface GitHubRepo {
  nameWithOwner: string; // e.g., "anthropics/claude-code"
  url: string; // https clone URL
  description: string | null;
  isPrivate: boolean;
  updatedAt: string; // ISO date
}

// Result types for GitHub CLI operations
export interface CheckGhAuthResult {
  authenticated: boolean;
  error?: string;
}

export interface ListGitHubReposResult {
  repos: GitHubRepo[];
  error?: string;
}

export interface WorktreeDetectionResult {
  isWorktree: boolean;
  mainRepoPath: string | null;
}

// Built-in "Terminal" preset - always present, cannot be modified
export const NEW_TERMINAL_PRESET: TerminalPreset = {
  id: 'new-terminal',
  name: 'Terminal',
  command: '', // Empty = plain shell
  icon: 'terminal',
  isBuiltIn: true,
  order: 0,
};

// Default "Claude" preset - editable/deletable
export const CLAUDE_DEFAULT_PRESET: TerminalPreset = {
  id: 'claude-default',
  name: 'Claude',
  command: 'claude',
  icon: 'sparkles',
  order: 1,
};

// Default "Gemini" preset - editable/deletable
export const GEMINI_DEFAULT_PRESET: TerminalPreset = {
  id: 'gemini-default',
  name: 'Gemini',
  command: 'gemini',
  icon: 'star',
  order: 2,
};

// Default "Codex" preset - editable/deletable
export const CODEX_DEFAULT_PRESET: TerminalPreset = {
  id: 'codex-default',
  name: 'Codex',
  command: 'codex',
  icon: 'code',
  order: 3,
};

// Default state factory
export function getDefaultAppState(): AppState {
  return {
    version: 1,
    settings: {
      worktreeBasePath: null,
      gitPollIntervalMs: 5000,
      notifications: {
        enabled: true,
        backgroundOnly: true,
        cooldownMs: 8000,
      },
      preferredEditor: 'cursor',
      defaultShell: null,
      customShells: [],
      terminalPresets: [
        NEW_TERMINAL_PRESET,
        CLAUDE_DEFAULT_PRESET,
        GEMINI_DEFAULT_PRESET,
        CODEX_DEFAULT_PRESET,
      ],
      defaultPresetId: null, // null = "Terminal" is default
    },
    repositories: [],
    window: {
      width: 1400,
      height: 900,
      x: 100,
      y: 100,
      isMaximized: true,
      sidebarWidth: 300,
      fileChangesPaneWidth: 400,
      userTerminalPanelRatio: 0.5,
    },
  };
}

// Editor open result
export interface OpenEditorResult {
  success: boolean;
  error?: string;
}

// Open folder result
export interface OpenFolderResult {
  success: boolean;
  error?: string;
}

// Electron API types
export interface ElectronAPI {
  platform: 'darwin' | 'win32' | 'linux';
  ping: () => Promise<string>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  openDevTools: () => void;
  // Menu event listeners (from native application menu)
  onMenuSettings: (callback: () => void) => () => void;
  onMenuKeyboardShortcuts: (callback: () => void) => () => void;
  openInEditor: (
    filePath: string,
    editor: 'cursor' | 'vscode',
    workspacePath?: string
  ) => Promise<OpenEditorResult>;
  openExternal: (url: string) => Promise<void>;
  openFolder: (folderPath: string) => Promise<OpenFolderResult>;
}

// Import review types for the API
import type {
  DiffFile,
  GitDiffResult,
  WorkingTreeDiffResult,
  WorkingTreeStatsResult,
} from './reviewTypes';

export interface TerminalAPI {
  // Lifecycle
  spawn(sessionId: string, cwd: string, initialCommand?: string): Promise<void>;
  write(sessionId: string, data: string): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string, waitForExit?: boolean): Promise<void>;
  killAllForWorktree(worktreeSessionId: string): Promise<void>;
  waitForReady(terminalId: string, timeoutMs?: number): Promise<void>;
  getBuffer(terminalId: string): Promise<string>;

  // Events
  onData(sessionId: string, callback: (data: string) => void): () => void;
  onExit(sessionId: string, callback: (code: number, signal?: number) => void): () => void;
  onDistroSwitched(
    callback: (payload: {
      sessionId: string;
      fromDistro: string;
      toDistro: string;
      reason: string;
    }) => void
  ): () => void;
  onShellUnavailable(
    callback: (payload: { unavailableShellName: string; fallbackShellName: string }) => void
  ): () => void;

  // Git operations
  clearGitCache(repoPath: string): Promise<void>;
  isGitRepo(path: string): Promise<boolean>;
  getGitStatus(path: string): Promise<GitStatus | null>;
  listBranches(repoPath: string): Promise<BranchInfo[]>;
  fetchBranches(repoPath: string): Promise<void>;
  createWorktree(
    repoPath: string,
    taskName: string,
    basePath: string | null,
    sourceBranch?: string
  ): Promise<WorktreeResult>;
  removeWorktree(
    worktreePath: string,
    prune: boolean,
    branchName?: string
  ): Promise<RemoveWorktreeResult>;
  listWorktrees(repoPath: string): Promise<WorktreeInfo[]>;
  getWorktreeInfo(worktreePath: string): Promise<WorktreeInfo | null>;
  isWorktreeDirty(worktreePath: string): Promise<boolean>;
  isBareRepo(repoPath: string): Promise<boolean>;
  forceRemoveWorktree(repoPath: string, worktreePath: string, branchName?: string): Promise<void>;
  cloneRepository(url: string, destPath: string): Promise<CloneResult>;
  detectWorktree(folderPath: string): Promise<WorktreeDetectionResult>;
  initGitRepo(folderPath: string): Promise<GitOperationResult>;

  // Diff operations
  getDiff(repoPath: string, baseBranch: string, compareBranch: string): Promise<GitDiffResult>;
  getFileDiff(
    repoPath: string,
    baseBranch: string,
    compareBranch: string,
    filePath: string
  ): Promise<DiffFile | null>;
  getCommitHash(repoPath: string, branch: string): Promise<string>;
  getDefaultBranch(repoPath: string): Promise<string>;
  getCurrentBranch(repoPath: string): Promise<string>;
  getWorkingTreeDiff(repoPath: string): Promise<WorkingTreeDiffResult>;
  getWorkingTreeStats(repoPath: string): Promise<WorkingTreeStatsResult>;
  getSingleWorkingTreeFileDiff(repoPath: string, filePath: string): Promise<DiffFile | null>;

  // File system
  selectFolder(): Promise<string | null>;
  pathExists(path: string): Promise<boolean>;
  getBasename(filePath: string): string;
  getFileLines(filePath: string, startLine: number, endLine: number): Promise<GetFileLinesResult>;
  getFileLineCount(filePath: string): Promise<GetFileLineCountResult>;
  removeDirectory(dirPath: string): Promise<{ success: boolean; error?: string }>;
  runScript(
    cwd: string,
    script: string,
    envVars?: Record<string, string>,
    timeoutMs?: number
  ): Promise<{ success: boolean; output?: string; error?: string }>;

  // Source control operations
  getFileStatuses(repoPath: string): Promise<FileStatusResult>;
  stageFiles(repoPath: string, files: string[]): Promise<GitOperationResult>;
  stageAll(repoPath: string): Promise<GitOperationResult>;
  unstageFiles(repoPath: string, files: string[]): Promise<GitOperationResult>;
  unstageAll(repoPath: string): Promise<GitOperationResult>;
  discardFiles(repoPath: string, files: string[], untracked: string[]): Promise<GitOperationResult>;
  discardAll(repoPath: string): Promise<GitOperationResult>;
  commit(repoPath: string, message: string): Promise<CommitResult>;
  commitWithOutput(repoPath: string, message: string): Promise<CommitWithOutputResult>;
  hasPreCommitHooks(repoPath: string): Promise<boolean>;
  getHookManifest(repoPath: string): Promise<HookManifest>;
  commitWithHooks(repoPath: string, message: string): Promise<OperationWithHooksResult>;
  pushWithHooks(repoPath: string): Promise<OperationWithHooksResult>;
  abortOperation(repoPath: string): Promise<boolean>;
  onCommitOutput(callback: (repoPath: string, line: string) => void): () => void;
  onOperationOutput(
    callback: (
      repoPath: string,
      line: string,
      phase: OperationProgressStatus,
      hook?: GitHookType
    ) => void
  ): () => void;
  push(repoPath: string): Promise<GitOperationResult>;
  pull(repoPath: string): Promise<GitOperationResult>;
  getAheadBehind(repoPath: string): Promise<AheadBehindResult>;
  getRemoteUrl(repoPath: string, remoteName?: string): Promise<string | null>;
  addRemote(repoPath: string, name: string, url: string): Promise<GitOperationResult>;

  // PR status operations (gh CLI)
  isGhCliAvailable(): Promise<boolean>;
  getPRStatuses(repos: string[]): Promise<PRStatusMap>;

  // GitHub repo operations (gh CLI)
  checkGhAuth(): Promise<CheckGhAuthResult>;
  listGitHubRepos(): Promise<ListGitHubReposResult>;

  // App
  getAppDataPath(): Promise<string>;
  showNotification(title: string, body: string): void;
  onBeforeClose(callback: (activeCount: number) => void): () => void;
  confirmClose(): void;
  cancelClose(): void;

  // Shell configuration
  getAvailableShells(): Promise<ShellInfo[]>;
  validateShellPath(path: string): Promise<{ valid: boolean; error?: string }>;
  getResolvedShellName(): Promise<string>;
}

export interface StorageAPI {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
}

export interface WatcherAPI {
  startRepositoryWatch(repositoryId: string, repoPath: string): void;
  stopRepositoryWatch(repositoryId: string): Promise<void>;
  onWorktreeAdded(callback: (repositoryId: string, worktree: WorktreeInfo) => void): () => void;
  onWorktreeRemoved(
    callback: (repositoryId: string, worktreePath: string, isExternal: boolean) => void
  ): () => void;
  // Branch change watcher
  onBranchesChanged(callback: (repositoryId: string) => void): () => void;
  // Repository deletion watcher (triggered when repo folder is deleted externally)
  onRepositoryDeleted(callback: (repositoryId: string, repoPath: string) => void): () => void;
}

// Import ReviewData for the API
import type { ReviewData } from './reviewTypes';

export interface ReviewStorageAPI {
  save(review: ReviewData): Promise<void>;
  load(projectPath: string, reviewId: string): Promise<ReviewData | null>;
  delete(projectPath: string, reviewId: string): Promise<boolean>;
  list(projectPath: string): Promise<string[]>;
  loadAll(projectPath: string): Promise<ReviewData[]>;
  findByBranches(
    projectPath: string,
    baseBranch: string,
    compareBranch: string
  ): Promise<ReviewData | null>;
}

export interface NotificationPayload {
  worktreeSessionId: string;
  repositoryName: string;
  branchName?: string;
  state: TerminalStatus;
  tabId?: string; // Optional for backwards compatibility, identifies which tab triggered the notification
}

export interface NotificationAPI {
  trigger(payload: NotificationPayload): Promise<boolean>;
  setCooldown(ms: number): void;
  focusWorktreeSession(worktreeSessionId: string, tabId?: string): void;
  onSwitchWorktreeSession(
    callback: (worktreeSessionId: string, tabId?: string) => void
  ): () => void;
}

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

export interface DialogAPI {
  saveFile(options: SaveFileOptions): Promise<SaveFileResult>;
}

// Import review types for DiffWindowAPI
import type { ReviewSession } from './reviewTypes';

export interface DiffWindowInitData {
  currentReview: ReviewSession;
  reviewData: ReviewData;
  projectPath: string;
  selectedFile: string | null;
}

export interface DiffWindowAPI {
  open(initData: DiffWindowInitData): Promise<{ success: boolean; error?: string }>;
  getInitialData(): Promise<DiffWindowInitData | null>;
  close(): void;
  notifyReviewDataChanged(reviewData: ReviewData): void;
  onReviewDataUpdate(callback: (reviewData: ReviewData) => void): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    terminal: TerminalAPI;
    storage: StorageAPI;
    watcher: WatcherAPI;
    reviewStorage: ReviewStorageAPI;
    notifications: NotificationAPI;
    dialog: DialogAPI;
    diffWindow: DiffWindowAPI;
    updater: UpdaterAPI;
  }
}
