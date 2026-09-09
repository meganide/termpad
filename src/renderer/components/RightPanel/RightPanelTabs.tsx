import { FileText, ListTodo, NotebookPen, GitCompareArrows, Terminal, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export interface RightPanelCounts {
  changes?: number;
  review?: number;
  reviewBase?: string;
  terminals?: number;
  browser?: number;
  scope?: 'global' | 'worktree';
  todos?: { completed: number; total: number };
  notes?: boolean;
}

export type RightPanelTab = 'changes' | 'review' | 'browser' | 'terminals' | 'notes' | 'todos';

const TABS: { id: RightPanelTab; label: string; Icon: LucideIcon }[] = [
  { id: 'changes', label: 'Changes', Icon: FileText },
  { id: 'review', label: 'Review', Icon: GitCompareArrows },
  { id: 'browser', label: 'Browser', Icon: Globe },
  { id: 'terminals', label: 'Terminals', Icon: Terminal },
  { id: 'notes', label: 'Notes', Icon: NotebookPen },
  { id: 'todos', label: 'Todos', Icon: ListTodo },
];

interface RightPanelTabsProps {
  active: RightPanelTab;
  onChange: (tab: RightPanelTab) => void;
  counts?: RightPanelCounts;
}

export function RightPanelTabs({ active, onChange, counts = {} }: RightPanelTabsProps) {
  const suffixes: Partial<Record<RightPanelTab, string>> = {
    changes: counts.changes === undefined ? '' : ` (${counts.changes})`,
    review: counts.review === undefined ? '' : ` (${counts.review})`,
    terminals: counts.terminals === undefined ? '' : ` (${counts.terminals})`,
    browser: counts.browser === undefined ? '' : ` (${counts.browser})`,
    todos: counts.todos ? ` (${counts.todos.completed}/${counts.todos.total})` : '',
  };
  const details: Record<RightPanelTab, string> = {
    changes: 'Unique changed files, including staged, unstaged, and untracked files',
    review: `Files in review against ${counts.reviewBase ?? 'HEAD'}`,
    terminals: 'Open terminals in this worktree',
    browser: 'Browser tabs shared across worktrees in this repository',
    todos: counts.todos
      ? `${counts.scope === 'global' ? 'All' : 'Worktree'}: ${counts.todos.completed}/${counts.todos.total} completed`
      : `${counts.scope === 'global' ? 'All' : 'Worktree'} todos`,
    notes: `${counts.scope === 'global' ? 'All' : 'Worktree'}: ${counts.notes ? 'has notes' : 'no notes'}`,
  };
  const hasNotes = counts.notes;
  return (
    <TooltipProvider>
      <div
        role="tablist"
        aria-label="Workspace tools"
        className="flex min-w-0 flex-wrap items-center gap-1"
        data-testid="right-panel-tabs"
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={id === 'notes' && hasNotes ? `Notes — ${details.notes}` : undefined}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(event) => {
                    const index = TABS.findIndex((tab) => tab.id === id);
                    const next =
                      event.key === 'ArrowRight'
                        ? (index + 1) % TABS.length
                        : event.key === 'ArrowLeft'
                          ? (index + TABS.length - 1) % TABS.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? TABS.length - 1
                              : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    onChange(TABS[next].id);
                    (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
                  }}
                  onClick={() => onChange(id)}
                  data-testid={`right-panel-tab-${id}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-obsidian-800/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="sr-only" />
                  <span>
                    {label}
                    {suffixes[id]}
                  </span>
                  {id === 'notes' && hasNotes && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-primary"
                      data-testid="notes-presence-indicator"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{details[id]}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
