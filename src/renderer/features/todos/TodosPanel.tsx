import { useMemo, type ReactNode } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { TodoScope } from '../../stores/appStore';
import { TodoList } from './TodoList';

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

  return (
    <div className="h-full flex flex-col" data-testid="todos-panel">
      <div className="flex items-center px-3 h-[49px] shrink-0">{titleSlot}</div>
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 pb-3">
        <TodoList
          label={`Repository: ${repositoryName}`}
          scope={repositoryScope}
          todos={repository?.todos ?? []}
        />
        <TodoList
          label={`Worktree: ${worktreeLabel}`}
          scope={worktreeScope}
          todos={worktree?.todos ?? []}
        />
      </div>
    </div>
  );
}
