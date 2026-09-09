import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Cpu,
  Globe,
  Network,
  RefreshCw,
  Terminal,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { PerformanceSnapshot } from '../../shared/performance';
import type { PortScanResult } from '../../shared/ports';
import { useAppStore } from '../stores/appStore';
import { useBrowserRegistry } from '../features/browser/browserRegistry';
import {
  buildPerformanceRows,
  formatCpu,
  formatMemory,
  sortPerformanceRows,
  sumUsage,
  type PerformanceRow,
  type SortKey,
} from '../features/performance/model';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { PortsPanel } from './PortsPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  PERFORMANCE_TABS,
  readPerformanceTab,
  savePerformanceTab,
} from '../features/performance/preferences';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const kinds = { terminal: 'Terminal', process: 'Process', browser: 'Browser tab', app: 'App' };
const columns: [SortKey, string][] = [
  ['name', 'Name'],
  ['kind', 'Type'],
  ['context', 'Workspace'],
  ['pid', 'PID'],
  ['cpuPercent', 'CPU'],
  ['memoryBytes', 'Memory'],
];

export function PerformanceDialog({
  onClose,
  onOpenTerminal,
  onCloseTerminal,
  onOpenBrowser,
}: {
  onClose: () => void;
  onOpenTerminal?: (terminalId: string) => boolean;
  onCloseTerminal?: (terminalId: string) => Promise<boolean>;
  onOpenBrowser?: (repositoryId: string) => boolean;
}) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [portCount, setPortCount] = useState<number | null>(null);
  const pendingPortScan = useRef<Promise<PortScanResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(readPerformanceTab);
  const viewingPorts = filter === 'ports';
  const [portsStopping, setPortsStopping] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'memoryBytes',
    direction: 'desc',
  });
  const [selected, setSelected] = useState<PerformanceRow | null>(null);
  const [force, setForce] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const navigating = useRef(false);
  const tabs = useBrowserRegistry((state) => state.tabs);
  const { repositories, worktreeTabs, userTerminalTabs } = useAppStore(
    useShallow((state) => ({
      repositories: state.repositories,
      worktreeTabs: state.worktreeTabs,
      userTerminalTabs: state.userTerminalTabs,
    }))
  );

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const next = await window.termpadPerformance.list();
      if (mounted.current) {
        setSnapshot(next);
        setError(null);
      }
    } catch (reason) {
      if (mounted.current)
        setError(reason instanceof Error ? reason.message : 'Could not read resource usage.');
    } finally {
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  const loadPorts = useCallback(() => {
    // Share the initial scan with the panel when opening directly into Open ports.
    if (!pendingPortScan.current) {
      pendingPortScan.current = window.ports
        .list()
        .then((result) => {
          if (mounted.current) setPortCount(result.ports.length);
          return result;
        })
        .finally(() => {
          pendingPortScan.current = null;
        });
    }
    return pendingPortScan.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Every tab needs counts, including when reopening directly into Open ports.
    void refresh();
    void loadPorts().catch(() => {
      // The ports panel reports scan failures when opened; keep its count unknown for now.
    });
    return () => {
      mounted.current = false;
    };
  }, [refresh, loadPorts]);

  useEffect(() => {
    if (viewingPorts) return;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [refresh, viewingPorts]);

  const allRows = useMemo(() => {
    if (!snapshot) return [];
    const terminalNames = new Map<string, { name: string; context: string }>();
    const state = useAppStore.getState();
    for (const [groups, user] of [
      [worktreeTabs, false],
      [userTerminalTabs, true],
    ] as const) {
      for (const group of groups ?? []) {
        const repo = repositories.find((repo) =>
          repo.worktreeSessions.some((session) => session.id === group.worktreeSessionId)
        );
        const session = repo?.worktreeSessions.find(
          (session) => session.id === group.worktreeSessionId
        );
        for (const tab of group.tabs)
          terminalNames.set(
            (user ? state.getUserTerminalIdForTab : state.getTerminalIdForTab)(
              group.worktreeSessionId,
              tab.id
            ),
            {
              name: tab.name,
              context: [repo?.name, session?.label].filter(Boolean).join(' / '),
            }
          );
      }
    }
    return buildPerformanceRows(
      snapshot,
      tabs,
      terminalNames,
      new Map(repositories.map((repo) => [repo.id, repo.name]))
    );
  }, [snapshot, tabs, repositories, worktreeTabs, userTerminalTabs]);
  const rows = sortPerformanceRows(
    allRows.filter(
      (row) =>
        (filter === 'all' || row.kind === filter) &&
        `${row.name} ${row.context} ${row.detail} ${row.pid ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
    ),
    sort.key,
    sort.direction
  );

  const navigate = (row: PerformanceRow) => {
    const tab =
      row.browser && useBrowserRegistry.getState().tabs.find((tab) => tab.id === row.browser?.id);
    const success = tab
      ? onOpenBrowser?.(tab.repositoryId)
      : row.terminalId
        ? onOpenTerminal?.(row.terminalId)
        : false;
    if (!success) {
      setActionError('This item is no longer available to open. Refresh and try again.');
      return;
    }
    tab?.select();
    navigating.current = true;
    onClose();
  };

  const stop = async () => {
    if (!selected || stopping) return;
    setStopping(true);
    setActionError(null);
    try {
      if (selected.browser) {
        const tab = useBrowserRegistry
          .getState()
          .tabs.find((tab) => tab.id === selected.browser?.id);
        if (!tab) throw new Error('This browser tab has already closed.');
        tab.close();
      } else if (selected.kind === 'terminal' && selected.terminalId) {
        if (!(await onCloseTerminal?.(selected.terminalId)))
          throw new Error('This terminal is no longer available.');
      } else if (selected.process) await window.termpadPerformance.stop(selected.process, force);
      if (!mounted.current) return;
      setNotice(
        selected.kind === 'process'
          ? `Stop requested for ${selected.name}. If it stays listed, you can force stop it.`
          : `Closed ${selected.name}.`
      );
      setSelected(null);
      await refresh();
    } catch (reason) {
      if (mounted.current)
        setActionError(reason instanceof Error ? reason.message : 'Could not close this item.');
    } finally {
      if (mounted.current) setStopping(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !stopping && !portsStopping) onClose();
      }}
    >
      <DialogContent
        className="flex h-[min(900px,85dvh)] w-[90vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[1440px]"
        onCloseAutoFocus={(event) => {
          if (navigating.current) event.preventDefault();
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 border-b border-border p-6">
          <DialogTitle className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            Performance
          </DialogTitle>
          <DialogDescription>
            Manage Termpad resources and open ports across all repositories.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={filter}
          className="min-h-0 flex-1 gap-0"
          onValueChange={(value) => {
            const next = PERFORMANCE_TABS.find((tab) => tab === value);
            if (!next || stopping || portsStopping) return;
            setFilter(next);
            savePerformanceTab(next);
            setSelected(null);
            setActionError(null);
            setNotice(null);
          }}
        >
          <div className="shrink-0 overflow-x-auto border-b border-border px-6 py-3">
            <TabsList aria-label="Performance views">
              {PERFORMANCE_TABS.map((kind) => (
                <TabsTrigger
                  key={kind}
                  value={kind}
                  disabled={stopping || portsStopping}
                  className="px-3"
                >
                  {kind === 'ports' ? (
                    <>
                      <Network className="size-4" />
                      Open ports
                      <span className="ml-1 text-muted-foreground tabular-nums">
                        {portCount ?? '—'}
                      </span>
                    </>
                  ) : (
                    <>
                      {kind === 'all' ? 'All' : kinds[kind]}
                      <span className="ml-1 text-muted-foreground tabular-nums">
                        {snapshot
                          ? kind === 'all'
                            ? allRows.length
                            : allRows.filter((row) => row.kind === kind).length
                          : '—'}
                      </span>
                    </>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={filter} className="flex min-h-0 flex-1 flex-col">
            {viewingPorts ? (
              <PortsPanel
                loadPorts={loadPorts}
                onNavigate={() => {
                  navigating.current = true;
                  onClose();
                }}
                onOpenTerminal={onOpenTerminal}
                onCloseTerminal={onCloseTerminal}
                onBusyChange={setPortsStopping}
              />
            ) : (
              <>
                <div className="grid shrink-0 grid-cols-3 gap-6 px-6 py-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Total CPU</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {snapshot ? formatCpu(sumUsage(snapshot.processes, 'cpuPercent')) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total memory</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {snapshot ? formatMemory(sumUsage(snapshot.processes, 'memoryBytes')) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Running processes</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {snapshot?.processes.length ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-4">
                  <Input
                    aria-label="Search running items"
                    placeholder="Search name, workspace, URL or PID…"
                    className="min-w-48 flex-1"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Refresh performance"
                    disabled={refreshing}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {(error || actionError) && (
                  <p role="alert" className="px-6 pb-3 text-sm text-destructive">
                    {actionError || error}
                    {error && snapshot ? ' Displaying the last successful reading.' : ''}
                  </p>
                )}
                {notice && (
                  <p role="status" className="px-6 pb-3 text-xs text-muted-foreground">
                    {notice}
                  </p>
                )}
                {snapshot?.warnings.map((warning) => (
                  <p key={warning} className="px-6 pb-3 text-xs text-muted-foreground">
                    {warning}
                  </p>
                ))}
                {selected && (
                  <div
                    className="mx-6 mb-4 flex shrink-0 flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-4"
                    role="group"
                    aria-label="Confirm close"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selected.kind === 'process' ? 'Stop' : 'Close'} {selected.name}?
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.kind === 'terminal'
                          ? 'The terminal and its running commands will close.'
                          : selected.kind === 'browser'
                            ? 'Unsaved changes in this page may be lost.'
                            : 'The running task will be interrupted.'}
                      </p>
                    </div>
                    {selected.kind === 'process' && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={force}
                          onChange={(event) => setForce(event.target.checked)}
                          disabled={stopping}
                        />
                        Force stop
                      </label>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={stopping}
                      onClick={() => {
                        setSelected(null);
                        setActionError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={stopping}
                      onClick={() => void stop()}
                    >
                      {stopping
                        ? 'Closing…'
                        : selected.kind === 'process'
                          ? 'Stop process'
                          : selected.kind === 'browser'
                            ? 'Close browser tab'
                            : 'Close terminal'}
                    </Button>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto border-y border-border">
                  <table className="w-full min-w-[880px] table-fixed text-sm">
                    <caption className="sr-only">
                      Termpad resource usage. Select a column heading to sort.
                    </caption>
                    <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                      <tr>
                        {columns.map(([key, label]) => (
                          <th
                            key={key}
                            scope="col"
                            aria-sort={
                              sort.key === key
                                ? sort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            className={`px-3 py-3 font-medium ${key === 'name' ? 'w-[27%] pl-6 text-left' : key === 'context' ? 'w-[20%] text-left' : key === 'kind' ? 'w-[12%] text-left' : 'w-[10%] text-right'}`}
                          >
                            <button
                              className={`inline-flex items-center gap-1 rounded focus-visible:outline focus-visible:outline-ring ${key === 'pid' || key === 'cpuPercent' || key === 'memoryBytes' ? 'justify-end' : ''}`}
                              onClick={() =>
                                setSort({
                                  key,
                                  direction:
                                    sort.key === key && sort.direction === 'desc' ? 'asc' : 'desc',
                                })
                              }
                            >
                              {label}
                              {sort.key === key &&
                                (sort.direction === 'asc' ? (
                                  <ArrowUp className="size-3" />
                                ) : (
                                  <ArrowDown className="size-3" />
                                ))}
                            </button>
                          </th>
                        ))}
                        <th scope="col" className="w-24">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const Icon =
                          row.kind === 'browser' ? Globe : row.kind === 'terminal' ? Terminal : Cpu;
                        const canOpen = !!(
                          (row.browser && onOpenBrowser) ||
                          (row.terminalId && onOpenTerminal)
                        );
                        const canClose =
                          !!row.browser ||
                          !!(
                            row.process?.canStop &&
                            (row.kind === 'process' || (row.kind === 'terminal' && onCloseTerminal))
                          );
                        return (
                          <tr key={row.id} className="border-b border-border/40 hover:bg-muted/40">
                            <td className="py-3 pl-6 pr-3">
                              <div className="flex items-center gap-2">
                                <Icon className="size-4 shrink-0 text-muted-foreground" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{row.name}</p>
                                      <p className="mt-1 truncate text-xs text-muted-foreground">
                                        {row.detail}
                                      </p>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{row.name}</p>
                                    <p>{row.detail}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground">
                              {kinds[row.kind]}
                            </td>
                            <td className="truncate px-3 py-3 text-xs text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{row.context}</span>
                                </TooltipTrigger>
                                <TooltipContent>{row.context}</TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">
                              {row.pid ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCpu(row.cpuPercent)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatMemory(row.memoryBytes)}
                            </td>
                            <td className="pr-4">
                              <div className="flex justify-end gap-1">
                                {canOpen && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8"
                                        aria-label={`Open ${row.name}`}
                                        onClick={() => navigate(row)}
                                      >
                                        <ArrowUpRight className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {row.kind === 'process'
                                        ? 'Open owning terminal'
                                        : 'Go to item'}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {canClose && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8 hover:text-destructive"
                                        disabled={!!error || stopping}
                                        aria-label={`Close ${row.name}`}
                                        onClick={() => {
                                          setSelected(row);
                                          setForce(false);
                                          setActionError(null);
                                          setNotice(null);
                                        }}
                                      >
                                        <X className="size-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {row.kind === 'process' ? 'Stop process' : 'Close item'}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!rows.length && (
                    <p role="status" className="p-12 text-center text-sm text-muted-foreground">
                      {!snapshot
                        ? error
                          ? 'Resource usage unavailable. Try refreshing.'
                          : 'Reading running processes…'
                        : query || filter !== 'all'
                          ? 'No running items match this filter.'
                          : 'No running items.'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
                  <p className="max-w-2xl">
                    Totals count each process once. Terminal rows include their children; browser
                    usage may be shared. CPU: 100% = one core. Totals use available readings. — =
                    waiting for a reading.
                  </p>
                  <span className="shrink-0">
                    {error ? 'Update failed' : 'Updates every 2s'}
                    {snapshot ? ` · ${new Date(snapshot.capturedAt).toLocaleTimeString()}` : ''}
                  </span>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
