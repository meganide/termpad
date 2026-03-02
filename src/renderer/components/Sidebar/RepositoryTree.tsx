import { useState, Fragment, useRef } from 'react';
import { ChevronRight, Plus, GripVertical, GitBranch, Settings, Trash2, Home } from 'lucide-react';
import { GitPullRequestIcon } from '@primer/octicons-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { RepositoryContextMenu } from './RepositoryContextMenu';
import { WorktreeDropdownMenu } from './WorktreeDropdownMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { AssignShortcutDialog } from '../AssignShortcutDialog';
import { formatShortcut } from '../../utils/shortcuts';
import { getAddWorktreeItemId } from '../../utils/sidebarNavigation';
import { useGitStatus } from '../../hooks/useGitStatus';
import { useAppStore } from '../../stores/appStore';
import type {
  Repository,
  WorktreeSession,
  TerminalState,
  TerminalStatus,
  WorktreeTabState,
  TerminalTab,
  SidebarStatusFocus,
} from '../../../shared/types';

/**
 * Get shortcut display text for a session
 * Only shows shortcuts that are actually assigned - no positional fallback
 */
function getShortcutDisplay(session: WorktreeSession): string | null {
  if (session.customShortcut) {
    return formatShortcut(session.customShortcut);
  }
  return null;
}

interface RepositoryTreeProps {
  repositories: Repository[];
  activeSessionId: string | null;
  terminals: Map<string, TerminalState>;
  focusedItemId?: string | null;
  statusFocus?: SidebarStatusFocus | null;
  worktreeTabs: WorktreeTabState[];
  getTerminalIdForTab: (worktreeSessionId: string, tabId: string) => string;
  onSessionClick: (sessionId: string) => void;
  onTabClick: (sessionId: string, tabId: string) => void;
  onNewWorktree: (repositoryId: string) => void;
  onToggleExpand: (repositoryId: string) => void;
  onRepositoryDelete: (repository: Repository) => void;
  onOpenRepositorySettings: (repository: Repository) => void;
  onWorktreeRemove: (session: WorktreeSession, repository: Repository) => void;
  onReorderSessions: (repositoryId: string, fromIndex: number, toIndex: number) => void;
  onReorderRepositories: (fromIndex: number, toIndex: number) => void;
  onDropdownOpen?: () => void;
}

// Drag state for sessions within a repository
interface SessionDragState {
  repositoryId: string;
  sessionId: string;
  fromIndex: number;
}

// Drag state for repositories
interface RepositoryDragState {
  repositoryId: string;
  fromIndex: number;
}

