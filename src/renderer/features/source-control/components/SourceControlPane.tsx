import { useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '../../../stores/appStore';
import { useSourceControl } from '../../../hooks/useSourceControl';
import { CommitSection } from './CommitSection';
import { FileStatusSection } from './FileStatusSection';
import { RemoteStatusBar } from './RemoteStatusBar';
import { DiscardConfirmDialog } from './DiscardConfirmDialog';
import { AddRemoteDialog } from './AddRemoteDialog';
import { SuccessIndicator } from './SuccessIndicator';
import { OperationDrawer } from './OperationDrawer';
import { ErrorDialog } from './ErrorDialog';
import type { FileStatus } from '../../../../shared/types';

interface SourceControlPaneProps {
  repoPath: string | null;
  onViewDiff?: (file: FileStatus) => void;
  onOpenInEditor?: (file: FileStatus) => void;
  onStartReview?: () => void;
}

export function SourceControlPane({
  repoPath,
  onViewDiff,
  onOpenInEditor,
  onStartReview,
}: SourceControlPaneProps) {
  const { settings, updateSettings } = useAppStore();
  const {
    staged,
    unstaged,
    untracked,
    aheadBehind,
    currentBranch,
    remoteUrl,
    isLoading,
    isRefreshing,
    isOperationLoading,
    stageFiles,
    unstageFiles,
    unstageAll,
    discardFiles,
    commit,
    push,
    pull,
    addRemote,
    refresh,
    operationProgress,
    clearOperationProgress,
    cancelOperation,
    hookManifest,
  } = useSourceControl({
    repoPath,
    enabled: !!repoPath,
  });

  // Discard confirmation dialog state
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardDialogFiles, setDiscardDialogFiles] = useState<string[]>([]);
  const [pendingDiscardAction, setPendingDiscardAction] = useState<{
    tracked: string[];
    untracked: string[];
  } | null>(null);

  // Add remote dialog state
  const [addRemoteDialogOpen, setAddRemoteDialogOpen] = useState(false);

  // Error dialog state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  // Success indicator state
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSuccess = useCallback(() => {
    // Clear any existing timer
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    setShowSuccess(true);
    successTimerRef.current = setTimeout(() => {
      setShowSuccess(false);
    }, 1500);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // Stage/unstage individual file handlers
  const handleStageFile = useCallback(
    async (file: FileStatus) => {
      const result = await stageFiles([file.path]);
      if (!result.success && result.error) {
        toast.error(`Failed to stage file: ${result.error}`);
      }
    },
    [stageFiles]
  );

  const handleUnstageFile = useCallback(
    async (file: FileStatus) => {
      const result = await unstageFiles([file.path]);
      if (!result.success && result.error) {
        toast.error(`Failed to unstage file: ${result.error}`);
      }
    },
    [unstageFiles]
  );

  // Bulk stage/unstage handlers
  const handleStageAllUnstaged = useCallback(async () => {
    const files = unstaged.map((f) => f.path);
    if (files.length === 0) return;
    const result = await stageFiles(files);
    if (!result.success && result.error) {
      toast.error(`Failed to stage files: ${result.error}`);
    }
  }, [unstaged, stageFiles]);

  const handleStageAllUntracked = useCallback(async () => {
    const files = untracked.map((f) => f.path);
    if (files.length === 0) return;
    const result = await stageFiles(files);
    if (!result.success && result.error) {
      toast.error(`Failed to stage files: ${result.error}`);
    }
  }, [untracked, stageFiles]);

  const handleUnstageAllStaged = useCallback(async () => {
    const result = await unstageAll();
    if (!result.success && result.error) {
      toast.error(`Failed to unstage files: ${result.error}`);
    }
  }, [unstageAll]);

  // Helper to perform discard operation
  const performDiscard = useCallback(
    async (tracked: string[], untrackedFiles: string[]) => {
      const result = await discardFiles(tracked, untrackedFiles);
      if (!result.success && result.error) {
        toast.error(`Failed to discard changes: ${result.error}`);
      } else {
        triggerSuccess();
      }
    },
    [discardFiles, triggerSuccess]
  );

  // Discard handlers
  const handleDiscardFile = useCallback(
    (file: FileStatus) => {
      const isUntracked = untracked.some((f) => f.path === file.path);
      const tracked = isUntracked ? [] : [file.path];
      const untrackedFiles = isUntracked ? [file.path] : [];

      // Skip confirmation if user has opted out
      if (settings.suppressDiscardWarning) {
        performDiscard(tracked, untrackedFiles);
        return;
      }

      // Show confirmation dialog
      setDiscardDialogFiles([...tracked, ...untrackedFiles]);
      setPendingDiscardAction({ tracked, untracked: untrackedFiles });
      setDiscardDialogOpen(true);
    },
    [untracked, settings.suppressDiscardWarning, performDiscard]
  );

  const handleDiscardConfirm = useCallback(
    async (suppressFutureWarnings: boolean) => {
      if (!pendingDiscardAction) return;

      if (suppressFutureWarnings) {
        updateSettings({ suppressDiscardWarning: true });
      }

      await performDiscard(pendingDiscardAction.tracked, pendingDiscardAction.untracked);

      setDiscardDialogOpen(false);
      setDiscardDialogFiles([]);
      setPendingDiscardAction(null);
    },
    [pendingDiscardAction, performDiscard, updateSettings]
  );

  const handleDiscardCancel = useCallback(() => {
    setDiscardDialogOpen(false);
    setDiscardDialogFiles([]);
    setPendingDiscardAction(null);
  }, []);

  // View full error handler
  const handleViewFullError = useCallback(() => {
    setErrorDialogOpen(true);
  }, []);

  // Close error dialog handler
  const handleCloseErrorDialog = useCallback(() => {
    setErrorDialogOpen(false);
  }, []);

  // Clear commit progress when successful (after a delay for user to see)
  useEffect(() => {
    if (operationProgress.status === 'success') {
      const timer = setTimeout(() => {
        clearOperationProgress();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [operationProgress.status, clearOperationProgress]);

  // Commit handler
  const handleCommit = useCallback(
    async (message: string) => {
      const result = await commit(message);
      // Don't show toast for streaming commits - drawer handles status display
      // Only show success indicator on success
      if (result.success) {
        triggerSuccess();
      }
    },
    [commit, triggerSuccess]
  );

  // Push/Pull handlers
  const handlePush = useCallback(async () => {
    const result = await push();
    if (!result.success && result.error) {
      toast.error(`Push failed: ${result.error}`);
    } else {
      triggerSuccess();
    }
  }, [push, triggerSuccess]);

  const handlePull = useCallback(async () => {
    const result = await pull();
    if (!result.success && result.error) {
      toast.error(`Pull failed: ${result.error}`);
    } else {
      triggerSuccess();
    }
  }, [pull, triggerSuccess]);

  // Add remote handler
  const handleAddRemote = useCallback(
    async (url: string) => {
      const result = await addRemote('origin', url);
      if (!result.success && result.error) {
        toast.error(`Failed to add remote: ${result.error}`);
        throw new Error(result.error); // Throw to keep dialog open on error
      } else {
        triggerSuccess();
        setAddRemoteDialogOpen(false);
      }
    },
    [addRemote, triggerSuccess]
  );

  // Create PR handler (opens GitHub in system browser)
  const handleCreatePR = useCallback(async () => {
    if (!remoteUrl || !currentBranch) return;

    // Convert SSH URL to HTTPS if needed
    let httpUrl = remoteUrl;
    if (remoteUrl.startsWith('git@github.com:')) {
      httpUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '');
    } else if (remoteUrl.includes('github.com')) {
      httpUrl = remoteUrl.replace(/\.git$/, '');
    } else {
      toast.error('Create PR is only supported for GitHub repositories');
      return;
    }

    const prUrl = `${httpUrl}/compare/${currentBranch}?expand=1`;
    await window.electronAPI.openExternal(prUrl);
  }, [remoteUrl, currentBranch]);

  // Show loading state
  if (isLoading && staged.length === 0 && unstaged.length === 0 && untracked.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-muted-foreground"
        data-testid="source-control-pane"
      >
        <RefreshCw className="size-4 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  const hasChanges = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;
  const showChangesSection = staged.length > 0 || unstaged.length > 0;

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col" data-testid="source-control-pane">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between px-3 h-[49px]">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <FileText className="size-4" />
            Source Control
          </h2>
          <div className="flex items-center gap-1">
            {onStartReview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onStartReview}
                    disabled={
                      staged.length === 0 && unstaged.length === 0 && untracked.length === 0
                    }
                    data-testid="start-review-button"
                  >
                    <Eye className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="font-medium">Review changes</p>
                  <p className="text-xs text-muted-foreground">
                    Add comments, then copy to your LLM to fix issues
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={refresh}
                  disabled={isLoading || isRefreshing}
                  data-testid="refresh-button"
                >
                  <RefreshCw
                    className={`size-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Commit Section - key ensures fresh state when switching repos */}
        <CommitSection
          key={repoPath}
          stagedFilesCount={staged.length}
          onCommit={handleCommit}
          isLoading={isOperationLoading}
          hookManifest={hookManifest}
        />

        {/* File sections with scroll area */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="pb-2">
            {hasChanges ? (
              <>
                {/* Staged Changes */}
                <FileStatusSection
                  title="Staged Changes"
                  category="staged"
                  files={staged}
                  onUnstageFile={handleUnstageFile}
                  onBulkAction={staged.length > 0 ? handleUnstageAllStaged : undefined}
                  onViewDiff={onViewDiff}
                  onOpenInEditor={onOpenInEditor}
                />

                {/* Unstaged Changes - always show when there are staged files */}
                <FileStatusSection
                  title="Changes"
                  category="unstaged"
                  files={unstaged}
                  showWhenEmpty={showChangesSection}
                  onStageFile={handleStageFile}
                  onDiscardFile={handleDiscardFile}
                  onBulkAction={unstaged.length > 0 ? handleStageAllUnstaged : undefined}
                  onViewDiff={onViewDiff}
                  onOpenInEditor={onOpenInEditor}
                />

                {/* Untracked Files */}
                <FileStatusSection
                  title="Untracked"
                  category="untracked"
                  files={untracked}
                  onStageFile={handleStageFile}
                  onDiscardFile={handleDiscardFile}
                  onBulkAction={untracked.length > 0 ? handleStageAllUntracked : undefined}
                  onViewDiff={onViewDiff}
                  onOpenInEditor={onOpenInEditor}
                />
              </>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm"
                data-testid="empty-state"
              >
                <FileText className="size-8 mb-2 opacity-50" />
                No changes
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Operation progress drawer */}
        <OperationDrawer
          progress={operationProgress}
          onViewFullError={handleViewFullError}
          onCancel={cancelOperation}
          onClose={clearOperationProgress}
        />

        {/* Success indicator bar */}
        <SuccessIndicator show={showSuccess} />

        {/* Remote Status Bar at bottom */}
        <RemoteStatusBar
          currentBranch={currentBranch}
          aheadBehind={aheadBehind}
          remoteUrl={remoteUrl}
          onPush={handlePush}
          onPull={handlePull}
          onAddRemote={() => setAddRemoteDialogOpen(true)}
          onCreatePR={handleCreatePR}
          isPushLoading={isOperationLoading}
          isPullLoading={isOperationLoading}
          hookManifest={hookManifest}
        />

        {/* Discard Confirmation Dialog */}
        <DiscardConfirmDialog
          open={discardDialogOpen}
          files={discardDialogFiles}
          onConfirm={handleDiscardConfirm}
          onCancel={handleDiscardCancel}
        />

        {/* Add Remote Dialog */}
        <AddRemoteDialog
          open={addRemoteDialogOpen}
          onSubmit={handleAddRemote}
          onCancel={() => setAddRemoteDialogOpen(false)}
          isLoading={isOperationLoading}
        />

        {/* Error Dialog */}
        <ErrorDialog
          open={errorDialogOpen}
          onClose={handleCloseErrorDialog}
          errorContent={operationProgress.output}
          title={
            operationProgress.operationSucceeded
              ? `${operationProgress.currentHook || 'Post'} Hook Failed`
              : operationProgress.operationType === 'push'
                ? 'Push Failed'
                : 'Commit Failed'
          }
          description={
            operationProgress.operationSucceeded
              ? `The ${operationProgress.operationType || 'commit'} succeeded, but the ${operationProgress.currentHook || 'post'} hook failed. See the error output below.`
              : 'The operation failed. See the full error output below.'
          }
          isPostHookFailure={operationProgress.operationSucceeded === true}
        />
      </div>
    </TooltipProvider>
  );
}
