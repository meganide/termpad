type Scope = 'worktree' | 'metadata';

/** Share in-flight reads; the freshness period starts when the read finishes. */
export class GitReadCache {
  private entries = new Map<
    string,
    {
      repoPath: string;
      scope: Scope;
      expiresAt: number;
      promise: Promise<unknown>;
    }
  >();

  read<T>(
    op: string,
    repoPath: string,
    run: () => Promise<T>,
    ttl = 1000,
    scope: Scope = 'worktree'
  ): Promise<T> {
    const key = `${op}\0${repoPath}`;
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;
    const entry = { repoPath, scope, expiresAt: Infinity, promise: Promise.resolve().then(run) };
    this.entries.set(key, entry);
    entry.promise.then(
      () => {
        entry.expiresAt = Date.now() + ttl;
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      }
    );
    // Bound retained results across repositories. In-flight entries are never evicted.
    for (const [oldKey, old] of this.entries) {
      if (this.entries.size <= 512) break;
      if (old.expiresAt !== Infinity) this.entries.delete(oldKey);
    }
    return entry.promise;
  }

  invalidate(repoPath?: string, scope?: Scope): void {
    for (const [key, entry] of this.entries) {
      if ((!repoPath || entry.repoPath === repoPath) && (!scope || entry.scope === scope)) {
        this.entries.delete(key);
      }
    }
  }
}

export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await run(items[index]);
      }
    })
  );
  return results;
}