export function RepositoryTree({
  repositories,
  activeSessionId,
  terminals,
  focusedItemId,
  statusFocus,
  worktreeTabs,
  getTerminalIdForTab,
  onSessionClick,
  onTabClick,
  onNewWorktree,
  onToggleExpand,
  onRepositoryDelete,
  onOpenRepositorySettings,
  onWorktreeRemove,
  onReorderSessions,
  onReorderRepositories,
  onDropdownOpen,
}: RepositoryTreeProps) {
  const [shortcutDialogSession, setShortcutDialogSession] = useState<WorktreeSession | null>(null);
  // Session drag state (for reordering sessions within a repository)
  const [sessionDragState, setSessionDragState] = useState<SessionDragState | null>(null);
  const [sessionDropTargetIndex, setSessionDropTargetIndex] = useState<number | null>(null);
  // Ref for synchronous access to drag state (React state is async)
  const sessionDragStateRef = useRef<SessionDragState | null>(null);
  // Repository drag state (for reordering repositories)
  const [repositoryDragState, setRepositoryDragState] = useState<RepositoryDragState | null>(null);
  const [dropTargetRepositoryIndex, setDropTargetRepositoryIndex] = useState<number | null>(null);

  // Handle repository drop
  const handleRepositoryDrop = (toIndex: number) => {
    if (repositoryDragState) {
      onReorderRepositories(repositoryDragState.fromIndex, toIndex);
    }
    setRepositoryDragState(null);
    setDropTargetRepositoryIndex(null);
  };

  return (
    <>
      <div className="flex flex-col px-2 py-3">
        {repositories.map((repository, index) => (
          <Fragment key={repository.id}>
            {index > 0 && <div className="h-3" />}
            <RepositoryItem
              repository={repository}
              repositoryIndex={index}
              activeSessionId={activeSessionId}
              terminals={terminals}
              isFocused={focusedItemId === repository.id}
              isAddWorktreeFocused={focusedItemId === getAddWorktreeItemId(repository.id)}
              focusedSessionId={focusedItemId}
              statusFocus={statusFocus}
              worktreeTabs={worktreeTabs}
              getTerminalIdForTab={getTerminalIdForTab}
              onSessionClick={onSessionClick}
              onTabClick={onTabClick}
              onNewWorktree={onNewWorktree}
              onToggleExpand={onToggleExpand}
              onDelete={onRepositoryDelete}
              onOpenSettings={onOpenRepositorySettings}
              onWorktreeRemove={onWorktreeRemove}
              onAssignShortcut={setShortcutDialogSession}
              sessionDragState={sessionDragState}
              sessionDropTargetIndex={sessionDropTargetIndex}
              onSessionDragStart={(sessionId, fromIndex) => {
                const dragState = { repositoryId: repository.id, sessionId, fromIndex };
                sessionDragStateRef.current = dragState;
                setSessionDragState(dragState);
              }}
              onSessionDragEnd={() => {
                sessionDragStateRef.current = null;
                setSessionDragState(null);
                setSessionDropTargetIndex(null);
              }}
              onSessionDragOver={(toIndex) => setSessionDropTargetIndex(toIndex)}
              onSessionDrop={(toIndex) => {
                const dragState = sessionDragStateRef.current;
                if (dragState && dragState.repositoryId === repository.id) {
                  onReorderSessions(repository.id, dragState.fromIndex, toIndex);
                }
                sessionDragStateRef.current = null;
                setSessionDragState(null);
                setSessionDropTargetIndex(null);
              }}
              getSessionDragState={() => sessionDragStateRef.current}
              isRepositoryDragging={repositoryDragState?.repositoryId === repository.id}
              isRepositoryDropTarget={
                repositoryDragState !== null && dropTargetRepositoryIndex === index
              }
              onRepositoryDragStart={() =>
                setRepositoryDragState({ repositoryId: repository.id, fromIndex: index })
              }
              onRepositoryDragEnd={() => {
                setRepositoryDragState(null);
                setDropTargetRepositoryIndex(null);
              }}
              onRepositoryDragOver={() => setDropTargetRepositoryIndex(index)}
              onRepositoryDrop={() => handleRepositoryDrop(index)}
              onDropdownOpen={onDropdownOpen}
            />
          </Fragment>
        ))}
      </div>
      <AssignShortcutDialog
        open={!!shortcutDialogSession}
        onOpenChange={(open) => !open && setShortcutDialogSession(null)}
        session={shortcutDialogSession}
      />
    </>
  );
}

interface RepositoryItemProps {
  repository: Repository;
  repositoryIndex: number;
  activeSessionId: string | null;
  terminals: Map<string, TerminalState>;
  isFocused: boolean;
  isAddWorktreeFocused: boolean;
  focusedSessionId?: string | null;
  statusFocus?: SidebarStatusFocus | null;
  worktreeTabs: WorktreeTabState[];
  getTerminalIdForTab: (worktreeSessionId: string, tabId: string) => string;
  onSessionClick: (sessionId: string) => void;
  onTabClick: (sessionId: string, tabId: string) => void;
  onNewWorktree: (repositoryId: string) => void;
  onToggleExpand: (repositoryId: string) => void;
  onDelete: (repository: Repository) => void;
  onOpenSettings: (repository: Repository) => void;
  onWorktreeRemove: (session: WorktreeSession, repository: Repository) => void;
  onAssignShortcut: (session: WorktreeSession) => void;
  // Session drag props
  sessionDragState: SessionDragState | null;
  sessionDropTargetIndex: number | null;
  onSessionDragStart: (sessionId: string, fromIndex: number) => void;
  onSessionDragEnd: () => void;
  onSessionDragOver: (toIndex: number) => void;
  onSessionDrop: (toIndex: number) => void;
  getSessionDragState: () => SessionDragState | null;
  // Repository drag props
  isRepositoryDragging: boolean;
  isRepositoryDropTarget: boolean;
  onRepositoryDragStart: () => void;
  onRepositoryDragEnd: () => void;
  onRepositoryDragOver: () => void;
  onRepositoryDrop: () => void;
  onDropdownOpen?: () => void;
}

