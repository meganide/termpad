import {
  ArrowRight,
  CornerDownRight,
  FolderGit2,
  GitBranch,
  Layers3,
  Plus,
  Terminal,
} from 'lucide-react';
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
  const repositories = useAppStore((state) => state.repositories);
  const terminals = useAppStore((state) => state.terminals);
  const recentRepositories = useMemo(
    () =>
      [...repositories]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [repositories]
  );
  const totalWorktrees = repositories.reduce((sum, repo) => sum + repo.worktreeSessions.length, 0);
  const openTerminals = [...terminals.values()].filter(
    (terminal) => terminal.status !== 'stopped' && terminal.status !== 'error'
  ).length;
  const recentWorktrees = useMemo(
    () =>
      repositories
        .flatMap((repository) =>
          repository.worktreeSessions.map((worktree) => ({ worktree, repository }))
        )
        .sort(
          (a, b) =>
            new Date(b.worktree.createdAt).getTime() - new Date(a.worktree.createdAt).getTime()
        )
        .slice(0, 6),
    [repositories]
  );
  const isEmpty = repositories.length === 0;

  return (
    <div className="workspace-home flex h-full min-w-0 flex-1 flex-col" data-testid="home-screen">
      <header className="workspace-topbar">
        <span className="flex items-center gap-2 text-sm">
          <Layers3 className="size-4 text-muted-foreground" />
          Workspace<span className="mx-1 text-muted-foreground/50">/</span>
          <span className="text-muted-foreground">Home</span>
        </span>
        <span className="workspace-local">
          <span className="size-1.5 rounded-full bg-primary" />
          Local workspace
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="home-content">
          <div className="home-heading">
            <div>
              <p className="eyebrow mb-3">YOUR DEVELOPMENT WORKSPACE</p>
              <h1 className="home-title">
                {isEmpty ? 'Great work starts here.' : 'Welcome back.'}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {isEmpty
                  ? 'A focused home for your code, terminals, and AI agents.'
                  : 'Your projects, branches, and agents. All in one place.'}
              </p>
            </div>
            {!isEmpty && (
              <Button className="gap-2" onClick={onAddRepository}>
                <Plus className="size-4" />
                Add Repository
              </Button>
            )}
          </div>
          {isEmpty ? (
            <>
              <section className="onboarding-card">
                <div className="onboarding-copy">
                  <span className="home-icon mb-6">
                    <FolderGit2 className="size-5" />
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Add your first repository
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                    Bring a local Git repository or clone one from a URL. Then give every idea its
                    own branch, terminal, and room to grow.
                  </p>
                  <Button size="lg" className="mt-6" onClick={onAddRepository}>
                    <Plus className="size-4" />
                    Add Repository
                    <ArrowRight className="ml-3 size-4" />
                  </Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Your code stays on your machine.
                  </p>
                </div>
                <div className="workspace-illustration" aria-hidden="true">
                  <div className="illustration-window">
                    <div className="illustration-title">
                      <Terminal className="size-3.5" />
                      <span>your next great idea</span>
                      <span className="ml-auto flex gap-1">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                    <div className="p-6 font-mono text-xs leading-8">
                      <div className="text-muted-foreground">~/projects/your-project</div>
                      <div className="flex items-center gap-2 text-primary">
                        <GitBranch className="size-3.5" />
                        main
                      </div>
                      <div className="mt-4 text-foreground">
                        <span className="text-primary">❯</span> Let’s build something.
                      </div>
                      <div className="mt-2 h-4 w-2 bg-primary/70" />
                    </div>
                  </div>
                  <div className="illustration-branch">
                    <CornerDownRight className="size-4 text-primary" />
                    <GitBranch className="size-3.5" />
                    <span>feature / your-next-idea</span>
                  </div>
                </div>
              </section>
              <div className="home-features">
                {[
                  {
                    icon: FolderGit2,
                    title: 'One place for every project',
                    detail: 'Keep repositories organized and close at hand.',
                  },
                  {
                    icon: GitBranch,
                    title: 'Space to work in parallel',
                    detail: 'Isolate each task in its own Git worktree.',
                  },
                  {
                    icon: Terminal,
                    title: 'Your agents, together',
                    detail: 'Run and monitor coding sessions side by side.',
                  },
                ].map(({ icon: Icon, title, detail }) => (
                  <div key={title}>
                    <Icon className="mb-3 size-4 text-primary" />
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="workspace-stats">
                {[
                  { icon: FolderGit2, label: 'Repositories', value: repositories.length },
                  { icon: GitBranch, label: 'Worktrees', value: totalWorktrees },
                  { icon: Terminal, label: 'Open terminals', value: openTerminals },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="workspace-stat">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-2xl font-medium tabular-nums tracking-tight">
                      {value.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              {recentWorktrees.length > 0 && (
                <section className="home-section">
                  <div className="home-section-heading">
                    <div>
                      <h2>Recent worktrees</h2>
                      <p>Pick up where your next idea is taking shape.</p>
                    </div>
                    <span className="eyebrow">LATEST {recentWorktrees.length}</span>
                  </div>
                  <div className="worktree-card-grid">
                    {recentWorktrees.map(({ worktree, repository }) => (
                      <button
                        key={worktree.id}
                        onClick={() => onSelectWorktree(worktree)}
                        className="worktree-card group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            <FolderGit2 className="size-3.5 shrink-0" />
                            <span className="truncate">{repository.name}</span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                        <h3 className="mt-5 truncate text-base font-medium tracking-tight">
                          {worktree.label}
                        </h3>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <GitBranch className="size-3.5 shrink-0 text-primary" />
                          <span className="truncate font-mono">
                            {worktree.branchName || 'No branch'}
                          </span>
                          {worktree.isMainWorktree && (
                            <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px]">
                              MAIN
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="home-section">
                <div className="home-section-heading">
                  <div>
                    <h2>Repositories</h2>
                    <p>Your most recently added projects.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onAddRepository}>
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
                <div className="repository-list">
                  {recentRepositories.map((repository) => (
                    <div key={repository.id} className="home-repository-row">
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() =>
                          repository.worktreeSessions.length > 0
                            ? onSelectRepository(repository)
                            : onAddWorktree(repository.id)
                        }
                        aria-label={`Open ${repository.name}`}
                      >
                        <span className="home-icon shrink-0">
                          <FolderGit2 className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {repository.name}
                          </span>
                          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                            {repository.path}
                          </span>
                        </span>
                      </button>
                      <span className="repository-worktree-count text-xs text-muted-foreground">
                        {repository.worktreeSessions.length}{' '}
                        {repository.worktreeSessions.length === 1 ? 'worktree' : 'worktrees'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddWorktree(repository.id)}
                        aria-label={`Add worktree to ${repository.name}`}
                      >
                        <Plus className="size-3.5" />
                        <span className="repository-add-label">Add worktree</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          repository.worktreeSessions.length > 0
                            ? onSelectRepository(repository)
                            : onAddWorktree(repository.id)
                        }
                        aria-label={`Open repository ${repository.name}`}
                      >
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          <footer className="home-footer">
            <Terminal className="size-3.5" />
            <span>A little less switching. A lot more building.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
