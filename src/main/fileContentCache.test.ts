import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { FileContentCache } from './fileContentCache';

let directory: string;
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(tmpdir(), 'termpad-cache-test-'));
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

describe('derived file caching', () => {
  it('reuses unchanged files, expires same-size edits, and bounds retained result weight', async () => {
    const cache = new FileContentCache<string>((value) => value.length, 5);
    const a = path.join(directory, 'a');
    const b = path.join(directory, 'b');
    await fs.writeFile(a, 'aaa');
    await fs.writeFile(b, 'bbb');
    const readA = vi.fn(() => fs.readFile(a, 'utf-8'));
    await cache.read(a, readA);
    await cache.read(a, readA);
    expect(readA).toHaveBeenCalledOnce();
    await cache.read(b, () => fs.readFile(b, 'utf-8'));
    await cache.read(a, readA);
    expect(readA).toHaveBeenCalledTimes(2);
    await fs.writeFile(a, 'new');
    await fs.utimes(a, new Date(), new Date(Date.now() + 1000));
    expect(await cache.read(a, readA)).toBe('new');
    cache.clear(directory);
    await cache.read(a, readA);
    expect(readA).toHaveBeenCalledTimes(4);
  });

  it.skipIf(process.platform === 'win32')(
    'does not reuse a symlink result when its target changes',
    async () => {
      const target = path.join(directory, 'target');
      const link = path.join(directory, 'link');
      await fs.writeFile(target, 'old');
      await fs.symlink(target, link);
      const cache = new FileContentCache<string>();
      const read = () => fs.readFile(link, 'utf-8');
      expect(await cache.read(link, read)).toBe('old');
      await fs.writeFile(target, 'new');
      expect(await cache.read(link, read)).toBe('new');
    }
  );
});