function RepositoryItem({
  repository,
  repositoryIndex: _repositoryIndex,
  activeSessionId,
  terminals,
  isFocused,
  isAddWorktreeFocused,
  focusedSessionId,
  statusFocus,
  worktreeTabs,
  getTerminalIdForTab,
  onSessionClick,
  onTabClick,
  onNewWorktree,
  onToggleExpand,
  onDelete,
  onOpenSettings,
  onWorktreeRemove,
  onAssignShortcut,
  sessionDragState,
  sessionDropTargetIndex,
  onSessionDragStart,
  onSessionDragEnd,
  onSessionDragOver,
  onSessionDrop,
  getSessionDragState,
  isRepositoryDragging,
  isRepositoryDropTarget,
  onRepositoryDragStart,
  onRepositoryDragEnd,
  onRepositoryDragOver,
  onRepositoryDrop,
  onDropdownOpen,
}: RepositoryItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isDraggingSessionFromThisRepository = sessionDragState?.repositoryId === repository.id;

  // Track if dragging started from the drag handle
  const isRepositoryDragHandleRef = useRef(false);

  const handleRepositoryDragStart = (e: React.DragEvent) => {
    // Only allow drag from the handle
    if (!isRepositoryDragHandleRef.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', repository.id);
    onRepositoryDragStart();
  };

  const handleRepositoryDragEnd = () => {
    // Always reset the drag handle ref and notify parent
    isRepositoryDragHandleRef.current = false;
    onRepositoryDragEnd();
  };

  const handleRepositoryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onRepositoryDragOver();
  };

  const handleRepositoryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onRepositoryDrop();
  };

  return (
    <div className="relative">
      {/* Drop indicator line - shows above the repository */}
      <div
        className={cn(
          'absolute -top-1.5 left-0 right-0 h-0.5 rounded-full bg-primary transition-opacity duration-150',
          isRepositoryDropTarget ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        draggable
        onDragStart={handleRepositoryDragStart}
        onDragEnd={handleRepositoryDragEnd}
        onDragOver={handleRepositoryDragOver}
        onDrop={handleRepositoryDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'transition-all duration-150',
          isRepositoryDragging && 'opacity-40 scale-[0.98]'
        )}
      >
        {/* Repository Header with Context Menu */}
        <RepositoryContextMenu
          repository={repository}
          onDelete={onDelete}
          onOpenSettings={onOpenSettings}
          onOpenChange={setIsMenuOpen}
        >
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-2 rounded-lg group cursor-pointer transition-all duration-200',
              'hover:bg-sidebar-accent/70',
              isMenuOpen && 'bg-sidebar-accent',
              isFocused && 'ring-1 ring-primary/40',
              repository.isExpanded && 'bg-sidebar-accent/40'
            )}
            onClick={() => onOpenSettings(repository)}
          >
            {/* Drag handle - progressive disclosure */}
            <div
              className={cn(
                'shrink-0 cursor-grab active:cursor-grabbing transition-opacity duration-200 -ml-0.5',
                isHovered || isMenuOpen ? 'opacity-50 hover:opacity-100' : 'opacity-0'
              )}
              onMouseDown={() => {
                isRepositoryDragHandleRef.current = true;
              }}
              onMouseUp={() => {
                isRepositoryDragHandleRef.current = false;
              }}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(repository.id);
              }}
              className="p-0.5 -ml-1 hover:bg-sidebar-accent/40 rounded transition-colors duration-150"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  repository.isExpanded && 'rotate-90'
                )}
              />
            </button>
            <span className="flex-1 text-sm font-semibold truncate">{repository.name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSettings(repository);
                  }}
                  className={cn(
                    'p-1 rounded transition-all duration-150',
                    'hover:bg-sidebar-accent/60',
                    'opacity-0 group-hover:opacity-60 hover:!opacity-100',
                    isMenuOpen && 'opacity-60'
                  )}
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                <span className="text-xs">Repository Settings</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </RepositoryContextMenu>

        {/* Sessions */}
        {repository.isExpanded && (
          <div className="ml-3 mt-2 flex flex-col gap-1 pl-2 border-l border-border/40">
            {/* Add Worktree button - fixed at top */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNewWorktree(repository.id)}
              className={cn(
                'justify-start h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent w-full transition-colors duration-150',
                isAddWorktreeFocused && 'ring-1 ring-primary/40'
              )}
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Worktree
            </Button>
            {repository.worktreeSessions.map((session, index) => {
              // Get tabs for this worktree session, sorted by order
              const tabState = worktreeTabs.find((wt) => wt.worktreeSessionId === session.id);
              const tabs = tabState ? [...tabState.tabs].sort((a, b) => a.order - b.order) : [];
              return (
                <SessionItem
                  key={session.id}
                  session={session}
                  repository={repository}
                  index={index}
                  isActive={session.id === activeSessionId}
                  isFocused={session.id === focusedSessionId}
                  focusedIndicatorIndex={
                    statusFocus?.worktreeSessionId === session.id
                      ? statusFocus.indicatorIndex
                      : null
                  }
                  terminalState={terminals.get(session.id)}
                  tabs={tabs}
                  terminals={terminals}
                  getTerminalIdForTab={getTerminalIdForTab}
                  onClick={() => onSessionClick(session.id)}
                  onTabClick={(tabId) => onTabClick(session.id, tabId)}
                  onWorktreeRemove={onWorktreeRemove}
                  onAssignShortcut={onAssignShortcut}
                  isDragging={sessionDragState?.sessionId === session.id}
                  isDropTarget={
                    isDraggingSessionFromThisRepository && sessionDropTargetIndex === index
                  }
                  repositoryId={repository.id}
                  getSessionDragState={getSessionDragState}
                  onDragStart={() => onSessionDragStart(session.id, index)}
                  onDragEnd={onSessionDragEnd}
                  onDragOver={() => onSessionDragOver(index)}
                  onDrop={() => onSessionDrop(index)}
                  onDropdownOpen={onDropdownOpen}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionItemProps {
  session: WorktreeSession;
  repository: Repository;
  index: number;
  isActive: boolean;
  isFocused: boolean;
  focusedIndicatorIndex: number | null;
  terminalState?: TerminalState;
  tabs: TerminalTab[];
  terminals: Map<string, TerminalState>;
  getTerminalIdForTab: (worktreeSessionId: string, tabId: string) => string;
  onClick: () => void;
  onTabClick: (tabId: string) => void;
  onWorktreeRemove: (session: WorktreeSession, repository: Repository) => void;
  onAssignShortcut: (session: WorktreeSession) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  repositoryId: string;
  getSessionDragState: () => SessionDragState | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDropdownOpen?: () => void;
}

function SessionItem({
  session,
  repository,
  index: _index,
  isActive,
  isFocused,
  focusedIndicatorIndex,
  terminalState: _terminalState,
  tabs,
  terminals,
  getTerminalIdForTab,
  onClick,
  onTabClick,
  onWorktreeRemove,
  onAssignShortcut,
  isDragging,
  isDropTarget,
  repositoryId,
  getSessionDragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDropdownOpen,
}: SessionItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Poll git status for all sessions, but use slower interval for inactive ones
  const gitStatus = useGitStatus({
    sessionId: session.id,
    path: session.path,
    isActive, // Active sessions poll faster (5s), inactive ones slower (15s)
  });

  // Get PR status for this branch
  const prStatuses = useAppStore((state) => state.prStatuses);
  const prStatus = session.branchName ? prStatuses[session.branchName] : undefined;
  const isMerged = prStatus?.state === 'MERGED';
  const isOpenPR = prStatus?.state === 'OPEN';

  // Track if dragging started from the drag handle
  const isDragHandleRef = useRef(false);

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging main worktree
    if (session.isMainWorktree) {
      e.preventDefault();
      return;
    }
    // Only allow drag from the handle
    if (!isDragHandleRef.current) {
      e.preventDefault();
      return;
    }
    // Stop propagation to prevent repository's dragstart from firing
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', session.id);
    onDragStart();
  };

  const handleDragEnd = () => {
    // Always reset the drag handle ref and notify parent
    isDragHandleRef.current = false;
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Compute canDrop synchronously using the ref
    const dragState = getSessionDragState();
    const canDrop =
      dragState !== null &&
      dragState.repositoryId === repositoryId &&
      dragState.sessionId !== session.id;
    if (!canDrop) return;
    // Prevent dropping on main worktree (would move item to index 0)
    if (session.isMainWorktree) return;
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver();
  };

  const handleDrop = (e: React.DragEvent) => {
    // Compute canDrop synchronously using the ref
    const dragState = getSessionDragState();
    const canDrop =
      dragState !== null &&
      dragState.repositoryId === repositoryId &&
      dragState.sessionId !== session.id;
    if (!canDrop) return;
    // Prevent dropping on main worktree (would move item to index 0)
    if (session.isMainWorktree) return;
    e.stopPropagation();
    e.preventDefault();
    onDrop();
  };

  // Get shortcut display text
  const shortcutDisplay = getShortcutDisplay(session);

  // Determine if we have any status to show
  const hasGitChanges = gitStatus?.isDirty && (gitStatus.additions > 0 || gitStatus.deletions > 0);
  const hasTabs = tabs.length > 0;

  const content = (
    <div className="relative">
      {/* Drop indicator line - shows above the item */}
      <div
        className={cn(
          'absolute -top-0.5 left-2 right-2 h-0.5 rounded-full bg-primary transition-opacity duration-150',
          isDropTarget ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'group relative flex items-start gap-2.5 py-3 pr-2 pl-3 rounded-xl text-sm w-full text-left cursor-pointer transition-all duration-150',
          isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50',
          isMenuOpen && 'bg-sidebar-accent',
          isFocused && 'ring-1 ring-primary/40',
          isDragging && 'opacity-40 scale-[0.98]'
        )}
      >
        {/* Drag handle - progressive disclosure, vertically centered (hidden for main worktree) */}
        {!session.isMainWorktree && (
          <div
            ref={dragHandleRef}
            className={cn(
              'shrink-0 mt-1 cursor-grab active:cursor-grabbing transition-opacity duration-200',
              isHovered || isMenuOpen || isActive ? 'opacity-50 hover:opacity-100' : 'opacity-0'
            )}
            onMouseDown={() => {
              isDragHandleRef.current = true;
            }}
            onMouseUp={() => {
              isDragHandleRef.current = false;
            }}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        {/* Spacer when main worktree (no drag handle) */}
        {session.isMainWorktree && <div className="w-3.5 shrink-0" />}

        {/* Main content area - adaptive height with smooth transitions */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Row 1: branch/PR icon + label */}
          <div className="flex items-center gap-2.5">
            {/* PR-aware icon: shows PR status with color, Home for main, or plain git branch */}
            {prStatus ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(prStatus.url, '_blank');
                    }}
                    className={cn(
                      'shrink-0 p-0.5 -m-0.5 rounded transition-all duration-150',
                      'hover:bg-sidebar-accent/60',
                      isOpenPR && 'text-green-500 hover:text-green-400',
                      isMerged && 'text-violet-500 hover:text-violet-400'
                    )}
                  >
                    <GitPullRequestIcon size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <span className="text-xs">
                    {isOpenPR ? 'Open PR' : 'Merged PR'} #{prStatus.number}
                  </span>
                </TooltipContent>
              </Tooltip>
            ) : session.isMainWorktree ? (
              <Home className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
            ) : (
              <GitBranch className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
            )}
            <span className="flex-1 truncate font-medium">
              {session.isMainWorktree && gitStatus?.branch ? gitStatus.branch : session.label}
            </span>
          </div>

          {/* Row 2: git stats - collapses when empty with smooth transition */}
          <div
            className={cn(
              'flex items-center gap-2 pl-7 text-xs font-mono transition-all duration-200 overflow-hidden',
              hasGitChanges ? 'min-h-4 opacity-100' : 'min-h-0 opacity-0'
            )}
          >
            {hasGitChanges && (
              <>
                {gitStatus.additions > 0 && (
                  <span className="text-emerald-500 font-semibold">+{gitStatus.additions}</span>
                )}
                {gitStatus.deletions > 0 && (
                  <span className="text-red-500 font-semibold">-{gitStatus.deletions}</span>
                )}
              </>
            )}
          </div>

          {/* Row 3: tab status indicators - collapses when empty with smooth transition */}
          <div
            className={cn(
              'pl-7 transition-all duration-200',
              hasTabs ? 'opacity-100 py-0.5' : 'min-h-0 opacity-0 overflow-hidden'
            )}
          >
            {hasTabs && (
              <TabStatusDots
                tabs={tabs}
                terminals={terminals}
                getTerminalIdForTab={(tabId) => getTerminalIdForTab(session.id, tabId)}
                focusedIndicatorIndex={focusedIndicatorIndex}
                onTabClick={onTabClick}
              />
            )}
          </div>
        </div>

        {/* Right column: options menu + shortcut kbd + trash icon - stacked vertically */}
        <div
          className="shrink-0 flex flex-col items-end gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Options menu - progressive disclosure */}
          <div
            className={cn(
              'transition-opacity duration-200',
              isHovered || isMenuOpen || isActive ? 'opacity-50 hover:opacity-100' : 'opacity-0'
            )}
          >
            <WorktreeDropdownMenu
              session={session}
              repository={repository}
              onRemove={onWorktreeRemove}
              onOpenChange={(open) => {
                setIsMenuOpen(open);
                if (open) {
                  onDropdownOpen?.();
                }
              }}
              onAssignShortcut={onAssignShortcut}
            />
          </div>
          {/* Keyboard shortcut */}
          {shortcutDisplay && (
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/40 rounded shadow-[0_1px_0_1px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
              {shortcutDisplay}
            </kbd>
          )}
          {/* Trash icon for merged PRs - below shortcut to encourage cleanup */}
          {isMerged && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWorktreeRemove(session, repository);
                  }}
                  className="p-1.5 rounded transition-all duration-200 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={5}>
                <span className="text-xs">Remove merged worktree</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );

  return content;
}

// Status labels for tooltips
const statusLabels: Record<TerminalStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  stopped: 'Stopped',
  error: 'Error',
};

interface TabStatusDotsProps {
  tabs: TerminalTab[];
  terminals: Map<string, TerminalState>;
  getTerminalIdForTab: (tabId: string) => string;
  focusedIndicatorIndex: number | null;
  onTabClick: (tabId: string) => void;
}

function TabStatusDots({
  tabs,
  terminals,
  getTerminalIdForTab,
  focusedIndicatorIndex,
  onTabClick,
}: TabStatusDotsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tabs.map((tab, index) => {
        const terminalId = getTerminalIdForTab(tab.id);
        const terminalState = terminals.get(terminalId);
        const status: TerminalStatus = terminalState?.status || 'stopped';

        return (
          <TabStatusDot
            key={tab.id}
            tabId={tab.id}
            tabName={tab.name}
            status={status}
            isFocused={focusedIndicatorIndex === index}
            onClick={onTabClick}
          />
        );
      })}
    </div>
  );
}

interface TabStatusDotProps {
  tabId: string;
  tabName: string;
  status: TerminalStatus;
  isFocused: boolean;
  onClick: (tabId: string) => void;
}

function TabStatusDot({ tabId, tabName, status, isFocused, onClick }: TabStatusDotProps) {
  // Get status-specific colors with ring colors for hover
  const getStatusColor = (): string => {
    switch (status) {
      case 'starting':
        return 'bg-status-starting';
      case 'running':
        return 'bg-status-running';
      case 'waiting':
        return 'bg-status-waiting';
      case 'idle':
        return 'bg-status-idle';
      case 'stopped':
        return 'bg-status-stopped';
      case 'error':
        return 'bg-status-error';
      default:
        return 'bg-status-idle';
    }
  };

  const getRingColor = (): string => {
    switch (status) {
      case 'starting':
        return 'hover:ring-status-starting/40';
      case 'running':
        return 'hover:ring-status-running/40';
      case 'waiting':
        return 'hover:ring-status-waiting/40';
      case 'idle':
        return 'hover:ring-status-idle/40';
      case 'stopped':
        return 'hover:ring-status-stopped/40';
      case 'error':
        return 'hover:ring-status-error/40';
      default:
        return 'hover:ring-status-idle/40';
    }
  };

  const isPulsing = status === 'starting' || status === 'running';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(tabId);
          }}
          className={cn(
            'relative flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200',
            'hover:bg-sidebar-accent/60 hover:scale-105 hover:ring-1',
            getRingColor(),
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/70',
            'active:scale-95',
            isFocused && 'ring-1 ring-primary/40 bg-sidebar-accent/60 scale-105'
          )}
        >
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-200',
              getStatusColor(),
              isPulsing && 'animate-pulse'
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={5}>
        <span className="text-xs">
          {tabName} - {statusLabels[status]}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
