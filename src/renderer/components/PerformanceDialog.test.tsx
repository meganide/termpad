import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceDialog } from './PerformanceDialog';
import { useBrowserRegistry } from '../features/browser/browserRegistry';
import type { PerformanceSnapshot } from '../../shared/performance';
const entry = {
  pid: 123,
  startedAt: 'today',
  name: 'node',
  kind: 'process' as const,
  terminalId: 'session:tab',
  cpuPercent: 12.5,
  memoryBytes: 64 * 1024 * 1024,
  canStop: true,
};
const snapshot: PerformanceSnapshot = {
  processes: [entry, { ...entry, pid: 124, name: 'python', memoryBytes: 100 * 1024 * 1024 }],
  browsers: [],
  capturedAt: 1000,
  warnings: [],
};
beforeEach(() => {
  useBrowserRegistry.setState({ tabs: [] });
  window.ports = { list: vi.fn().mockResolvedValue({ ports: [], warnings: [] }), stop: vi.fn() };
  window.termpadPerformance = {
    list: vi.fn().mockResolvedValue(snapshot),
    stop: vi.fn().mockResolvedValue(undefined),
  };
});
describe('Performance view', () => {
  const selectTab = (name: string | RegExp) =>
    fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false });

  it('loads the open-port count before visiting ports and updates it after a scan', async () => {
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, port: 3000, address: '*', origin: 'termpad' }],
      warnings: [],
    });
    render(<PerformanceDialog onClose={vi.fn()} />);
    expect(await screen.findByRole('tab', { name: /^Open ports\s*1$/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    selectTab(/^Open ports/);
    await screen.findByText('3000');
    vi.mocked(window.ports.list).mockResolvedValue({ ports: [], warnings: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('tab', { name: /^Open ports\s*0$/ })).toBeInTheDocument();
  });

  it('restores the selected resource tab when reopened', async () => {
    const { unmount } = render(<PerformanceDialog onClose={vi.fn()} />);
    await screen.findByText('node');
    selectTab(/Process/);
    expect(screen.getByRole('tab', { name: /Process/ })).toHaveAttribute('aria-selected', 'true');
    unmount();
    render(<PerformanceDialog onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /Process/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('node')).toBeInTheDocument();
  });

  it('embeds open ports in the same modal and restores that tab on reopen', async () => {
    window.ports = {
      list: vi.fn().mockResolvedValue({
        ports: [{ ...entry, port: 3000, address: '127.0.0.1', origin: 'termpad' }],
        warnings: [],
      }),
      stop: vi.fn(),
    };
    const { unmount } = render(<PerformanceDialog onClose={vi.fn()} />);
    await screen.findByText('node');
    selectTab(/^Open ports/);
    expect(await screen.findByText('3000')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Performance');
    expect(screen.queryByLabelText('Search running items')).not.toBeInTheDocument();
    unmount();
    vi.mocked(window.termpadPerformance.list).mockClear();
    render(<PerformanceDialog onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /^Open ports/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByText('3000')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^All\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Open ports\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Process\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Terminal\s*0$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Browser tab\s*0$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^App\s*0$/ })).toBeInTheDocument();
    expect(window.termpadPerformance.list).toHaveBeenCalledOnce();
  });

  it('loads counts once when opening on ports without starting resource polling', async () => {
    localStorage.setItem('termpad-performance-tab', 'ports');
    window.ports = { list: vi.fn().mockResolvedValue({ ports: [], warnings: [] }), stop: vi.fn() };
    vi.useFakeTimers();
    try {
      const { unmount } = render(<PerformanceDialog onClose={vi.fn()} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(screen.getByRole('tab', { name: /^All\s*2$/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Open ports\s*0$/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Open ports/ })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(window.termpadPerformance.list).toHaveBeenCalledOnce();
      expect(window.ports.list).toHaveBeenCalledTimes(3);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates counts when the initial reading completes after switching to ports', async () => {
    let finish!: (result: PerformanceSnapshot) => void;
    vi.mocked(window.termpadPerformance.list).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    window.ports = { list: vi.fn().mockResolvedValue({ ports: [], warnings: [] }), stop: vi.fn() };
    render(<PerformanceDialog onClose={vi.fn()} />);
    selectTab(/^Open ports/);
    await act(async () => finish(snapshot));
    expect(screen.getByRole('tab', { name: /^All\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Process\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Open ports/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(window.termpadPerformance.list).toHaveBeenCalledOnce();
  });

  it('stops polling inactive tabs and resumes the newly selected view', async () => {
    window.ports = { list: vi.fn().mockResolvedValue({ ports: [], warnings: [] }), stop: vi.fn() };
    vi.useFakeTimers();
    try {
      render(<PerformanceDialog onClose={vi.fn()} />);
      await act(async () => {
        await Promise.resolve();
      });
      selectTab(/^Open ports/);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(window.termpadPerformance.list).toHaveBeenCalledTimes(1);
      expect(window.ports.list).toHaveBeenCalledTimes(3);
      selectTab(/^All/);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(window.ports.list).toHaveBeenCalledTimes(3);
      expect(window.termpadPerformance.list).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('prevents tab switching and dismissal while a port stop request is pending', async () => {
    let finish!: (result: { success: boolean }) => void;
    window.ports = {
      list: vi.fn().mockResolvedValue({
        ports: [{ ...entry, port: 3000, address: '*', origin: 'termpad' }],
        warnings: [],
      }),
      stop: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      ),
    };
    const close = vi.fn();
    render(<PerformanceDialog onClose={close} />);
    selectTab(/^Open ports/);
    fireEvent.keyDown(
      await screen.findByRole('button', { name: 'Actions for node on port 3000 (PID 123)' }),
      { key: 'Enter' }
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Stop process' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(screen.getByRole('tab', { name: /^All/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish({ success: true }));
    expect(screen.getByRole('tab', { name: /^All/ })).not.toBeDisabled();
  });

  it('falls back to All for an invalid saved tab', async () => {
    localStorage.setItem('termpad-performance-tab', 'removed-tab');
    render(<PerformanceDialog onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('node')).toBeInTheDocument();
  });
  it('shows totals, sorts numerically, and searches running processes', async () => {
    render(<PerformanceDialog onClose={vi.fn()} />);
    await screen.findByText('node');
    expect(screen.getByText('164.0 MB')).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveTextContent('python');
    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    expect(screen.getByRole('columnheader', { name: 'Memory' })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveTextContent('node');
    fireEvent.change(screen.getByLabelText('Search running items'), { target: { value: '123' } });
    expect(screen.queryByText('python')).not.toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
  });
  it('navigates a child process to its terminal', async () => {
    const open = vi.fn().mockReturnValue(true);
    const close = vi.fn();
    render(<PerformanceDialog onClose={close} onOpenTerminal={open} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open node' }));
    expect(open).toHaveBeenCalledWith('session:tab');
    expect(close).toHaveBeenCalledOnce();
  });
  it('requires confirmation and surfaces failed stop requests', async () => {
    vi.mocked(window.termpadPerformance.stop).mockRejectedValue(
      new Error('This process has exited.')
    );
    render(<PerformanceDialog onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Close node' }));
    expect(window.termpadPerformance.stop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Force stop'));
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This process has exited.');
    expect(window.termpadPerformance.stop).toHaveBeenCalledWith(entry, true);
    expect(screen.getByRole('group', { name: 'Confirm close' })).toBeInTheDocument();
  });
  it('closes terminal tabs through the existing lifecycle callback', async () => {
    vi.mocked(window.termpadPerformance.list).mockResolvedValue({
      ...snapshot,
      processes: [{ ...entry, kind: 'terminal' }],
    });
    const closeTerminal = vi.fn().mockResolvedValue(true);
    render(<PerformanceDialog onClose={vi.fn()} onCloseTerminal={closeTerminal} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Close node' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close terminal' }));
    await waitFor(() => expect(closeTerminal).toHaveBeenCalledWith('session:tab'));
    expect(window.termpadPerformance.stop).not.toHaveBeenCalled();
  });
  it('finds tabs across repositories and navigates to the selected page', async () => {
    const select = vi.fn();
    const open = vi.fn().mockReturnValue(true);
    useBrowserRegistry.setState({
      tabs: [
        { id: 'page', title: 'Docs', url: '', repositoryId: 'other-repo', select, close: vi.fn() },
      ],
    });
    render(<PerformanceDialog onClose={vi.fn()} onOpenBrowser={open} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Docs' }));
    expect(open).toHaveBeenCalledWith('other-repo');
    expect(select).toHaveBeenCalledOnce();
  });
  it('closes browser pages through their live registry rather than killing shared processes', async () => {
    const close = vi.fn();
    useBrowserRegistry.setState({
      tabs: [{ id: 'page', title: 'Docs', url: '', repositoryId: 'repo', select: vi.fn(), close }],
    });
    render(<PerformanceDialog onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Close Docs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close browser tab' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(window.termpadPerformance.stop).not.toHaveBeenCalled();
  });
  it('keeps previous readings visible on refresh errors and disables close actions', async () => {
    render(<PerformanceDialog onClose={vi.fn()} />);
    await screen.findByText('node');
    vi.mocked(window.termpadPerformance.list).mockRejectedValueOnce(new Error('Reading failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh performance' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Reading failed');
    expect(screen.getByRole('button', { name: 'Close node' })).toBeDisabled();
    expect(screen.getByText('164.0 MB')).toBeInTheDocument();
  });
  it('polls only while visible and stops polling after unmount', async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<PerformanceDialog onClose={vi.fn()} />);
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(window.termpadPerformance.list).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(window.termpadPerformance.list).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it('never offers to close protected app processes', async () => {
    vi.mocked(window.termpadPerformance.list).mockResolvedValue({
      ...snapshot,
      processes: [{ ...entry, kind: 'app', canStop: false, terminalId: undefined }],
    });
    render(<PerformanceDialog onClose={vi.fn()} />);
    const row = (await screen.findByText('node')).closest('tr')!;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });
});
