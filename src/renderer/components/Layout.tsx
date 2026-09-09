import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { Button } from './ui/button';
import type {
  FileStatus,
  Repository,
  TerminalTab,
  TodoItem,
  WorktreeSession,
} from '../../shared/types';
import { SourceControlPane } from '../features/source-control';
import { UserTerminalSection } from '../features/user-terminals';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useResizeSelectionLock } from '../hooks/useResizeSelectionLock';
import { usePRStatusPolling } from '../hooks/usePRStatusPolling';
import { useWorktreeWatchers } from '../hooks/useWorktreeWatchers';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type TodoScope } from '../stores/appStore';
import { ReviewPanel, type ReviewRequest } from '../features/review/ReviewPanel';
import { AddRepositoryScreen } from './AddRepositoryScreen';
import { AddWorktreeScreen } from './AddWorktreeScreen';
import { CloseWarningDialog } from './CloseWarningDialog';
import { DeleteRepositoryDialog } from './DeleteRepositoryDialog';
import { HomeScreen } from './HomeScreen';
import { AgentTile, OverviewHeader } from './Overview';
import { useOverviewShortcuts } from './Overview/useOverviewShortcuts';
import type { AgentTileActionsHandle } from './Overview/AgentTileActions';
import { RemoveWorktreeDialog } from './RemoveWorktreeDialog';
import { RepositorySettingsOverlay } from './RepositorySettingsOverlay';
import type { SettingsTab } from './SettingsScreen';
import { SettingsScreen } from './SettingsScreen';
import { Sidebar } from './Sidebar/index';
import { EmptyTerminalState } from './Terminal/EmptyTerminalState';
import { TabBar } from './Terminal/TabBar';
import { TerminalView, type TerminalViewHandle } from './Terminal/TerminalView';
import { TitleBar } from './TitleBar';
import { UpdateNotification } from './UpdateNotification';
import { WorktreeBar } from './WorktreeBar/WorktreeBar';
import { NotesPanel } from '../features/notes/NotesPanel';
import { TodosPanel } from '../features/todos/TodosPanel';
import { RightPanelTabs, type RightPanelTab } from './RightPanel/RightPanelTabs';
import { BrowserPanel } from '../features/browser/BrowserPanel';
import { getScopeIndicators } from './RightPanel/scopeIndicators';
import { useAutoUpdater } from '../hooks/useAutoUpdater';
import { useTermpadConfig } from '../hooks/useTermpadConfig';
import { deliverTodoToTerminal, dispatchTodoToWorktree } from '../services/todoDispatch';
import { PlanningWorkspace, type PlanningLocation } from '../features/planning/PlanningWorkspace';

