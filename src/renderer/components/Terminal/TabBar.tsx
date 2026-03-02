import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, X, Plus, Loader, GripVertical, Pencil } from 'lucide-react';
import { PRESET_ICONS } from '../IconPicker';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import type {
  TerminalTab,
  TerminalState,
  TerminalStatus,
  TerminalPreset,
} from '../../../shared/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TabBarProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  terminalStatuses: Map<string, TerminalState>;
  getTerminalIdForTab: (tabId: string) => string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabRename: (tabId: string, name: string) => void;
  onTabReorder: (tabs: TerminalTab[]) => void;
  onNewTab: (name?: string, command?: string, icon?: string) => void;
  /** Current scroll position for the tab bar (for persistence across worktree switches) */
  scrollPosition?: number;
  /** Callback when scroll position changes */
  onScrollPositionChange?: (position: number) => void;
  /** Worktree session ID - used to detect worktree switches for scroll restoration */
  worktreeSessionId?: string;
  /** Terminal presets to show in the dropdown menu */
  terminalPresets?: TerminalPreset[];
}

const statusTooltips: Record<TerminalStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  waiting: 'Waiting for input',
  idle: 'Idle',
  stopped: 'Stopped',
  error: 'Error',
};

function TabStatusIndicator({ status }: { status: TerminalStatus }) {
  // Starting: spinning loader
  if (status === 'starting') {
    return (
      <div className="h-2.5 w-2.5 flex items-center justify-center">
        <Loader className="h-2.5 w-2.5 text-status-starting animate-spin" />
      </div>
    );
  }

  // Running: pulsing dot
  if (status === 'running') {
    return <div className="h-2.5 w-2.5 rounded-full bg-status-running animate-pulse" />;
  }

  // Waiting: attention dot
  if (status === 'waiting') {
    return <div className="h-2.5 w-2.5 rounded-full bg-status-waiting" />;
  }

  // Idle: muted dot
  if (status === 'idle') {
    return <div className="h-2.5 w-2.5 rounded-full bg-status-idle" />;
  }

  // Error: alert dot
  if (status === 'error') {
    return <div className="h-2.5 w-2.5 rounded-full bg-status-error" />;
  }

  // Stopped or fallback
  return <div className="h-2.5 w-2.5 rounded-full bg-status-stopped" />;
}

interface SortableTabProps {
  tab: TerminalTab;
  isActive: boolean;
  status: TerminalStatus;
  isEditing: boolean;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onStartEditing: () => void;
  onFinishEditing: (newName: string) => void;
  onCancelEditing: () => void;
}

