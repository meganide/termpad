import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortsDialog } from './PortsDialog';

const entry = {
  pid: 123,
  name: 'node',
  port: 3000,
  address: '127.0.0.1',
  startedAt: 'today',
  canStop: true,
  cpuPercent: 12.5,
  memoryBytes: 64 * 1024 * 1024,
  origin: 'termpad' as const,
  terminalId: 'session:tab',
};

beforeEach(() => {
  window.ports = {
    list: vi.fn().mockResolvedValue({
      ports: [
        entry,
        {
          ...entry,
          pid: 456,
          port: 8080,
          name: 'python',
          origin: 'outside',
          terminalId: undefined,
        },
      ],
      warnings: [],
    }),
    stop: vi.fn().mockResolvedValue({ success: true }),
  };
});

async function openActions() {
  fireEvent.keyDown(
    await screen.findByRole('button', { name: 'Actions for node on port 3000 (PID 123)' }),
    { key: 'Enter' }
  );
  await screen.findByRole('menu');
}

async function selectStop() {
  await openActions();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Stop process' }));
}

describe('Open ports', () => {
  it('shows listeners and filters by process or port', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('3000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All (2)' }));
    fireEvent.change(screen.getByLabelText('Filter ports'), { target: { value: 'python' } });
    expect(screen.queryByText('3000')).not.toBeInTheDocument();
    expect(screen.getByText('8080')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter ports'), { target: { value: '9999' } });
    expect(screen.getByText('No ports match your filter.')).toBeInTheDocument();
  });
  it('defaults to Termpad and switches between outside and all listeners', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('3000')).toBeInTheDocument();
    expect(screen.queryByText('8080')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Termpad (1)' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Outside Termpad (1)' }));
    expect(screen.queryByText('3000')).not.toBeInTheDocument();
    expect(screen.getByText('8080')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All (2)' }));
    expect(screen.getByText('3000')).toBeInTheDocument();
    expect(screen.getByText('8080')).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2/)).toBeInTheDocument();
  });

  it('combines origin and text filters and clears a hidden stop selection', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    await selectStop();
    fireEvent.click(screen.getByRole('button', { name: 'Outside Termpad (1)' }));
    expect(screen.queryByRole('region', { name: 'Confirm stop process' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter ports'), { target: { value: 'node' } });
    expect(screen.getByText('No ports match your filter.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Termpad (1)' }));
    expect(screen.getByText('3000')).toBeInTheDocument();
    expect(window.ports.stop).not.toHaveBeenCalled();
  });

  it('keeps the origin filter on refresh and resets to Termpad when reopened', async () => {
    const { unmount } = render(<PortsDialog onClose={vi.fn()} />);
    await screen.findByText('3000');
    fireEvent.click(screen.getByRole('button', { name: 'Outside Termpad (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(window.ports.list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Outside Termpad (1)' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    unmount();
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('3000')).toBeInTheDocument();
    expect(screen.queryByText('8080')).not.toBeInTheDocument();
  });

  it('counts processes once across multiple endpoints and separately across WSL namespaces', async () => {
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [entry, { ...entry, port: 3001 }, { ...entry, distro: 'Ubuntu', origin: 'outside' }],
      warnings: [],
    });
    render(<PortsDialog onClose={vi.fn()} />);
    await screen.findByText('3000');
    expect(screen.getByRole('button', { name: 'Termpad (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outside Termpad (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (2)' })).toBeInTheDocument();
  });

  it('opens the owning terminal from the dropdown and closes the dialog', async () => {
    const onOpenTerminal = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();
    render(<PortsDialog onClose={onClose} onOpenTerminal={onOpenTerminal} />);
    await openActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Go to terminal' }));
    expect(onOpenTerminal).toHaveBeenCalledWith('session:tab');
    expect(onClose).toHaveBeenCalledOnce();
    expect(window.ports.stop).not.toHaveBeenCalled();
  });

  it('keeps the dialog open if the terminal was closed since scanning', async () => {
    const onClose = vi.fn();
    render(<PortsDialog onClose={onClose} onOpenTerminal={() => false} />);
    await openActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Go to terminal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('terminal is no longer available');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables navigation for a detached process with no active terminal', async () => {
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, terminalId: undefined }],
      warnings: [],
    });
    render(<PortsDialog onClose={vi.fn()} onOpenTerminal={vi.fn()} />);
    await openActions();
    expect(screen.getByRole('menuitem', { name: 'Go to terminal' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows CPU and memory usage and updates them on refresh', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('64.0 MiB')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'CPU' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Memory' })).toBeInTheDocument();
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, cpuPercent: 150.3, memoryBytes: 128 * 1024 * 1024 }],
      warnings: [],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('150.3%')).toBeInTheDocument();
    expect(screen.getByText('128.0 MiB')).toBeInTheDocument();
  });

  it('shows zero usage and distinguishes unavailable measurements', async () => {
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, cpuPercent: 0, memoryBytes: 0 }],
      warnings: [],
    });
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0 MiB')).toBeInTheDocument();
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, cpuPercent: null, memoryBytes: null }],
      warnings: [],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByLabelText('CPU usage unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Memory usage unavailable')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
  });

  it('requires confirmation and sends only the selected listener', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    await selectStop();
    expect(window.ports.stop).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('region', { name: 'Confirm stop process' });
    expect(within(confirmation).getByText(/closes all of its ports/)).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Stop process' }));
    await waitFor(() => expect(window.ports.stop).toHaveBeenCalledWith(entry, false));
    expect(await screen.findByText(/Stop requested for node/)).toBeInTheDocument();
  });
  it('keeps the owning terminal open by default', async () => {
    const onCloseTerminal = vi.fn().mockResolvedValue(true);
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={onCloseTerminal} />);
    await selectStop();
    expect(screen.getByRole('checkbox', { name: 'Also close terminal' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    await screen.findByText(/Stop requested for node/);
    expect(onCloseTerminal).not.toHaveBeenCalled();
  });

  it('closes only the owning terminal after a successful stop request', async () => {
    const onCloseTerminal = vi.fn().mockResolvedValue(true);
    let finishStop!: (result: { success: boolean }) => void;
    vi.mocked(window.ports.stop).mockReturnValue(
      new Promise((resolve) => {
        finishStop = resolve;
      })
    );
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={onCloseTerminal} />);
    await selectStop();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also close terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(onCloseTerminal).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Also close terminal' })).toBeDisabled();
    await act(async () => {
      finishStop({ success: true });
    });
    expect(onCloseTerminal).toHaveBeenCalledExactlyOnceWith('session:tab');
    expect(await screen.findByText(/Terminal closed/)).toBeInTheDocument();
  });

  it('keeps the terminal open when stopping fails', async () => {
    const onCloseTerminal = vi.fn().mockResolvedValue(true);
    vi.mocked(window.ports.stop).mockResolvedValue({ success: false, error: 'Permission denied' });
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={onCloseTerminal} />);
    await selectStop();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also close terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
    expect(onCloseTerminal).not.toHaveBeenCalled();
  });

  it('reports terminal cleanup errors separately from the successful stop request', async () => {
    const onCloseTerminal = vi.fn().mockRejectedValue(new Error('Shell cleanup failed'));
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={onCloseTerminal} />);
    await selectStop();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also close terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Stop requested, but the terminal could not be closed: Shell cleanup failed'
    );
    expect(screen.queryByText(/Terminal closed/)).not.toBeInTheDocument();
  });

  it('disables terminal closure when no owning terminal is known', async () => {
    vi.mocked(window.ports.list).mockResolvedValue({
      ports: [{ ...entry, terminalId: undefined }],
      warnings: [],
    });
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={vi.fn()} />);
    await selectStop();
    expect(screen.getByRole('checkbox', { name: 'Also close terminal' })).toBeDisabled();
  });

  it('resets the close-terminal checkbox for the next stop confirmation', async () => {
    render(<PortsDialog onClose={vi.fn()} onCloseTerminal={vi.fn()} />);
    await selectStop();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also close terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await selectStop();
    expect(screen.getByRole('checkbox', { name: 'Also close terminal' })).not.toBeChecked();
  });

  it('allows cancelling and explicitly force stopping', async () => {
    render(<PortsDialog onClose={vi.fn()} />);
    await selectStop();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(window.ports.stop).not.toHaveBeenCalled();
    await selectStop();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Force stop (skip process cleanup)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Force stop process' }));
    await waitFor(() => expect(window.ports.stop).toHaveBeenCalledWith(entry, true));
  });
  it('shows stop errors and keeps the process available', async () => {
    vi.mocked(window.ports.stop).mockResolvedValue({ success: false, error: 'Permission denied' });
    render(<PortsDialog onClose={vi.fn()} />);
    await selectStop();
    fireEvent.click(screen.getByRole('button', { name: 'Stop process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
    expect(screen.getByText('3000')).toBeInTheDocument();
  });
  it('distinguishes a failed scan from an empty result and allows retry', async () => {
    vi.mocked(window.ports.list).mockRejectedValueOnce(new Error('lsof unavailable'));
    render(<PortsDialog onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('lsof unavailable');
    expect(
      screen.queryByText('No listening TCP ports found for your user.')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('3000')).toBeInTheDocument();
  });
  it('polls only while mounted and does not overlap scans', async () => {
    vi.useFakeTimers();
    try {
      let finish!: (value: { ports: (typeof entry)[]; warnings: string[] }) => void;
      vi.mocked(window.ports.list).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const { unmount } = render(<PortsDialog onClose={vi.fn()} />);
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(window.ports.list).toHaveBeenCalledTimes(1);
      await act(async () => {
        finish({ ports: [], warnings: [] });
      });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(window.ports.list).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(window.ports.list).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
