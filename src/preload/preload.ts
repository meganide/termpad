import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  TerminalAPI,
  StorageAPI,
  WatcherAPI,
  ReviewStorageAPI,
  NotificationAPI,
  NotificationPayload,
  AppState,
  WorktreeInfo,
  DialogAPI,
  SaveFileOptions,
  OpenEditorResult,
  OpenFolderResult,
  ShellInfo,
  CheckGhAuthResult,
  ListGitHubReposResult,
  OperationProgressStatus,
  GitHookType,
  UpdaterAPI,
  UpdateStatus,
} from '../shared/types';
import type { ReviewData, ReviewSession } from '../shared/reviewTypes';
import path from 'path';

// Diff window init data type
interface DiffWindowInitData {
  currentReview: ReviewSession;
  reviewData: ReviewData;
  projectPath: string;
  selectedFile: string | null;
}

// Diff window API type
interface DiffWindowAPI {
  open: (initData: DiffWindowInitData) => Promise<{ success: boolean; error?: string }>;
  getInitialData: () => Promise<DiffWindowInitData | null>;
  close: () => void;
  notifyReviewDataChanged: (reviewData: ReviewData) => void;
  onReviewDataUpdate: (callback: (reviewData: ReviewData) => void) => () => void;
}

console.log('[Preload] Script loading...');

const electronAPI: ElectronAPI = {
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  ping: () => ipcRenderer.invoke('ping'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window-maximized-change', handler);
    return () => ipcRenderer.removeListener('window-maximized-change', handler);
  },
  openDevTools: () => ipcRenderer.send('open-devtools'),
  // Menu event listeners
  onMenuSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:settings', handler);
    return () => ipcRenderer.removeListener('menu:settings', handler);
  },
  onMenuKeyboardShortcuts: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:keyboardShortcuts', handler);
    return () => ipcRenderer.removeListener('menu:keyboardShortcuts', handler);
  },
  openInEditor: (
    filePath: string,
    editor: 'cursor' | 'vscode',
    workspacePath?: string
  ): Promise<OpenEditorResult> =>
    ipcRenderer.invoke('editor:openPath', filePath, editor, workspacePath),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  openFolder: (folderPath: string): Promise<OpenFolderResult> =>
    ipcRenderer.invoke('shell:openFolder', folderPath),
};

