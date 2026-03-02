import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Folder,
  GitBranch,
  Loader2,
  Download,
  FolderGit2,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useAppStore } from '../stores/appStore';
import { extractOwnerRepo } from '../utils/gitUrlParser';
import { WorktreePicker } from './WorktreePicker';
import { GitHubRepoPicker } from './GitHubRepoPicker';
import { getImportableWorktrees, normalizePathSlashes } from '../utils/worktreeUtils';
import type { Repository, WorktreeSession, WorktreeInfo, GitHubRepo } from '../../shared/types';

/**
 * Tip component shown to Windows users who have a WSL shell as their default.
 */
function WslTip({
  distroName,
  context,
}: {
  distroName: string | null;
  context: 'local' | 'clone';
}) {
  if (!distroName) return null;

  const examplePath = `\\\\wsl$\\${distroName}\\home\\...`;

  return (
    <div className="rounded-lg bg-blue-500/10 p-3 text-sm max-w-md">
      <div className="flex gap-2">
        <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-blue-500">WSL Tip</p>
          <p className="text-muted-foreground">
            {context === 'local' ? (
              <>
                To access repositories inside WSL, navigate to{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{examplePath}</code> in the
                folder picker.
              </>
            ) : (
              <>
                For better performance, clone directly into WSL by selecting a destination like{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{examplePath}</code>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Files stored directly in WSL have significantly better I/O performance than accessing
            Windows files from WSL.
          </p>
        </div>
      </div>
    </div>
  );
}

interface AddRepositoryScreenProps {
  onBack: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function AddRepositoryScreen({ onBack }: AddRepositoryScreenProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'clone'>('local');
  // Local folder state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isGit, setIsGit] = useState<boolean | null>(null);
  const [initGitChecked, setInitGitChecked] = useState(false);
  // Worktree import state
  const [importableWorktrees, setImportableWorktrees] = useState<WorktreeInfo[]>([]);
  const [selectedWorktreePaths, setSelectedWorktreePaths] = useState<Set<string>>(new Set());
  const [mainWorktree, setMainWorktree] = useState<WorktreeInfo | null>(null);
  // Clone state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneDestPath, setCloneDestPath] = useState<string | null>(null);
  // GitHub repos state
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposError, setGithubReposError] = useState<string | null>(null);
  const [githubReposFetched, setGithubReposFetched] = useState(false);
  // Worktree redirect dialog state
  const [worktreeRedirectOpen, setWorktreeRedirectOpen] = useState(false);
  const [pendingMainRepoPath, setPendingMainRepoPath] = useState<string | null>(null);
  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addRepository, setActiveTerminal, settings } = useAppStore();

  // Check if we should show WSL tip (Windows only, using a WSL shell as default)
  const wslDistroName = useMemo(() => {
    if (window.electronAPI.platform !== 'win32') {
      return null;
    }

    // Get the default shell ID from settings
    const defaultShellId = settings.defaultShell;

    // If a WSL shell is explicitly set (id starts with 'wsl-'), extract distro from the ID
    if (defaultShellId?.startsWith('wsl-')) {
      // Extract distro name from shell ID (e.g., "wsl-archlinux" -> "archlinux")
      return defaultShellId.slice(4); // Remove 'wsl-' prefix
    }

    // For custom shells, check if it's a WSL shell
    if (defaultShellId) {
      const customShell = settings.customShells.find((s) => s.id === defaultShellId);
      if (customShell?.path.toLowerCase().includes('wsl')) {
        // Try to extract distro from args (e.g., ['-d', 'Ubuntu'])
        if (customShell.args) {
          const distroIndex = customShell.args.findIndex(
            (arg) => arg === '-d' || arg === '--distribution'
          );
          if (distroIndex !== -1 && customShell.args[distroIndex + 1]) {
            return customShell.args[distroIndex + 1];
          }
        }
        // Fallback: use the custom shell name or a generic indicator
        return customShell.name || 'WSL';
      }
    }

    return null;
  }, [settings.defaultShell, settings.customShells]);

  // Fetch GitHub repos when Clone tab becomes active
  const fetchGitHubRepos = useCallback(async () => {
    if (githubReposFetched) return; // Already fetched

    setGithubReposLoading(true);
    setGithubReposError(null);

    try {
      // First check if gh is authenticated
      const authResult = await window.terminal.checkGhAuth();
      if (!authResult.authenticated) {
        setGithubReposError(authResult.error || 'Not authenticated');
        return;
      }

      // Fetch repos
      const result = await window.terminal.listGitHubRepos();
      if (result.error) {
        setGithubReposError(result.error);
      } else {
        setGithubRepos(result.repos);
        setGithubReposFetched(true);
      }
    } catch (err) {
      setGithubReposError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setGithubReposLoading(false);
    }
  }, [githubReposFetched]);

  // Fetch GitHub repos when Clone tab is selected
  useEffect(() => {
    if (activeTab === 'clone' && !githubReposFetched && !githubReposLoading) {
      fetchGitHubRepos();
    }
  }, [activeTab, githubReposFetched, githubReposLoading, fetchGitHubRepos]);

  const processSelectedPath = async (path: string) => {
    setSelectedPath(path);
    setInitGitChecked(false); // Reset checkbox when folder changes
    const gitStatus = await window.terminal.isGitRepo(path);
    setIsGit(gitStatus);

    // If it's a git repo, check for importable worktrees and main worktree
    if (gitStatus) {
      const worktrees = await window.terminal.listWorktrees(path);
      const mainWt = worktrees.find((wt) => wt.isMain) || null;
      setMainWorktree(mainWt);
      const importable = getImportableWorktrees(worktrees, []);
      setImportableWorktrees(importable);
      setSelectedWorktreePaths(new Set());
    } else {
      setMainWorktree(null);
      setImportableWorktrees([]);
      setSelectedWorktreePaths(new Set());
    }
  };

  const handleSelectFolder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const path = await window.terminal.selectFolder();
      if (path) {
        // Check if the selected folder is a worktree (not the main repo)
        const detection = await window.terminal.detectWorktree(path);

        if (detection.isWorktree && detection.mainRepoPath) {
          // Show redirect dialog
          setPendingMainRepoPath(detection.mainRepoPath);
          setWorktreeRedirectOpen(true);
          return;
        }

        await processSelectedPath(path);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to select folder: ${errorMsg}`);
      console.error('[AddRepositoryScreen] selectFolder error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorktreeRedirectConfirm = async () => {
    setWorktreeRedirectOpen(false);
    if (pendingMainRepoPath) {
      setIsLoading(true);
      try {
        await processSelectedPath(pendingMainRepoPath);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(`Failed to process folder: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    }
    setPendingMainRepoPath(null);
  };

  const handleWorktreeRedirectCancel = () => {
    setWorktreeRedirectOpen(false);
    setPendingMainRepoPath(null);
  };

  const handleConfirm = async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize git if user checked the checkbox for a non-git folder
      if (!isGit && initGitChecked) {
        const result = await window.terminal.initGitRepo(selectedPath);
        if (!result.success) {
          setError(result.error || 'Failed to initialize Git repository');
          return;
        }
      }

      const repositoryId = generateId();
      const repositoryName = window.terminal.getBasename(selectedPath);

      // Create worktree sessions - main worktree first, then selected worktrees
      const worktreeSessions: WorktreeSession[] = [];

      // Add main worktree session first (if it's a git repo with main worktree)
      if (mainWorktree) {
        const mainSession: WorktreeSession = {
          id: generateId(),
          label: mainWorktree.branch || 'main',
          path: normalizePathSlashes(mainWorktree.path),
          branchName: mainWorktree.branch || undefined,
          worktreeName: mainWorktree.branch || 'main',
          createdAt: new Date().toISOString(),
          isExternal: false,
          isMainWorktree: true,
        };
        worktreeSessions.push(mainSession);
      }

      // Add selected importable worktrees
      for (const worktree of importableWorktrees) {
        if (selectedWorktreePaths.has(worktree.path)) {
          const worktreeSession: WorktreeSession = {
            id: generateId(),
            label: worktree.branch || window.terminal.getBasename(worktree.path),
            path: normalizePathSlashes(worktree.path),
            branchName: worktree.branch || undefined,
            worktreeName: worktree.branch || window.terminal.getBasename(worktree.path),
            createdAt: new Date().toISOString(),
            isExternal: true,
          };
          worktreeSessions.push(worktreeSession);
        }
      }

      const repository: Repository = {
        id: repositoryId,
        name: repositoryName,
        path: normalizePathSlashes(selectedPath),
        isBare: false,
        isExpanded: true,
        worktreeSessions,
        createdAt: new Date().toISOString(),
      };

      addRepository(repository);
      // Set active terminal to first worktree session if any
      if (worktreeSessions.length > 0) {
        setActiveTerminal(worktreeSessions[0].id);
      }

      // Reset and go back
      resetState();
      onBack();
    } catch (err) {
      setError('Failed to add repository');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCloneDestination = async () => {
    setError(null);
    try {
      const path = await window.terminal.selectFolder();
      if (path) {
        setCloneDestPath(path);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to select folder: ${errorMsg}`);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl || !cloneDestPath) return;

    setIsLoading(true);
    setError(null);

    try {
      // Extract owner/repo from URL (e.g., 'anthropics/claude')
      const repositoryName = extractOwnerRepo(cloneUrl);
      // Use just repo name for folder path
      const repoName = repositoryName.split('/').pop() || 'cloned-repo';
      const fullDestPath = `${cloneDestPath}/${repoName}`;

      // Clone the repository
      const result = await window.terminal.cloneRepository(cloneUrl, fullDestPath);

      if (!result.success) {
        setError(result.error || 'Failed to clone repository');
        return;
      }

      // Get main worktree info after clone
      const worktrees = await window.terminal.listWorktrees(fullDestPath);
      const mainWt = worktrees.find((wt) => wt.isMain) || null;

      // Create worktree sessions with main worktree first
      const worktreeSessions: WorktreeSession[] = [];
      if (mainWt) {
        const mainSession: WorktreeSession = {
          id: generateId(),
          label: mainWt.branch || 'main',
          path: normalizePathSlashes(mainWt.path),
          branchName: mainWt.branch || undefined,
          worktreeName: mainWt.branch || 'main',
          createdAt: new Date().toISOString(),
          isExternal: false,
          isMainWorktree: true,
        };
        worktreeSessions.push(mainSession);
      }

      // Add as repository with main worktree session
      const repositoryId = generateId();

      const repository: Repository = {
        id: repositoryId,
        name: repositoryName,
        path: normalizePathSlashes(fullDestPath),
        isBare: false,
        isExpanded: true,
        worktreeSessions,
        createdAt: new Date().toISOString(),
      };

      addRepository(repository);

      // Set active terminal to main worktree session if created
      if (worktreeSessions.length > 0) {
        setActiveTerminal(worktreeSessions[0].id);
      }

      // Reset and go back
      resetState();
      onBack();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setSelectedPath(null);
    setIsGit(null);
    setInitGitChecked(false);
    setMainWorktree(null);
    setImportableWorktrees([]);
    setSelectedWorktreePaths(new Set());
    setCloneUrl('');
    setCloneDestPath(null);
    setError(null);
    setActiveTab('local');
  };

  return (
    <div className="flex-1 flex bg-background h-full" data-testid="add-repository-screen">
      {/* Left navigation panel */}
      <div className="w-48 flex flex-col bg-sidebar-panel">
        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveTab('local')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              activeTab === 'local'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }`}
          >
            <Folder className="h-4 w-4" />
            Local Folder
          </button>
          <button
            onClick={() => setActiveTab('clone')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              activeTab === 'clone'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            }`}
          >
            <Download className="h-4 w-4" />
            Clone Repository
          </button>
        </nav>

        {/* Back button at bottom */}
        <div className="flex items-center px-3 py-2.5 bg-sidebar-panel">
          <button
            onClick={onBack}
            className="flex-1 h-9 flex items-center justify-start gap-2 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold mb-2">Add Repository</h1>
              <p className="text-muted-foreground">
                {activeTab === 'local'
                  ? 'Add an existing folder from your local machine'
                  : 'Clone a repository from a URL'}
              </p>
            </div>

            {activeTab === 'local' ? (
              <div className="space-y-6">
                {/* Folder selection */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Select Folder</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose a folder to add as a repository.
                  </p>
                  {!selectedPath ? (
                    <>
                      <Button
                        variant="outline"
                        className="w-full max-w-md h-24 flex flex-col gap-2"
                        onClick={handleSelectFolder}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-8 w-8 animate-spin" />
                        ) : (
                          <>
                            <Folder className="h-8 w-8" />
                            <span>Browse...</span>
                          </>
                        )}
                      </Button>
                      <WslTip distroName={wslDistroName} context="local" />
                    </>
                  ) : (
                    <div className="rounded-lg bg-muted/50 p-4 max-w-md">
                      <div className="flex items-start gap-3">
                        <Folder className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {window.terminal.getBasename(selectedPath)}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">{selectedPath}</p>
                          <div className="flex items-center gap-1 mt-2">
                            {isGit ? (
                              <>
                                <GitBranch className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-500">
                                  Git repository detected
                                </span>
                              </>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center gap-1.5">
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                  <span className="text-sm text-destructive">
                                    This folder is not a Git repository
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Run{' '}
                                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                                    git init
                                  </code>{' '}
                                  inside this folder, or check the box below
                                </p>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id="init-git"
                                    checked={initGitChecked}
                                    onCheckedChange={(checked) =>
                                      setInitGitChecked(checked === true)
                                    }
                                  />
                                  <label
                                    htmlFor="init-git"
                                    className="text-sm cursor-pointer select-none"
                                  >
                                    Initialize Git repository for me
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={handleSelectFolder}
                        disabled={isLoading}
                      >
                        Change folder
                      </Button>
                    </div>
                  )}
                </div>

                {/* Importable worktrees */}
                {importableWorktrees.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-medium">Existing Worktrees Found</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {importableWorktrees.length} existing worktree
                        {importableWorktrees.length !== 1 ? 's' : ''} found. Select which to import:
                      </p>
                    </div>
                    <div className="max-w-lg flex-1 overflow-y-auto">
                      <WorktreePicker
                        worktrees={importableWorktrees}
                        selectedPaths={selectedWorktreePaths}
                        onSelectionChange={setSelectedWorktreePaths}
                        idPrefix="add-repo-worktree"
                      />
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-destructive max-w-md">{error}</p>}
              </div>
            ) : (
              <div className="space-y-6">
                {/* GitHub Repository Picker */}
                <div className="space-y-2 max-w-md">
                  <Label className="text-base font-medium">Your Repositories</Label>
                  <p className="text-sm text-muted-foreground">
                    Select a repository from GitHub or enter a URL below.
                  </p>
                  <GitHubRepoPicker
                    repos={githubRepos}
                    isLoading={githubReposLoading}
                    error={githubReposError}
                    onSelect={(url) => setCloneUrl(url)}
                  />
                </div>

                {/* Repository URL */}
                <div className="space-y-2">
                  <Label htmlFor="clone-url" className="text-base font-medium">
                    Repository URL
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Or enter the URL of any repository you want to clone.
                  </p>
                  <Input
                    id="clone-url"
                    placeholder="https://github.com/user/repo.git"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    disabled={isLoading}
                    className="max-w-md"
                  />
                </div>

                {/* Destination folder */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Destination Folder</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose where to clone the repository.
                  </p>
                  {!cloneDestPath ? (
                    <Button
                      variant="outline"
                      className="w-full max-w-md"
                      onClick={handleSelectCloneDestination}
                      disabled={isLoading}
                    >
                      <Folder className="h-4 w-4 mr-2" />
                      Select Destination
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 max-w-md">
                      <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm truncate">
                        {cloneDestPath}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectCloneDestination}
                        disabled={isLoading}
                      >
                        Change
                      </Button>
                    </div>
                  )}
                  <WslTip distroName={wslDistroName} context="clone" />
                </div>

                {error && <p className="text-sm text-destructive max-w-md">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Fixed action buttons footer - matches left nav back button height */}
        <div className="flex items-center px-3 py-2.5 bg-background">
          <div className="flex gap-2">
            {activeTab === 'local' ? (
              <>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={handleConfirm}
                  disabled={!selectedPath || isLoading || (isGit === false && !initGitChecked)}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Repository
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={onBack}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={handleClone}
                  disabled={!cloneUrl || !cloneDestPath || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Clone & Add
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={onBack}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Worktree redirect confirmation dialog */}
      <AlertDialog open={worktreeRedirectOpen} onOpenChange={setWorktreeRedirectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <FolderGit2 className="h-5 w-5 text-primary" />
              </div>
              <AlertDialogTitle>Worktree Detected</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left pt-2">
              The selected folder is a git worktree, not the main repository. Would you like to add
              the main repository instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingMainRepoPath && (
            <div className="rounded-lg p-3 bg-muted/50">
              <p className="text-sm text-muted-foreground">Main repository:</p>
              <p className="font-mono text-sm truncate">{pendingMainRepoPath}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWorktreeRedirectCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWorktreeRedirectConfirm}>
              Add Main Repository
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
