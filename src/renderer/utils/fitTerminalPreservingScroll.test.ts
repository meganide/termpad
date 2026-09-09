import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import { createScrollPreservingFit } from './fitTerminalPreservingScroll';

// Exercise the installed xterm implementation, including its asynchronous
// viewport synchronization. Only browser text measurement needs a stub in jsdom.
const nextRender = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

describe('fitting a real xterm while preserving scroll', () => {
  let terminal: XtermTerminal;
  let container: HTMLDivElement;
  let fitter: ReturnType<typeof createScrollPreservingFit>;

  beforeEach(async () => {
    const context = new Proxy(
      {
        createLinearGradient: () => ({ addColorStop: vi.fn() }),
        measureText: () => ({ width: 9 }),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      },
      { get: (target, key) => target[key as keyof typeof target] ?? vi.fn() }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.classList.contains('xterm-char-measure-element') ? 288 : 800;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.classList.contains('xterm-char-measure-element') ? 18 : 600;
    });
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.append(container);
    terminal = new Terminal({ allowProposedApi: true, scrollback: 5000 });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminal.element?.style.setProperty('padding', '0px');
    fitAddon.fit();
    fitter = createScrollPreservingFit(terminal, fitAddon);
  });

  afterEach(() => {
    fitter?.dispose();
    terminal?.dispose();
    container?.remove();
    vi.restoreAllMocks();
  });

  async function writeLines(width = 20) {
    await new Promise<void>((resolve) => {
      terminal.write(
        Array.from({ length: 400 }, (_, i) => `line-${i}: ${'x'.repeat(width)}`).join('\r\n'),
        resolve
      );
    });
    await nextRender();
  }

  async function scrollTo(line: number) {
    terminal.scrollToLine(line);
    await nextRender();
  }

  function resize(width: number, height: number) {
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    fitter.fit();
  }

  const write = (data: string) => new Promise<void>((resolve) => terminal.write(data, resolve));
  // Codex's resize response: synchronized output, clear screen and scrollback,
  // then replay the transcript at the new width. CSI 3 J destroys all markers.
  const startRedraw = '\x1b[?2026h\x1b[H\x1b[2J\x1b[3J';
  const endRedraw = '\x1b[?2026l';

  it('restores the text being read after Codex asynchronously clears and redraws its transcript in both views', async () => {
    const transcript = Array.from({ length: 400 }, (_, i) => `line-${i}: ${'x'.repeat(100)}`).join(
      '\r\n'
    );
    await write(transcript);
    await nextRender();
    await scrollTo(150);
    resize(400, 300);
    await nextRender(); // The old fix finished here, before the PTY responded.
    await write(startRedraw + transcript + endRedraw);
    await nextRender();
    expect(
      terminal.buffer.active.getLine(terminal.buffer.active.viewportY)?.translateToString(true)
    ).toMatch(/^line-75:/);

    await scrollTo(300); // Choose a different position inside overview.
    resize(800, 600);
    await nextRender();
    await write(startRedraw + transcript + endRedraw);
    await nextRender();
    expect(
      terminal.buffer.active.getLine(terminal.buffer.active.viewportY)?.translateToString(true)
    ).toMatch(/^line-100:/);
    expect(terminal.markers).toHaveLength(0);
  });

  it('waits for a synchronized redraw split across PTY chunks, including a redundant fit', async () => {
    await writeLines();
    await scrollTo(150);
    resize(400, 300);
    await nextRender();
    await write(startRedraw);
    await nextRender();
    fitter.fit();
    await writeLines();
    const scroll = vi.spyOn(terminal, 'scrollToLine');
    expect(terminal.modes.synchronizedOutputMode).toBe(true);
    await write(endRedraw);
    await nextRender();
    expect(scroll).toHaveBeenCalledWith(150);
    expect(terminal.buffer.active.viewportY).toBe(150);
  });

  it('stays at the bottom after a Codex resize redraw', async () => {
    await writeLines();
    resize(400, 300);
    await nextRender();
    await write(startRedraw);
    await writeLines();
    await write(endRedraw);
    await nextRender();
    expect(terminal.buffer.active.viewportY).toBe(terminal.buffer.active.baseY);
  });

  it('does not override an intentional clear after the user types', async () => {
    await writeLines();
    await scrollTo(150);
    resize(400, 300);
    await nextRender();
    terminal.element?.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
    const scroll = vi.spyOn(terminal, 'scrollToLine');
    await write(startRedraw + 'new output' + endRedraw);
    await nextRender();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('does not treat a later clear as part of an old resize', async () => {
    await writeLines();
    await scrollTo(150);
    resize(400, 300);
    await nextRender();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3000);
    const scroll = vi.spyOn(terminal, 'scrollToLine');
    await write(startRedraw + 'new output' + endRedraw);
    await nextRender();
    expect(scroll).not.toHaveBeenCalled();
  });

  it.each([10, 150])(
    'preserves line %i in both directions, including a new position chosen in overview',
    async (line) => {
      await writeLines();
      await scrollTo(line);
      resize(400, 300);
      await nextRender();
      expect(terminal.buffer.active.viewportY).toBe(line);

      await scrollTo(85);
      resize(800, 600);
      await nextRender();
      expect(terminal.buffer.active.viewportY).toBe(85);
    }
  );

  it('keeps the same output in view when long lines wrap to the overview width', async () => {
    await writeLines(100);
    await scrollTo(150);
    const visibleText = () =>
      terminal.buffer.active.getLine(terminal.buffer.active.viewportY)?.translateToString(true) ??
      '';
    const originalText = visibleText();
    resize(400, 300);
    await nextRender();
    expect(visibleText()).not.toBe('');
    expect(originalText.startsWith(visibleText())).toBe(true);

    resize(800, 600);
    await nextRender();
    expect(visibleText()).toBe(originalText);
  });

  it.each([0, 'bottom'] as const)('preserves %s across layout changes', async (position) => {
    await writeLines(100);
    if (position === 0) await scrollTo(0);
    for (const [width, height] of [
      [400, 300],
      [800, 600],
    ]) {
      resize(width, height);
      await nextRender();
      expect(terminal.buffer.active.viewportY).toBe(
        position === 0 ? 0 : terminal.buffer.active.baseY
      );
    }
  });

  it('keeps a wrapped continuation in view when opening it from overview', async () => {
    await writeLines(100);
    resize(400, 300);
    await nextRender();
    // Each output line spans three rows here. Read the last row of line 75,
    // which is merged into an earlier row when opening the wider worktree.
    await scrollTo(227);
    expect(terminal.buffer.active.getLine(227)?.isWrapped).toBe(true);
    resize(800, 600);
    await nextRender();
    expect(terminal.buffer.active.viewportY).toBe(150);
    expect(terminal.buffer.active.getLine(150)?.translateToString(true)).toMatch(/^line-75:/);
  });

  it('does not jump to the top when reflow evicts the anchor from a full scrollback buffer', async () => {
    terminal.options.scrollback = 1000;
    await writeLines(100);
    await scrollTo(30);
    resize(400, 300);
    await nextRender();
    expect(terminal.buffer.active.baseY).toBe(1000);
    expect(terminal.buffer.active.viewportY).toBe(30);
  });

  it('retains the original position across multiple fits before the next render', async () => {
    await writeLines();
    await scrollTo(150);
    resize(400, 300);
    resize(500, 400);
    resize(400, 300);
    await nextRender();
    expect(terminal.buffer.active.viewportY).toBe(150);
    expect(terminal.markers).toHaveLength(0);
  });

  it('does not restore after disposal or leave a scrollback marker behind', async () => {
    await writeLines();
    await scrollTo(150);
    resize(400, 300);
    fitter.dispose();
    const scroll = vi.spyOn(terminal, 'scrollLines');
    await nextRender();
    expect(scroll).not.toHaveBeenCalled();
    expect(terminal.markers).toHaveLength(0);
  });
});
