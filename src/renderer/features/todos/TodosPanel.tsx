import { useMemo, type ReactNode } from 'react';
import { PanelSection } from '../../components/RightPanel/PanelSection';
import { useCollapsibleScopes } from '../../components/RightPanel/useCollapsibleScopes';
import { useAppStore } from '../../stores/appStore';
import type { TodoScope } from '../../stores/appStore';
import { TodoList } from './TodoList';
import type { TodoItem } from '../../../shared/types';

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
}

export function TodosPanel({
  repositoryId,
  worktreeSessionId,
  repositoryName,
  worktreeLabel,
  titleSlot,
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

  return (
    <div className="h-full flex flex-col" data-testid="todos-panel">
      <div className="flex items-center px-3 h-[49px] shrink-0">{titleSlot}</div>
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 pb-3">
        <PanelSection
          label={`Repository: ${repositoryName}`}
          collapsed={collapsed.repository}
          onToggle={() => toggle('repository')}
          headerAccessory={<TodoCount todos={repositoryTodos} />}
        >
          <TodoList
            label={`Repository: ${repositoryName}`}
            scope={repositoryScope}
            todos={repositoryTodos}
          />
        </PanelSection>
        <PanelSection
          label={`Worktree: ${worktreeLabel}`}
          collapsed={collapsed.worktree}
          onToggle={() => toggle('worktree')}
          headerAccessory={<TodoCount todos={worktreeTodos} />}
        >
          <TodoList
            label={`Worktree: ${worktreeLabel}`}
            scope={worktreeScope}
            todos={worktreeTodos}
          />
        </PanelSection>
      </div>
    </div>
  );
}
