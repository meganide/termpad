import type { ReactNode } from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PRESET_ICONS } from '../IconPicker';
import {
  TERMINAL_STATUS_LABELS,
  getStatusDotColor,
  isStatusPulsing,
} from '../../utils/terminalStatusStyles';
import type { TerminalStatus } from '../../../shared/types';
import { AgentTileActions } from './AgentTileActions';

// Smaller font in overview mode fits more agent output into each tile
export const OVERVIEW_TERMINAL_FONT_SIZE = 11;

interface AgentTileProps {
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
}: AgentTileProps) {
  const TabIcon = PRESET_ICONS[tabIcon || ''] || Terminal;

  return (
    <div
      data-testid={`agent-tile-${terminalId}`}
      className={cn(
        'group flex h-full w-full min-h-0 min-w-0 flex-col',
        isOverview &&
          'overview-agent-tile relative overflow-hidden rounded-xl bg-obsidian-800/60 shadow-md transition-[box-shadow,background-color] duration-150 motion-reduce:transition-none hover:ring-2 hover:ring-primary/60 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary',
        isOverview && (isActive ? 'ring-1 ring-lime-500/40' : 'hover:bg-obsidian-800/80')
      )}
      style={{ display: isVisible ? 'flex' : 'none' }}
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
        </div>
      )}

      <div className="relative min-h-0 flex-1" inert={isOverview}>
        {children}
      </div>

      {isOverview && (
        <AgentTileActions
          terminalId={terminalId}
          tabName={tabName}
          status={status}
          onSelect={onSelect}
          onClose={onClose}
          label={`Open ${tabName} in ${repositoryName} / ${worktreeLabel} (${TERMINAL_STATUS_LABELS[status]})`}
        />
      )}
    </div>
  );
}
