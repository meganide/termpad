import { useRef, type ReactNode, type Ref } from 'react';
import { Terminal, Maximize2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { PRESET_ICONS } from '../IconPicker';
import {
  TERMINAL_STATUS_LABELS,
  getStatusDotColor,
  isStatusPulsing,
} from '../../utils/terminalStatusStyles';
import type { TerminalStatus } from '../../../shared/types';
import { AgentTileActions, type AgentTileActionsHandle } from './AgentTileActions';

interface AgentTileProps {
  actionsRef?: Ref<AgentTileActionsHandle>;
  terminalId: string;
  isOverview: boolean;
  isVisible: boolean;
  isActive: boolean;
  repositoryName: string;
  worktreeLabel: string;
  tabName: string;
  tabIcon?: string;
  status: TerminalStatus;
  onSelect: () => void;
  onClose: () => void;
  children: ReactNode;
  onFocusPane?: () => void;
  onMenuOpen?: () => void;
  selectTooltip?: string;
  onCopy?: () => void;
  onPaste?: () => void;
  onHide?: () => void;
}

/**
 * Positions a single agent terminal, either as the full-size main terminal or as
 * a card in the overview grid.
 *
 * The wrapper element and the child slot stay in the same place in the tree in
 * both modes on purpose: moving a TerminalView to a different parent would
 * unmount it and destroy the agent's scrollback.
 */
export function AgentTile({
  actionsRef,
  terminalId,
  isOverview,
  isVisible,
  isActive,
  repositoryName,
  worktreeLabel,
  tabName,
  tabIcon,
  status,
  onSelect,
  onClose,
  children,
  onFocusPane,
  onMenuOpen,
  selectTooltip = 'Open in worktree',
  onCopy,
  onPaste,
  onHide,
}: AgentTileProps) {
  const TabIcon = PRESET_ICONS[tabIcon || ''] || Terminal;
  const tileRef = useRef<HTMLDivElement>(null);

  return (
    <AgentTileActions
      actionsRef={actionsRef}
      enabled={isOverview}
      tabName={tabName}
      status={status}
      onSelect={onSelect}
      onClose={onClose}
      onMenuOpen={onMenuOpen}
      onCopy={onCopy}
      onPaste={onPaste}
      onHide={onHide}
      selectLabel={selectTooltip}
      onRestoreFocus={() => {
        const tile = tileRef.current;
        if (tile) (tile.querySelector('textarea') ?? tile).focus({ preventScroll: true });
      }}
    >
      <div
        ref={tileRef}
        data-overview-terminal-id={isOverview ? terminalId : undefined}
        tabIndex={isOverview ? -1 : undefined}
        role={isOverview ? 'group' : undefined}
        aria-label={
          isOverview
            ? `${tabName} in ${repositoryName} / ${worktreeLabel} (${TERMINAL_STATUS_LABELS[status]})`
            : undefined
        }
        data-testid={`agent-tile-${terminalId}`}
        className={cn(
          'group flex h-full w-full min-h-0 min-w-0 flex-col',
          isOverview &&
            'overview-agent-tile relative overflow-hidden rounded-xl bg-obsidian-800/60 shadow-md transition-[box-shadow,background-color] duration-150 motion-reduce:transition-none hover:ring-2 hover:ring-primary/60 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary',
          isOverview && (isActive ? 'ring-1 ring-lime-500/40' : 'hover:bg-obsidian-800/80')
        )}
        style={{
          display: isVisible ? 'flex' : 'none',
        }}
        onPointerDownCapture={onFocusPane}
        onFocusCapture={onFocusPane}
      >
        {isOverview && (
          <div className="flex shrink-0 items-center gap-2 bg-obsidian-900/60 px-4 py-3 transition-colors group-hover:bg-obsidian-800 group-focus-within:bg-obsidian-800">
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                getStatusDotColor(status),
                isStatusPulsing(status) && 'animate-pulse'
              )}
            />
            <span className="truncate text-xs font-medium">{repositoryName}</span>
            <span className="shrink-0 text-xs text-muted-foreground/40">/</span>
            <span className="truncate text-xs text-muted-foreground">{worktreeLabel}</span>
            <span className="ml-auto flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <TabIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{tabName}</span>
            </span>
            {isOverview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={`Open ${tabName} in ${worktreeLabel}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect();
                    }}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{selectTooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </AgentTileActions>
  );
}
