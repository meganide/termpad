import { AlertTriangle, Folder, Info, Loader2, Trash2, FolderMinus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Repository, WorktreeInfo, WorktreeSession } from '../../shared/types';
import { useAppStore } from '../stores/appStore';
import { normalizePath } from '../utils/worktreeUtils';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

interface WorktreeStatus {
  session: WorktreeSession;
  isDirty: boolean;
}

interface DeleteRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: Repository | null;
}

type DeleteMode = 'delete-completely' | 'remove-from-app';

export function DeleteRepositoryDialog({
  open,
  onOpenChange,
  repository,
}: DeleteRepositoryDialogProps) {
  const { removeRepository, setRepositoryDeleting } = useAppStore();
  const [worktreeStatuses, setWorktreeStatuses] = useState<WorktreeStatus[]>([]);
  const [untrackedWorktrees, setUntrackedWorktrees] = useState<WorktreeInfo[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('delete-completely');
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  // Load worktree dirty status and detect untracked worktrees when dialog opens
  useEffect(() => {
    if (!repository || !open) {
      setWorktreeStatuses([]);
      setUntrackedWorktrees([]);
      setIsLoading(false);
      setError(null);
      setConfirmText('');
      setDeleteMode('delete-completely');
      setIsRunningCleanup(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const worktreeSessions = repository.worktreeSessions;

    const loadWorktreeInfo = async () => {
      // Get dirty status for tracked worktrees
      const statuses = await Promise.all(
        worktreeSessions.map(async (session) => {
          try {
            const isDirty = await window.terminal.isWorktreeDirty(session.path);
            return { session, isDirty };
          } catch {
            return { session, isDirty: false };
          }
        })
      );
      setWorktreeStatuses(statuses);

      // Get all worktrees from git and find untracked ones
      try {
        const allWorktrees = await window.terminal.listWorktrees(repository.path);
        // Use normalized paths for comparison to handle different path formats
        // (e.g., wsl$ vs wsl.localhost, forward vs backslashes)
        const trackedPaths = new Set(worktreeSessions.map((s) => normalizePath(s.path)));
        const untracked = allWorktrees.filter((wt) => !trackedPaths.has(normalizePath(wt.path)));
        setUntrackedWorktrees(untracked);
      } catch {
        // If we can't list worktrees, just proceed without untracked info
        setUntrackedWorktrees([]);
      }

      setIsLoading(false);
    };

    loadWorktreeInfo();
  }, [repository, open]);

  const handleDelete = async () => {
    if (!repository) return;

    if (deleteMode === 'remove-from-app') {
      // Just remove from store, no filesystem changes
      await removeRepository(repository.id);
      onOpenChange(false);
      return;
    }

    // Delete completely mode
    setIsDeleting(true);
    setError(null);

    try {
      // Mark repository as deleting to stop all polling hooks (useSourceControl, useWorkingTreeDiff, etc.)
      // This must happen FIRST to prevent hooks from accessing the directory during deletion
      setRepositoryDeleting(repository, true);

      // Stop file watchers (worktreeWatcher handles Windows-specific delays internally)
      await window.watcher.stopRepositoryWatch(repository.id);

      // Find the main session by matching the repository path, not by index
      // (worktreeSessions[0] may not be the main session if the repo was imported without main)
      const repoPathNormalized = normalizePath(repository.path);
      const mainSession = repository.worktreeSessions.find(
        (s) => normalizePath(s.path) === repoPathNormalized
      );

      // Get tracked worktrees to delete (exclude the main session which matches repository.path)
      const trackedWorktreesToDelete = worktreeStatuses.filter(
        (status) => normalizePath(status.session.path) !== repoPathNormalized
      );

      // For each tracked worktree (excluding main):
      // 1. Kill terminals (with waitForExit to ensure process fully terminates)
      // 2. Remove from filesystem
      // 3. Delete branch
      // 4. Run cleanup if configured
      for (const status of trackedWorktreesToDelete) {
        // 1. Kill all terminals for this worktree (including user terminals) and wait for them to exit
        // This is critical on Windows where file locks persist until process terminates
        try {
          await window.terminal.killAllForWorktree(status.session.id);
        } catch {
          // No terminals running for this worktree
        }

        // 2 & 3. Remove worktree and delete branch
        try {
          const branchName = status.session.branchName;
          if (status.isDirty) {
            await window.terminal.forceRemoveWorktree(
              repository.path,
              status.session.path,
              branchName
            );
          } else {
            await window.terminal.removeWorktree(status.session.path, true, branchName);
          }
        } catch (err) {
          console.error(
            `[DeleteRepositoryDialog] Failed to remove worktree ${status.session.path}:`,
            err
          );
          // Continue with other deletions
        }

        // Explicitly delete the worktree directory if it still exists
        // (git worktree remove may leave untracked files/directories behind)
        try {
          const dirResult = await window.terminal.removeDirectory(status.session.path);
          if (!dirResult.success) {
            console.error(
              `[DeleteRepositoryDialog] Failed to remove worktree directory ${status.session.path}:`,
              dirResult.error
            );
          }
        } catch {
          // Directory might already be gone
        }

        // 4. Run cleanup script if configured (after deletion, from repo root)
        const cleanupScript = repository.scriptsConfig?.cleanupScript;
        if (cleanupScript && cleanupScript.trim() !== '') {
          setIsRunningCleanup(true);

          // Build environment variables for cleanup script
          const envVars: Record<string, string> = {
            TERMPAD_WORKSPACE_NAME: status.session.branchName || status.session.label,
            TERMPAD_WORKSPACE_PATH: status.session.path,
            TERMPAD_ROOT_PATH: repository.path,
          };
          if (status.session.portOffset !== undefined && repository.portRangeStart !== undefined) {
            envVars.TERMPAD_PORT = String(repository.portRangeStart + status.session.portOffset);
          }

          // Run cleanup script in background (30 second timeout)
          const result = await window.terminal.runScript(
            repository.path,
            cleanupScript,
            envVars,
            30000
          );
          if (!result.success) {
            console.error('[DeleteRepositoryDialog] Cleanup script failed:', result.error);
          }

          setIsRunningCleanup(false);
        }
      }

      // Delete untracked worktrees (not in app but exist on filesystem)
      for (const wt of untrackedWorktrees) {
        if (wt.isMain) continue; // Skip main worktree, will be deleted with repo

        try {
          // Force remove since we don't know if it's dirty
          await window.terminal.forceRemoveWorktree(repository.path, wt.path, wt.branch);
        } catch (err) {
          console.error(
            `[DeleteRepositoryDialog] Failed to remove untracked worktree ${wt.path}:`,
            err
          );
          // Continue with other deletions
        }

        // Explicitly delete the worktree directory if it still exists
        // (git worktree remove may leave untracked files/directories behind)
        try {
          const dirResult = await window.terminal.removeDirectory(wt.path);
          if (!dirResult.success) {
            console.error(
              `[DeleteRepositoryDialog] Failed to remove untracked worktree directory ${wt.path}:`,
              dirResult.error
            );
          }
        } catch {
          // Directory might already be gone
        }

        // Run cleanup script for untracked worktrees too
        const cleanupScript = repository.scriptsConfig?.cleanupScript;
        if (cleanupScript && cleanupScript.trim() !== '') {
          setIsRunningCleanup(true);

          const envVars: Record<string, string> = {
            TERMPAD_WORKSPACE_NAME: wt.branch,
            TERMPAD_WORKSPACE_PATH: wt.path,
            TERMPAD_ROOT_PATH: repository.path,
          };

          const result = await window.terminal.runScript(
            repository.path,
            cleanupScript,
            envVars,
            30000
          );
          if (!result.success) {
            console.error('[DeleteRepositoryDialog] Cleanup script failed:', result.error);
          }

          setIsRunningCleanup(false);
        }
      }

      // Kill all terminals for main session (including user terminals) and wait for them to exit
      // This is critical on Windows where file locks persist until process terminates
      if (mainSession) {
        try {
          await window.terminal.killAllForWorktree(mainSession.id);
        } catch {
          // No terminals running for main session
        }

        // For bare repos, the main worktree folder is separate from the bare repo directory
        // and needs to be deleted explicitly
        if (repository.isBare && mainSession.path !== repository.path) {
          try {
            const dirResult = await window.terminal.removeDirectory(mainSession.path);
            if (!dirResult.success) {
              console.error(
                `[DeleteRepositoryDialog] Failed to remove main worktree directory ${mainSession.path}:`,
                dirResult.error
              );
            }
          } catch {
            // Directory might already be gone
          }

          // Run cleanup script for main worktree if configured
          const cleanupScript = repository.scriptsConfig?.cleanupScript;
          if (cleanupScript && cleanupScript.trim() !== '') {
            setIsRunningCleanup(true);

            const envVars: Record<string, string> = {
              TERMPAD_WORKSPACE_NAME: mainSession.branchName || mainSession.label,
              TERMPAD_WORKSPACE_PATH: mainSession.path,
              TERMPAD_ROOT_PATH: repository.path,
            };
            if (mainSession.portOffset !== undefined && repository.portRangeStart !== undefined) {
              envVars.TERMPAD_PORT = String(repository.portRangeStart + mainSession.portOffset);
            }

            const result = await window.terminal.runScript(
              repository.path,
              cleanupScript,
              envVars,
              30000
            );
            if (!result.success) {
              console.error('[DeleteRepositoryDialog] Cleanup script failed:', result.error);
            }

            setIsRunningCleanup(false);
          }
        }
      }

      // Delete the repository root directory from filesystem
      const removeResult = await window.terminal.removeDirectory(repository.path);
      if (!removeResult.success) {
        console.error('[DeleteRepositoryDialog] Failed to remove directory:', removeResult.error);
        // Continue anyway - we still want to remove from app
      }

      // Remove repository from store
      await removeRepository(repository.id);
      onOpenChange(false);
    } catch (err) {
      setError('Failed to delete repository');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setConfirmText('');
    onOpenChange(false);
  };

  if (!repository) return null;

  // Find worktrees with uncommitted changes (excluding main session)
  // Use path comparison to identify main session, not index
  const repoPathNormalized = normalizePath(repository.path);
  const dirtyWorktrees = worktreeStatuses.filter(
    (s) => normalizePath(s.session.path) !== repoPathNormalized && s.isDirty
  );
  const hasDirtyWorktrees = dirtyWorktrees.length > 0;
  const canDelete =
    deleteMode === 'remove-from-app' ||
    (deleteMode === 'delete-completely' && confirmText === repository.name);

  // Determine button label based on mode and current state
  const getButtonLabel = () => {
    if (isRunningCleanup) return 'Running cleanup...';
    if (deleteMode === 'remove-from-app') return 'Remove from App';
    return 'Delete Repository';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <Folder className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Remove Repository</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            How would you like to remove &quot;{repository.name}&quot;?
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground">Checking worktree status...</div>
        ) : (
          <div className="space-y-4 py-2">
            <RadioGroup
              value={deleteMode}
              onValueChange={(value) => setDeleteMode(value as DeleteMode)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="delete-completely" id="delete-completely" className="mt-1" />
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="delete-completely"
                    className="cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    Delete completely
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Remove the repository from app, includes deleting all worktrees and their local
                    branches. Cleanup scripts will run for each deleted worktree.
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="remove-from-app" id="remove-from-app" className="mt-1" />
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="remove-from-app"
                    className="cursor-pointer flex items-center gap-2 font-medium"
                  >
                    <FolderMinus className="h-4 w-4 text-muted-foreground" />
                    Remove from app
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Just stop tracking this repository. Keep all files and branches intact.
                  </span>
                </div>
              </div>
            </RadioGroup>

            {/* Main worktree warning */}
            {repository.worktreeSessions.some((s) => s.isMainWorktree) && (
              <div className="flex items-start gap-2 p-3 rounded bg-blue-500/10 text-blue-500 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Removing this repository will also remove the main worktree session.</span>
              </div>
            )}

            {deleteMode === 'delete-completely' && hasDirtyWorktrees && (
              <div className="flex items-start gap-2 p-3 rounded bg-yellow-500/10 text-yellow-500 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Uncommitted changes will be lost:</span>
                  <ul className="mt-1 space-y-0.5">
                    {dirtyWorktrees.map((s) => (
                      <li key={s.session.id} className="text-xs">
                        {s.session.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {deleteMode === 'delete-completely' && untrackedWorktrees.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded bg-blue-500/10 text-blue-500 text-sm">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">
                    Found {untrackedWorktrees.length} additional worktree
                    {untrackedWorktrees.length > 1 ? 's' : ''} not tracked by this app.
                  </span>
                  <span className="block text-xs mt-1">
                    All {worktreeStatuses.length + untrackedWorktrees.length} worktrees will be
                    deleted.
                  </span>
                </div>
              </div>
            )}

            {deleteMode === 'delete-completely' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Type <strong>{repository.name}</strong> to confirm deletion:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={repository.name}
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isLoading || !canDelete}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getButtonLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
