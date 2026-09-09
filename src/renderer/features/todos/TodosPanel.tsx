import { useMemo, type ReactNode } from 'react';
import { PanelSection } from '../../components/RightPanel/PanelSection';
import { useCollapsibleScopes } from '../../components/RightPanel/useCollapsibleScopes';
import { useAppStore } from '../../stores/appStore';
import type { TodoScope } from '../../stores/appStore';
import { TodoList } from './TodoList';
import type { TodoItem } from '../../../shared/types';
import { isGlobalWorkspace } from '../../utils/workspaceScope';

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
  repositoryId: string;
  worktreeSessionId: string;
  repositoryName: string;
  worktreeLabel: string;
  titleSlot: ReactNode;
  onSendToTerminal?: (todo: TodoItem) => void;
  onCreateWorktree?: (todo: TodoItem) => void;
}

export function TodosPanel({
  repositoryId,
  worktreeSessionId,
  repositoryName,
  worktreeLabel,
  titleSlot,
  onSendToTerminal,
  onCreateWorktree,
}: TodosPanelProps) {
  const repositories = useAppStore((s) => s.repositories);
  const { collapsed, toggle } = useCollapsibleScopes();

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

  const repositoryTodos = repository?.todos ?? [];
  const worktreeTodos = worktree?.todos ?? [];
  const global = isGlobalWorkspace(worktree);
  const scope = global ? repositoryScope : worktreeScope;
  const todos = global ? repositoryTodos : worktreeTodos;
  const label = global ? `Global: ${repositoryName}` : `Worktree: ${worktreeLabel}`;
  const scopeKey = global ? 'repository' : 'worktree';
  const moveTargets = global
    ? repository?.worktreeSessions.filter((session) => !isGlobalWorkspace(session))
    : undefined;

  return (
    <div className="h-full flex flex-col" data-testid="todos-panel">
      {titleSlot && <div className="flex items-center px-3 h-[49px] shrink-0">{titleSlot}</div>}
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 pb-3">
        <PanelSection
          label={label}
          collapsed={collapsed[scopeKey]}
          onToggle={() => toggle(scopeKey)}
          headerAccessory={<TodoCount todos={todos} />}
        >
          <TodoList
            key={global ? repositoryId : worktreeSessionId}
            label={label}
            scope={scope}
            todos={todos}
            moveTargets={moveTargets}
            onSendToTerminal={onSendToTerminal}
            onCreateWorktree={onCreateWorktree}
          />
        </PanelSection>
      </div>
    </div>
  );
}
