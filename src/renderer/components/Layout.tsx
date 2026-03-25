import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import type { FileStatus, Repository, TerminalTab, WorktreeSession } from '../../shared/types';
import type { DiffFile, DiffFileStat } from '../../shared/reviewTypes';
import { SourceControlPane } from '../features/source-control';
import { UserTerminalSection } from '../features/user-terminals';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePRStatusPolling } from '../hooks/usePRStatusPolling';
import { useWorktreeWatchers } from '../hooks/useWorktreeWatchers';
import { useAppStore } from '../stores/appStore';
import { useReviewStore } from '../stores/reviewStore';
import { AddRepositoryScreen } from './AddRepositoryScreen';
import { AddWorktreeScreen } from './AddWorktreeScreen';
import { CloseWarningDialog } from './CloseWarningDialog';
import { DeleteRepositoryDialog } from './DeleteRepositoryDialog';
import { HomeScreen } from './HomeScreen';
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
import { useAutoUpdater } from '../hooks/useAutoUpdater';

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
    updateUserTerminalPanelRatio,
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
    // Scroll position actions
    updateTabScrollPosition,
    getTabScrollPosition,
    // User terminal tabs
    getUserTabsForWorktree,
    getUserTerminalIdForTab,
    userTerminalTabs,
    activeUserTabId,
  } = useAppStore();

  // Initialize store from main process storage
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Start watchers for live worktree changes
  useWorktreeWatchers();

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
    | { type: 'addWorktree'; repositoryId: string | null }
    | { type: 'home' }
    | { type: 'addRepository' }
    | { type: 'repositorySettings'; repositoryId: string };

  // Start with home screen on app launch
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>({ type: 'home' });
  const [notesOpen, setNotesOpen] = useState(false);

  // Callback to close overlay screens when session is selected via keyboard
  const handleKeyboardSessionSelect = useCallback(() => {
    setActiveScreen({ type: 'main' });
  }, []);

  // Callback to open settings via keyboard shortcut (Ctrl+,)
  const handleKeyboardOpenSettings = useCallback(() => {
    setActiveScreen({ type: 'settings', tab: 'terminal' });
  }, []);

  // Callback to add repository via keyboard shortcut (Ctrl+G)
  const handleKeyboardAddRepository = useCallback(() => {
    setActiveScreen({ type: 'addRepository' });
  }, []);

  // Enable keyboard shortcuts (Ctrl+B toggle, Ctrl+Shift+1-9 session shortcuts)
  useKeyboardShortcuts({
    onSessionSelect: handleKeyboardSessionSelect,
    onOpenSettings: handleKeyboardOpenSettings,
    onAddRepository: handleKeyboardAddRepository,
  });

  // Handle Escape key for going back on overlay screens
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      // Only handle Escape when on an overlay screen with a back button
      if (e.key === 'Escape') {
        // Don't handle if user is in an input field (except for settings/repository screens)
        const isInputFocused =
          e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

        if (activeScreen.type === 'settings') {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
        } else if (activeScreen.type === 'addRepository' && !isInputFocused) {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
        } else if (activeScreen.type === 'addWorktree' && !isInputFocused) {
          e.preventDefault();
          setActiveScreen({ type: 'main' });
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
  }, [activeScreen.type]);

  // Sync sidebar focus when active terminal changes
  useEffect(() => {
    if (activeTerminalId) {
      setSidebarFocusedItemId(`session:${activeTerminalId}`);
    }
  }, [activeTerminalId, setSidebarFocusedItemId]);

  // Sidebar resize state
  const SIDEBAR_MIN_WIDTH = 250;
  const SIDEBAR_MAX_WIDTH = 400;
  const [sidebarWidth, setSidebarWidth] = useState(windowState.sidebarWidth);
  const isResizingSidebar = useRef(false);

  const startResizingSidebar = useCallback(() => {
    isResizingSidebar.current = true;
    let lastWidth = sidebarWidth;

    const resize = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
        lastWidth = newWidth;
        // Update local state during drag for smooth UI
        setSidebarWidth(newWidth);
      }
    };

    const stopResizing = () => {
      isResizingSidebar.current = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      // Persist the final width to store when drag ends
      updateSidebarWidth(lastWidth);
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, [sidebarWidth, updateSidebarWidth]);

  // File changes pane resize state
  const FILE_CHANGES_MIN_WIDTH = 300;
  const FILE_CHANGES_MAX_WIDTH = 600;
  const [fileChangesPaneWidth, setFileChangesPaneWidth] = useState(
    windowState.fileChangesPaneWidth
  );
  const isResizingFileChangesPane = useRef(false);

  const startResizingFileChangesPane = useCallback(() => {
    isResizingFileChangesPane.current = true;
    let lastWidth = fileChangesPaneWidth;

    const resize = (e: MouseEvent) => {
      if (isResizingFileChangesPane.current) {
        // Calculate width from right edge of window
        const newWidth = Math.min(
          FILE_CHANGES_MAX_WIDTH,
          Math.max(FILE_CHANGES_MIN_WIDTH, window.innerWidth - e.clientX)
        );
        lastWidth = newWidth;
        // Update local state during drag for smooth UI
        setFileChangesPaneWidth(newWidth);
      }
    };

    const stopResizing = () => {
      isResizingFileChangesPane.current = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      // Persist the final width to store when drag ends
      updateFileChangesPaneWidth(lastWidth);
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, [fileChangesPaneWidth, setFileChangesPaneWidth, updateFileChangesPaneWidth]);

  // User terminal panel resize state (vertical split between source control and user terminals)
  const USER_TERMINAL_MIN_RATIO = 0.3;
  const USER_TERMINAL_MAX_RATIO = 0.7;
  const [userTerminalPanelRatio, setUserTerminalPanelRatio] = useState(
    windowState.userTerminalPanelRatio
  );
  const isResizingUserTerminalPanel = useRef(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const startResizingUserTerminalPanel = useCallback(() => {
    isResizingUserTerminalPanel.current = true;
    let lastRatio = userTerminalPanelRatio;

    const resize = (e: MouseEvent) => {
      if (isResizingUserTerminalPanel.current && rightPanelRef.current) {
        const panelRect = rightPanelRef.current.getBoundingClientRect();
        // Calculate ratio based on mouse Y position within the panel
        // User terminal is at the bottom, so ratio = (panel bottom - mouse Y) / panel height
        const ratio = (panelRect.bottom - e.clientY) / panelRect.height;
        const clampedRatio = Math.min(
          USER_TERMINAL_MAX_RATIO,
          Math.max(USER_TERMINAL_MIN_RATIO, ratio)
        );
        lastRatio = clampedRatio;
        // Update local state during drag for smooth UI
        setUserTerminalPanelRatio(clampedRatio);
      }
    };

    const stopResizing = () => {
      isResizingUserTerminalPanel.current = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      // Persist the final ratio to store when drag ends
      updateUserTerminalPanelRatio(lastRatio);
    };

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, [userTerminalPanelRatio, updateUserTerminalPanelRatio]);

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
    // Don't sync user terminal panel ratio while user is resizing
    if (
      !isResizingUserTerminalPanel.current &&
      userTerminalPanelRatio !== windowState.userTerminalPanelRatio
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserTerminalPanelRatio(windowState.userTerminalPanelRatio);
    }
  }, [
    windowState.sidebarWidth,
    windowState.fileChangesPaneWidth,
    windowState.userTerminalPanelRatio,
    sidebarWidth,
    fileChangesPaneWidth,
    userTerminalPanelRatio,
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
      // Set focus to main terminal area so it receives keyboard input
      setFocusArea('mainTerminal');
    });

    return unsubscribe;
  }, [setActiveTerminal, setActiveTab, setFocusArea]);

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
    return allSessions.flatMap(({ session }) => {
      const tabs = getTabsForWorktree(session.id);
      return tabs.map((tab) => ({
        terminalId: getTerminalIdForTab(session.id, tab.id),
        sessionId: session.id,
        cwd: session.path,
        tabId: tab.id,
        tabName: tab.name,
        tabCommand: tab.command,
      }));
    });
    // Note: worktreeTabs is needed to trigger recomputation when tabs change,
    // even though getTabsForWorktree reads it internally via get()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessions, getTabsForWorktree, getTerminalIdForTab, worktreeTabs]);

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

  // Get tabs for the active worktree
  const tabsForActiveWorktree = useMemo(() => {
    if (!activeTerminalId) return [];
    return getTabsForWorktree(activeTerminalId);
  }, [activeTerminalId, getTabsForWorktree, worktreeTabs]);

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
    },
    [setActiveTab]
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

  // Review store hooks
  const { openWorkingTreeReview, setSelectedFile, markFileUnviewed, isFileViewed } =
    useReviewStore();

  // Threshold for auto-loading hunks (files with more changes require manual expand)
  const AUTO_LOAD_THRESHOLD = 500;

  // Helper to load optimized diff data with lazy loading for large files
  const loadOptimizedDiffData = useCallback(
    async (
      repoPath: string,
      clickedFilePath?: string
    ): Promise<{ files: DiffFile[]; headCommit: string } | null> => {
      // Fetch lightweight stats first (fast)
      const statsResult = await window.terminal.getWorkingTreeStats(repoPath);
      if (!statsResult || statsResult.files.length === 0) return null;

      // Determine which files need hunks loaded (small files auto-load)
      const smallFiles = statsResult.files.filter(
        (f) => f.additions + f.deletions < AUTO_LOAD_THRESHOLD
      );

      // Always load the clicked file's hunks (even if large)
      const filesToLoad = clickedFilePath
        ? [...new Set([...smallFiles.map((f) => f.path), clickedFilePath])]
        : smallFiles.map((f) => f.path);

      // Load hunks for small files + clicked file in parallel
      const hunksMap = new Map<string, DiffFile['hunks']>();
      await Promise.all(
        filesToLoad.map(async (filePath) => {
          try {
            const diffFile = await window.terminal.getSingleWorkingTreeFileDiff(repoPath, filePath);
            if (diffFile) {
              hunksMap.set(filePath, diffFile.hunks);
            }
          } catch {
            // Ignore errors for individual files
          }
        })
      );

      // Build the final files array with hunks where available
      const files: DiffFile[] = statsResult.files.map((stat: DiffFileStat) => {
        const hunks = hunksMap.get(stat.path) || [];
        return {
          ...stat,
          hunks,
          // These properties help FileDiff know if lazy loading is needed
          hunksLoaded: hunksMap.has(stat.path),
          isLoadingHunks: false,
        } as DiffFile;
      });

      return { files, headCommit: statsResult.headCommit };
    },
    []
  );

  // Handler for viewing diff from source control pane (opens diff in separate window)
  // Diffs are fetched on-demand when user clicks, not continuously polled
  const handleViewDiff = useCallback(
    async (fileStatus: FileStatus) => {
      if (!activeSession) return;

      // Fetch optimized diff data (stats + hunks for small files + clicked file)
      const diffResult = await loadOptimizedDiffData(activeSession.path, fileStatus.path);
      if (!diffResult || diffResult.files.length === 0) return;

      // Find the corresponding DiffFile by path
      const diffFile = diffResult.files.find((f) => f.path === fileStatus.path);
      if (diffFile) {
        // Must await to ensure openWorkingTreeReview completes before setting the selected file
        await openWorkingTreeReview(
          activeSession.path,
          diffResult.files,
          diffResult.headCommit ?? 'HEAD'
        );
        // If the file was previously marked as viewed, unmark it so it renders in the diff viewer
        if (isFileViewed(diffFile.path)) {
          await markFileUnviewed(diffFile.path);
        }
        setSelectedFile(diffFile.path);

        // Get the updated store state after the above operations
        const store = useReviewStore.getState();
        if (store.currentReview && store.reviewData) {
          // Open the diff in a separate window
          const result = await window.diffWindow.open({
            currentReview: store.currentReview,
            reviewData: store.reviewData,
            projectPath: activeSession.path,
            selectedFile: diffFile.path,
          });
          if (!result.success) {
            toast.error(`Failed to open diff viewer: ${result.error}`);
          }
        }
      }
    },
    [
      activeSession,
      loadOptimizedDiffData,
      openWorkingTreeReview,
      setSelectedFile,
      isFileViewed,
      markFileUnviewed,
    ]
  );

  // Handler for starting review (opens diff viewer in separate window with all changed files)
  // Diffs are fetched on-demand when user clicks, not continuously polled
  const handleStartReview = useCallback(async () => {
    if (!activeSession) return;

    // Fetch optimized diff data (stats + hunks for small files only)
    const diffResult = await loadOptimizedDiffData(activeSession.path);
    if (!diffResult || diffResult.files.length === 0) return;

    await openWorkingTreeReview(
      activeSession.path,
      diffResult.files,
      diffResult.headCommit ?? 'HEAD'
    );

    // Get the updated store state after openWorkingTreeReview
    const store = useReviewStore.getState();
    if (store.currentReview && store.reviewData) {
      // Open the diff in a separate window
      const result = await window.diffWindow.open({
        currentReview: store.currentReview,
        reviewData: store.reviewData,
        projectPath: activeSession.path,
        selectedFile: store.selectedFile,
      });
      if (!result.success) {
        toast.error(`Failed to open diff viewer: ${result.error}`);
      }
    }
  }, [activeSession, loadOptimizedDiffData, openWorkingTreeReview]);

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
  }, []);

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
        />

        <main
          className="flex-1 overflow-hidden relative bg-background flex"
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
              <div className="flex-1 flex flex-col min-w-0">
                {/* WorktreeBar Header - only spans terminal width */}
                <WorktreeBar
                  sessionId={activeTerminalId}
                  sessionPath={activeSession?.path}
                  branchName={activeSession?.branchName}
                  notesOpen={notesOpen}
                  onToggleNotes={() => setNotesOpen((prev) => !prev)}
                  onError={(message) => toast.error(message)}
                />

                {/* TabBar - show when a worktree is selected */}
                {activeTerminalId && (
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
                  />
                )}

                {/* Terminal area */}
                <div className="flex-1 relative min-h-0 p-2 bg-muted rounded-xl mx-3 mb-3 mt-2">
                  {/* Notes panel - overlay on top of terminal */}
                  {notesOpen && activeSessionInfo && (
                    <NotesPanel
                      repositoryId={activeSessionInfo.repository.id}
                      worktreeSessionId={activeSessionInfo.session.id}
                      repositoryName={activeSessionInfo.repository.name}
                      worktreeLabel={activeSessionInfo.session.label}
                    />
                  )}

                  {/* Render terminals for each tab across all worktrees */}
                  {allTerminalConfigs.map((config) => {
                    const isActiveWorktree = config.sessionId === activeTerminalId;
                    const isActiveTab = isActiveWorktree && config.tabId === activeTabId;

                    return (
                      <TerminalView
                        key={config.terminalId}
                        sessionId={config.sessionId}
                        terminalId={config.terminalId}
                        cwd={config.cwd}
                        isVisible={isActiveTab}
                        initialCommand={config.tabCommand}
                        terminalType="main"
                      />
                    );
                  })}

                  {/* Show empty state when worktree is selected but has no tabs */}
                  {activeTerminalId && tabsForActiveWorktree.length === 0 && (
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

              {/* Right Panel - Source Control + User Terminals
                  Always rendered so user terminal TerminalViews remain mounted across repo switches.
                  Hidden via display:none when no session is active. */}
              <div
                ref={rightPanelRef}
                className="h-full flex-shrink-0 relative bg-card"
                style={{
                  width: fileChangesPaneWidth,
                  display: activeSession && activeSessionInfo ? undefined : 'none',
                }}
                data-testid="right-panel"
              >
                {/* Horizontal resize handle (for panel width) */}
                <div
                  className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 z-10"
                  onMouseDown={startResizingFileChangesPane}
                />

                {/* Vertical resize handle (for panel split) */}
                <div
                  className="absolute left-0 w-full cursor-ns-resize z-10 group flex items-center py-1 -translate-y-1/2"
                  style={{ top: `${(1 - userTerminalPanelRatio) * 100}%` }}
                  onMouseDown={startResizingUserTerminalPanel}
                >
                  <div className="w-full h-px bg-border group-hover:bg-primary/30 transition-colors" />
                </div>

                {/* Top Panel: Source Control */}
                {activeSession && (
                  <div
                    className="absolute top-0 left-0 right-0 overflow-hidden"
                    style={{ height: `${(1 - userTerminalPanelRatio) * 100}%` }}
                  >
                    <SourceControlPane
                      repoPath={activeSession.path}
                      onViewDiff={handleViewDiff}
                      onOpenInEditor={handleOpenInEditor}
                      onStartReview={handleStartReview}
                    />
                  </div>
                )}

                {/* Bottom Panel: User Terminals - Tab bar, controls, and stable terminal container */}
                <div
                  className="absolute bottom-0 left-0 right-0 overflow-hidden flex flex-col"
                  style={{ height: `${userTerminalPanelRatio * 100}%` }}
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
                          config.sessionId === activeTerminalId && config.tabId === activeUserTabId
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
                onBack={() => setActiveScreen({ type: 'main' })}
                repositoryId={activeScreen.repositoryId}
              />
            </div>
          )}
          {/* HomeScreen: Show when explicitly requested OR when on main screen with no active terminal
              IMPORTANT: Must check activeScreen.type === 'main' to prevent blocking other overlays
              (Settings, AddWorktree, etc.) when activeTerminalId is null */}
          {(activeScreen.type === 'home' ||
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
