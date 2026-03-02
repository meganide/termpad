import { useState, useMemo, useEffect, useCallback, cloneElement } from 'react';
import {
  ArrowLeft,
  GitBranch,
  FolderGit2,
  Plus,
  Download,
  Loader2,
  RefreshCw,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Badge } from './ui/badge';
import { useAppStore } from '../stores/appStore';
import type { WorktreeSession, BranchInfo, WorktreeInfo } from '../../shared/types';
import { cn } from '@/lib/utils';
import { WorktreePicker } from './WorktreePicker';
import { getImportableWorktrees, normalizePathSlashes } from '../utils/worktreeUtils';

type Mode = 'create' | 'import';

interface AddWorktreeScreenProps {
  onBack: () => void;
  repositoryId: string | null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sanitizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 50);
}

export function AddWorktreeScreen({ onBack, repositoryId }: AddWorktreeScreenProps) {
  const [mode, setMode] = useState<Mode>('create');
  // Create mode state
  const [worktreeName, setWorktreeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  // Import mode state
  const [importableWorktrees, setImportableWorktrees] = useState<WorktreeInfo[]>([]);
  const [selectedWorktreePaths, setSelectedWorktreePaths] = useState<Set<string>>(new Set());
  // All worktrees (for branch indicators)
  const [allWorktrees, setAllWorktrees] = useState<WorktreeInfo[]>([]);

  const {
    repositories,
    settings,
    addWorktreeSession,
    setActiveTerminal,
    createUserTab,
    getUserTerminalIdForTab,
  } = useAppStore();

  const repository = useMemo(
    () => repositories.find((p) => p.id === repositoryId),
    [repositories, repositoryId]
  );

  const sanitizedName = useMemo(() => sanitizeBranchName(worktreeName), [worktreeName]);

  // Group branches into local and remote
  const { localBranches, remoteBranches } = useMemo(() => {
    const local = branches.filter((b) => !b.isRemote);
    const remote = branches.filter((b) => b.isRemote);
    return { localBranches: local, remoteBranches: remote };
  }, [branches]);

  // Map branch names to their worktree paths (if checked out)
  const branchWorktreeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of allWorktrees) {
      if (wt.branch) {
        map.set(wt.branch, wt.path);
      }
    }
    return map;
  }, [allWorktrees]);

  // Load branches
  const loadBranches = useCallback(async () => {
    if (!repository) return;
    setBranchesLoading(true);
    try {
      const branchList = await window.terminal.listBranches(repository.path);
      setBranches(branchList);

      // Prefer remote branches: origin/main, origin/master, then fall back to local default
      if (!selectedBranch) {
        const originMain = branchList.find((b) => b.name === 'origin/main');
        const originMaster = branchList.find((b) => b.name === 'origin/master');
        const localDefault = branchList.find((b) => b.isDefault && !b.isRemote);
        const defaultBranch = originMain || originMaster || localDefault;
        if (defaultBranch) {
          setSelectedBranch(defaultBranch.name);
        }
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setBranchesLoading(false);
    }
  }, [repository, selectedBranch]);

  // Load worktrees
  const loadWorktrees = useCallback(async () => {
    if (!repository) return;
    try {
      const worktrees = await window.terminal.listWorktrees(repository.path);
      setAllWorktrees(worktrees);
      const importable = getImportableWorktrees(worktrees, repository.worktreeSessions);
      setImportableWorktrees(importable);
    } catch (err) {
      console.error('Failed to load worktrees:', err);
    }
  }, [repository]);

  // Fetch branches from remote
  const handleFetch = async () => {
    if (!repository) return;
    setIsFetching(true);
    try {
      await window.terminal.fetchBranches(repository.path);
      await loadBranches();
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setIsFetching(false);
    }
  };

  // Load branches and worktrees on mount
  useEffect(() => {
    if (repository) {
      loadBranches();
      loadWorktrees();
    }
  }, [repository, loadBranches, loadWorktrees]);

  // Auto-refresh branch list when branchesChanged event fires
  useEffect(() => {
    if (!repositoryId) return;

    const unsubscribe = window.watcher.onBranchesChanged((changedRepositoryId: string) => {
      if (changedRepositoryId === repositoryId) {
        loadBranches();
        loadWorktrees();
      }
    });

    return () => unsubscribe();
  }, [repositoryId, loadBranches, loadWorktrees]);

  const handleCreate = async () => {
    if (!repository || !sanitizedName) return;

    setIsLoading(true);
    setError(null);

    try {
      // Auto-fetch if creating from a remote branch to ensure we have the latest commits
      if (selectedBranch && selectedBranch.includes('/')) {
        await window.terminal.fetchBranches(repository.path);
      }

      const result = await window.terminal.createWorktree(
        repository.path,
        worktreeName,
        settings.worktreeBasePath,
        selectedBranch || undefined
      );

      if (!result.success) {
        setError(result.error || 'Failed to create worktree');
        return;
      }

      const sessionId = generateId();

      const worktreeSession: WorktreeSession = {
        id: sessionId,
        label: worktreeName,
        path: normalizePathSlashes(result.path!),
        branchName: sanitizedName,
        worktreeName: sanitizedName,
        createdAt: new Date().toISOString(),
        isExternal: false,
      };

      addWorktreeSession(repository.id, worktreeSession);
      setActiveTerminal(sessionId);

      // Execute setup script if configured
      const setupScript = repository.scriptsConfig?.setupScript;
      if (setupScript) {
        // Create a user terminal tab with a descriptive name
        const newTab = createUserTab(sessionId, 'Setup');
        const terminalId = getUserTerminalIdForTab(sessionId, newTab.id);

        // Wait for the terminal to be ready before sending the command
        window.terminal
          .waitForReady(terminalId)
          .then(() => {
            window.terminal.write(terminalId, setupScript + '\n');
          })
          .catch((err) => {
            console.error('Failed to execute setup script:', err);
          });
      }

      onBack();
    } catch (err) {
      setError('Failed to create worktree');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!repository || selectedWorktreePaths.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      let firstSessionId: string | null = null;
      const importedSessionIds: string[] = [];

      for (const worktree of importableWorktrees) {
        if (selectedWorktreePaths.has(worktree.path)) {
          const sessionId = generateId();
          if (!firstSessionId) {
            firstSessionId = sessionId;
          }
          importedSessionIds.push(sessionId);

          const worktreeSession: WorktreeSession = {
            id: sessionId,
            label: worktree.branch || window.terminal.getBasename(worktree.path),
            path: normalizePathSlashes(worktree.path),
            branchName: worktree.branch || undefined,
            worktreeName: worktree.branch || window.terminal.getBasename(worktree.path),
            createdAt: new Date().toISOString(),
            isExternal: true,
          };

          addWorktreeSession(repository.id, worktreeSession);
        }
      }

      if (firstSessionId) {
        setActiveTerminal(firstSessionId);
      }

      // Execute setup script for each imported worktree if configured
      const setupScript = repository.scriptsConfig?.setupScript;
      if (setupScript) {
        for (const sessionId of importedSessionIds) {
          const newTab = createUserTab(sessionId, 'Setup');
          const terminalId = getUserTerminalIdForTab(sessionId, newTab.id);

          window.terminal
            .waitForReady(terminalId)
            .then(() => {
              window.terminal.write(terminalId, setupScript + '\n');
            })
            .catch((err) => {
              console.error('Failed to execute setup script:', err);
            });
        }
      }

      onBack();
    } catch (err) {
      setError('Failed to import worktrees');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!repository) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Repository not found</p>
      </div>
    );
  }

  const importCount = importableWorktrees.length;
  const hasImportable = importCount > 0;

  const navItems: {
    id: Mode;
    label: string;
    icon: typeof Plus;
    badge?: number;
    disabled?: boolean;
  }[] = [
    { id: 'create', label: 'Create New', icon: Plus },
    {
      id: 'import',
      label: 'Import',
      icon: Download,
      badge: hasImportable ? importCount : undefined,
      disabled: !hasImportable,
    },
  ];

  return (
    <div
      className="flex-1 flex bg-background h-full"
      data-testid="add-worktree-screen"
      data-repository-id={repositoryId}
    >
      {/* Left navigation panel */}
      <div className="w-48 flex flex-col bg-sidebar-panel">
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            const buttonContent = (
              <button
                onClick={() => !item.disabled && setMode(item.id)}
                disabled={item.disabled}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  item.disabled &&
                    'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badge !== undefined && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );

            if (item.disabled) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <span className="block">{buttonContent}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    No worktrees available to import. Create a worktree first in order to be able to
                    import one.
                  </TooltipContent>
                </Tooltip>
              );
            }

            return cloneElement(buttonContent, { key: item.id });
          })}
        </nav>

        {/* Back button at bottom */}
        <div className="flex items-center px-3 py-2.5 bg-sidebar-panel">
          <button
            onClick={onBack}
            className="flex-1 h-9 flex items-center justify-start gap-2 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold mb-2">Add Worktree</h1>
              <p className="text-muted-foreground">
                {mode === 'create' ? 'Create a new worktree' : 'Import existing worktrees'} for
                &quot;
                {repository.name}&quot;
              </p>
            </div>

            {/* Explanation box */}
            <div className="rounded-lg bg-muted/30 p-4 mb-6 depth-inset">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">What is a worktree?</span> A worktree
                lets you work on multiple branches at once, each in its own folder. No more stashing
                changes or switching branches - just open a different worktree.
              </p>
            </div>

            {mode === 'create' ? (
              <div className="space-y-6">
                {/* Worktree Name */}
                <div className="space-y-2">
                  <Label htmlFor="worktreeName" className="text-base font-medium">
                    Worktree Name
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will be used as the branch name and directory name.
                  </p>
                  <Input
                    id="worktreeName"
                    value={worktreeName}
                    onChange={(e) => setWorktreeName(e.target.value)}
                    placeholder="e.g., fix-authentication-bug"
                    className="max-w-md"
                    autoFocus
                  />
                </div>

                {/* Branch From */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Branch From</Label>
                  <p className="text-sm text-muted-foreground">
                    Select the branch to create your new worktree from.
                  </p>
                  <div className="flex gap-2 max-w-md">
                    <Popover open={branchPopoverOpen} onOpenChange={setBranchPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={branchPopoverOpen}
                          className="flex-1 justify-between font-normal"
                          disabled={branchesLoading}
                        >
                          {branchesLoading ? (
                            <span className="text-muted-foreground">Loading branches...</span>
                          ) : selectedBranch ? (
                            <span className="truncate">{selectedBranch}</span>
                          ) : (
                            <span className="text-muted-foreground">Select a branch...</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search branches..." />
                          <CommandList>
                            <CommandEmpty>No branch found.</CommandEmpty>
                            {remoteBranches.length > 0 && (
                              <CommandGroup heading="Remote">
                                {remoteBranches.map((branch) => (
                                  <CommandItem
                                    key={branch.name}
                                    value={branch.name}
                                    onSelect={(value) => {
                                      setSelectedBranch(value);
                                      setBranchPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedBranch === branch.name ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <GitBranch className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <span className="truncate">{branch.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {localBranches.length > 0 && (
                              <CommandGroup heading="Local">
                                {localBranches.map((branch) => {
                                  const worktreePath = branchWorktreeMap.get(branch.name);
                                  return (
                                    <CommandItem
                                      key={branch.name}
                                      value={branch.name}
                                      onSelect={(value) => {
                                        setSelectedBranch(value);
                                        setBranchPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4 shrink-0',
                                          selectedBranch === branch.name
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {worktreePath ? (
                                        <FolderGit2 className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                      ) : (
                                        <GitBranch className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                      )}
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="truncate">{branch.name}</span>
                                        {worktreePath && (
                                          <span className="text-xs text-muted-foreground truncate">
                                            {worktreePath}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleFetch}
                          disabled={isFetching || branchesLoading}
                        >
                          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Fetch branches from remote</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Branch Preview */}
                {worktreeName && (
                  <div className="rounded-lg p-4 bg-muted/50 max-w-md">
                    <h3 className="text-sm font-medium mb-3">Preview</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Branch name:</span>
                        <code className="font-mono bg-background px-2 py-0.5 rounded">
                          {sanitizedName || '(invalid)'}
                        </code>
                      </div>
                      {selectedBranch && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground ml-6">Based on:</span>
                          <code className="font-mono text-muted-foreground">{selectedBranch}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-destructive max-w-md">{error}</p>}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Import description */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    These worktrees exist on disk but haven&apos;t been imported into Termpad yet.
                    Select the ones you want to add.
                  </p>
                </div>

                {/* Worktree picker */}
                <div className="max-w-lg">
                  <WorktreePicker
                    worktrees={importableWorktrees}
                    selectedPaths={selectedWorktreePaths}
                    onSelectionChange={setSelectedWorktreePaths}
                    idPrefix="import-worktree"
                  />
                </div>

                {error && <p className="text-sm text-destructive max-w-md">{error}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Fixed action buttons footer - matches left nav back button height */}
        <div className="flex items-center px-3 py-2.5 bg-background">
          <div className="flex gap-2">
            {mode === 'create' ? (
              <>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={handleCreate}
                  disabled={!sanitizedName || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Worktree
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={onBack}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="h-9"
                  onClick={handleImport}
                  disabled={selectedWorktreePaths.size === 0 || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {selectedWorktreePaths.size > 0 ? `(${selectedWorktreePaths.size})` : ''}
                </Button>
                <Button variant="ghost" size="sm" className="h-9" onClick={onBack}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
