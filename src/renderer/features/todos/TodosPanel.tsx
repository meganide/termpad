import { Columns3, List, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useMemo, useState, type ReactNode } from 'react';
import { PanelSection } from '../../components/RightPanel/PanelSection';
import { useAppStore } from '../../stores/appStore';
import type { TodoScope } from '../../stores/appStore';
import { TodoList } from './TodoList';
import type { TodoItem } from '../../../shared/types';
import { isGlobalWorkspace } from '../../utils/workspaceScope';
import { getRepositoryTodos } from './repositoryTodos';

function TodoCount({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) return null;
  const completed = todos.filter((todo) => todo.completed).length;
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground">
      {completed}/{todos.length}
    </span>
  );
}

interface TodosPanelProps {
  scopeMode?: 'repository' | 'worktree';
  defaultView?: 'list' | 'kanban';
  onOpenPlanning?: () => void;
  onDispatch?: (todo: TodoItem, targetId: string) => void;
  onOpenWorktree?: (worktreeSessionId: string) => void;
  repositoryId: string;
  worktreeSessionId: string;
  repositoryName: string;
  worktreeLabel: string;
  titleSlot: ReactNode;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onSendToTerminal?: (todo: TodoItem) => void;
  onCreateWorktree?: (todo: TodoItem) => void;
}

export function TodosPanel({
  scopeMode,
  defaultView = 'list',
  onOpenPlanning,
  onDispatch,
  onOpenWorktree,
  repositoryId,
  worktreeSessionId,
  repositoryName,
  worktreeLabel,
  titleSlot,
  expanded = false,
  onToggleExpanded,
  onSendToTerminal,
  onCreateWorktree,
}: TodosPanelProps) {
  const [view, setView] = useState<'list' | 'kanban'>(
    defaultView === 'kanban'
      ? 'kanban'
      : localStorage.getItem('termpad:todos-view') === 'kanban'
        ? 'kanban'
        : 'list'
  );
  const repositories = useAppStore((s) => s.repositories);

  const repository = repositories.find((r) => r.id === repositoryId);
  const worktree = repository?.worktreeSessions.find((ws) => ws.id === worktreeSessionId);

  const repositoryScope = useMemo<TodoScope>(
    () => ({ type: 'repository', repositoryId }),
    [repositoryId]
  );
  const worktreeScope = useMemo<TodoScope>(
    () => ({ type: 'worktree', worktreeSessionId }),
    [worktreeSessionId]
  );

  const repositoryTodos = getRepositoryTodos(repository);
  const worktreeTodos = worktree?.todos ?? [];
  const global = scopeMode ? scopeMode === 'repository' : isGlobalWorkspace(worktree);
  const scope = global ? repositoryScope : worktreeScope;
  const todos = global ? repositoryTodos : worktreeTodos;
  const label = global ? `All: ${repositoryName}` : `Worktree: ${worktreeLabel}`;
  const moveTargets = onDispatch
    ? repository?.worktreeSessions
    : global
      ? repository?.worktreeSessions.filter((session) => !isGlobalWorkspace(session))
      : undefined;

  return (
    <div className="h-full flex flex-col" data-testid="todos-panel">
      {titleSlot && <div className="flex items-center px-3 h-[49px] shrink-0">{titleSlot}</div>}
      <div
        className="flex items-center justify-end gap-1 px-3 pb-2"
        role="group"
        aria-label="Todo view"
      >
        {onOpenPlanning && (
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto h-7 text-xs"
            onClick={onOpenPlanning}
          >
            Open Planning
          </Button>
        )}
        {(['list', 'kanban'] as const).map((mode) => (
          <Button
            key={mode}
            variant={view === mode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-2 text-xs"
            aria-pressed={view === mode}
            onClick={() => {
              setView(mode);
              localStorage.setItem('termpad:todos-view', mode);
            }}
          >
            {mode === 'list' ? <List className="size-3.5" /> : <Columns3 className="size-3.5" />}
            {mode === 'list' ? 'List' : 'Kanban'}
          </Button>
        ))}
        {onToggleExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Collapse todos' : 'Expand todos'}
            title={expanded ? 'Collapse todos' : 'Expand todos'}
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 pb-3">
        <PanelSection label={label} headerAccessory={<TodoCount todos={todos} />}>
          <TodoList
            key={global ? repositoryId : worktreeSessionId}
            label={label}
            view={view}
            scope={scope}
            todos={todos}
            moveTargets={moveTargets}
            onSendToTerminal={onSendToTerminal}
            onCreateWorktree={onCreateWorktree}
            onDispatch={onDispatch}
            onOpenWorktree={onOpenWorktree}
            assignments={repository?.worktreeSessions}
          />
        </PanelSection>
      </div>
    </div>
  );
}
