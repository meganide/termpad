import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MoreVertical, Network, RefreshCw, Square, Terminal } from 'lucide-react';
import type { ListeningPort, PortOrigin, PortScanResult } from '../../shared/ports';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function PortsPanel({
  loadPorts,
  onNavigate,
  onBusyChange,
  onOpenTerminal,
  onCloseTerminal,
}: {
  loadPorts?: () => Promise<PortScanResult>;
  onNavigate: () => void;
  onBusyChange?: (busy: boolean) => void;
  onOpenTerminal?: (terminalId: string) => boolean;
  onCloseTerminal?: (terminalId: string) => Promise<boolean>;
}) {
  const [scan, setScan] = useState<PortScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<PortOrigin | 'all'>('termpad');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ListeningPort | null>(null);
  const [force, setForce] = useState(false);
  const [closeTerminal, setCloseTerminal] = useState(false);
  const [stopping, setStopping] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const navigating = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const result = await (loadPorts ? loadPorts() : window.ports.list());
      if (mounted.current) {
        setScan(result);
        setError(null);
      }
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : 'Could not load open ports.');
    } finally {
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, [loadPorts]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  const stop = async () => {
    if (!selected || stopping) return;
    setStopping(true);
    onBusyChange?.(true);
    setStopError(null);
    setNotice(null);
    try {
      const result = await window.ports.stop(selected, force);
      if (!mounted.current) return;
      if (!result.success) {
        setStopError(result.error || 'Could not stop the process.');
        return;
      }
      let terminalNotice = '';
      if (
        closeTerminal &&
        selected.origin === 'termpad' &&
        selected.terminalId &&
        onCloseTerminal
      ) {
        try {
          const closed = await onCloseTerminal(selected.terminalId);
          terminalNotice = closed
            ? ' Terminal closed.'
            : ' Its terminal is already closed or unavailable.';
        } catch (error) {
          if (mounted.current)
            setStopError(
              `Stop requested, but the terminal could not be closed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
        if (!mounted.current) return;
      }
      setSelected(null);
      setNotice(
        `${force ? 'Force stop' : 'Stop'} requested for ${selected.name} (PID ${selected.pid}).${terminalNotice} If it stays listed, ${force ? 'it may have restarted automatically' : 'try Force stop'}.`
      );
      await refresh();
    } catch (error) {
      if (mounted.current)
        setStopError(error instanceof Error ? error.message : 'Could not stop the process.');
    } finally {
      if (mounted.current) setStopping(false);
      onBusyChange?.(false);
    }
  };

  const goToTerminal = (entry: ListeningPort) => {
    if (!entry.terminalId || !onOpenTerminal) return;
    if (!onOpenTerminal(entry.terminalId)) {
      setStopError('This terminal is no longer available. Refresh the ports list.');
      return;
    }
    navigating.current = true;
    onNavigate();
  };

  // A process can own multiple listening endpoints. Count it only once per namespace.
  const processIds = {
    termpad: new Set<string>(),
    outside: new Set<string>(),
    all: new Set<string>(),
  };
  for (const entry of scan?.ports ?? []) {
    const id = JSON.stringify([entry.distro ?? '', entry.pid, entry.startedAt]);
    processIds[entry.origin].add(id);
    processIds.all.add(id);
  }

  // Include listeners hidden by the table filters, but never another process or WSL namespace.
  const affectedPorts = selected
    ? [
        ...new Set([
          selected.port,
          ...(scan?.ports ?? [])
            .filter(
              (entry) =>
                entry.pid === selected.pid &&
                entry.startedAt === selected.startedAt &&
                (entry.distro ?? '') === (selected.distro ?? '')
            )
            .map((entry) => entry.port),
        ]),
      ].sort((a, b) => a - b)
    : [];

  const search = query.trim().toLowerCase();
  const ports =
    scan?.ports.filter(
      (entry) =>
        (origin === 'all' || entry.origin === origin) &&
        [entry.port, entry.pid, entry.name, entry.address, entry.distro || 'Local'].some((value) =>
          String(value).toLowerCase().includes(search)
        )
    ) ?? [];

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
      aria-label="Open ports"
    >
      <div className="shrink-0">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Network className="size-4 text-primary" /> Open ports
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          TCP ports listening under your user account, including apps started outside Termpad.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter by origin"
        className="grid shrink-0 grid-cols-[1fr_1.4fr_1fr] gap-1 rounded-lg bg-muted p-1"
      >
        {(
          [
            ['termpad', 'Termpad'],
            ['outside', 'Outside Termpad'],
            ['all', 'All'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={origin === value ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={origin === value}
            disabled={stopping}
            className={
              origin === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }
            onClick={() => {
              setOrigin(value);
              setSelected(null);
            }}
          >
            {label} <span className="tabular-nums">({processIds[value].size})</span>
          </Button>
        ))}
      </div>

      <div className="flex shrink-0 items-end gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="port-search" className="text-xs font-medium text-muted-foreground">
            Filter ports
          </label>
          <Input
            id="port-search"
            placeholder="Port, process, PID, or address…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          disabled={refreshing || stopping}
          onClick={() => void refresh()}
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {(error || stopError) && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {stopError || error}
        </p>
      )}
      {scan?.warnings.map((warning) => (
        <p key={warning} role="status" className="text-sm text-muted-foreground">
          {warning}
        </p>
      ))}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <div
        className="min-h-0 flex-1 overflow-auto rounded-lg bg-muted/30 [scrollbar-gutter:stable]"
        aria-busy={refreshing}
      >
        <table className="w-full min-w-[38rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-20" />
          </colgroup>
          <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Port / address
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Process
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-help underline decoration-dotted underline-offset-4"
                    >
                      CPU
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    CPU average for this process, excluding child processes. macOS uses a recent
                    average; Linux, WSL and Windows use the process lifetime. 100% equals one CPU
                    core.
                  </TooltipContent>
                </Tooltip>
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-help underline decoration-dotted underline-offset-4"
                    >
                      Memory
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    Resident memory (RSS / working set) for this process, excluding child processes.
                  </TooltipContent>
                </Tooltip>
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {ports.map((entry) => (
              <tr
                key={JSON.stringify([entry.distro, entry.pid, entry.port, entry.address])}
                className="hover:bg-muted/60"
              >
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold tabular-nums text-primary">
                    {entry.port}
                  </span>
                  <div className="mt-1 max-w-56 break-all font-mono text-xs text-muted-foreground">
                    {entry.address}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="break-all font-medium">{entry.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    PID {entry.pid} · {entry.origin === 'termpad' ? 'Termpad' : 'Outside Termpad'}
                    {entry.distro ? ` · WSL: ${entry.distro}` : ''}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums">
                  {entry.cpuPercent == null ? (
                    <span aria-label="CPU usage unavailable" className="text-muted-foreground">
                      —
                    </span>
                  ) : (
                    `${entry.cpuPercent.toFixed(1)}%`
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums">
                  {entry.memoryBytes == null ? (
                    <span aria-label="Memory usage unavailable" className="text-muted-foreground">
                      —
                    </span>
                  ) : (
                    `${(entry.memoryBytes / 1024 / 1024).toFixed(1)} MiB`
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={stopping}
                        aria-label={`Actions for ${entry.name} on port ${entry.port} (PID ${entry.pid})`}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48"
                      onCloseAutoFocus={(event) => {
                        if (navigating.current) event.preventDefault();
                      }}
                    >
                      {entry.origin === 'termpad' && (
                        <>
                          <DropdownMenuItem
                            disabled={!entry.terminalId || !onOpenTerminal}
                            onSelect={() => goToTerminal(entry)}
                          >
                            <Terminal className="size-4" /> Go to terminal
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!entry.canStop}
                        onSelect={() => {
                          setSelected(entry);
                          setForce(false);
                          setCloseTerminal(false);
                          setNotice(null);
                        }}
                      >
                        <Square className="size-4" /> Stop process
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {ports.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-muted-foreground"
                  role="status"
                >
                  {!scan
                    ? error
                      ? 'Port scan unavailable. Try refreshing.'
                      : 'Scanning open ports…'
                    : search
                      ? 'No ports match your filter.'
                      : origin === 'termpad'
                        ? 'No listening TCP ports started in Termpad.'
                        : origin === 'outside'
                          ? 'No listening TCP ports started outside Termpad.'
                          : 'No listening TCP ports found for your user.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <section
          aria-label="Confirm stop process"
          className="shrink-0 space-y-3 rounded-lg bg-muted p-4"
        >
          <p className="text-sm font-medium">
            Stop {selected.name} (PID {selected.pid})?
          </p>
          <p className="text-sm text-muted-foreground">
            This stops the entire process and closes all of its listeners on{' '}
            {affectedPorts.length === 1 ? 'port' : 'ports'}{' '}
            <strong className="font-medium text-foreground">
              {new Intl.ListFormat('en', { type: 'conjunction' }).format(affectedPorts.map(String))}
            </strong>
            .
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={force}
              disabled={stopping}
              onChange={(event) => setForce(event.target.checked)}
              className="accent-primary"
            />
            Force stop (skip process cleanup)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={closeTerminal}
              disabled={
                stopping ||
                selected.origin !== 'termpad' ||
                !selected.terminalId ||
                !onCloseTerminal
              }
              onChange={(event) => setCloseTerminal(event.target.checked)}
              className="accent-primary"
            />
            Also close terminal
          </label>
          {closeTerminal && (
            <p className="text-xs text-muted-foreground">
              Closes the owning tab and ends any other jobs running in that terminal.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={stopping} onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={stopping} onClick={() => void stop()}>
              {stopping && <Loader2 className="size-4 animate-spin" />}
              {force ? 'Force stop process' : 'Stop process'}
            </Button>
          </div>
        </section>
      )}
      <p className="shrink-0 text-xs text-muted-foreground">
        {scan
          ? `Showing ${ports.length} of ${scan.ports.length} listening ${scan.ports.length === 1 ? 'endpoint' : 'endpoints'} · `
          : ''}
        Refreshes every 5 seconds while open.
      </p>
    </section>
  );
}
