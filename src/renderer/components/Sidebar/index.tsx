import { useRef, useCallback, useEffect, useState } from 'react';
import { Settings, FolderPlus, Home, Bug, ListFilter, Terminal, LayoutGrid } from 'lucide-react';
import { RepositoryTree } from './RepositoryTree';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../stores/appStore';
import { useSidebarNavigation } from '../../hooks/useSidebarNavigation';
import { useSidebarRepositories } from '../../hooks/useSidebarRepositories';
import { ADD_REPOSITORY_ITEM_ID } from '../../utils/sidebarNavigation';
import { cn } from '../../lib/utils';
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
  hasAgents,
}: SidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
      reorderWorktreeSessions: s.reorderWorktreeSessions,
      reorderRepositories: s.reorderRepositories,
      worktreeTabs: s.worktreeTabs,
      getTerminalIdForTab: s.getTerminalIdForTab,
      showOnlyActiveRepositories: s.settings.showOnlyActiveRepositories ?? false,
      updateSettings: s.updateSettings,
    }))
  );
  const visibleRepositories = useSidebarRepositories();

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
      className="relative z-10 flex flex-col bg-sidebar"
      style={{ width }}
      onClick={handleSidebarClick}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/50">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold">Repositories</span>
          {repositories.length > 0 && (
            <span className="text-xs text-muted-foreground/60">({visibleRepositories.length})</span>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 hover:bg-sidebar-accent',
                  isOverviewMode && 'bg-sidebar-accent text-primary'
                )}
                onClick={onToggleOverview}
                disabled={!hasAgents}
                aria-pressed={isOverviewMode}
                aria-label="Agent overview"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasAgents ? 'Agent overview (Ctrl+O)' : 'No agents yet'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-sidebar-accent"
                onClick={onOpenHome}
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Home</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Project Tree with scroll gradients */}
      <div className="relative flex-1 overflow-hidden">
        {/* Top fade gradient */}
        {showTopShadow && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-sidebar to-transparent pointer-events-none z-10" />
        )}

        <div ref={scrollRef} className="h-full overflow-y-auto">
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
              onToggleExpand={toggleRepositoryExpanded}
              onRepositoryDelete={onRepositoryDelete}
              onOpenRepositorySettings={onOpenRepositorySettings}
              onOpenRepositoryOverview={onOpenRepositoryOverview}
              onWorktreeRemove={onWorktreeRemove}
              onReorderSessions={reorderWorktreeSessions}
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
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 bg-sidebar">
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
              className="h-9 w-9 hover:bg-sidebar-accent"
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
              className="h-9 w-9 hover:bg-sidebar-accent"
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
        onMouseDown={onResizeStart}
      />
    </aside>
  );
}