const terminalAPI: TerminalAPI = {
  // Lifecycle
  spawn: (sessionId, cwd, initialCommand) =>
    ipcRenderer.invoke('terminal:spawn', sessionId, cwd, initialCommand),
  write: (sessionId, data) => ipcRenderer.send('terminal:write', sessionId, data),
  resize: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', sessionId, cols, rows),
  kill: (sessionId, waitForExit) => ipcRenderer.invoke('terminal:kill', sessionId, waitForExit),
  killAllForWorktree: (worktreeSessionId) =>
    ipcRenderer.invoke('terminal:killAllForWorktree', worktreeSessionId),
  waitForReady: (terminalId, timeoutMs) =>
    ipcRenderer.invoke('terminal:waitForReady', terminalId, timeoutMs),
  getBuffer: (terminalId) => ipcRenderer.invoke('terminal:getBuffer', terminalId),
  saveClipboardImage: (imageData, format) =>
    ipcRenderer.invoke('clipboard:saveImage', imageData, format),

  // Events
  onData: (sessionId, callback) => {
    const handler = (_: unknown, id: string, data: string) => {
      if (id === sessionId) callback(data);
    };
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onExit: (sessionId, callback) => {
    const handler = (_: unknown, id: string, code: number, signal?: number) => {
      if (id === sessionId) callback(code, signal);
    };
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },
  onDistroSwitched: (
    callback: (payload: {
      sessionId: string;
      fromDistro: string;
      toDistro: string;
      reason: string;
    }) => void
  ) => {
    const handler = (
      _: unknown,
      payload: { sessionId: string; fromDistro: string; toDistro: string; reason: string }
    ) => {
      callback(payload);
    };
    ipcRenderer.on('terminal:distro-switched', handler);
    return () => ipcRenderer.removeListener('terminal:distro-switched', handler);
  },
  onShellUnavailable: (
    callback: (payload: { unavailableShellName: string; fallbackShellName: string }) => void
  ) => {
    const handler = (
      _: unknown,
      payload: { unavailableShellName: string; fallbackShellName: string }
    ) => {
      callback(payload);
    };
    ipcRenderer.on('terminal:shell-unavailable', handler);
    return () => ipcRenderer.removeListener('terminal:shell-unavailable', handler);
  },

  // Git operations
  clearGitCache: (repoPath) => ipcRenderer.invoke('git:clearCache', repoPath),
  isGitRepo: (folderPath) => ipcRenderer.invoke('git:isRepo', folderPath),
  getGitStatus: (repoPath) => ipcRenderer.invoke('git:getStatus', repoPath),
  listBranches: (repoPath) => ipcRenderer.invoke('git:listBranches', repoPath),
  fetchBranches: (repoPath) => ipcRenderer.invoke('git:fetchBranches', repoPath),
  createWorktree: (repoPath, taskName, basePath, sourceBranch) =>
    ipcRenderer.invoke('git:createWorktree', repoPath, taskName, basePath, sourceBranch),
  removeWorktree: (worktreePath, prune, branchName) =>
    ipcRenderer.invoke('git:removeWorktree', worktreePath, prune, branchName),
  listWorktrees: (repoPath) => ipcRenderer.invoke('git:listWorktrees', repoPath),
  getWorktreeInfo: (worktreePath) => ipcRenderer.invoke('git:getWorktreeInfo', worktreePath),
  isWorktreeDirty: (worktreePath) => ipcRenderer.invoke('git:isWorktreeDirty', worktreePath),
  isBareRepo: (repoPath) => ipcRenderer.invoke('git:isBareRepo', repoPath),
  forceRemoveWorktree: (repoPath, worktreePath, branchName) =>
    ipcRenderer.invoke('git:forceRemoveWorktree', repoPath, worktreePath, branchName),
  cloneRepository: (url, destPath) => ipcRenderer.invoke('git:cloneRepository', url, destPath),
  detectWorktree: (folderPath) => ipcRenderer.invoke('git:detectWorktree', folderPath),
  initGitRepo: (folderPath) => ipcRenderer.invoke('git:initRepo', folderPath),

  // Diff operations
  getDiff: (repoPath, baseBranch, compareBranch) =>
    ipcRenderer.invoke('git:getDiff', repoPath, baseBranch, compareBranch),
  getFileDiff: (repoPath, baseBranch, compareBranch, filePath) =>
    ipcRenderer.invoke('git:getFileDiff', repoPath, baseBranch, compareBranch, filePath),
  getCommitHash: (repoPath, branch) => ipcRenderer.invoke('git:getCommitHash', repoPath, branch),
  getDefaultBranch: (repoPath) => ipcRenderer.invoke('git:getDefaultBranch', repoPath),
  getCurrentBranch: (repoPath) => ipcRenderer.invoke('git:getCurrentBranch', repoPath),
  getWorkingTreeDiff: (repoPath) => ipcRenderer.invoke('git:getWorkingTreeDiff', repoPath),
  getWorkingTreeStats: (repoPath) => ipcRenderer.invoke('git:getWorkingTreeStats', repoPath),
  getSingleWorkingTreeFileDiff: (repoPath, filePath) =>
    ipcRenderer.invoke('git:getSingleWorkingTreeFileDiff', repoPath, filePath),

  // Source control operations
  getFileStatuses: (repoPath) => ipcRenderer.invoke('git:getFileStatuses', repoPath),
  stageFiles: (repoPath, files) => ipcRenderer.invoke('git:stageFiles', repoPath, files),
  stageAll: (repoPath) => ipcRenderer.invoke('git:stageAll', repoPath),
  unstageFiles: (repoPath, files) => ipcRenderer.invoke('git:unstageFiles', repoPath, files),
  unstageAll: (repoPath) => ipcRenderer.invoke('git:unstageAll', repoPath),
  discardFiles: (repoPath, files, untracked) =>
    ipcRenderer.invoke('git:discardFiles', repoPath, files, untracked),
  discardAll: (repoPath) => ipcRenderer.invoke('git:discardAll', repoPath),
  commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  commitWithOutput: (repoPath, message) =>
    ipcRenderer.invoke('git:commitWithOutput', repoPath, message),
  hasPreCommitHooks: (repoPath) => ipcRenderer.invoke('git:hasPreCommitHooks', repoPath),
  getHookManifest: (repoPath) => ipcRenderer.invoke('git:getHookManifest', repoPath),
  commitWithHooks: (repoPath, message) =>
    ipcRenderer.invoke('git:commitWithHooks', repoPath, message),
  pushWithHooks: (repoPath) => ipcRenderer.invoke('git:pushWithHooks', repoPath),
  abortOperation: (repoPath) => ipcRenderer.invoke('git:abortOperation', repoPath),
  onCommitOutput: (callback) => {
    const handler = (_: unknown, repoPath: string, line: string) => callback(repoPath, line);
    ipcRenderer.on('git:commit-output', handler);
    return () => ipcRenderer.removeListener('git:commit-output', handler);
  },
  onOperationOutput: (callback) => {
    const handler = (
      _: unknown,
      repoPath: string,
      line: string,
      phase: OperationProgressStatus,
      hook?: GitHookType
    ) => callback(repoPath, line, phase, hook);
    ipcRenderer.on('git:operation-output', handler);
    return () => ipcRenderer.removeListener('git:operation-output', handler);
  },
  push: (repoPath) => ipcRenderer.invoke('git:push', repoPath),
  pull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
  getAheadBehind: (repoPath) => ipcRenderer.invoke('git:getAheadBehind', repoPath),
  getRemoteUrl: (repoPath, remoteName) =>
    ipcRenderer.invoke('git:getRemoteUrl', repoPath, remoteName),
  addRemote: (repoPath, name, url) => ipcRenderer.invoke('git:addRemote', repoPath, name, url),

  // PR status operations (gh CLI)
  isGhCliAvailable: () => ipcRenderer.invoke('git:isGhCliAvailable'),
  getPRStatuses: (repos) => ipcRenderer.invoke('git:getPRStatuses', repos),

  // GitHub repo operations (gh CLI)
  checkGhAuth: (): Promise<CheckGhAuthResult> => ipcRenderer.invoke('git:checkGhAuth'),
  listGitHubRepos: (): Promise<ListGitHubReposResult> => ipcRenderer.invoke('git:listGitHubRepos'),

  // File system
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  pathExists: (filePath) => ipcRenderer.invoke('fs:pathExists', filePath),
  getBasename: (filePath) => path.basename(filePath),
  getFileLines: (filePath, startLine, endLine) =>
    ipcRenderer.invoke('fs:getFileLines', filePath, startLine, endLine),
  getFileLineCount: (filePath) => ipcRenderer.invoke('fs:getFileLineCount', filePath),
  removeDirectory: (dirPath) => ipcRenderer.invoke('fs:removeDirectory', dirPath),
  runScript: (cwd, script, envVars, timeoutMs) =>
    ipcRenderer.invoke('fs:runScript', cwd, script, envVars, timeoutMs),

  // Termpad config
  loadTermpadConfig: (repoPath: string) => ipcRenderer.invoke('config:loadTermpadConfig', repoPath),

  // App
  getAppDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  showNotification: (title, body) => ipcRenderer.send('app:showNotification', title, body),
  onBeforeClose: (callback) => {
    const handler = (_event: unknown, activeCount: number) => callback(activeCount);
    ipcRenderer.on('app:beforeClose', handler);
    return () => ipcRenderer.removeListener('app:beforeClose', handler);
  },
  confirmClose: () => ipcRenderer.send('app:confirmClose'),
  cancelClose: () => ipcRenderer.send('app:cancelClose'),

  // Shell configuration
  getAvailableShells: (): Promise<ShellInfo[]> => ipcRenderer.invoke('terminal:getAvailableShells'),
  validateShellPath: (shellPath: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('terminal:validateShellPath', shellPath),
  getResolvedShellName: (): Promise<string> => ipcRenderer.invoke('terminal:getResolvedShellName'),
};

const storageAPI: StorageAPI = {
  loadState: () => ipcRenderer.invoke('storage:loadState'),
  saveState: (state: AppState) => ipcRenderer.invoke('storage:saveState', state),
};

const watcherAPI: WatcherAPI = {
  startRepositoryWatch: (repositoryId: string, repoPath: string) => {
    ipcRenderer.send('watcher:startRepositoryWatch', repositoryId, repoPath);
  },
  stopRepositoryWatch: (repositoryId: string) => {
    return ipcRenderer.invoke('watcher:stopRepositoryWatch', repositoryId);
  },
  onWorktreeAdded: (callback: (repositoryId: string, worktree: WorktreeInfo) => void) => {
    const handler = (_: unknown, repositoryId: string, worktree: WorktreeInfo) => {
      callback(repositoryId, worktree);
    };
    ipcRenderer.on('watcher:worktreeAdded', handler);
    return () => ipcRenderer.removeListener('watcher:worktreeAdded', handler);
  },
  onWorktreeRemoved: (
    callback: (repositoryId: string, worktreePath: string, isExternal: boolean) => void
  ) => {
    const handler = (
      _: unknown,
      repositoryId: string,
      worktreePath: string,
      isExternal: boolean
    ) => {
      callback(repositoryId, worktreePath, isExternal);
    };
    ipcRenderer.on('watcher:worktreeRemoved', handler);
    return () => ipcRenderer.removeListener('watcher:worktreeRemoved', handler);
  },
  // Branch change watcher
  onBranchesChanged: (callback: (repositoryId: string) => void) => {
    const handler = (_: unknown, repositoryId: string) => {
      callback(repositoryId);
    };
    ipcRenderer.on('watcher:branchesChanged', handler);
    return () => ipcRenderer.removeListener('watcher:branchesChanged', handler);
  },
  // Repository deletion watcher (triggered when repo folder is deleted externally)
  onRepositoryDeleted: (callback: (repositoryId: string, repoPath: string) => void) => {
    const handler = (_: unknown, repositoryId: string, repoPath: string) => {
      callback(repositoryId, repoPath);
    };
    ipcRenderer.on('watcher:repositoryDeleted', handler);
    return () => ipcRenderer.removeListener('watcher:repositoryDeleted', handler);
  },
  // termpad.json change watcher
  onConfigChanged: (callback: (repositoryId: string) => void) => {
    const handler = (_: unknown, repositoryId: string) => {
      callback(repositoryId);
    };
    ipcRenderer.on('watcher:configChanged', handler);
    return () => ipcRenderer.removeListener('watcher:configChanged', handler);
  },
};

const reviewStorageAPI: ReviewStorageAPI = {
  save: (review: ReviewData) => ipcRenderer.invoke('review:save', review),
  load: (projectPath: string, reviewId: string) =>
    ipcRenderer.invoke('review:load', projectPath, reviewId),
  delete: (projectPath: string, reviewId: string) =>
    ipcRenderer.invoke('review:delete', projectPath, reviewId),
  list: (projectPath: string) => ipcRenderer.invoke('review:list', projectPath),
  loadAll: (projectPath: string) => ipcRenderer.invoke('review:loadAll', projectPath),
  findByBranches: (projectPath: string, baseBranch: string, compareBranch: string) =>
    ipcRenderer.invoke('review:findByBranches', projectPath, baseBranch, compareBranch),
};

const notificationAPI: NotificationAPI = {
  trigger: (payload: NotificationPayload) => ipcRenderer.invoke('notification:trigger', payload),
  setCooldown: (ms: number) => ipcRenderer.send('notification:setCooldown', ms),
  focusWorktreeSession: (worktreeSessionId: string, tabId?: string) =>
    ipcRenderer.send('notification:focusWorktreeSession', worktreeSessionId, tabId),
  onSwitchWorktreeSession: (callback: (worktreeSessionId: string, tabId?: string) => void) => {
    const handler = (_: unknown, worktreeSessionId: string, tabId?: string) =>
      callback(worktreeSessionId, tabId);
    ipcRenderer.on('notification:switch-worktree-session', handler);
    return () => ipcRenderer.removeListener('notification:switch-worktree-session', handler);
  },
};

const dialogAPI: DialogAPI = {
  saveFile: (options: SaveFileOptions) => ipcRenderer.invoke('dialog:saveFile', options),
};

const diffWindowAPI: DiffWindowAPI = {
  open: (initData: DiffWindowInitData) => ipcRenderer.invoke('diff-window:open', initData),
  getInitialData: () => ipcRenderer.invoke('diff-window:get-initial-data'),
  close: () => ipcRenderer.send('diff-window:close'),
  notifyReviewDataChanged: (reviewData: ReviewData) =>
    ipcRenderer.send('diff-window:review-data-changed', reviewData),
  onReviewDataUpdate: (callback: (reviewData: ReviewData) => void) => {
    const handler = (_: unknown, reviewData: ReviewData) => callback(reviewData);
    ipcRenderer.on('diff-window:review-data-update', handler);
    return () => ipcRenderer.removeListener('diff-window:review-data-update', handler);
  },
};

const updaterAPI: UpdaterAPI = {
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  dismissUpdate: () => ipcRenderer.send('updater:dismissUpdate'),
  onStatusChange: (callback: (status: UpdateStatus) => void) => {
    const handler = (_: unknown, status: UpdateStatus) => callback(status);
    ipcRenderer.on('updater:status-changed', handler);
    return () => ipcRenderer.removeListener('updater:status-changed', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('terminal', terminalAPI);
contextBridge.exposeInMainWorld('storage', storageAPI);
contextBridge.exposeInMainWorld('watcher', watcherAPI);
contextBridge.exposeInMainWorld('reviewStorage', reviewStorageAPI);
contextBridge.exposeInMainWorld('notifications', notificationAPI);
contextBridge.exposeInMainWorld('dialog', dialogAPI);
contextBridge.exposeInMainWorld('diffWindow', diffWindowAPI);
contextBridge.exposeInMainWorld('updater', updaterAPI);

console.log('[Preload] All APIs exposed to window');