function SortableTab({
  tab,
  isActive,
  status,
  isEditing,
  onTabClick,
  onTabClose,
  onStartEditing,
  onFinishEditing,
  onCancelEditing,
}: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(tab.name);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = useCallback(() => {
    setEditValue(tab.name);
    onStartEditing();
  }, [tab.name, onStartEditing]);

  const handleFinishEditing = useCallback(
    (valueToSave?: string) => {
      // Use provided value or fall back to current input value
      const value = valueToSave ?? inputRef.current?.value ?? editValue;
      const trimmedValue = value.trim();
      // Empty names revert to previous value
      if (trimmedValue) {
        onFinishEditing(trimmedValue);
      } else {
        onCancelEditing();
      }
    },
    [editValue, onFinishEditing, onCancelEditing]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Read value directly from the input to avoid stale closure
        handleFinishEditing(e.currentTarget.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditValue(tab.name);
        onCancelEditing();
      }
    },
    [handleFinishEditing, tab.name, onCancelEditing]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Read value directly from the input to avoid stale closure
      handleFinishEditing(e.currentTarget.value);
    },
    [handleFinishEditing]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          data-tab-id={tab.id}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer select-none shrink-0 group transition-all duration-150',
            isActive
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            isDragging && 'opacity-50 z-50'
          )}
          onClick={() => !isEditing && onTabClick(tab.id)}
          role="tab"
          aria-selected={isActive}
          tabIndex={isEditing ? -1 : 0}
          onKeyDown={(e) => {
            if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onTabClick(tab.id);
            }
          }}
        >
          <span
            className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          {(() => {
            const TabIcon = PRESET_ICONS[tab.icon || ''] || Terminal;
            return <TabIcon className="h-4 w-4 shrink-0" />;
          })()}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <TabStatusIndicator status={status} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              {statusTooltips[status]}
            </TooltipContent>
          </Tooltip>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-sm min-w-[60px] px-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="whitespace-nowrap" onDoubleClick={handleStartEditing}>
              {tab.name}
            </span>
          )}
          <button
            className={cn(
              'ml-auto p-0.5 rounded hover:bg-accent shrink-0',
              'opacity-0 group-hover:opacity-100',
              isActive && 'opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            aria-label={`Close ${tab.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleStartEditing}>
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTabClose(tab.id)}>
          <X className="h-4 w-4 mr-2" />
          Close
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Helper to determine if a status represents an active/running process
function isActiveStatus(status: TerminalStatus): boolean {
  return status === 'running' || status === 'waiting' || status === 'starting';
}

export function TabBar({
  tabs,
  activeTabId,
  terminalStatuses,
  getTerminalIdForTab,
  onTabClick,
  onTabClose,
  onTabRename,
  onTabReorder,
  onNewTab,
  scrollPosition = 0,
  onScrollPositionChange,
  worktreeSessionId,
  terminalPresets = [],
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const prevTabsRef = useRef<{ length: number; firstTabId: string | null }>({
    length: tabs.length,
    firstTabId: tabs[0]?.id ?? null,
  });
  const isRestoringScrollRef = useRef(false);
  const prevWorktreeSessionIdRef = useRef(worktreeSessionId);
  const prevActiveTabIdRef = useRef(activeTabId);

  // Scroll active tab into view when it changes or when worktree changes (centered)
  useEffect(() => {
    if (!activeTabId) {
      prevActiveTabIdRef.current = activeTabId;
      return;
    }

    const worktreeChanged = prevWorktreeSessionIdRef.current !== worktreeSessionId;
    const tabChanged = activeTabId !== prevActiveTabIdRef.current;

    // Skip if neither worktree nor tab changed
    if (!worktreeChanged && !tabChanged) {
      return;
    }

    prevActiveTabIdRef.current = activeTabId;

    // Find the tab element and scroll it into view
    // Use setTimeout to ensure DOM has updated (especially after worktree switch)
    setTimeout(() => {
      if (tabsScrollRef.current) {
        const tabElement = tabsScrollRef.current.querySelector(
          `[data-tab-id="${activeTabId}"]`
        ) as HTMLElement;
        if (tabElement) {
          tabElement.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        }
      }
    }, 0);
  }, [activeTabId, worktreeSessionId]);

  // Restore scroll position ONLY when worktree changes (not when scroll position changes within same worktree)
  useEffect(() => {
    const worktreeChanged = prevWorktreeSessionIdRef.current !== worktreeSessionId;
    prevWorktreeSessionIdRef.current = worktreeSessionId;

    // Only restore if we actually switched worktrees
    if (!worktreeChanged) {
      return;
    }

    if (tabsScrollRef.current) {
      isRestoringScrollRef.current = true;
      // Use requestAnimationFrame to ensure DOM has updated with new tabs
      requestAnimationFrame(() => {
        if (tabsScrollRef.current) {
          tabsScrollRef.current.scrollLeft = scrollPosition;
        }
        // Reset the flag after a short delay to allow any scroll events to settle
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 100);
      });
    }
  }, [scrollPosition, worktreeSessionId]);

  // Handle scroll events to persist scroll position
  const handleScroll = useCallback(() => {
    if (tabsScrollRef.current && onScrollPositionChange && !isRestoringScrollRef.current) {
      onScrollPositionChange(tabsScrollRef.current.scrollLeft);
    }
  }, [onScrollPositionChange]);

  // Auto-scroll to end when a new tab is added (but not when switching worktrees)
  useEffect(() => {
    const currentFirstTabId = tabs[0]?.id ?? null;
    const prevFirstTabId = prevTabsRef.current.firstTabId;
    const prevLength = prevTabsRef.current.length;

    // Only auto-scroll if:
    // 1. A new tab was added (length increased)
    // 2. We're in the same worktree (first tab ID is the same)
    const isNewTabAdded = tabs.length > prevLength && currentFirstTabId === prevFirstTabId;

    if (isNewTabAdded && tabsScrollRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (tabsScrollRef.current) {
          tabsScrollRef.current.scrollLeft = tabsScrollRef.current.scrollWidth;
          // Also save the new scroll position
          if (onScrollPositionChange) {
            onScrollPositionChange(tabsScrollRef.current.scrollLeft);
          }
        }
      }, 0);
    }

    prevTabsRef.current = { length: tabs.length, firstTabId: currentFirstTabId };
  }, [tabs, onScrollPositionChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab) => tab.id === over.id);

      const reorderedTabs = arrayMove(tabs, oldIndex, newIndex).map((tab, index) => ({
        ...tab,
        order: index,
      }));

      onTabReorder(reorderedTabs);
    }
  };

  const handleStartEditing = useCallback((tabId: string) => {
    setEditingTabId(tabId);
  }, []);

  const handleFinishEditing = useCallback(
    (tabId: string, newName: string) => {
      onTabRename(tabId, newName);
      setEditingTabId(null);
    },
    [onTabRename]
  );

  const handleCancelEditing = useCallback(() => {
    setEditingTabId(null);
  }, []);

  // Handle close attempt - check if terminal is active and show confirmation if so
  const handleCloseAttempt = useCallback(
    (tabId: string) => {
      const terminalId = getTerminalIdForTab(tabId);
      const terminalState = terminalStatuses.get(terminalId);
      const status: TerminalStatus = terminalState?.status || 'stopped';
      console.log(
        `[TabBar.handleCloseAttempt] tabId=${tabId}, terminalId=${terminalId}, status=${status}`
      );

      if (isActiveStatus(status)) {
        // Show confirmation dialog
        console.log(`[TabBar.handleCloseAttempt] Terminal is active, showing confirmation dialog`);
        setPendingCloseTabId(tabId);
      } else {
        // Close immediately
        console.log(`[TabBar.handleCloseAttempt] Terminal not active, closing immediately`);
        onTabClose(tabId);
      }
    },
    [getTerminalIdForTab, terminalStatuses, onTabClose]
  );

  const handleConfirmClose = useCallback(() => {
    console.log(`[TabBar.handleConfirmClose] pendingCloseTabId=${pendingCloseTabId}`);
    if (pendingCloseTabId) {
      onTabClose(pendingCloseTabId);
      setPendingCloseTabId(null);
    }
  }, [pendingCloseTabId, onTabClose]);

  const handleCancelClose = useCallback(() => {
    setPendingCloseTabId(null);
  }, []);

  // Sort presets by order for display and keyboard handling
  const sortedPresets = [...terminalPresets].sort((a, b) => a.order - b.order);

  // Handle keyboard shortcuts 1-9 when dropdown is open
  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '9') {
        const index = parseInt(key) - 1;
        if (index < sortedPresets.length) {
          e.preventDefault();
          const preset = sortedPresets[index];
          // Empty command means plain shell (Terminal)
          onNewTab(preset.name, preset.command || undefined, preset.icon);
          setDropdownOpen(false);
        }
      }
    },
    [sortedPresets, onNewTab, setDropdownOpen]
  );

  // Get the name of the tab pending close for the dialog
  const pendingCloseTab = pendingCloseTabId
    ? tabs.find((tab) => tab.id === pendingCloseTabId)
    : null;

  return (
    <div className="flex items-center py-1 bg-muted/60 backdrop-blur-sm mx-3 mt-3 rounded-lg">
      {/* Scrollable tabs container */}
      <div
        ref={tabsScrollRef}
        className="flex-1 min-w-0 overflow-x-auto flex items-center gap-1 px-2 py-1 user-terminal-tabs-scrollbar"
        onScroll={handleScroll}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToHorizontalAxis]}
        >
          <SortableContext
            items={tabs.map((tab) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => {
              const terminalId = getTerminalIdForTab(tab.id);
              const terminalState = terminalStatuses.get(terminalId);
              const status: TerminalStatus = terminalState?.status || 'stopped';
              const isActive = tab.id === activeTabId;

              return (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={isActive}
                  status={status}
                  isEditing={editingTabId === tab.id}
                  onTabClick={onTabClick}
                  onTabClose={handleCloseAttempt}
                  onStartEditing={() => handleStartEditing(tab.id)}
                  onFinishEditing={(newName) => handleFinishEditing(tab.id, newName)}
                  onCancelEditing={handleCancelEditing}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Inline "new terminal" button for discoverability */}
        <Tooltip>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center p-1.5 rounded cursor-pointer select-none shrink-0 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  aria-label="New terminal"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              New terminal
            </TooltipContent>
            <DropdownMenuContent align="start" sideOffset={5} onKeyDown={handleDropdownKeyDown}>
              {sortedPresets.map((preset, index) => {
                const Icon = PRESET_ICONS[preset.icon] || Terminal;
                return (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => onNewTab(preset.name, preset.command || undefined, preset.icon)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{preset.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{index + 1}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </div>

      {/* Close confirmation dialog for running terminals */}
      <AlertDialog open={pendingCloseTabId !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/10 p-2">
                <Terminal className="h-5 w-5 text-amber-500" />
              </div>
              <AlertDialogTitle>Close Running Terminal?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left pt-2">
              Process &quot;{pendingCloseTab?.name}&quot; is running. Close anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
