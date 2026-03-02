import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Terminal as TerminalIcon,
  Copy,
  Check,
  Pencil,
  X,
  GripVertical,
} from 'lucide-react';
import { SplitButton, type SplitButtonItem } from '../../components/ui/split-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/context-menu';
import { useAppStore } from '../../stores/appStore';
import { cn } from '../../lib/utils';
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
import type { TerminalTab } from '../../../shared/types';

interface SortableUserTabProps {
  tab: TerminalTab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onStartEditing: (tabId: string, name: string) => void;
  onFinishEditing: (tabId: string) => void;
  onCancelEditing: () => void;
  onEditValueChange: (value: string) => void;
}

function SortableUserTab({
  tab,
  isActive,
  isEditing,
  editValue,
  inputRef,
  onTabClick,
  onTabClose,
  onStartEditing,
  onFinishEditing,
  onCancelEditing,
  onEditValueChange,
}: SortableUserTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

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
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer select-none min-w-0 max-w-[180px] group shrink-0 transition-all duration-150',
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
          <TerminalIcon className="h-4 w-4 shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onBlur={() => onFinishEditing(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onFinishEditing(tab.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEditing();
                }
              }}
              className="bg-transparent border-none outline-none text-sm w-full min-w-[40px] max-w-[100px] px-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate" onDoubleClick={() => onStartEditing(tab.id, tab.name)}>
              {tab.name}
            </span>
          )}
          <button
            className={cn(
              'ml-auto p-1 rounded hover:bg-accent shrink-0',
              'opacity-0 group-hover:opacity-100',
              isActive && 'opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            aria-label={`Close ${tab.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onStartEditing(tab.id, tab.name)}>
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

interface UserTerminalSectionProps {
  worktreeSessionId: string;
  repositoryId: string;
  onOpenRepositorySettings?: () => void;
  onCopyOutput?: () => Promise<void>;
}

export function UserTerminalSection({
  worktreeSessionId,
  repositoryId,
  onOpenRepositorySettings,
  onCopyOutput,
}: UserTerminalSectionProps) {
  const {
    activeUserTabId,
    userTerminalTabs,
    createUserTab,
    closeUserTab,
    renameUserTab,
    setActiveUserTab,
    getUserTabsForWorktree,
    getUserTerminalIdForTab,
    unregisterTerminal,
    repositories,
    updateRepositoryScriptsConfig,
    reorderUserTabs,
    updateUserTabScrollPosition,
    getUserTabScrollPosition,
    findUserTabsWithScript,
    closeUserTabById,
  } = useAppStore();

  // Get tabs for this worktree
  // Note: userTerminalTabs is intentionally in deps to trigger re-render when tabs change
  const tabs = useMemo(
    () => getUserTabsForWorktree(worktreeSessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getUserTabsForWorktree, worktreeSessionId, userTerminalTabs]
  );

  // Get the repository for scriptsConfig
  const repository = useMemo(
    () => repositories.find((r) => r.id === repositoryId),
    [repositories, repositoryId]
  );

  // Get run scripts from the repository config
  const runScripts = useMemo(
    () => repository?.scriptsConfig?.runScripts ?? [],
    [repository?.scriptsConfig?.runScripts]
  );
  const selectedRunScriptId = repository?.scriptsConfig?.lastUsedRunScriptId ?? null;

  // Build SplitButton items from run scripts
  const runScriptItems: SplitButtonItem[] = useMemo(() => {
    return runScripts.map((script) => ({
      id: script.id,
      label: script.name,
      selected: script.id === selectedRunScriptId,
    }));
  }, [runScripts, selectedRunScriptId]);

  // Handle tab click
  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveUserTab(tabId);
    },
    [setActiveUserTab]
  );

  // Handle tab close
  const handleTabClose = useCallback(
    async (tabId: string) => {
      const terminalId = getUserTerminalIdForTab(worktreeSessionId, tabId);
      try {
        await window.terminal.kill(terminalId);
      } catch {
        // Terminal might not be running, ignore
      }
      unregisterTerminal(terminalId);
      closeUserTab(tabId);
    },
    [getUserTerminalIdForTab, worktreeSessionId, closeUserTab, unregisterTerminal]
  );

  // Handle new tab (+ button) - instantly creates terminal
  const handleNewTab = useCallback(async () => {
    const shellName = await window.terminal.getResolvedShellName();
    createUserTab(worktreeSessionId, shellName);
    // Auto-scroll tabs to end after creation
    setTimeout(() => {
      if (tabsScrollRef.current) {
        tabsScrollRef.current.scrollLeft = tabsScrollRef.current.scrollWidth;
        // Also save the new scroll position
        updateUserTabScrollPosition(worktreeSessionId, tabsScrollRef.current.scrollLeft);
      }
    }, 0);
  }, [createUserTab, worktreeSessionId, updateUserTabScrollPosition]);

  // Handle Run button click
  const handleRunClick = useCallback(async () => {
    // If no scripts configured, open repo settings
    if (runScripts.length === 0) {
      onOpenRepositorySettings?.();
      return;
    }

    // Find the selected script (or first if none selected)
    const scriptToRun = runScripts.find((s) => s.id === selectedRunScriptId) || runScripts[0];

    if (!scriptToRun) {
      return;
    }

    // If exclusive mode is enabled, find and kill all tabs running this script across all worktrees
    const exclusiveMode = repository?.scriptsConfig?.exclusiveMode ?? false;
    if (exclusiveMode) {
      // Find all tabs with matching scriptId across all worktrees in this repo
      const matchingTabs = findUserTabsWithScript(repositoryId, scriptToRun.id);
      for (const { worktreeSessionId: tabWorktreeId, tab } of matchingTabs) {
        const terminalId = getUserTerminalIdForTab(tabWorktreeId, tab.id);
        try {
          await window.terminal.kill(terminalId);
        } catch {
          // Terminal might not be running, ignore
        }
        unregisterTerminal(terminalId);
        closeUserTabById(tabWorktreeId, tab.id);
      }
    }

    // Create a new user terminal tab with the script name and scriptId
    const newTab = createUserTab(worktreeSessionId, scriptToRun.name, scriptToRun.id);
    const terminalId = getUserTerminalIdForTab(worktreeSessionId, newTab.id);

    // Wait for the terminal to be ready before sending the command
    // TerminalView spawns on mount, waitForReady ensures shell has started
    await window.terminal.waitForReady(terminalId);
    // Write the script command followed by Enter
    window.terminal.write(terminalId, scriptToRun.command + '\n');
  }, [
    runScripts,
    selectedRunScriptId,
    onOpenRepositorySettings,
    repository?.scriptsConfig?.exclusiveMode,
    repositoryId,
    findUserTabsWithScript,
    getUserTerminalIdForTab,
    unregisterTerminal,
    closeUserTabById,
    createUserTab,
    worktreeSessionId,
  ]);

  // Handle script selection from dropdown
  const handleScriptSelect = useCallback(
    (scriptId: string) => {
      // Update lastUsedRunScriptId in scriptsConfig
      updateRepositoryScriptsConfig(repositoryId, { lastUsedRunScriptId: scriptId });
    },
    [updateRepositoryScriptsConfig, repositoryId]
  );

  // Ref for scrolling tabs container
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isRestoringScrollRef = useRef(false);
  const prevWorktreeSessionIdRef = useRef(worktreeSessionId);
  const prevActiveTabIdRef = useRef(activeUserTabId);

  // Scroll active tab into view when it changes or when worktree changes (centered)
  useEffect(() => {
    if (!activeUserTabId) {
      prevActiveTabIdRef.current = activeUserTabId;
      return;
    }

    const worktreeChanged = prevWorktreeSessionIdRef.current !== worktreeSessionId;
    const tabChanged = activeUserTabId !== prevActiveTabIdRef.current;

    // Skip if neither worktree nor tab changed
    if (!worktreeChanged && !tabChanged) {
      return;
    }

    prevActiveTabIdRef.current = activeUserTabId;

    // Find the tab element and scroll it into view
    // Use setTimeout to ensure DOM has updated (especially after worktree switch)
    setTimeout(() => {
      if (tabsScrollRef.current) {
        const tabElement = tabsScrollRef.current.querySelector(
          `[data-tab-id="${activeUserTabId}"]`
        ) as HTMLElement;
        if (tabElement) {
          tabElement.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        }
      }
    }, 0);
  }, [activeUserTabId, worktreeSessionId]);

  // Get scroll position for the current worktree's tab bar
  const tabScrollPosition = useMemo(() => {
    return getUserTabScrollPosition(worktreeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUserTabScrollPosition, worktreeSessionId, userTerminalTabs]);

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
          tabsScrollRef.current.scrollLeft = tabScrollPosition;
        }
        // Reset the flag after a short delay to allow any scroll events to settle
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 100);
      });
    }
  }, [worktreeSessionId, tabScrollPosition]);

  // Handle scroll events to persist scroll position
  const handleScroll = useCallback(() => {
    if (tabsScrollRef.current && !isRestoringScrollRef.current) {
      updateUserTabScrollPosition(worktreeSessionId, tabsScrollRef.current.scrollLeft);
    }
  }, [updateUserTabScrollPosition, worktreeSessionId]);

  // Copy feedback state
  const [showCopied, setShowCopied] = useState(false);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  // Drag-and-drop sensors
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

  // Handle drag end for tab reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
        const newIndex = tabs.findIndex((tab) => tab.id === over.id);

        const reorderedTabs = arrayMove(tabs, oldIndex, newIndex).map((tab, index) => ({
          ...tab,
          order: index,
        }));

        reorderUserTabs(worktreeSessionId, reorderedTabs);
      }
    },
    [tabs, reorderUserTabs, worktreeSessionId]
  );

  const handleStartEditing = useCallback((tabId: string, name: string) => {
    setEditingTabId(tabId);
    setEditValue(name);
  }, []);

  const handleFinishEditing = useCallback(
    (tabId: string) => {
      const trimmedValue = editValue.trim();
      if (trimmedValue) {
        renameUserTab(tabId, trimmedValue);
      }
      setEditingTabId(null);
    },
    [editValue, renameUserTab]
  );

  const handleCancelEditing = useCallback(() => {
    setEditingTabId(null);
  }, []);

  // Handle copy output from active terminal
  const handleCopyOutput = useCallback(async () => {
    if (!onCopyOutput) return;
    await onCopyOutput();
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }, [onCopyOutput]);

  return (
    <div className="flex flex-col shrink-0" data-testid="user-terminal-section">
      {/* Header with title and action buttons */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <h2 className="text-sm font-semibold">Terminals</h2>
        <div className="flex items-center gap-1">
          {/* Copy output button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'flex items-center justify-center p-1.5 rounded text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                  tabs.length === 0 && 'opacity-50 pointer-events-none',
                  showCopied && 'text-green-500'
                )}
                onClick={handleCopyOutput}
                aria-label="Copy terminal output"
                disabled={tabs.length === 0}
                data-testid="user-terminal-copy-button"
              >
                {showCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              {showCopied ? 'Copied!' : 'Copy terminal output'}
            </TooltipContent>
          </Tooltip>

          {/* Run SplitButton */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <SplitButton
                  label="Run"
                  icon={<Play className="h-3.5 w-3.5" />}
                  onClick={handleRunClick}
                  items={runScriptItems}
                  onItemSelect={handleScriptSelect}
                  disabled={false}
                  dropdownDisabled={runScripts.length === 0}
                  data-testid="user-terminal-run-button"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              Run a preconfigured script
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Tab bar - full width with + button fixed right */}
      <div className="flex items-center h-[46px] shrink-0 mx-1 mt-1 rounded-lg bg-muted/30 dark:bg-muted/20">
        {/* Scrollable tabs container */}
        <div
          ref={tabsScrollRef}
          className="flex-1 min-w-0 overflow-x-auto flex items-center gap-1 px-2 py-2 user-terminal-tabs-scrollbar"
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
              {tabs.map((tab) => (
                <SortableUserTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeUserTabId}
                  isEditing={editingTabId === tab.id}
                  editValue={editValue}
                  inputRef={inputRef}
                  onTabClick={handleTabClick}
                  onTabClose={handleTabClose}
                  onStartEditing={handleStartEditing}
                  onFinishEditing={handleFinishEditing}
                  onCancelEditing={handleCancelEditing}
                  onEditValueChange={setEditValue}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Inline "new terminal" button for discoverability */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center p-1.5 rounded cursor-pointer select-none shrink-0 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                onClick={handleNewTab}
                aria-label="New terminal"
                data-testid="user-terminal-add-button"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              New terminal
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
