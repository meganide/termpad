import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePRStatusPolling } from './usePRStatusPolling';
import { useAppStore } from '../stores/appStore';

describe('usePRStatusPolling', () => {
  let fetchPRStatusesMock: () => Promise<void>;

  beforeEach(() => {
    vi.useFakeTimers();

    fetchPRStatusesMock = vi.fn().mockResolvedValue(undefined);

    // Reset store state
    useAppStore.setState({
      isInitialized: true,
      ghCliAvailable: true,
      prStatuses: {},
      prStatusLoading: false,
      prStatusLastUpdated: null,
      prStatusFetchId: 0,
      fetchPRStatuses: fetchPRStatusesMock,
    });

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('fetches PR statuses immediately on mount when initialized', async () => {
    renderHook(() => usePRStatusPolling());

    // Flush promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when not initialized', async () => {
    useAppStore.setState({ isInitialized: false });

    renderHook(() => usePRStatusPolling());

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchPRStatusesMock).not.toHaveBeenCalled();
  });

  it('polls every 30 seconds', async () => {
    renderHook(() => usePRStatusPolling());

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1);

    // Advance time by 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(2);

    // Advance time by another 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(3);
  });

  it('stops polling when document is hidden', async () => {
    renderHook(() => usePRStatusPolling());

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1);

    // Make document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance time - should not fetch because document is hidden
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1); // Still 1
  });

  it('resumes polling and fetches immediately when document becomes visible', async () => {
    renderHook(() => usePRStatusPolling());

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1);

    // Make document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Make document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Should fetch immediately on visibility change
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(2);
  });

  it('cleans up interval on unmount', async () => {
    const { unmount } = renderHook(() => usePRStatusPolling());

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // Advance time - should not fetch because unmounted
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(fetchPRStatusesMock).toHaveBeenCalledTimes(1); // Still 1
  });

  it('removes visibility change listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => usePRStatusPolling());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
