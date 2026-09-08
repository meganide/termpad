import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitReadCache, mapConcurrent } from './gitReadCache';

afterEach(() => vi.useRealTimers());

describe('GitReadCache', () => {
  it('shares slow in-flight requests even after the usual TTL', async () => {
    vi.useFakeTimers();
    const cache = new GitReadCache();
    let resolve!: (value: string) => void;
    const run = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        })
    );
    const first = cache.read('status', '/repo', run);
    await vi.advanceTimersByTimeAsync(5000);
    expect(cache.read('status', '/repo', run)).toBe(first);
    resolve('result');
    await first;
    await vi.advanceTimersByTimeAsync(999);
    expect(await cache.read('status', '/repo', run)).toBe('result');
    expect(run).toHaveBeenCalledOnce();
  });

  it('preserves metadata on file edits, invalidates it on Git changes, and isolates repositories', async () => {
    const cache = new GitReadCache();
    const run = vi.fn(async () => 'value');
    await cache.read('status', '/repo', run);
    const metadata = cache.read('branch', '/repo', run, 30_000, 'metadata');
    const other = cache.read('status', '/other', run);
    await Promise.all([metadata, other]);
    cache.invalidate('/repo', 'worktree');
    expect(cache.read('branch', '/repo', run)).toBe(metadata);
    expect(cache.read('status', '/other', run)).toBe(other);
    await cache.read('status', '/repo', run);
    expect(run).toHaveBeenCalledTimes(4);
    cache.invalidate('/repo');
    expect(cache.read('branch', '/repo', run)).not.toBe(metadata);
  });

  it('does not resurrect invalidated results or cache failures', async () => {
    const cache = new GitReadCache();
    let resolve!: (value: string) => void;
    const old = cache.read(
      'status',
      '/repo',
      () =>
        new Promise<string>((done) => {
          resolve = done;
        })
    );
    await Promise.resolve();
    cache.invalidate('/repo');
    const fresh = cache.read('status', '/repo', async () => 'fresh');
    resolve('old');
    await Promise.all([old, fresh]);
    expect(await cache.read('status', '/repo', async () => 'unexpected')).toBe('fresh');
    await expect(
      cache.read('fail', '/repo', async () => {
        throw Error('failed');
      })
    ).rejects.toThrow();
    expect(await cache.read('fail', '/repo', async () => 'retry')).toBe('retry');
  });
});

it('bounds concurrent subprocess work and preserves file order', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return value * 2;
  });
  expect(result).toEqual([2, 4, 6, 8, 10, 12]);
  expect(peak).toBe(2);
});
