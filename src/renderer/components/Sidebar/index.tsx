import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import {
  Settings,
  FolderPlus,
  Home,
  Bug,
  ListFilter,
  Terminal,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react';
import { RepositoryTree } from './RepositoryTree';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../stores/appStore';
import { useSidebarNavigation } from '../../hooks/useSidebarNavigation';
import { useSidebarRepositories } from '../../hooks/useSidebarRepositories';
import { ADD_REPOSITORY_ITEM_ID } from '../../utils/sidebarNavigation';
import { cn } from '../../lib/utils';
import { isMac } from '../../utils/shortcuts';
import type { WorktreeSession, Repository } from '../../../shared/types';

interface SidebarProps {
  width: number;
  onResizeStart: () => void;
  onAddRepository: () => void;
  onNewWorktree: (repositoryId: string) => void;
  onRepositoryDelete: (repository: Repository) => void;
  onOpenRepositorySettings: (repository: Repository) => void;
  onWorktreeRemove: (session: WorktreeSession, repository: Repository) => void;
  onOpenSettings: () => void;
  onOpenHome: () => void;
  onSessionSelect?: (sessionId: string) => void;
  onToggleOverview: () => void;
  onOpenRepositoryOverview?: (repositoryId: string) => void;
  isOverviewMode: boolean;
  isHome?: boolean;
  activeOverviewRepositoryId?: string | null;
  hasAgents: boolean;
}

export function Sidebar({
  width,
  onResizeStart,
  onAddRepository,
  onNewWorktree,
  onRepositoryDelete,
  onOpenRepositorySettings,
  onWorktreeRemove,
  onOpenSettings,
  onOpenHome,
  onSessionSelect,
  onToggleOverview,
  onOpenRepositoryOverview,
  isOverviewMode,
  isHome = false,
  activeOverviewRepositoryId,
  hasAgents,
}: SidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSearchRepositories, setCollapsedSearchRepositories] = useState<Set<string>>(
    new Set()
  );
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const {
    repositories,
    terminals,
    activeTerminalId,
    setActiveTerminal,
    setActiveTab,
    toggleRepositoryExpanded,
    focusArea,
    setFocusArea,
    setSidebarFocusedItemId,
    setSidebarStatusFocus,
    reorderWorktreeSessions,
    reorderRepositories,
    worktreeTabs,
    getTerminalIdForTab,
    showOnlyActiveRepositories,
    updateSettings,
  } = useAppStore(
    // Store mutations always clone the terminals Map, so its identity is a
    // reliable change signal under shallow comparison.
    useShallow((s) => ({
      repositories: s.repositories,
      terminals: s.terminals,
      activeTerminalId: s.activeTerminalId,
      setActiveTerminal: s.setActiveTerminal,
      setActiveTab: s.setActiveTab,
      toggleRepositoryExpanded: s.toggleRepositoryExpanded,
      focusArea: s.focusArea,
      setFocusArea: s.setFocusArea,
      setSidebarFocusedItemId: s.setSidebarFocusedItemId,
      setSidebarStatusFocus: s.setSidebarStatusFocus,
      reorderWorktreeSessions: s.reorderWorktreeSessions,
      reorderRepositories: s.reorderRepositories,
      worktreeTabs: s.worktreeTabs,
      getTerminalIdForTab: s.getTerminalIdForTab,
      showOnlyActiveRepositories: s.settings.showOnlyActiveRepositories ?? false,
      updateSettings: s.updateSettings,
    }))
  );
  const matchingRepositories = useSidebarRepositories(searchQuery);
  const visibleRepositories = useMemo(
    () =>
      searchQuery.trim()
        ? matchingRepositories.map((repository) => ({
            ...repository,
            isExpanded: !collapsedSearchRepositories.has(repository.id),
          }))
        : matchingRepositories,
    [matchingRepositories, searchQuery, collapsedSearchRepositories]
  );
  const updateSearchQuery = (query: string) => {
    setSearchQuery(query);
    setCollapsedSearchRepositories(new Set());
    setSidebarFocusedItemId(null);
    setSidebarStatusFocus(null);
  };
  const handleToggleExpand = useCallback(
    (repositoryId: string) => {
      if (!searchQuery.trim()) {
        toggleRepositoryExpanded(repositoryId);
        return;
      }
      setCollapsedSearchRepositories((previous) => {
        const next = new Set(previous);
        if (next.has(repositoryId)) next.delete(repositoryId);
        else next.add(repositoryId);
        return next;
      });
    },
    [searchQuery, toggleRepositoryExpanded]
  );

  const handleReorderSessions = useCallback(
    (repositoryId: string, fromIndex: number, toIndex: number) => {
      const visibleSessions = visibleRepositories.find(
        (repo) => repo.id === repositoryId
      )?.worktreeSessions;
      const sessions = repositories.find((repo) => repo.id === repositoryId)?.worktreeSessions;
      const fromSession = visibleSessions?.[fromIndex];
      const toSession = visibleSessions?.[toIndex];
      if (!sessions || !fromSession || !toSession) return;
      reorderWorktreeSessions(
        repositoryId,
        sessions.findIndex((session) => session.id === fromSession.id),
        sessions.findIndex((session) => session.id === toSession.id)
      );
    },
    [repositories, visibleRepositories, reorderWorktreeSessions]
  );

  const handleReorderRepositories = useCallback(
    (fromIndex: number, toIndex: number) => {
      const fromRepository = visibleRepositories[fromIndex];
      const toRepository = visibleRepositories[toIndex];
      if (!fromRepository || !toRepository) return;
      reorderRepositories(
        repositories.findIndex((repository) => repository.id === fromRepository.id),
        repositories.findIndex((repository) => repository.id === toRepository.id)
      );
    },
    [repositories, visibleRepositories, reorderRepositories]
  );

  // Wrap onSessionSelect to not require sessionId (keyboard navigation already handles selection)
  const handleKeyboardSessionSelect = useCallback(() => {
    onSessionSelect?.('');
  }, [onSessionSelect]);

  const { focusedItemId, focusableItems, statusFocus, handleKeyDown } = useSidebarNavigation({
    repositories: visibleRepositories,
    onToggleExpand: handleToggleExpand,
    onSessionSelect: handleKeyboardSessionSelect,
    onAddRepository,
    onNewWorktree,
  });

  // Check if the "Add Repository" button is focused
  const isAddRepositoryFocused =
    focusArea === 'sidebar' && focusedItemId === ADD_REPOSITORY_ITEM_ID;

  // Handle scroll shadows
  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setShowTopShadow(scrollTop > 0);
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    handleScroll();
    element.addEventListener('scroll', handleScroll);
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [handleScroll, visibleRepositories]);

  // Handle click on sidebar to set focus
  const handleSidebarClick = useCallback(() => {
    if (focusArea !== 'sidebar') {
      setFocusArea('sidebar');
      // Set initial focused item if not already set
      if (!focusedItemId && focusableItems.length > 0) {
        setSidebarFocusedItemId(focusableItems[0].id);
      }
    }
  }, [focusArea, focusedItemId, focusableItems, setFocusArea, setSidebarFocusedItemId]);

  // Attach sidebar keyboard navigation
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      // Set as active terminal (focuses it)
      setActiveTerminal(sessionId);
      // Set focus area to main terminal so keyboard shortcuts work
      setFocusArea('mainTerminal');
      // Notify parent (e.g., to close overlay screens)
      onSessionSelect?.(sessionId);
    },
    [setActiveTerminal, setFocusArea, onSessionSelect]
  );

  const handleTabClick = useCallback(
    (sessionId: string, tabId: string) => {
      // Switch to the worktree session
      setActiveTerminal(sessionId);
      // Switch to the specific tab
      setActiveTab(tabId);
      // Set focus to main terminal area so it receives keyboard input
      setFocusArea('mainTerminal');
      // Notify parent (e.g., to close overlay screens)
      onSessionSelect?.(sessionId);
    },
    [setActiveTerminal, setActiveTab, setFocusArea, onSessionSelect]
  );

  return (
    <aside
      className="workspace-sidebar relative z-10 flex min-h-0 shrink-0 flex-col overflow-hidden bg-sidebar"
      style={{ width }}
      onClick={handleSidebarClick}
    >
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Terminal className="size-5" strokeWidth={2} />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          termpad<span className="text-primary">.</span>
        </span>
        <span className="ml-auto rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          LOCAL
        </span>
      </div>
      <nav className="sidebar-navigation" aria-label="Workspace navigation">
        <button
          className={cn('sidebar-nav-item', isHome && 'is-selected')}
          onClick={onOpenHome}
          aria-label="Home"
          aria-current={isHome ? 'page' : undefined}
        >
          <Home className="size-4" />
          <span>Home</span>
        </button>
        <button
          className={cn('sidebar-nav-item', isOverviewMode && 'is-selected')}
          onClick={onToggleOverview}
          disabled={!hasAgents}
          aria-pressed={isOverviewMode}
          aria-label="Agent overview"
          aria-keyshortcuts={isMac ? 'Meta+O' : 'Control+O'}
        >
          <LayoutGrid className="size-4" />
          <span>Agent overview</span>
          <kbd className="sidebar-shortcut" aria-hidden="true">
            {isMac ? 'Cmd + O' : 'Ctrl + O'}
          </kbd>
        </button>
      </nav>
      <div className="relative flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-1">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Repositories</span>
          {repositories.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {visibleRepositories.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Only show active repositories"
                aria-pressed={showOnlyActiveRepositories}
                className={cn(
                  'h-8 w-8 hover:bg-sidebar-accent',
                  showOnlyActiveRepositories && 'bg-sidebar-accent text-primary'
                )}
                onFocus={() => setFocusArea('app')}
                onClick={(event) => {
                  event.stopPropagation();
                  updateSettings({ showOnlyActiveRepositories: !showOnlyActiveRepositories });
                }}
              >
                <ListFilter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showOnlyActiveRepositories
                ? 'Show all repositories'
                : 'Only show repositories with open terminals'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="shrink-0 px-3 py-2" onClick={(event) => event.stopPropagation()}>
        <label htmlFor="repository-search" className="sr-only">
          Search repositories and worktrees
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            id="repository-search"
            type="text"
            placeholder="Search repositories…"
            value={searchQuery}
            onChange={(event) => updateSearchQuery(event.target.value)}
            onFocus={() => setFocusArea('app')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                updateSearchQuery('');
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                setSidebarFocusedItemId(focusableItems[0]?.id ?? null);
                setSidebarStatusFocus(null);
                setFocusArea('sidebar');
                event.currentTarget.blur();
              }
            }}
            className="h-9 border-sidebar-border bg-background/60 pl-8 pr-8 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear repository search"
              className="absolute right-0 top-0 h-8 w-8"
              onClick={() => {
                updateSearchQuery('');
                searchRef.current?.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Project Tree with scroll gradients */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Top fade gradient */}
        {showTopShadow && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-sidebar to-transparent pointer-events-none z-10" />
        )}

        <div ref={scrollRef} className="h-full overflow-y-auto px-1">
          {repositories.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-4">
                <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium mb-1">No repositories yet</p>
              <p className="text-xs text-muted-foreground mb-4">Add a repository to get started</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddRepository}
                className="bg-sidebar hover:bg-sidebar-accent"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Add repository
              </Button>
            </div>
          ) : visibleRepositories.length === 0 && searchQuery.trim() ? (
            <div className="p-8 text-center" role="status">
              <p className="text-sm font-medium mb-1">No matching repositories or worktrees</p>
              <p className="text-xs text-muted-foreground">
                {showOnlyActiveRepositories
                  ? 'Try another name or turn off the active repositories filter.'
                  : 'Try another repository or worktree name.'}
              </p>
            </div>
          ) : visibleRepositories.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground/60 mb-4" />
              <p className="text-sm font-medium mb-1">No active repositories</p>
              <p className="text-xs text-muted-foreground mb-4">
                Open a terminal in a repository to see it here.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSettings({ showOnlyActiveRepositories: false })}
                className="bg-sidebar hover:bg-sidebar-accent"
              >
                Show all repositories
              </Button>
            </div>
          ) : (
            <RepositoryTree
              repositories={visibleRepositories}
              activeSessionId={activeTerminalId}
              terminals={terminals}
              focusedItemId={focusedItemId}
              statusFocus={statusFocus}
              worktreeTabs={worktreeTabs || []}
              getTerminalIdForTab={getTerminalIdForTab}
              onSessionClick={handleSessionClick}
              onTabClick={handleTabClick}
              onNewWorktree={onNewWorktree}
              onToggleExpand={handleToggleExpand}
              onRepositoryDelete={(repository) => {
                const original = repositories.find((repo) => repo.id === repository.id);
                if (original) onRepositoryDelete(original);
              }}
              onOpenRepositorySettings={(repository) => {
                const original = repositories.find((repo) => repo.id === repository.id);
                if (original) onOpenRepositorySettings(original);
              }}
              onOpenRepositoryOverview={onOpenRepositoryOverview}
              activeOverviewRepositoryId={activeOverviewRepositoryId}
              onWorktreeRemove={(session, repository) => {
                const original = repositories.find((repo) => repo.id === repository.id);
                if (original) onWorktreeRemove(session, original);
              }}
              onReorderSessions={handleReorderSessions}
              onReorderRepositories={handleReorderRepositories}
              onDropdownOpen={() => setFocusArea('app')}
            />
          )}
        </div>

        {/* Bottom fade gradient */}
        {showBottomShadow && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-sidebar to-transparent pointer-events-none z-10" />
        )}
      </div>

      {/* Footer */}
      <div className="relative flex shrink-0 flex-wrap items-center justify-between gap-1 border-t border-sidebar-border px-3 py-3 bg-sidebar">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddRepository}
          className={cn(
            'flex-1 justify-start h-9 px-3 font-medium text-foreground hover:bg-sidebar-accent',
            isAddRepositoryFocused && 'ring-1 ring-primary/40'
          )}
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          <span className="text-sm">Add repository</span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:bg-sidebar-accent"
              aria-label="Report Issue"
              onClick={() =>
                window.electronAPI.openExternal('https://github.com/meganide/termpad/issues/new')
              }
            >
              <Bug className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Report Issue</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:bg-sidebar-accent"
              aria-label="Settings"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/20 z-10"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          onResizeStart();
        }}
      />
    </aside>
  );
}
