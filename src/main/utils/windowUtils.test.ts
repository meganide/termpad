import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron's screen module
vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: vi.fn(),
  },
}));

import { screen } from 'electron';
import { getConstrainedWindowSize } from './windowUtils';

describe('getConstrainedWindowSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns preferred size when smaller than screen', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1400, 900);

    expect(result).toEqual({ width: 1400, height: 900 });
  });

  it('constrains width to 90% of screen when preferred width exceeds limit', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 1366, height: 768 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1400, 600);

    expect(result.width).toBe(Math.floor(1366 * 0.9));
    expect(result.height).toBe(600);
  });

  it('constrains height to 90% of screen when preferred height exceeds limit', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 1920, height: 768 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1000, 900);

    expect(result.width).toBe(1000);
    expect(result.height).toBe(Math.floor(768 * 0.9));
  });

  it('constrains both dimensions when both exceed screen size', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 1280, height: 720 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1400, 900);

    expect(result.width).toBe(Math.floor(1280 * 0.9));
    expect(result.height).toBe(Math.floor(720 * 0.9));
  });

  it('uses custom maxScreenPercent when provided', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1400, 900, 0.5);

    expect(result.width).toBe(Math.floor(1920 * 0.5));
    expect(result.height).toBe(Math.floor(1080 * 0.5));
  });

  it('handles small screens correctly', () => {
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      workAreaSize: { width: 800, height: 600 },
    } as Electron.Display);

    const result = getConstrainedWindowSize(1400, 900);

    expect(result.width).toBe(Math.floor(800 * 0.9));
    expect(result.height).toBe(Math.floor(600 * 0.9));
  });
});
