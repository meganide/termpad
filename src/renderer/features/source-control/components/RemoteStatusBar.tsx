import { GitBranch, ArrowUp, ArrowDown, Plus, ExternalLink, RefreshCw } from 'lucide-react';

// GitHub-style Pull Request icon
function GitPullRequestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import type { AheadBehindResult, HookManifest } from '../../../../shared/types';

interface RemoteStatusBarProps {
  currentBranch: string | null;
  aheadBehind: AheadBehindResult;
  remoteUrl: string | null;
  onPush: () => Promise<void>;
  onPull: () => Promise<void>;
  onAddRemote: () => void;
  onCreatePR: () => void;
  isPushLoading?: boolean;
  isPullLoading?: boolean;
  hookManifest?: HookManifest | null;
}

export function RemoteStatusBar({
  currentBranch,
  aheadBehind,
  remoteUrl,
  onPush,
  onPull,
  onAddRemote,
  onCreatePR,
  isPushLoading = false,
  isPullLoading = false,
  hookManifest,
}: RemoteStatusBarProps) {
  const hasRemote = aheadBehind.hasRemote && remoteUrl !== null;
  const hasRemoteBranch = Boolean(aheadBehind.remoteBranch);
  const { ahead, behind } = aheadBehind;
  const isLoading = isPushLoading || isPullLoading;

  // PR status from store
  const ghCliAvailable = useAppStore((state) => state.ghCliAvailable);
  const prStatuses = useAppStore((state) => state.prStatuses);
  const prStatusLoading = useAppStore((state) => state.prStatusLoading);
  const fetchPRStatuses = useAppStore((state) => state.fetchPRStatuses);

  // Look up PR status for current branch
  const prStatus = currentBranch ? prStatuses[currentBranch] : undefined;
  const hasPR = prStatus !== undefined;

  // Extract GitHub URL for PR creation
  const getGitHubPRUrl = (): string | null => {
    if (!remoteUrl || !currentBranch) return null;

    // Convert SSH URL to HTTPS if needed
    let httpUrl = remoteUrl;
    if (remoteUrl.startsWith('git@github.com:')) {
      httpUrl = remoteUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '');
    } else if (remoteUrl.includes('github.com')) {
      httpUrl = remoteUrl.replace(/\.git$/, '');
    } else {
      // Not a GitHub URL
      return null;
    }

    return `${httpUrl}/compare/${currentBranch}?expand=1`;
  };

  const prUrl = getGitHubPRUrl();

  const handlePush = async () => {
    if (isPushLoading || isPullLoading) return;
    await onPush();
  };

  const handlePull = async () => {
    if (isPushLoading || isPullLoading) return;
    await onPull();
  };

  const handleCreatePR = () => {
    if (prUrl) {
      onCreatePR();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2" data-testid="remote-status-bar">
      {/* Branch info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <GitBranch className="size-4 text-muted-foreground flex-shrink-0" />
        <span
          className="text-sm text-muted-foreground truncate"
          title={currentBranch ?? 'No branch'}
          data-testid="branch-name"
        >
          {currentBranch ?? 'No branch'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1" data-testid="action-buttons">
        {hasRemote ? (
          <>
            {/* Pull button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-9 px-2', behind > 0 && 'text-primary')}
                  onClick={handlePull}
                  disabled={isLoading || !hasRemoteBranch}
                  data-testid="pull-button"
                >
                  {isPullLoading ? (
                    <Spinner className="size-4" data-testid="pull-spinner" />
                  ) : (
                    <>
                      <ArrowDown className="size-4" />
                      {behind > 0 && (
                        <span className="ml-0.5" data-testid="behind-badge">
                          {behind}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!hasRemoteBranch
                  ? 'No remote branch (push to create)'
                  : behind > 0
                    ? `Pull ${behind} commit${behind !== 1 ? 's' : ''} from remote`
                    : 'Pull changes from remote'}
              </TooltipContent>
            </Tooltip>

            {/* Push button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-9 px-2', (ahead > 0 || !hasRemoteBranch) && 'text-primary')}
                  onClick={handlePush}
                  disabled={isLoading}
                  data-testid="push-button"
                >
                  {isPushLoading ? (
                    <Spinner className="size-4" data-testid="push-spinner" />
                  ) : (
                    <>
                      <ArrowUp className="size-4" />
                      {ahead > 0 && (
                        <span className="ml-0.5" data-testid="ahead-badge">
                          {ahead}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!hasRemoteBranch ? (
                  'Push and create remote branch'
                ) : (
                  <>
                    <p>
                      {ahead > 0
                        ? `Push ${ahead} commit${ahead !== 1 ? 's' : ''} to remote`
                        : 'Push changes to remote'}
                    </p>
                    {hookManifest && (hookManifest['pre-push'] || hookManifest['post-push']) && (
                      <p className="text-xs text-muted-foreground">
                        Hooks:{' '}
                        {[
                          hookManifest['pre-push'] && 'pre-push',
                          hookManifest['post-push'] && 'post-push',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Refresh PR status button */}
            {ghCliAvailable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    onClick={() => fetchPRStatuses()}
                    disabled={prStatusLoading}
                    data-testid="refresh-pr-status-button"
                  >
                    {prStatusLoading ? (
                      <Spinner className="size-4" data-testid="pr-status-spinner" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh PR status</TooltipContent>
              </Tooltip>
            )}

            {/* PR button - show for GitHub repos */}
            {prUrl !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {hasPR ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-9 px-2',
                        prStatus.state === 'OPEN' && 'text-green-500',
                        prStatus.state === 'MERGED' && 'text-purple-500'
                      )}
                      onClick={() => window.electronAPI.openExternal(prStatus.url)}
                      disabled={isLoading}
                      data-testid="view-pr-button"
                    >
                      <GitPullRequestIcon className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-9 px-2',
                        // Green when gh CLI confirms no PR exists and button is enabled
                        ghCliAvailable === true && hasRemoteBranch && 'text-green-500'
                      )}
                      onClick={handleCreatePR}
                      disabled={isLoading || !hasRemoteBranch}
                      data-testid="create-pr-button"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {!hasRemoteBranch ? (
                    'Push branch first to create PR'
                  ) : hasPR ? (
                    prStatus.state === 'MERGED' ? (
                      `View merged PR #${prStatus.number}`
                    ) : (
                      `View PR #${prStatus.number}`
                    )
                  ) : ghCliAvailable === null ? (
                    'Create pull request'
                  ) : ghCliAvailable === false ? (
                    <>
                      Create pull request
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Tip: Install gh CLI to see PR status
                      </span>
                    </>
                  ) : (
                    'Create pull request'
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          /* Add Remote button - shown when no remote configured */
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2"
                onClick={onAddRemote}
                data-testid="add-remote-button"
              >
                <Plus className="size-4 mr-1" />
                Add Remote
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a remote repository</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
