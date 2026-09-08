import fs from 'fs/promises';
import path from 'path';

/** Cache small derived file results across unrelated repository changes. */
export class FileContentCache<T> {
  private entries = new Map<string, { stamp: string; promise: Promise<T>; weight: number }>();
  private totalWeight = 0;

  constructor(
    private weigh: (value: T) => number = () => 1,
    private maxWeight = 128
  ) {}

  private remove(key: string): void {
    this.totalWeight -= this.entries.get(key)?.weight ?? 0;
    this.entries.delete(key);
  }

  clear(directory?: string): void {
    if (!directory) {
      this.entries.clear();
      this.totalWeight = 0;
      return;
    }
    const prefix = path.join(directory, path.sep);
    for (const filePath of this.entries.keys()) {
      if (filePath.startsWith(prefix)) this.remove(filePath);
    }
  }

  async read(filePath: string, run: () => Promise<T>): Promise<T> {
    const stat = await fs.lstat(filePath);
    // Large files are processed without retaining their potentially large result.
    // Symlink diffs describe the link itself; line counts follow its target.
    // Bypass caching for links so either kind of change is observed correctly.
    if (stat.isSymbolicLink() || stat.size > 256 * 1024) return run();
    const stamp = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    const previous = this.entries.get(filePath);
    if (previous?.stamp === stamp) return previous.promise;
    const entry = { stamp, promise: Promise.resolve().then(run), weight: 0 };
    this.remove(filePath);
    this.entries.set(filePath, entry);
    while (this.entries.size > 128) this.remove(this.entries.keys().next().value!);
    entry.promise.then(
      (value) => {
        if (this.entries.get(filePath) !== entry) return;
        entry.weight = this.weigh(value);
        this.totalWeight += entry.weight;
        while (this.totalWeight > this.maxWeight) this.remove(this.entries.keys().next().value!);
      },
      () => {
        if (this.entries.get(filePath) === entry) this.remove(filePath);
      }
    );
    return entry.promise;
  }
}
