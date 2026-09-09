import { useState } from 'react';
import { Columns3, StickyNote, ArrowLeft } from 'lucide-react';
import type { Repository, TodoItem } from '../../../shared/types';
import type { TodoScope } from '../../stores/appStore';
import { Button } from '../../components/ui/button';
import { TodosPanel } from '../todos/TodosPanel';
import { NotesPanel } from '../notes/NotesPanel';

export interface PlanningLocation {
  scopeId: string; // 'global' or a worktree session ID
  tab: 'todos' | 'notes';
}

interface PlanningWorkspaceProps {
  locationRequest?: PlanningLocation;
  repository: Repository;
  repositories: Repository[];
  onRepositoryChange: (repositoryId: string) => void;
  onBack: () => void;
  onDispatch: (todo: TodoItem, targetId: string) => void;
  onOpenWorktree?: (worktreeSessionId: string) => void;
  onCreateWorktree: (todo: TodoItem, scope: TodoScope) => void;
}

export function PlanningWorkspace({
  locationRequest,
  repository,
  repositories,
  onRepositoryChange,
  onBack,
  onDispatch,
  onOpenWorktree,
  onCreateWorktree,
}: PlanningWorkspaceProps) {
  const [tab, setTab] = useState<'todos' | 'notes'>('todos');
  const [selectedScope, setSelectedScope] = useState('global');
  const [visitedScopes, setVisitedScopes] = useState(['global']);
  const [appliedLocationRequest, setAppliedLocationRequest] = useState<PlanningLocation>();
  // Apply a new navigation request before rendering children; keep mounted board state intact.
  if (locationRequest && locationRequest !== appliedLocationRequest) {
    setAppliedLocationRequest(locationRequest);
    setSelectedScope(locationRequest.scopeId);
    setTab(locationRequest.tab);
    setVisitedScopes((previous) =>
      previous.includes(locationRequest.scopeId) ? previous : [...previous, locationRequest.scopeId]
    );
  }
  const scopes = [
    { id: 'global', label: 'Global', sessionId: '', mode: 'repository' as const },
    ...repository.worktreeSessions.map((session) => ({
      id: session.id,
      label: session.label,
      sessionId: session.id,
      mode: 'worktree' as const,
    })),
  ];
  const currentScope = scopes.some((scope) => scope.id === selectedScope)
    ? selectedScope
    : 'global';

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-background"
      aria-label={`Planning for ${repository.name}`}
    >
      <header className="flex flex-wrap items-center gap-4 border-b border-border/50 px-6 py-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Planning</h1>
        </div>
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Repository
          <select
            aria-label="Planning repository"
            value={repository.id}
            onChange={(event) => onRepositoryChange(event.target.value)}
            className="h-9 max-w-64 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {repositories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Scope
          <select
            aria-label="Planning scope"
            value={currentScope}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedScope(id);
              setVisitedScopes((previous) =>
                previous.includes(id) ? previous : [...previous, id]
              );
            }}
            className="h-9 max-w-64 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {scopes.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="flex items-center gap-2 px-6 py-3" role="group" aria-label="Planning views">
        <Button
          variant={tab === 'todos' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={tab === 'todos'}
          onClick={() => setTab('todos')}
        >
          <Columns3 className="size-4" />
          Todos
        </Button>
        <Button
          variant={tab === 'notes' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={tab === 'notes'}
          onClick={() => setTab('notes')}
        >
          <StickyNote className="size-4" />
          Notes
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground xl:block">
          {tab === 'todos'
            ? 'Plan here. Start work in any worktree.'
            : 'Keep context close to your work.'}
        </span>
      </div>
      {/* Retain each visited scope and view, including scroll, drafts and editor history. */}
      {scopes
        .filter((scope) => visitedScopes.includes(scope.id))
        .map((scope) => {
          const props = {
            repositoryId: repository.id,
            repositoryName: repository.name,
            worktreeSessionId: scope.sessionId,
            worktreeLabel: scope.label,
            scopeMode: scope.mode,
            titleSlot: null,
          };
          return (
            <div
              key={scope.id}
              hidden={scope.id !== currentScope}
              className={scope.id === currentScope ? 'flex-1 min-h-0 px-3 pb-3' : 'hidden'}
            >
              <div hidden={tab !== 'todos'} className={tab === 'todos' ? 'h-full' : 'hidden'}>
                <TodosPanel
                  {...props}
                  defaultView="kanban"
                  onDispatch={onDispatch}
                  onOpenWorktree={onOpenWorktree}
                  onCreateWorktree={(todo) =>
                    onCreateWorktree(
                      todo,
                      scope.mode === 'repository'
                        ? { type: 'repository', repositoryId: repository.id }
                        : { type: 'worktree', worktreeSessionId: scope.sessionId }
                    )
                  }
                />
              </div>
              <div hidden={tab !== 'notes'} className={tab === 'notes' ? 'h-full' : 'hidden'}>
                <NotesPanel {...props} />
              </div>
            </div>
          );
        })}
    </section>
  );
}
