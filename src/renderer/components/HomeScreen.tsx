import { ArrowRight, FolderGit2, GitBranch, Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { Repository, WorktreeSession } from '../../shared/types';
import { useAppStore } from '../stores/appStore';
import { Button } from './ui/button';

interface HomeScreenProps {
  onAddRepository: () => void;
  onSelectRepository: (repository: Repository) => void;
  onAddWorktree: (repositoryId: string) => void;
  onSelectWorktree: (worktree: WorktreeSession) => void;
}

export function HomeScreen({
  onAddRepository,
  onSelectRepository,
  onAddWorktree,
  onSelectWorktree,
}: HomeScreenProps) {
  const { repositories } = useAppStore();

  // Sort repositories by most recently created/used
  const recentRepositories = useMemo(() => {
    return [...repositories]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [repositories]);

  // Calculate total worktrees across all repositories
  const totalWorktrees = useMemo(() => {
    return repositories.reduce((sum, repo) => sum + repo.worktreeSessions.length, 0);
  }, [repositories]);

  // Get recent worktrees across all repositories, sorted by creation date
  const recentWorktrees = useMemo(() => {
    return repositories
      .flatMap((repo) =>
        repo.worktreeSessions.map((wt) => ({
          worktree: wt,
          repository: repo,
        }))
      )
      .sort(
        (a, b) =>
          new Date(b.worktree.createdAt).getTime() - new Date(a.worktree.createdAt).getTime()
      )
      .slice(0, 6);
  }, [repositories]);

  // Empty state: No repositories yet
  if (repositories.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-background h-full" data-testid="home-screen">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="rounded-full bg-primary/10 p-4 w-fit mx-auto mb-6">
              <FolderGit2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Add your first repository</h1>
            <p className="text-muted-foreground mb-8">
              Get started by adding a Git repository. You can add a local folder or clone from a
              URL.
            </p>
            <Button size="lg" className="gap-2" onClick={onAddRepository}>
              <Plus className="h-5 w-5" />
              Add Repository
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal state: Has repositories (with or without worktrees)
  return (
    <div className="flex-1 flex flex-col bg-background h-full" data-testid="home-screen">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-1">Welcome back</h1>
            <p className="text-muted-foreground">
              {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'},{' '}
              {totalWorktrees} {totalWorktrees === 1 ? 'worktree' : 'worktrees'}
            </p>
          </div>

          {/* Recent Worktrees - Primary focus */}
          {recentWorktrees.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Worktrees</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentWorktrees.map(({ worktree, repository }) => (
                  <button
                    key={worktree.id}
                    onClick={() => onSelectWorktree(worktree)}
                    className="flex items-start gap-3 p-4 rounded-lg bg-card hover:bg-accent/50 transition-all text-left group"
                  >
                    <div className="rounded-md bg-primary/10 p-2 mt-0.5">
                      <GitBranch className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{worktree.label}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {repository.name}
                      </div>
                      {worktree.branchName && (
                        <div className="text-xs text-muted-foreground/70 truncate mt-1">
                          {worktree.branchName}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Repositories Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground">Repositories</h2>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onAddRepository}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {recentRepositories.map((repository) => (
                <div key={repository.id} className="flex items-center gap-3 p-3 rounded-lg bg-card">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{repository.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {repository.worktreeSessions.length}{' '}
                      {repository.worktreeSessions.length === 1 ? 'worktree' : 'worktrees'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {repository.worktreeSessions.length === 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => onAddWorktree(repository.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Worktree
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => onAddWorktree(repository.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => onSelectRepository(repository)}
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
