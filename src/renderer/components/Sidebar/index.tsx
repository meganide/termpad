import { useRef, useCallback, useEffect, useState } from 'react';
import { Settings, FolderPlus, Home, Bug } from 'lucide-react';
import { RepositoryTree } from './RepositoryTree';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAppStore } from '../../stores/appStore';
import { useSidebarNavigation } from '../../hooks/useSidebarNavigation';
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
}: SidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const {
    repositories,
    terminals,
    terminalsVersion,
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
  } = useAppStore();

  // Force re-render when terminals change (terminalsVersion tracks this)
  // This is needed because Zustand's shallow comparison doesn't always detect Map changes
  void terminalsVersion;

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
  }, [handleScroll, repositories]);

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
            <span className="text-xs text-muted-foreground/60">({repositories.length})</span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-sidebar-accent"
              onClick={onOpenHome}
            >
              <Home className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Home</TooltipContent>
        </Tooltip>
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
          ) : (
            <RepositoryTree
              repositories={repositories}
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
              onWorktreeRemove={onWorktreeRemove}
              onReorderSessions={reorderWorktreeSessions}
              onReorderRepositories={reorderRepositories}
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
