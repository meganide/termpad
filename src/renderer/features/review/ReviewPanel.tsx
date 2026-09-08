import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Columns,
  LayoutList,
  Maximize2,
  Minimize2,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { BranchInfo } from '../../../shared/types';
import { createReviewStore, ReviewStoreContext, useReviewStore } from '../../stores/reviewStore';
import { useAppStore } from '../../stores/appStore';
import { ReviewIconButton } from './components/ReviewIconButton';
import { DiffReviewModal } from './DiffReviewModal';
import { ReviewToolbar } from './components/ReviewToolbar';
import { reconcileDiffFiles } from './utils/reconcileDiffFiles';

export interface ReviewRequest {
  id: number;
  filePath?: string;
}

interface ReviewPanelProps {
  repoPath: string;
  active: boolean;
  request?: ReviewRequest;
  expanded: boolean;
  onToggleExpanded: () => void;
  enabled?: boolean;
  onFileCountChange?: (repoPath: string, base: string, count: number | null) => void;
}

export function ReviewPanel({
  repoPath,
  active,
  request,
  expanded,
  onToggleExpanded,
  enabled = active,
  onFileCountChange,
}: ReviewPanelProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [base, setBase] = useState('HEAD');
  const [visited, setVisited] = useState(['HEAD']);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    window.terminal
      .listBranches(repoPath)
      .then((result) => {
        if (!cancelled) {
          setBranches(result);
          setBranchError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBranchError('Could not load branches. Reopen Review to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, [active, repoPath]);

  const [lastRequest, setLastRequest] = useState(request);
  if (request !== lastRequest) {
    setLastRequest(request);
    if (request) setBase('HEAD');
  }

  const changeBase = (value: string) => {
    setVisited((previous) => (previous.includes(value) ? previous : [...previous, value]));
    setBase(value);
  };
  const currentBranch = branches.find((branch) => branch.isCurrent)?.name;
  const choices = branches
    .filter((branch) => !branch.isCurrent)
    .sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        Number(a.isRemote) - Number(b.isRemote) ||
        a.name.localeCompare(b.name)
    );

  return (
    <div className="@container/review flex h-full min-h-0 flex-col" data-testid="review-panel">
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`review-base-${repoPath}`}
            className="shrink-0 text-xs text-muted-foreground"
          >
            Base
          </label>
          <select
            id={`review-base-${repoPath}`}
            aria-label="Review base branch"
            value={base}
            onChange={(event) => changeBase(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="HEAD">
              Current branch{currentBranch ? ` (${currentBranch})` : ''} · HEAD
            </option>
            {base !== 'HEAD' && !choices.some((branch) => branch.name === base) && (
              <option value={base}>{base}</option>
            )}
            {choices.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
          <ReviewIconButton
            label={expanded ? 'Collapse review' : 'Expand review'}
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Collapse review' : 'Expand review'}
            title={expanded ? 'Collapse review' : 'Expand review'}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </ReviewIconButton>
        </div>
        <p className="text-xs text-muted-foreground">
          {base === 'HEAD'
            ? 'Uncommitted changes, including staged and untracked files.'
            : `Changes since the common ancestor with ${base}, including uncommitted changes.`}
        </p>
        {branchError && (
          <p role="alert" className="text-xs text-destructive">
            {branchError}
          </p>
        )}
      </div>
      {visited.map((comparisonBase) => (
        <Comparison
          key={comparisonBase}
          repoPath={repoPath}
          base={comparisonBase}
          active={active && base === comparisonBase}
          visible={base === comparisonBase}
          enabled={enabled && base === comparisonBase}
          treeCollapsed={treeCollapsed}
          onToggleTree={() => setTreeCollapsed((value) => !value)}
          onFileCountChange={onFileCountChange}
          request={comparisonBase === 'HEAD' ? request : undefined}
        />
      ))}
    </div>
  );
}

function Comparison(props: {
  repoPath: string;
  base: string;
  active: boolean;
  visible: boolean;
  request?: ReviewRequest;
  enabled: boolean;
  treeCollapsed: boolean;
  onToggleTree: () => void;
  onFileCountChange?: ReviewPanelProps['onFileCountChange'];
}) {
  const [store] = useState(createReviewStore);
  return (
    <ReviewStoreContext.Provider value={store}>
      <ComparisonContent {...props} store={store} />
    </ReviewStoreContext.Provider>
  );
}

function ComparisonContent({
  repoPath,
  base,
  active,
  visible,
  request,
  store,
  enabled,
  treeCollapsed,
  onToggleTree,
  onFileCountChange,
}: {
  repoPath: string;
  base: string;
  active: boolean;
  visible: boolean;
  request?: ReviewRequest;
  store: ReturnType<typeof createReviewStore>;
  enabled: boolean;
  treeCollapsed: boolean;
  onToggleTree: () => void;
  onFileCountChange?: ReviewPanelProps['onFileCountChange'];
}) {
  const review = useReviewStore((state) => state.currentReview);
  const setViewMode = useReviewStore((state) => state.setViewMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);
  const throttleMs = useAppStore((state) => state.settings.gitPollIntervalMs);

  useEffect(() => {
    if (visible) onFileCountChange?.(repoPath, base, review?.files.length ?? null);
  }, [visible, repoPath, base, review?.files.length, onFileCountChange]);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      refreshQueued.current = true;
      return;
    }
    inFlight.current = true;
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await window.terminal.getWorkingTreeDiff(repoPath, base);
      if (generation.current !== version) return;
      const state = store.getState();
      if (!state.currentReview) {
        await state.openWorkingTreeReview(repoPath, result.files, result.headCommit, base);
        const loadError = store.getState().error;
        if (loadError) throw new Error(loadError);
      } else {
        const previousFiles = state.currentReview.files;
        const files = reconcileDiffFiles(previousFiles, result.files);
        if (state.reviewData?.baseCommit === result.headCommit && files === previousFiles) return;
        const previousByPath = new Map(previousFiles.map((file) => [file.path, file]));
        const unchanged = new Set(
          files.filter((file) => file === previousByPath.get(file.path)).map((file) => file.path)
        );
        const reviewData = state.reviewData && {
          ...state.reviewData,
          baseCommit: result.headCommit,
          lastCommitHash: result.headCommit,
          files: files.map((file) => ({
            path: file.path,
            viewed: unchanged.has(file.path) && state.isFileViewed(file.path),
          })),
        };
        store.setState({
          currentReview: { ...state.currentReview, files },
          reviewData,
          expandedRanges: new Map(
            [...state.expandedRanges].filter(([path]) => unchanged.has(path))
          ),
        });
        if (reviewData) await window.reviewStorage.save(reviewData);
      }
    } catch (cause) {
      if (generation.current === version)
        setError(cause instanceof Error ? cause.message : 'Could not load review');
    } finally {
      inFlight.current = false;
      if (generation.current === version) setLoading(false);
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refresh();
      }
    }
  }, [repoPath, base, store]);

  useEffect(() => {
    if (!enabled || !active) return;
    void refresh();
    // Reuse the app's throttled repository watcher for live updates.
    void window.watcher.watchRepoChanges(repoPath, throttleMs);
    const unsubscribe = window.watcher.onRepoChanged(repoPath, () => {
      void refresh();
    });
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      refreshQueued.current = false;
      // Invalidate in-flight work when this comparison is hidden or removed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      unsubscribe();
      void window.watcher.unwatchRepoChanges(repoPath);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, active, refresh, repoPath, throttleMs]);

  // Hidden comparisons keep only their badge current. Full hunks and drafts
  // remain mounted in the store and reconcile when the user opens Review again.
  useEffect(() => {
    if (!enabled || active || !onFileCountChange) return;
    let disposed = false;
    let fetching = false;
    let queued = false;
    const refreshCount = async () => {
      if (disposed) return;
      if (fetching) {
        queued = true;
        return;
      }
      fetching = true;
      try {
        const count = await window.terminal.getReviewFileCount(repoPath, base);
        if (!disposed) onFileCountChange(repoPath, base, count);
      } catch {
        if (!disposed) onFileCountChange(repoPath, base, null);
      } finally {
        fetching = false;
        if (queued && !disposed) {
          queued = false;
          void refreshCount();
        }
      }
    };
    void refreshCount();
    void window.watcher.watchRepoChanges(repoPath, throttleMs);
    const unsubscribe = window.watcher.onRepoChanged(repoPath, refreshCount);
    window.addEventListener('focus', refreshCount);
    return () => {
      disposed = true;
      unsubscribe();
      void window.watcher.unwatchRepoChanges(repoPath);
      window.removeEventListener('focus', refreshCount);
    };
  }, [enabled, active, repoPath, base, throttleMs, onFileCountChange]);

  const appliedRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!review || !request || appliedRequest.current === request.id) return;
    appliedRequest.current = request.id;
    if (request.filePath) {
      store.getState().setSelectedFile(request.filePath);
      if (store.getState().isFileViewed(request.filePath))
        void store.getState().markFileUnviewed(request.filePath);
    }
  }, [review, request, store]);

  return (
    <div className={visible ? 'flex flex-1 min-h-0 flex-col' : 'hidden'}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
        <div className="flex items-center gap-1">
          <ReviewIconButton
            label={treeCollapsed ? 'Expand file tree' : 'Collapse file tree'}
            className="size-7"
            onClick={onToggleTree}
            aria-expanded={!treeCollapsed}
          >
            {treeCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </ReviewIconButton>
          <ReviewIconButton
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => void refresh()}
            disabled={loading}
            label="Refresh review"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </ReviewIconButton>
          <ReviewIconButton
            variant={review?.viewMode === 'unified' ? 'secondary' : 'ghost'}
            size="icon"
            className="size-7"
            onClick={() => setViewMode('unified')}
            label="Unified diff"
            aria-pressed={review?.viewMode === 'unified'}
          >
            <LayoutList className="size-4" />
          </ReviewIconButton>
          <ReviewIconButton
            variant={review?.viewMode === 'split' ? 'secondary' : 'ghost'}
            size="icon"
            className="size-7"
            onClick={() => setViewMode('split')}
            label="Split diff"
            aria-pressed={review?.viewMode === 'split'}
          >
            <Columns className="size-4" />
          </ReviewIconButton>
        </div>
        <ReviewToolbar />
      </div>
      {error && (
        <p role="alert" className="px-3 pb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!review && !error && (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading review…
        </p>
      )}
      {review && (
        <DiffReviewModal
          embedded
          treeCollapsed={treeCollapsed}
          toolbar={<></>}
          isOpen={active}
          onClose={() => undefined}
        />
      )}
    </div>
  );
}
