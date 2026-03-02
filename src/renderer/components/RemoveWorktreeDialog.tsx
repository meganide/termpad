import { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { AlertTriangle, GitBranch, Loader2, Trash2, FolderMinus } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { WorktreeSession, Repository } from '../../shared/types';

interface RemoveWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorktreeSession | null;
  repository: Repository | null;
}

type DeleteMode = 'delete-completely' | 'remove-from-app';

export function RemoveWorktreeDialog({
  open,
  onOpenChange,
  session,
  repository,
}: RemoveWorktreeDialogProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDirty, setIsCheckingDirty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('delete-completely');
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  const { removeWorktreeSession, activeTerminalId, setActiveTerminal } = useAppStore();

  // Check if worktree is dirty when dialog opens
  useEffect(() => {
    if (!session || !open) {
      setIsDirty(false);
      setIsCheckingDirty(false);
      setError(null);
      setDeleteMode('delete-completely');
      setIsRunningCleanup(false);
      return;
    }

    setIsCheckingDirty(true);
    setError(null);
    window.terminal
      .isWorktreeDirty(session.path)
      .then(setIsDirty)
      .catch(() => setIsDirty(false))
      .finally(() => setIsCheckingDirty(false));
  }, [session, open]);

  const executeDeleteCompletely = async () => {
    if (!session || !repository) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Kill all terminals for this session (including all tabs) and wait for them to exit
      // This is critical on Windows where file locks persist until process terminates
      try {
        await window.terminal.killAllForWorktree(session.id);
      } catch {
        // No terminals running for this worktree
      }

      // 2. Remove worktree from filesystem (always use force since user confirmed deletion)
      const branchToDelete = session.branchName;
      await window.terminal.forceRemoveWorktree(repository.path, session.path, branchToDelete);

      // 3. Run cleanup script if configured (after deletion, from repo root)
      const cleanupScript = repository.scriptsConfig?.cleanupScript;
      if (cleanupScript && cleanupScript.trim() !== '') {
        setIsRunningCleanup(true);

        // Build environment variables for cleanup script
        const envVars: Record<string, string> = {
          TERMPAD_WORKSPACE_NAME: session.branchName || session.label,
          TERMPAD_WORKSPACE_PATH: session.path,
          TERMPAD_ROOT_PATH: repository.path,
        };
        if (session.portOffset !== undefined && repository.portRangeStart !== undefined) {
          envVars.TERMPAD_PORT = String(repository.portRangeStart + session.portOffset);
        }

        // Run cleanup script in background (30 second timeout)
        const result = await window.terminal.runScript(
          repository.path,
          cleanupScript,
          envVars,
          30000
        );
        if (!result.success) {
          console.error('[RemoveWorktreeDialog] Cleanup script failed:', result.error);
        }

        setIsRunningCleanup(false);
      }

      // 4. If this was the active terminal, clear selection
      if (activeTerminalId === session.id) {
        setActiveTerminal(null);
      }

      // 5. Remove worktree from app store
      removeWorktreeSession(repository.id, session.id);

      // Close dialog
      onOpenChange(false);
    } catch (err) {
      setError('Failed to remove worktree');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    // Prevent AlertDialogAction from auto-closing the dialog
    e.preventDefault();

    if (!session || !repository) {
      return;
    }

    if (deleteMode === 'remove-from-app') {
      // Just remove from store, no filesystem changes
      removeWorktreeSession(repository.id, session.id);
      if (activeTerminalId === session.id) {
        setActiveTerminal(null);
      }
      onOpenChange(false);
      return;
    }

    // Delete completely mode - execute deletion directly (warning is already shown if dirty)
    await executeDeleteCompletely();
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  if (!session || !repository) return null;

  const worktreeName = session.label;
  const branchName = session.branchName;
  const isProtectedBranch = branchName === 'main' || branchName === 'master';

  // Determine button label based on mode and current state
  const getButtonLabel = () => {
    if (isRunningCleanup) return 'Running cleanup...';
    if (deleteMode === 'remove-from-app') return 'Remove from App';
    return 'Delete Worktree';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg sm:min-h-[320px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <GitBranch className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Remove Worktree</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2">
            How would you like to remove &quot;{worktreeName}&quot;?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isProtectedBranch ? (
          <div className="py-2">
            <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                Cannot delete the <strong>{branchName}</strong> branch. This is a protected branch.
              </span>
            </div>
          </div>
        ) : isCheckingDirty ? (
          <div className="py-4 text-center text-muted-foreground">Checking worktree status...</div>
        ) : (
          <div className="space-y-4 py-2">
            {isDirty && (
              <div className="flex items-center gap-2 p-3 rounded bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>This worktree has uncommitted changes that will be permanently lost.</span>
              </div>
            )}

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
                    Remove the worktree directory, delete the local branch
                    {branchName && (
                      <>
                        {' '}
                        <strong>{branchName}</strong>
                      </>
                    )}
                    , and remove from app. Any configured cleanup scripts will run after deletion.
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
                    Just stop tracking this worktree. Keep files and branch intact.
                  </span>
                </div>
              </div>
            </RadioGroup>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || isCheckingDirty || isProtectedBranch}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getButtonLabel()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
