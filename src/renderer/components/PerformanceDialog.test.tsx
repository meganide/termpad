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
  window.termpadPerformance = {
    list: vi.fn().mockResolvedValue(snapshot),
    stop: vi.fn().mockResolvedValue(undefined),
  };
});
describe('Performance view', () => {
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