export function Layout() {
  const {
    settings,
    updateSettings,
    repositories,
    activeTerminalId,
    activeTabId,
    window: windowState,
    updateSidebarWidth,
    updateFileChangesPaneWidth,
    terminals,
    isInitialized,
    initialize,
    setSidebarFocusedItemId,
    setActiveTerminal,
    setFocusArea,
    unregisterTerminal,
    // Tab actions
    createTab,
    closeTab,
    renameTab,
    reorderTabs,
    setActiveTab,
    getTabsForWorktree,
    getTerminalIdForTab,
    worktreeTabs,
    setWorktreeGridView,
    // Scroll position actions
    updateTabScrollPosition,
    getTabScrollPosition,
    // User terminal tabs
    getUserTabsForWorktree,
    getUserTerminalIdForTab,
    userTerminalTabs,
    activeUserTabId,
  } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
      repositories: s.repositories,
      activeTerminalId: s.activeTerminalId,
      activeTabId: s.activeTabId,
      window: s.window,
      updateSidebarWidth: s.updateSidebarWidth,
      updateFileChangesPaneWidth: s.updateFileChangesPaneWidth,
      terminals: s.terminals,
      isInitialized: s.isInitialized,
      initialize: s.initialize,
      setSidebarFocusedItemId: s.setSidebarFocusedItemId,
      setActiveTerminal: s.setActiveTerminal,
      setFocusArea: s.setFocusArea,
      unregisterTerminal: s.unregisterTerminal,
      createTab: s.createTab,
      closeTab: s.closeTab,
      renameTab: s.renameTab,
      reorderTabs: s.reorderTabs,
      setActiveTab: s.setActiveTab,
      getTabsForWorktree: s.getTabsForWorktree,
      getTerminalIdForTab: s.getTerminalIdForTab,
      worktreeTabs: s.worktreeTabs,
      setWorktreeGridView: s.setWorktreeGridView,
      updateTabScrollPosition: s.updateTabScrollPosition,
      getTabScrollPosition: s.getTabScrollPosition,
      getUserTabsForWorktree: s.getUserTabsForWorktree,
      getUserTerminalIdForTab: s.getUserTerminalIdForTab,
      userTerminalTabs: s.userTerminalTabs,
      activeUserTabId: s.activeUserTabId,
    }))
  );

  // Initialize store from main process storage
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Start watchers for live worktree changes
  useWorktreeWatchers();

  // Load and watch termpad.json files
  useTermpadConfig();

  // Start polling for PR statuses (gh CLI)
  usePRStatusPolling();

  // Auto-update: check for updates on app start
  const { checkForUpdates } = useAutoUpdater();
  useEffect(() => {
    // Check for updates 5 seconds after app starts (gives app time to load)
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Track if distro switched toast was shown recently to prevent stacking
  const distroSwitchedShownRef = useRef(false);

  // Listen for WSL distro auto-switch notifications
  useEffect(() => {
    const unsubscribe = window.terminal.onDistroSwitched((payload) => {
      // Only show one toast even if multiple terminals trigger this
      if (distroSwitchedShownRef.current) {
        return;
      }
      distroSwitchedShownRef.current = true;

      toast.info(`Using ${payload.toDistro} terminal`, {
        description: `Path is in WSL ${payload.toDistro}. Consider changing your default terminal in Settings.`,
        duration: 5000,
      });

      // Reset after a short delay to allow showing again if user makes changes and restarts
      setTimeout(() => {
        distroSwitchedShownRef.current = false;
      }, 10000);
    });
    return unsubscribe;
  }, []);

  // Track if shell unavailable toast was shown recently to prevent stacking
  const shellUnavailableShownRef = useRef(false);

  // Listen for shell unavailable notifications (replaces system notification with toast)
  useEffect(() => {
    const unsubscribe = window.terminal.onShellUnavailable((payload) => {
      // Only show one toast even if multiple terminals trigger this
      if (shellUnavailableShownRef.current) {
        return;
      }
      shellUnavailableShownRef.current = true;

      toast.warning('Shell Unavailable', {
        description: `${payload.unavailableShellName} is no longer available. Using ${payload.fallbackShellName} instead.`,
        duration: 5000,
      });

      // Reset after a short delay to allow showing again if user makes changes and restarts
      setTimeout(() => {
        shellUnavailableShownRef.current = false;
      }, 10000);
    });
    return unsubscribe;
  }, []);

  // Active screen state (discriminated union - only one screen can be active)
  type ActiveScreen =
    | { type: 'main' }
    | { type: 'settings'; tab: SettingsTab }
    | {
        type: 'addWorktree';
        repositoryId: string | null;
        todo?: TodoItem;
        todoScope?: TodoScope;
        returnToPlanning?: string;
      }
    | { type: 'planning'; repositoryId: string | null }
    | { type: 'home' }
    | { type: 'addRepository' }
    | { type: 'repositorySettings'; repositoryId: string };

  // Start with home screen on app launch
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>({ type: 'home' });
  const [visitedWorktreeTools, setVisitedWorktreeTools] = useState<string[]>([]);
  useEffect(() => {
    if (activeTerminalId)
      setVisitedWorktreeTools((previous) =>
        previous.includes(activeTerminalId) ? previous : [...previous, activeTerminalId]
      );
  }, [activeTerminalId]);
  const [visitedPlanning, setVisitedPlanning] = useState<string[]>([]);
  const [lastPlanningRepositoryId, setLastPlanningRepositoryId] = useState<string | null>(null);
  const [planningLocations, setPlanningLocations] = useState<Record<string, PlanningLocation>>({});
  const openPlanning = (requestedRepositoryId?: string, location?: PlanningLocation) => {
    const repositoryId =
      [
        requestedRepositoryId,
        lastPlanningRepositoryId,
        repositories.find((repository) =>
          repository.worktreeSessions.some((session) => session.id === activeTerminalId)
        )?.id,
        repositories[0]?.id,
      ].find((id) => repositories.some((repository) => repository.id === id)) ?? null;
    if (repositoryId)
      setVisitedPlanning((previous) =>
        previous.includes(repositoryId) ? previous : [...previous, repositoryId]
      );
    setLastPlanningRepositoryId(repositoryId);
    if (repositoryId && location) {
      // A fresh request also handles reopening the same link after manually changing filters.
      setPlanningLocations((previous) => ({ ...previous, [repositoryId]: { ...location } }));
    }
    setIsOverviewMode(false);
    setActiveScreen({ type: 'planning', repositoryId });
    setFocusArea('app');
  };
  const planningRepositoryId =
    activeScreen.type === 'planning'
      ? (repositories.find((repository) => repository.id === activeScreen.repositoryId)?.id ??
        repositories[0]?.id ??
        null)
      : null;
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('changes');
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [browserExpanded, setBrowserExpanded] = useState(false);
  const [todosExpanded, setTodosExpanded] = useState(false);
  const [expandedToolTabs, setExpandedToolTabs] = useState<Partial<Record<RightPanelTab, boolean>>>(
    {}
  );
  const [browserCounts, setBrowserCounts] = useState<Record<string, number>>({});
  const rightPanelExpanded =
    (reviewExpanded && rightPanelTab === 'review') ||
    (browserExpanded && rightPanelTab === 'browser') ||
    (todosExpanded && rightPanelTab === 'todos') ||
    Boolean(expandedToolTabs[rightPanelTab]);
  const [reviewRequests, setReviewRequests] = useState<Record<string, ReviewRequest>>({});
  const [visitedReviews, setVisitedReviews] = useState<Record<string, string>>({});
  const [changeCounts, setChangeCounts] = useState<Record<string, number>>({});
  const [reviewCounts, setReviewCounts] = useState<
    Record<string, { base: string; count: number | null }>
  >({});
  const handleChangeCount = useCallback((repoPath: string, count: number) => {
    setChangeCounts((previous) =>
      previous[repoPath] === count ? previous : { ...previous, [repoPath]: count }
    );
  }, []);
  const handleReviewCount = useCallback((repoPath: string, base: string, count: number | null) => {
    setReviewCounts((previous) =>
      previous[repoPath]?.base === base && previous[repoPath]?.count === count
        ? previous
        : { ...previous, [repoPath]: { base, count } }
    );
  }, []);
  const selectRightPanelTab = useCallback(
    (tab: RightPanelTab) => {
      setRightPanelTab(tab);
      if (tab === 'terminals') setFocusArea('userTerminal');
      else if (useAppStore.getState().focusArea === 'userTerminal') setFocusArea('sidebar');
    },
    [setFocusArea]
  );

  // Overview mode shows every agent terminal side by side in a grid
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [overviewRepositoryId, setOverviewRepositoryId] = useState<string | null>(null);
  const [hiddenOverviewAgents, setHiddenOverviewAgents] = useState<Set<string>>(() => new Set());
  const terminalGridRef = useRef<HTMLDivElement>(null);

  const exitOverview = useCallback(() => {
    setIsOverviewMode(false);
  }, []);

  const focusUserTerminal = useCallback(() => {
    exitOverview();
    setRightPanelTab('terminals');
  }, [exitOverview]);

  const toggleOverview = useCallback(() => {
    const next = !isOverviewMode;
    setIsOverviewMode(next);
    if (next) {
      setOverviewRepositoryId(null);
      setActiveScreen({ type: 'main' });
      setFocusArea('app');
    }
  }, [isOverviewMode, setFocusArea]);

  const openRepositoryOverview = useCallback(
    (repositoryId: string) => {
      setOverviewRepositoryId(repositoryId);
      setIsOverviewMode(true);
      setActiveScreen({ type: 'main' });
      setFocusArea('app');
    },
    [setFocusArea]
  );

  useEffect(() => {
    if (overviewRepositoryId && !repositories.some((repo) => repo.id === overviewRepositoryId)) {
      setOverviewRepositoryId(null);
    }
  }, [overviewRepositoryId, repositories]);

  // Callback to close overlay screens when session is selected via keyboard
  const handleKeyboardSessionSelect = useCallback(() => {
    setActiveScreen({ type: 'main' });
    exitOverview();
  }, [exitOverview]);

  // Callback to open settings via keyboard shortcut (Ctrl+,)
  const handleKeyboardOpenSettings = useCallback(() => {
    setActiveScreen({ type: 'settings', tab: 'terminal' });
  }, []);

  // Callback to add repository via keyboard shortcut (Ctrl+G)
  const handleKeyboardAddRepository = useCallback(() => {
    setActiveScreen({ type: 'addRepository' });
  }, []);

  // Handle Escape key for going back on overlay screens
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Only handle Escape when on an overlay screen with a back button
      if (e.key === 'Escape') {
        // Don't handle if user is in an input field (except for settings/repository screens)
        const isInputFocused =
          e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

        if (isOverviewMode && activeScreen.type === 'main') {
          // Escape belongs to the running agent while interacting with any overview pane.
          if (e.target instanceof Element && e.target.closest('.xterm')) return;
          e.preventDefault();
          exitOverview();
        } else if (activeScreen.type === 'settings') {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
        } else if (activeScreen.type === 'addRepository' && !isInputFocused) {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
        } else if (activeScreen.type === 'addWorktree' && !isInputFocused) {
          e.preventDefault();
          setActiveScreen(
            activeScreen.returnToPlanning
              ? { type: 'planning', repositoryId: activeScreen.returnToPlanning }
              : { type: 'main' }
          );
        } else if (activeScreen.type === 'repositorySettings') {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [activeScreen, isOverviewMode, exitOverview]);

  // Sync sidebar focus when active terminal changes
  useEffect(() => {
    if (activeTerminalId) {
      setSidebarFocusedItemId(`session:${activeTerminalId}`);
    }
  }, [activeTerminalId, setSidebarFocusedItemId]);

  // Sidebar resize state
  const { start: lockResizeSelection } = useResizeSelectionLock();
  const SIDEBAR_MIN_WIDTH = 250;
  const SIDEBAR_MAX_WIDTH = 400;
  const [sidebarWidth, setSidebarWidth] = useState(windowState.sidebarWidth);
  const isResizingSidebar = useRef(false);

  const startResizingSidebar = useCallback(() => {
    lockResizeSelection();
    isResizingSidebar.current = true;
    let lastWidth = sidebarWidth;
    let rafId: number | null = null;

    const resize = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        lastWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
        // Coalesce to one state update (Layout re-render) per frame
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            setSidebarWidth(lastWidth);
          });
        }
      }
    };

    const stopResizing = () => {
      isResizingSidebar.current = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('blur', stopResizing);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setSidebarWidth(lastWidth);
      // Persist the final width to store when drag ends
      updateSidebarWidth(lastWidth);
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    window.addEventListener('blur', stopResizing);
  }, [sidebarWidth, updateSidebarWidth, lockResizeSelection]);

  // File changes pane resize state
  const FILE_CHANGES_MIN_WIDTH = 300;
  const FILE_CHANGES_MAX_WIDTH = 2000;
  const [fileChangesPaneWidth, setFileChangesPaneWidth] = useState(
    windowState.fileChangesPaneWidth
  );
  const isResizingFileChangesPane = useRef(false);

  const startResizingFileChangesPane = useCallback(() => {
    lockResizeSelection();
    isResizingFileChangesPane.current = true;
    let lastWidth = fileChangesPaneWidth;
    let rafId: number | null = null;

    const resize = (e: MouseEvent) => {
      if (isResizingFileChangesPane.current) {
        // Calculate width from right edge of window
        lastWidth = Math.min(
          FILE_CHANGES_MAX_WIDTH,
          Math.max(FILE_CHANGES_MIN_WIDTH, window.innerWidth - e.clientX)
        );
        // Coalesce to one state update (Layout re-render) per frame
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            setFileChangesPaneWidth(lastWidth);
          });
        }
      }
    };

    const stopResizing = () => {
      isResizingFileChangesPane.current = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('blur', stopResizing);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setFileChangesPaneWidth(lastWidth);
      // Persist the final width to store when drag ends
      updateFileChangesPaneWidth(lastWidth);
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    window.addEventListener('blur', stopResizing);
  }, [
    fileChangesPaneWidth,
    setFileChangesPaneWidth,
    updateFileChangesPaneWidth,
    lockResizeSelection,
  ]);

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isUserTerminalPanelCollapsed = rightPanelTab !== 'terminals';

  // Dialog states
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [closeWarningCount, setCloseWarningCount] = useState(0);
  const [removeWorktreeSession, setRemoveWorktreeSession] = useState<WorktreeSession | null>(null);
  const [removeWorktreeRepository, setRemoveWorktreeRepository] = useState<Repository | null>(null);
  const [deleteRepositoryDialogOpen, setDeleteRepositoryDialogOpen] = useState(false);
  const [deleteRepositoryTarget, setDeleteRepositoryTarget] = useState<Repository | null>(null);

  // Listen for native menu events
  useEffect(() => {
    const cleanupSettings = window.electronAPI?.onMenuSettings(() => {
      setActiveScreen({ type: 'settings', tab: 'terminal' });
    });
    const cleanupShortcuts = window.electronAPI?.onMenuKeyboardShortcuts(() => {
      setActiveScreen({ type: 'settings', tab: 'shortcuts' });
    });
    return () => {
      cleanupSettings?.();
      cleanupShortcuts?.();
    };
  }, []);

  // Theme effect - always apply dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Sync panel widths when store loads from disk (only if different to avoid loops)
  useEffect(() => {
    // This is an intentional sync from external state (persisted storage) to local UI state
    // Local state is needed for smooth drag performance, but must sync when store initializes
    // Don't sync sidebar width while user is resizing
    if (!isResizingSidebar.current && sidebarWidth !== windowState.sidebarWidth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarWidth(windowState.sidebarWidth);
    }
    // Don't sync file changes pane width while user is resizing
    if (
      !isResizingFileChangesPane.current &&
      fileChangesPaneWidth !== windowState.fileChangesPaneWidth
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileChangesPaneWidth(windowState.fileChangesPaneWidth);
    }
  }, [
    windowState.sidebarWidth,
    windowState.fileChangesPaneWidth,
    sidebarWidth,
    fileChangesPaneWidth,
  ]);

  // Handle before close event from main process
  useEffect(() => {
    if (!window.terminal) {
      console.warn('[Layout] window.terminal not available');
      return;
    }
    const unsubscribe = window.terminal.onBeforeClose((activeCount: number) => {
      // Use activeCount from main process - it's the source of truth for running terminals
      if (activeCount > 0) {
        // Skip warning if user has opted out
        if (settings.suppressCloseWarning) {
          window.terminal.confirmClose();
          return;
        }
        setCloseWarningCount(activeCount);
        setCloseWarningOpen(true);
      }
    });

    return unsubscribe;
  }, []);

  // Handle notification click to switch session and tab
  useEffect(() => {
    if (!window.notifications) {
      return;
    }
    const unsubscribe = window.notifications.onSwitchWorktreeSession((sessionId, tabId) => {
      setActiveTerminal(sessionId);
      if (tabId) {
        setActiveTab(tabId);
      }
      // Close any overlay screen (settings, addWorktree, etc.)
      setActiveScreen({ type: 'main' });
      exitOverview();
      // Set focus to main terminal area so it receives keyboard input
      setFocusArea('mainTerminal');
    });

    return unsubscribe;
  }, [setActiveTerminal, setActiveTab, setFocusArea, exitOverview]);

  // Handle folder drag and drop
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items = e.dataTransfer?.items;
      if (!items) return;

      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            // Note: In real implementation, we'd need to get the actual path
            // This would require additional Electron IPC
            toast.info('Drag and drop coming soon!');
          }
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  // Handlers
  const handleAddRepository = useCallback(() => {
    setActiveScreen({ type: 'addRepository' });
  }, []);

  const handleNewWorktree = useCallback(
    (repositoryId: string) => {
      setActiveScreen({ type: 'addWorktree', repositoryId });
      // Move focus away from sidebar so keyboard shortcuts don't interfere with the form
      setFocusArea('app');
    },
    [setFocusArea]
  );

  const handleWorktreeRemove = useCallback((session: WorktreeSession, repository: Repository) => {
    // Prevent removing main worktree
    if (session.isMainWorktree) return;
    setRemoveWorktreeSession(session);
    setRemoveWorktreeRepository(repository);
  }, []);

  const handleCloseConfirm = useCallback(
    (suppressFutureWarnings: boolean) => {
      if (suppressFutureWarnings) {
        updateSettings({ suppressCloseWarning: true });
      }
      setCloseWarningOpen(false);
      window.terminal.confirmClose();
    },
    [updateSettings]
  );

  const handleCloseCancel = useCallback(() => {
    setCloseWarningOpen(false);
    window.terminal.cancelClose();
  }, []);

  const handleRepositoryDelete = useCallback((repository: Repository) => {
    setDeleteRepositoryTarget(repository);
    setDeleteRepositoryDialogOpen(true);
  }, []);

  const handleOpenRepositorySettings = useCallback((repository: Repository) => {
    setActiveScreen({ type: 'repositorySettings', repositoryId: repository.id });
  }, []);

  // Get all sessions that should have terminals rendered
  // Memoized to prevent unnecessary object recreation during reorder
  const allSessions = useMemo(
    () =>
      repositories.flatMap((p) => p.worktreeSessions.map((s) => ({ session: s, repository: p }))),
    [repositories]
  );

  // Pre-compute all terminal configs as a flat list for stable rendering
  // This prevents React reconciliation issues with nested maps during reorder
  const allTerminalConfigs = useMemo(() => {
    return allSessions.flatMap(({ session, repository }) => {
      const tabs = getTabsForWorktree(session.id);
      return tabs.map((tab) => ({
        terminalId: getTerminalIdForTab(session.id, tab.id),
        sessionId: session.id,
        cwd: session.path,
        tabId: tab.id,
        tabName: tab.name,
        tabCommand: tab.command,
        tabIcon: tab.icon,
        repositoryId: repository.id,
        repositoryName: repository.name,
        worktreeLabel: session.label,
      }));
    });
    // Note: worktreeTabs is needed to trigger recomputation when tabs change,
    // even though getTabsForWorktree reads it internally via get()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessions, getTabsForWorktree, getTerminalIdForTab, worktreeTabs]);

  const overviewAgents = allTerminalConfigs.filter(
    (config) => !overviewRepositoryId || config.repositoryId === overviewRepositoryId
  );
  const hiddenAgents = overviewAgents.filter((config) =>
    hiddenOverviewAgents.has(config.terminalId)
  );
  const overviewAgentCount = overviewAgents.length - hiddenAgents.length;

  const unhideOverviewAgent = (terminalId: string) => {
    setHiddenOverviewAgents((previous) => {
      const next = new Set(previous);
      next.delete(terminalId);
      return next;
    });
  };
  const unhideAllOverviewAgents = () => {
    setHiddenOverviewAgents((previous) => {
      const next = new Set(previous);
      for (const agent of hiddenAgents) next.delete(agent.terminalId);
      return next;
    });
  };
  const hideOverviewAgent = (terminalId: string) => {
    setHiddenOverviewAgents((previous) => new Set(previous).add(terminalId));
    setFocusArea('app');
    requestAnimationFrame(() => {
      const container = terminalGridRef.current;
      const nextPane = Array.from(
        container?.querySelectorAll<HTMLDivElement>('[data-overview-terminal-id]') ?? []
      ).find(
        (pane) => pane.dataset.overviewTerminalId !== terminalId && pane.style.display !== 'none'
      );
      (nextPane?.querySelector('textarea') ?? nextPane ?? container)?.focus({
        preventScroll: true,
      });
    });
  };

  // Pre-compute all user terminal configs as a flat list for stable rendering
  // Spans ALL repositories so user terminals survive cross-repo worktree switches
  const allUserTerminalConfigs = useMemo(() => {
    return allSessions.flatMap(({ session }) => {
      const tabs = getUserTabsForWorktree(session.id);
      return tabs.map((tab) => ({
        terminalId: getUserTerminalIdForTab(session.id, tab.id),
        sessionId: session.id,
        cwd: session.path,
        tabId: tab.id,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessions, getUserTabsForWorktree, getUserTerminalIdForTab, userTerminalTabs]);

  // Refs for user terminal views (keyed by terminalId)
  const userTerminalRefs = useRef<Map<string, TerminalViewHandle>>(new Map());
  const mainTerminalRefs = useRef<Map<string, TerminalViewHandle>>(new Map());
  const activeMainTerminalId =
    activeTerminalId && activeTabId ? getTerminalIdForTab(activeTerminalId, activeTabId) : null;
  const activeMainStatus = activeMainTerminalId
    ? terminals.get(activeMainTerminalId)?.status
    : undefined;
  const canSendTodo = Boolean(
    activeMainStatus && !['starting', 'stopped', 'error'].includes(activeMainStatus)
  );

  const handleSendTodo = async (todo: TodoItem) => {
    if (!activeMainTerminalId) return;
    try {
      const terminal = mainTerminalRefs.current.get(activeMainTerminalId);
      if (!terminal) throw new Error('Open a terminal in the main area first.');
      const sourceSession = allSessions.find(({ session }) => session.id === activeTerminalId);
      const scope: TodoScope | undefined = sourceSession
        ? { type: 'worktree', worktreeSessionId: sourceSession.session.id }
        : undefined;
      await terminal.sendText(todo.text, true, { focus: false });
      if (scope) useAppStore.getState().updateTodo(scope, todo.id, { status: 'in_progress' });
    } catch (error) {
      toast.error('Could not send todo', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const sendTodoText = async (terminalId: string, text: string) => {
    const terminal = mainTerminalRefs.current.get(terminalId);
    if (!terminal) throw new Error('The terminal is no longer open.');
    await terminal.sendText(text, true, { focus: false });
  };

  const handleTodoTerminalCreated = async (
    terminalId: string,
    todo: TodoItem,
    hasCommand: boolean
  ) => {
    try {
      await deliverTodoToTerminal(terminalId, todo, hasCommand, sendTodoText);
      toast.success('Todo started in the new worktree', {
        action: {
          label: 'Open worktree',
          onClick: () => {
            handleOpenPortTerminal(terminalId);
          },
        },
      });
    } catch (error) {
      toast.error('Worktree created, but the todo could not be started', {
        description: error instanceof Error ? error.message : String(error),
        duration: 10000,
      });
    }
  };

  const handleDispatchTodo = async (repositoryId: string, todo: TodoItem, targetId: string) => {
    try {
      const result = await dispatchTodoToWorktree(repositoryId, todo.id, targetId, sendTodoText);
      toast.success(`Started in ${result.worktreeLabel}`, {
        action: {
          label: 'Open worktree',
          onClick: () => {
            setActiveTerminal(targetId);
            setActiveTab(result.tabId);
            setActiveScreen({ type: 'main' });
            exitOverview();
            setFocusArea('mainTerminal');
          },
        },
      });
    } catch (error) {
      toast.error('Could not start todo', {
        description: error instanceof Error ? error.message : String(error),
        duration: 10000,
      });
    }
  };

  const agentActionRefs = useRef<Map<string, AgentTileActionsHandle>>(new Map());

  // Copy output from the active user terminal
  const handleCopyUserTerminalOutput = useCallback(async () => {
    if (!activeTerminalId || !activeUserTabId) return;
    const terminalId = getUserTerminalIdForTab(activeTerminalId, activeUserTabId);
    const terminalHandle = userTerminalRefs.current.get(terminalId);
    if (terminalHandle) {
      await terminalHandle.copyAllOutput();
    }
  }, [activeTerminalId, activeUserTabId, getUserTerminalIdForTab]);

  // Get active session and repository info
  const activeSessionInfo = useMemo(() => {
    if (!activeTerminalId) return null;
    return allSessions.find(({ session }) => session.id === activeTerminalId) ?? null;
  }, [activeTerminalId, allSessions]);

  const activeSession = activeSessionInfo?.session ?? null;
  const currentReviewCount = activeSession ? reviewCounts[activeSession.path] : undefined;
  const currentChangeCount = activeSession ? changeCounts[activeSession.path] : undefined;
  const rightPanelCounts = {
    changes: currentChangeCount,
    review:
      currentReviewCount?.count ??
      (currentReviewCount?.base && currentReviewCount.base !== 'HEAD'
        ? undefined
        : currentChangeCount),
    reviewBase: currentReviewCount?.base,
    terminals: activeTerminalId ? getUserTabsForWorktree(activeTerminalId).length : 0,
    browser: activeSessionInfo ? (browserCounts[activeSessionInfo.repository.id] ?? 0) : 0,
    ...getScopeIndicators(activeSessionInfo?.repository, activeSession ?? undefined),
  };

  // Get tabs for the active worktree
  const tabsForActiveWorktree = useMemo(() => {
    if (!activeTerminalId) return [];
    return getTabsForWorktree(activeTerminalId);
  }, [activeTerminalId, getTabsForWorktree, worktreeTabs]);

  const isWorktreeGrid =
    !isOverviewMode &&
    Boolean(worktreeTabs.find((wt) => wt.worktreeSessionId === activeTerminalId)?.isGridView);
  const isInteractiveGrid = isOverviewMode || isWorktreeGrid;
  const gridAgentCount = isOverviewMode ? overviewAgentCount : tabsForActiveWorktree.length;
  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(gridAgentCount)));

  // Helper to get terminal ID for a tab in the current worktree
  const getTerminalIdForActiveTab = useCallback(
    (tabId: string) => {
      if (!activeTerminalId) return '';
      return getTerminalIdForTab(activeTerminalId, tabId);
    },
    [activeTerminalId, getTerminalIdForTab]
  );

  // Tab handlers
  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      setFocusArea('mainTerminal');
    },
    [setActiveTab, setFocusArea]
  );

  const handleTabClose = useCallback(
    async (tabId: string) => {
      if (!activeTerminalId) {
        console.log('[handleTabClose] No activeTerminalId, returning early');
        return;
      }
      // Kill the terminal for this tab
      const terminalId = getTerminalIdForTab(activeTerminalId, tabId);
      console.log(
        `[handleTabClose] Killing terminal: ${terminalId} (activeTerminalId=${activeTerminalId}, tabId=${tabId})`
      );
      try {
        await window.terminal.kill(terminalId);
        console.log(`[handleTabClose] Terminal kill completed for: ${terminalId}`);
      } catch (err) {
        console.log(`[handleTabClose] Terminal kill failed for: ${terminalId}`, err);
        // Terminal might not be running, ignore
      }
      // Unregister from renderer's terminal state so close warning shows correct count
      unregisterTerminal(terminalId);
      closeTab(tabId);
    },
    [activeTerminalId, getTerminalIdForTab, closeTab, unregisterTerminal]
  );

  const handleTabRename = useCallback(
    (tabId: string, name: string) => {
      renameTab(tabId, name);
    },
    [renameTab]
  );

  const handleTabReorder = useCallback(
    (tabs: TerminalTab[]) => {
      if (!activeTerminalId) return;
      reorderTabs(activeTerminalId, tabs);
    },
    [activeTerminalId, reorderTabs]
  );

  const handleNewTab = useCallback(
    async (name?: string, command?: string, icon?: string) => {
      if (!activeTerminalId || !activeSession) return;
      // Determine display name: use preset name if provided, otherwise resolve shell name
      let displayName = name;
      if (!displayName) {
        displayName = await window.terminal.getResolvedShellName();
      }
      // Create the tab with separate name, command, and icon
      // command is undefined for plain terminals (no auto-run)
      createTab(activeTerminalId, displayName, command || undefined, icon);
      // Focus the main terminal area so the new terminal receives input
      // Delay to ensure dropdown has closed and terminal has mounted (TerminalView uses 250ms)
      setTimeout(() => {
        // Blur dropdown trigger to release focus
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setFocusArea('mainTerminal');
      }, 300);
    },
    [activeTerminalId, activeSession, createTab, setFocusArea]
  );

  // Get scroll position for the active worktree's tab bar
  const tabScrollPosition = useMemo(() => {
    if (!activeTerminalId) return 0;
    return getTabScrollPosition(activeTerminalId);
  }, [activeTerminalId, getTabScrollPosition, worktreeTabs]);

  // Get the default preset for EmptyTerminalState (used when pressing Enter in empty worktree)
  const defaultPreset = useMemo(() => {
    const { terminalPresets, defaultPresetId } = settings;
    // Find preset by defaultPresetId, or use first preset (Terminal) if null
    const preset = defaultPresetId
      ? terminalPresets.find((p) => p.id === defaultPresetId)
      : terminalPresets.find((p) => p.isBuiltIn); // Built-in "Terminal" is the fallback

    if (!preset) return undefined;

    return {
      name: preset.name,
      command: preset.command,
      icon: preset.icon,
    };
  }, [settings]);

  // Handle tab bar scroll position changes
  const handleTabScrollPositionChange = useCallback(
    (position: number) => {
      if (!activeTerminalId) return;
      updateTabScrollPosition(activeTerminalId, position);
    },
    [activeTerminalId, updateTabScrollPosition]
  );

  useEffect(() => {
    if (rightPanelTab === 'review' && activeSession) {
      setVisitedReviews((previous) =>
        previous[activeSession.id] === activeSession.path
          ? previous
          : { ...previous, [activeSession.id]: activeSession.path }
      );
    }
  }, [rightPanelTab, activeSession]);

  const handleViewDiff = useCallback(
    (file: FileStatus) => {
      if (!activeSession) return;
      setReviewRequests((previous) => ({
        ...previous,
        [activeSession.id]: { id: (previous[activeSession.id]?.id ?? 0) + 1, filePath: file.path },
      }));
      selectRightPanelTab('review');
    },
    [activeSession, selectRightPanelTab]
  );

  // Handler for opening file in external editor
  const handleOpenInEditor = useCallback(
    async (fileStatus: FileStatus) => {
      if (!activeSession) return;

      const filePath = `${activeSession.path}/${fileStatus.path}`;
      // For file open, use cursor as fallback if 'folder' is preferred
      const editor = settings.preferredEditor === 'folder' ? 'cursor' : settings.preferredEditor;
      // Open editor at worktree root with the file
      const result = await window.electronAPI.openInEditor(filePath, editor, activeSession.path);
      if (!result.success && result.error) {
        toast.error(`Failed to open in editor: ${result.error}`);
      }
    },
    [activeSession, settings.preferredEditor]
  );

  // Handler to open settings
  const handleOpenSettings = useCallback(() => {
    setActiveScreen({ type: 'settings', tab: 'terminal' });
  }, []);

  // Handler to open home screen
  const handleOpenHome = useCallback(() => {
    setActiveScreen({ type: 'home' });
  }, []);

  // Handler when a session is selected in sidebar - return to main screen
  const handleSessionSelect = useCallback(() => {
    setActiveScreen({ type: 'main' });
    exitOverview();
  }, [exitOverview]);

  const handleOpenPortTerminal = useCallback(
    (terminalId: string): boolean => {
      const state = useAppStore.getState();
      // Resolve against live tabs rather than parsing IDs or recreating a closed terminal.
      for (const kind of ['main', 'user'] as const) {
        const groups = kind === 'main' ? state.worktreeTabs : state.userTerminalTabs;
        for (const group of groups ?? []) {
          const tab = group.tabs.find(
            (tab) =>
              (kind === 'main' ? state.getTerminalIdForTab : state.getUserTerminalIdForTab)(
                group.worktreeSessionId,
                tab.id
              ) === terminalId
          );
          if (
            !tab ||
            !state.repositories.some((repo) =>
              repo.worktreeSessions.some((session) => session.id === group.worktreeSessionId)
            )
          )
            continue;
          state.setActiveTerminal(group.worktreeSessionId);
          if (kind === 'main') {
            state.setActiveTab(tab.id);
            state.setWorktreeGridView(group.worktreeSessionId, false);
          } else {
            state.setActiveUserTab(tab.id);
            setRightPanelTab('terminals');
          }
          setActiveScreen({ type: 'main' });
          setReviewExpanded(false);
          setBrowserExpanded(false);
          exitOverview();
          state.setFocusArea(kind === 'main' ? 'mainTerminal' : 'userTerminal');
          // Restore keyboard focus after the navigation dialog releases its focus trap.
          requestAnimationFrame(() => {
            const refs = kind === 'main' ? mainTerminalRefs : userTerminalRefs;
            refs.current.get(terminalId)?.focus();
          });
          return true;
        }
      }
      return false;
    },
    [exitOverview]
  );

  const handleClosePortTerminal = useCallback(async (terminalId: string): Promise<boolean> => {
    const state = useAppStore.getState();
    for (const kind of ['main', 'user'] as const) {
      const groups = kind === 'main' ? state.worktreeTabs : state.userTerminalTabs;
      for (const group of groups ?? []) {
        const tab = group.tabs.find(
          (tab) =>
            (kind === 'main' ? state.getTerminalIdForTab : state.getUserTerminalIdForTab)(
              group.worktreeSessionId,
              tab.id
            ) === terminalId
        );
        if (!tab) continue;
        // Wait for shell cleanup before removing the tab. Keep the tab if killing fails.
        await window.terminal.kill(terminalId, true);
        const current = useAppStore.getState();
        current.unregisterTerminal(terminalId);
        if (kind === 'main') current.closeTab(tab.id);
        else current.closeUserTabById(group.worktreeSessionId, tab.id);
        return true;
      }
    }
    return false;
  }, []);

  // Handler when an agent tile is clicked in overview mode - jump to that agent
  const handleAgentSelect = useCallback(
    (sessionId: string, tabId: string) => {
      setActiveTerminal(sessionId);
      setActiveTab(tabId);
      setReviewExpanded(false);
      setBrowserExpanded(false);
      setTodosExpanded(false);
      setExpandedToolTabs({});
      exitOverview();
      setFocusArea('mainTerminal');
    },
    [setActiveTerminal, setActiveTab, exitOverview, setFocusArea]
  );

  const handleOverviewAgentClose = (terminalId: string, tabId: string) => {
    const container = terminalGridRef.current;
    const cards = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[data-overview-terminal-id]') ?? []
    ).filter((pane) => pane.style.display !== 'none');
    const index = cards.findIndex((card) => card.dataset.overviewTerminalId === terminalId);
    const nextCard = cards[index + 1] ?? cards[index - 1];

    // closeTab resolves the owning worktree and kills its process, even when inactive.
    unregisterTerminal(terminalId);
    closeTab(tabId);

    requestAnimationFrame(() => {
      if (nextCard?.isConnected) {
        (nextCard.querySelector('textarea') ?? nextCard).focus({ preventScroll: true });
        nextCard.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      } else {
        container?.querySelector<HTMLDivElement>('[data-overview-terminal-id]')?.focus();
      }
    });
  };

  const onOverviewKeyDown = useOverviewShortcuts({
    enabled: isOverviewMode && activeScreen.type === 'main',
    terminalIds: overviewAgents
      .filter((agent) => !hiddenOverviewAgents.has(agent.terminalId))
      .map((agent) => agent.terminalId),
    activeTerminalId:
      activeTerminalId && activeTabId ? getTerminalIdForTab(activeTerminalId, activeTabId) : null,
    columns: gridColumns,
    onFocus: (terminalId) => {
      const agent = allTerminalConfigs.find((config) => config.terminalId === terminalId);
      if (!agent) return;
      setActiveTerminal(agent.sessionId);
      setActiveTab(agent.tabId);
      setFocusArea('mainTerminal');
      const pane = Array.from(
        terminalGridRef.current?.querySelectorAll<HTMLDivElement>('[data-overview-terminal-id]') ??
          []
      ).find((element) => element.dataset.overviewTerminalId === terminalId);
      (pane?.querySelector('textarea') ?? pane)?.focus({ preventScroll: true });
    },
    onOpen: (terminalId) => {
      const agent = allTerminalConfigs.find((config) => config.terminalId === terminalId);
      if (agent) handleAgentSelect(agent.sessionId, agent.tabId);
    },
    onClose: (terminalId) => agentActionRefs.current.get(terminalId)?.requestClose(),
  });

  useKeyboardShortcuts({
    onSessionSelect: handleKeyboardSessionSelect,
    onOpenSettings: handleKeyboardOpenSettings,
    onAddRepository: handleKeyboardAddRepository,
    onToggleOverview: toggleOverview,
    onFocusUserTerminal: focusUserTerminal,
    onOpenRepositoryOverview: () => {
      const repositoryId =
        (isOverviewMode && overviewRepositoryId) || activeSessionInfo?.repository.id;
      if (repositoryId) openRepositoryOverview(repositoryId);
    },
    onOverviewKeyDown,
  });

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Only render custom title bar on Windows (macOS and Linux use native title bars)
  const shouldRenderTitleBar = window.electronAPI?.platform === 'win32';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {shouldRenderTitleBar && <TitleBar title="Termpad" />}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          width={sidebarWidth}
          onResizeStart={startResizingSidebar}
          onAddRepository={handleAddRepository}
          onNewWorktree={handleNewWorktree}
          onRepositoryDelete={handleRepositoryDelete}
          onOpenRepositorySettings={handleOpenRepositorySettings}
          onWorktreeRemove={handleWorktreeRemove}
          onOpenSettings={handleOpenSettings}
          onOpenHome={handleOpenHome}
          onSessionSelect={handleSessionSelect}
          onOpenPerformanceBrowser={(repositoryId) => {
            const repo = useAppStore
              .getState()
              .repositories.find((item) => item.id === repositoryId);
            const session =
              repo?.worktreeSessions.find((item) => item.id === activeTerminalId) ??
              repo?.worktreeSessions[0];
            if (!session) return false;
            setActiveTerminal(session.id);
            setActiveScreen({ type: 'main' });
            exitOverview();
            setRightPanelTab('browser');
            setFocusArea('app');
            return true;
          }}
          onOpenPortTerminal={handleOpenPortTerminal}
          onClosePortTerminal={handleClosePortTerminal}
          onToggleOverview={toggleOverview}
          onOpenPlanning={() => openPlanning()}
          onOpenRepositoryPlanning={(repositoryId) =>
            openPlanning(repositoryId, { scopeId: 'global', tab: 'todos' })
          }
          isPlanning={activeScreen.type === 'planning'}
          onOpenRepositoryOverview={openRepositoryOverview}
          isOverviewMode={isOverviewMode}
          isHome={
            !isOverviewMode &&
            (activeScreen.type === 'home' || (activeScreen.type === 'main' && !activeTerminalId))
          }
          activeOverviewRepositoryId={isOverviewMode ? overviewRepositoryId : null}
          hasAgents={allTerminalConfigs.length > 0}
        />

        <main
          className="workspace-main min-w-0 flex-1 overflow-hidden relative bg-background flex"
          onClick={() => {
            // When clicking on main content area (but not on terminal), set focus to 'app'
            // This allows form inputs to work without terminal/sidebar shortcuts interfering
            setFocusArea('app');
          }}
        >
          {/* Main content - always rendered to preserve state */}
          {allSessions.length === 0 ? (
            <div className="flex-1 bg-background" />
          ) : (
            <>
              {/* Terminal Panel with WorktreeBar */}
              <div
                className="flex-1 flex flex-col min-w-0"
                style={{
                  display: !isOverviewMode && rightPanelExpanded ? 'none' : undefined,
                }}
              >
                {/* Overview replaces the per-session header while it is open */}
                {isOverviewMode && (
                  <OverviewHeader
                    agentCount={overviewAgentCount}
                    onClose={exitOverview}
                    repositories={repositories}
                    repositoryId={overviewRepositoryId}
                    hiddenAgents={hiddenAgents}
                    onUnhideAgent={unhideOverviewAgent}
                    onUnhideAll={unhideAllOverviewAgents}
                    onRepositoryChange={(repositoryId) => {
                      setOverviewRepositoryId(repositoryId);
                      setFocusArea('app');
                    }}
                  />
                )}

                {/* WorktreeBar Header - only spans terminal width */}
                {!isOverviewMode && (
                  <WorktreeBar
                    sessionId={activeTerminalId}
                    sessionPath={activeSession?.path}
                    branchName={activeSession?.branchName}
                    onError={(message) => toast.error(message)}
                  />
                )}

                {/* TabBar - show when a worktree is selected */}
                {!isOverviewMode && activeTerminalId && (
                  <TabBar
                    tabs={tabsForActiveWorktree}
                    activeTabId={activeTabId}
                    terminalStatuses={terminals}
                    getTerminalIdForTab={getTerminalIdForActiveTab}
                    onTabClick={handleTabClick}
                    onTabClose={handleTabClose}
                    onTabRename={handleTabRename}
                    onTabReorder={handleTabReorder}
                    onNewTab={handleNewTab}
                    scrollPosition={tabScrollPosition}
                    onScrollPositionChange={handleTabScrollPositionChange}
                    worktreeSessionId={activeTerminalId}
                    terminalPresets={settings.terminalPresets}
                    isGridView={isWorktreeGrid}
                    onToggleGridView={() => setWorktreeGridView(activeTerminalId, !isWorktreeGrid)}
                  />
                )}

                {/* Terminal area - a grid of agent tiles while overview is open */}
                <div
                  ref={terminalGridRef}
                  tabIndex={-1}
                  style={
                    isInteractiveGrid
                      ? {
                          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${Math.max(1, Math.ceil(gridAgentCount / gridColumns))}, minmax(0, 1fr))`,
                        }
                      : undefined
                  }
                  className={cn(
                    'relative flex-1 min-h-0 rounded-xl mx-3 mb-3 mt-2',
                    isInteractiveGrid
                      ? 'grid gap-3 overflow-hidden p-1 bg-background'
                      : 'border border-border/60 p-2 bg-muted'
                  )}
                >
                  {/* Render terminals for each tab across all worktrees.
                      Overview mode shows them all at once instead of only the active tab. */}
                  {allTerminalConfigs.map((config) => {
                    const isActiveTab =
                      config.sessionId === activeTerminalId && config.tabId === activeTabId;
                    const isVisible =
                      activeScreen.type !== 'planning' &&
                      !(activeScreen.type === 'addWorktree' && activeScreen.todo) &&
                      (isOverviewMode
                        ? (!overviewRepositoryId || config.repositoryId === overviewRepositoryId) &&
                          !hiddenOverviewAgents.has(config.terminalId)
                        : !rightPanelExpanded &&
                          (isWorktreeGrid ? config.sessionId === activeTerminalId : isActiveTab));

                    return (
                      <AgentTile
                        key={config.terminalId}
                        actionsRef={(handle) => {
                          if (handle) agentActionRefs.current.set(config.terminalId, handle);
                          else agentActionRefs.current.delete(config.terminalId);
                        }}
                        terminalId={config.terminalId}
                        isOverview={isOverviewMode || isWorktreeGrid}
                        isVisible={isVisible}
                        isActive={isActiveTab}
                        onFocusPane={
                          isVisible
                            ? () => {
                                if (!isActiveTab) {
                                  if (config.sessionId !== activeTerminalId)
                                    setActiveTerminal(config.sessionId);
                                  setActiveTab(config.tabId);
                                }
                                setFocusArea('mainTerminal');
                              }
                            : undefined
                        }
                        repositoryName={config.repositoryName}
                        worktreeLabel={config.worktreeLabel}
                        tabName={config.tabName}
                        tabIcon={config.tabIcon}
                        status={terminals.get(config.terminalId)?.status ?? 'stopped'}
                        selectTooltip={
                          isWorktreeGrid ? 'Show only this terminal' : 'Open in worktree'
                        }
                        onSelect={() => {
                          if (isWorktreeGrid) setWorktreeGridView(config.sessionId, false);
                          handleAgentSelect(config.sessionId, config.tabId);
                        }}
                        onClose={() => handleOverviewAgentClose(config.terminalId, config.tabId)}
                        onHide={
                          isOverviewMode ? () => hideOverviewAgent(config.terminalId) : undefined
                        }
                        onMenuOpen={() => setFocusArea('app')}
                        onCopy={() => {
                          void mainTerminalRefs.current.get(config.terminalId)?.copySelection();
                        }}
                        onPaste={() => {
                          void mainTerminalRefs.current.get(config.terminalId)?.paste();
                        }}
                      >
                        <TerminalView
                          ref={(handle) => {
                            if (handle) mainTerminalRefs.current.set(config.terminalId, handle);
                            else mainTerminalRefs.current.delete(config.terminalId);
                          }}
                          sessionId={config.sessionId}
                          terminalId={config.terminalId}
                          cwd={config.cwd}
                          isVisible={isVisible}
                          isFocused={isActiveTab}
                          useParentContextMenu={isInteractiveGrid}
                          initialCommand={config.tabCommand}
                          terminalType="main"
                        />
                      </AgentTile>
                    );
                  })}

                  {/* Overview open but no agent terminals exist yet */}
                  {isOverviewMode && overviewAgentCount === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                      <TerminalIcon className="h-8 w-8 opacity-40" />
                      <span className="text-sm">
                        {hiddenAgents.length > 0
                          ? 'All agents in this view are hidden'
                          : overviewRepositoryId
                            ? 'No agents open in this repository'
                            : 'No agents yet'}
                      </span>
                      {hiddenAgents.length > 0 ? (
                        <button
                          className="text-sm text-primary underline underline-offset-4"
                          onClick={unhideAllOverviewAgents}
                        >
                          Show hidden agents
                        </button>
                      ) : (
                        overviewRepositoryId && (
                          <span className="text-xs">
                            Open a terminal in one of its worktrees to see it here.
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Show empty state when worktree is selected but has no tabs */}
                  {!isOverviewMode && activeTerminalId && tabsForActiveWorktree.length === 0 && (
                    <div
                      className="absolute inset-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusArea('mainTerminal');
                      }}
                    >
                      <EmptyTerminalState
                        onCreateTab={handleNewTab}
                        defaultPreset={defaultPreset}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Workspace tools. Hidden tabs stay mounted to retain their state.
                  Always rendered so user terminal TerminalViews remain mounted across repo switches.
                  Hidden via display:none when no session is active. */}
              <div
                ref={rightPanelRef}
                className="h-full min-w-0 flex-shrink-0 relative bg-card flex flex-col"
                style={{
                  width: rightPanelExpanded ? '100%' : fileChangesPaneWidth,
                  display:
                    activeSession && activeSessionInfo && !isOverviewMode ? undefined : 'none',
                }}
                data-testid="right-panel"
              >
                {/* Horizontal resize handle (for panel width) */}
                <div
                  className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 z-10"
                  style={{
                    display: rightPanelExpanded ? 'none' : undefined,
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    startResizingFileChangesPane();
                  }}
                />

                <div className="flex min-h-[49px] shrink-0 items-center gap-2 px-3 py-2">
                  <RightPanelTabs
                    active={rightPanelTab}
                    onChange={selectRightPanelTab}
                    counts={rightPanelCounts}
                  />
                  {['changes', 'notes', 'terminals'].includes(rightPanelTab) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7 shrink-0"
                      aria-label={`${rightPanelExpanded ? 'Collapse' : 'Expand'} ${rightPanelTab}`}
                      title={`${rightPanelExpanded ? 'Collapse' : 'Expand'} ${rightPanelTab}`}
                      onClick={() =>
                        setExpandedToolTabs((previous) => ({
                          ...previous,
                          [rightPanelTab]: !previous[rightPanelTab],
                        }))
                      }
                    >
                      {rightPanelExpanded ? (
                        <Minimize2 className="size-3.5" />
                      ) : (
                        <Maximize2 className="size-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Changes, Notes, and Todos stay mounted so git watchers and an in-progress commit
                    message survive tab switches. */}
                {activeSession && activeSessionInfo && (
                  <div
                    className="flex-1 min-h-0 overflow-hidden"
                    style={{
                      height: '100%',
                      display:
                        rightPanelTab === 'review' ||
                        rightPanelTab === 'terminals' ||
                        rightPanelTab === 'browser'
                          ? 'none'
                          : undefined,
                    }}
                    data-testid="right-panel-top"
                  >
                    <div className={rightPanelTab === 'changes' ? 'h-full' : 'hidden'}>
                      <SourceControlPane
                        titleSlot={
                          <span className="text-xs font-medium text-muted-foreground">
                            Source control
                          </span>
                        }
                        repoPath={activeSession.path}
                        onViewDiff={handleViewDiff}
                        onOpenInEditor={handleOpenInEditor}
                        onFileCountChange={handleChangeCount}
                      />
                    </div>
                    {allSessions
                      .filter(({ session }) => visitedWorktreeTools.includes(session.id))
                      .map(({ repository, session }) => (
                        <div
                          key={session.id}
                          hidden={
                            session.id !== activeTerminalId ||
                            !['notes', 'todos'].includes(rightPanelTab)
                          }
                          className={
                            session.id === activeTerminalId &&
                            ['notes', 'todos'].includes(rightPanelTab)
                              ? 'h-full'
                              : 'hidden'
                          }
                        >
                          <div
                            hidden={rightPanelTab !== 'notes'}
                            className={rightPanelTab === 'notes' ? 'h-full' : 'hidden'}
                          >
                            <NotesPanel
                              scopeMode="worktree"
                              onOpenPlanning={() =>
                                openPlanning(repository.id, {
                                  scopeId: session.id,
                                  tab: 'notes',
                                })
                              }
                              titleSlot={null}
                              repositoryId={repository.id}
                              worktreeSessionId={session.id}
                              repositoryName={repository.name}
                              worktreeLabel={session.label}
                            />
                          </div>
                          <div
                            hidden={rightPanelTab !== 'todos'}
                            className={rightPanelTab === 'todos' ? 'h-full' : 'hidden'}
                          >
                            <TodosPanel
                              scopeMode="worktree"
                              onOpenPlanning={() =>
                                openPlanning(repository.id, {
                                  scopeId: session.id,
                                  tab: 'todos',
                                })
                              }
                              onDispatch={(todo, targetId) => {
                                void handleDispatchTodo(repository.id, todo, targetId);
                              }}
                              expanded={todosExpanded}
                              onToggleExpanded={() => setTodosExpanded((value) => !value)}
                              titleSlot={null}
                              repositoryId={repository.id}
                              worktreeSessionId={session.id}
                              repositoryName={repository.name}
                              worktreeLabel={session.label}
                              onSendToTerminal={
                                canSendTodo && session.id === activeTerminalId
                                  ? handleSendTodo
                                  : undefined
                              }
                              onCreateWorktree={(todo) => {
                                setActiveScreen({
                                  type: 'addWorktree',
                                  repositoryId: repository.id,
                                  todo,
                                  todoScope: { type: 'worktree', worktreeSessionId: session.id },
                                });
                                setFocusArea('app');
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {repositories.map((repository) => (
                  <div
                    key={repository.id}
                    data-browser-repository={repository.id}
                    hidden={
                      rightPanelTab !== 'browser' ||
                      activeSessionInfo?.repository.id !== repository.id
                    }
                    className={
                      rightPanelTab === 'browser' &&
                      activeSessionInfo?.repository.id === repository.id
                        ? 'flex-1 min-h-0'
                        : 'hidden'
                    }
                  >
                    <BrowserPanel
                      repositoryId={repository.id}
                      expanded={browserExpanded}
                      onToggleExpanded={() => setBrowserExpanded((value) => !value)}
                      onTabCountChange={(count) => {
                        setBrowserCounts((previous) =>
                          previous[repository.id] === count
                            ? previous
                            : { ...previous, [repository.id]: count }
                        );
                      }}
                    />
                  </div>
                ))}

                {Object.entries(visitedReviews)
                  .filter(([sessionId]) =>
                    allSessions.some(({ session }) => session.id === sessionId)
                  )
                  .map(([sessionId, repoPath]) => (
                    <div
                      key={sessionId}
                      className={
                        rightPanelTab === 'review' && activeTerminalId === sessionId
                          ? 'flex-1 min-h-0'
                          : 'hidden'
                      }
                    >
                      <ReviewPanel
                        repoPath={repoPath}
                        active={rightPanelTab === 'review' && activeTerminalId === sessionId}
                        enabled={activeTerminalId === sessionId}
                        onFileCountChange={handleReviewCount}
                        request={reviewRequests[sessionId]}
                        expanded={reviewExpanded}
                        onToggleExpanded={() => setReviewExpanded((value) => !value)}
                      />
                    </div>
                  ))}

                {/* Terminals tab: controls and a stable terminal container. */}
                <div
                  className="flex-1 min-h-0 overflow-hidden flex flex-col"
                  style={{
                    height: '100%',
                    display: isUserTerminalPanelCollapsed ? 'none' : undefined,
                  }}
                  data-testid="user-terminal-panel"
                >
                  {activeSession && activeSessionInfo && (
                    <UserTerminalSection
                      worktreeSessionId={activeSession.id}
                      repositoryId={activeSessionInfo.repository.id}
                      onOpenRepositorySettings={() =>
                        setActiveScreen({
                          type: 'repositorySettings',
                          repositoryId: activeSessionInfo.repository.id,
                        })
                      }
                      onCopyOutput={handleCopyUserTerminalOutput}
                    />
                  )}

                  {/* Stable user terminal TerminalView container — always mounted, never unmounts on repo switch */}
                  <div className="flex-1 relative min-h-0 overflow-auto p-2 bg-muted rounded-xl m-1">
                    {allUserTerminalConfigs.map((config) => (
                      <TerminalView
                        key={config.terminalId}
                        ref={(handle) => {
                          if (handle) {
                            userTerminalRefs.current.set(config.terminalId, handle);
                          } else {
                            userTerminalRefs.current.delete(config.terminalId);
                          }
                        }}
                        sessionId={config.sessionId}
                        terminalId={config.terminalId}
                        cwd={config.cwd}
                        isVisible={
                          activeScreen.type !== 'planning' &&
                          !(activeScreen.type === 'addWorktree' && activeScreen.todo) &&
                          !isOverviewMode &&
                          !isUserTerminalPanelCollapsed &&
                          config.sessionId === activeTerminalId &&
                          config.tabId === activeUserTabId
                        }
                        terminalType="user"
                      />
                    ))}

                    {/* Empty state when no user tabs for the active worktree */}
                    {activeTerminalId && getUserTabsForWorktree(activeTerminalId).length === 0 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusArea('userTerminal');
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <TerminalIcon className="h-8 w-8 opacity-40" />
                          <span className="text-sm">No terminals</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {repositories
            .filter(
              (repository) =>
                visitedPlanning.includes(repository.id) || planningRepositoryId === repository.id
            )
            .map((repository) => (
              <div
                key={repository.id}
                hidden={planningRepositoryId !== repository.id}
                className={
                  planningRepositoryId === repository.id
                    ? 'absolute inset-0 z-30 bg-background'
                    : 'hidden'
                }
              >
                <PlanningWorkspace
                  locationRequest={planningLocations[repository.id]}
                  repository={repository}
                  repositories={repositories}
                  onRepositoryChange={openPlanning}
                  onBack={() => setActiveScreen({ type: 'main' })}
                  onDispatch={(todo, targetId) => {
                    void handleDispatchTodo(repository.id, todo, targetId);
                  }}
                  onCreateWorktree={(todo, todoScope) => {
                    setActiveScreen({
                      type: 'addWorktree',
                      repositoryId: repository.id,
                      todo,
                      todoScope,
                      returnToPlanning: repository.id,
                    });
                    setFocusArea('app');
                  }}
                />
              </div>
            ))}

          {activeScreen.type === 'planning' && !planningRepositoryId && (
            <section
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background p-6"
              aria-label="Planning"
            >
              <h1 className="text-lg font-semibold">Planning</h1>
              <p className="text-sm text-muted-foreground">
                Add a repository to start planning todos and notes.
              </p>
              <Button onClick={handleAddRepository}>Add repository</Button>
            </section>
          )}

          {/* Overlay screens - rendered on top of main content */}
          {activeScreen.type === 'settings' && (
            <div className="absolute inset-0 z-40 bg-background">
              <SettingsScreen
                onBack={() => setActiveScreen({ type: 'main' })}
                initialTab={activeScreen.tab}
              />
            </div>
          )}
          {activeScreen.type === 'addWorktree' && (
            <div className="absolute inset-0 z-40 bg-background">
              <AddWorktreeScreen
                onBack={() =>
                  setActiveScreen(
                    activeScreen.returnToPlanning
                      ? { type: 'planning', repositoryId: activeScreen.returnToPlanning }
                      : { type: 'main' }
                  )
                }
                repositoryId={activeScreen.repositoryId}
                todo={activeScreen.todo}
                todoScope={activeScreen.todoScope}
                onTodoTerminalCreated={handleTodoTerminalCreated}
              />
            </div>
          )}
          {/* HomeScreen: Show when explicitly requested OR when on main screen with no active terminal
              IMPORTANT: Must check activeScreen.type === 'main' to prevent blocking other overlays
              (Settings, AddWorktree, etc.) when activeTerminalId is null */}
          {!isOverviewMode &&
            (activeScreen.type === 'home' ||
              (activeScreen.type === 'main' && !activeTerminalId)) && (
              <div className="absolute inset-0 z-40 bg-background">
                <HomeScreen
                  onAddRepository={() => setActiveScreen({ type: 'addRepository' })}
                  onSelectRepository={(repository) => {
                    // If repository has worktree sessions, activate the first one
                    if (repository.worktreeSessions.length > 0) {
                      setActiveTerminal(repository.worktreeSessions[0].id);
                    }
                    setActiveScreen({ type: 'main' });
                  }}
                  onAddWorktree={(repositoryId) =>
                    setActiveScreen({ type: 'addWorktree', repositoryId })
                  }
                  onSelectWorktree={(worktree) => {
                    setActiveTerminal(worktree.id);
                    setActiveScreen({ type: 'main' });
                  }}
                />
              </div>
            )}
          {activeScreen.type === 'addRepository' && (
            <div className="absolute inset-0 z-40 bg-background">
              <AddRepositoryScreen onBack={() => setActiveScreen({ type: 'main' })} />
            </div>
          )}
          {activeScreen.type === 'repositorySettings' && (
            <div className="absolute inset-0 z-40 bg-background">
              <RepositorySettingsOverlay
                key={activeScreen.repositoryId}
                repositoryId={activeScreen.repositoryId}
                onClose={() => setActiveScreen({ type: 'main' })}
              />
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <CloseWarningDialog
        open={closeWarningOpen}
        activeCount={closeWarningCount}
        onConfirm={handleCloseConfirm}
        onCancel={handleCloseCancel}
      />

      <RemoveWorktreeDialog
        key={removeWorktreeSession?.id}
        open={removeWorktreeSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveWorktreeSession(null);
            setRemoveWorktreeRepository(null);
          }
        }}
        session={removeWorktreeSession}
        repository={removeWorktreeRepository}
      />

      <DeleteRepositoryDialog
        key={deleteRepositoryTarget?.id}
        open={deleteRepositoryDialogOpen}
        onOpenChange={(open) => {
          setDeleteRepositoryDialogOpen(open);
          if (!open) {
            setDeleteRepositoryTarget(null);
          }
        }}
        repository={deleteRepositoryTarget}
      />

      <Toaster position="bottom-right" theme="dark" />

      {/* Auto-update notification */}
      <UpdateNotification />
    </div>
  );
}
