import { useState, useMemo } from 'react';
import { Search, Lock, Globe, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import type { GitHubRepo } from '../../shared/types';

interface GitHubRepoPickerProps {
  repos: GitHubRepo[];
  isLoading: boolean;
  error: string | null;
  onSelect: (url: string) => void;
}

export function GitHubRepoPicker({ repos, isLoading, error, onSelect }: GitHubRepoPickerProps) {
  const [search, setSearch] = useState('');

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repos;
    const searchLower = search.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.nameWithOwner.toLowerCase().includes(searchLower) ||
        (repo.description && repo.description.toLowerCase().includes(searchLower))
    );
  }, [repos, search]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg bg-muted/60 p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading repositories...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    const isNotInstalled = error.includes('not found') || error.includes('Install');
    const isNotAuthenticated = error.includes('login') || error.includes('auth');

    return (
      <div className="rounded-lg bg-destructive/10 p-4">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium text-destructive">
              {isNotInstalled
                ? 'GitHub CLI Not Found'
                : isNotAuthenticated
                  ? 'Not Authenticated'
                  : 'Error'}
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
            {isNotInstalled && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.electronAPI.openExternal('https://cli.github.com');
                }}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Install GitHub CLI
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state (authenticated but no repos)
  if (repos.length === 0) {
    return (
      <div className="rounded-lg bg-muted/60 p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No repositories found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Repository list */}
      <ScrollArea className="h-48 rounded-lg bg-muted/60">
        <div className="p-1">
          {filteredRepos.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No repositories match your search.
            </div>
          ) : (
            filteredRepos.map((repo) => (
              <button
                key={repo.nameWithOwner}
                onClick={() => onSelect(repo.url)}
                className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors"
              >
                {repo.isPrivate ? (
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{repo.nameWithOwner}</p>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
