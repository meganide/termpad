import type { Terminal, IBuffer, IMarker } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

interface ScrollPosition {
  buffer: IBuffer;
  viewportY: number;
  wrappedOffset: number;
  atBottom: boolean;
  marker: IMarker | undefined;
}

interface RedrawPosition {
  buffer: IBuffer;
  atBottom: boolean;
  fraction: number;
  anchors: Array<{ text: string; offset: number }>;
}

// A resize response arrives asynchronously from the PTY, after fit has finished.
const RESIZE_REDRAW_WINDOW_MS = 2000;

function normalizeLine(text: string): string {
  return text.replace(/[│┃║]/g, ' ').replace(/\s+/g, ' ').trim();
}

function captureRedrawPosition(terminal: Terminal): RedrawPosition {
  const buffer = terminal.buffer.active;
  const anchors: RedrawPosition['anchors'] = [];
  const atBottom = buffer.viewportY >= buffer.baseY;
  for (let offset = 0; !atBottom && offset < Math.min(terminal.rows, 10); offset++) {
    const text = normalizeLine(
      buffer.getLine(buffer.viewportY + offset)?.translateToString(true) ?? ''
    );
    if (text.length >= 12 && /[\p{L}\p{N}]/u.test(text)) anchors.push({ text, offset });
  }
  return {
    buffer,
    atBottom,
    fraction: buffer.baseY ? buffer.viewportY / buffer.baseY : 0,
    anchors,
  };
}

function findRedrawnLine(saved: RedrawPosition): number {
  const fallback = Math.round(saved.fraction * saved.buffer.baseY);
  const lines = Array.from({ length: saved.buffer.length }, (_, i) =>
    normalizeLine(saved.buffer.getLine(i)?.translateToString(true) ?? '')
  );
  for (const anchor of saved.anchors) {
    let closest: number | undefined;
    let bestScore = 0;
    for (let i = 0; i < lines.length; i++) {
      // Codex wraps its own output and changes table borders at the new width.
      if (
        lines[i].length < 12 ||
        !(lines[i].includes(anchor.text) || anchor.text.includes(lines[i]))
      )
        continue;
      const score = lines[i].startsWith(anchor.text) || anchor.text.startsWith(lines[i]) ? 2 : 1;
      const line = Math.max(0, i - anchor.offset);
      if (
        score > bestScore ||
        (score === bestScore &&
          (closest === undefined || Math.abs(line - fallback) < Math.abs(closest - fallback)))
      ) {
        closest = line;
        bestScore = score;
      }
    }
    if (closest !== undefined) return closest;
  }
  // The old text may have fallen out of the application's replayed history.
  return fallback;
}

export function createScrollPreservingFit(terminal: Terminal, fitAddon: FitAddon) {
  let position: ScrollPosition | undefined;
  let frame: number | undefined;
  let redrawPosition: RedrawPosition | undefined;
  let redrawFrame: number | undefined;
  let redrawDeadline = 0;
  let replaying = false;

  const clearFit = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    position?.marker?.dispose();
    position = undefined;
  };

  const cancelRedraw = () => {
    if (redrawFrame !== undefined) cancelAnimationFrame(redrawFrame);
    redrawFrame = undefined;
    redrawPosition = undefined;
    replaying = false;
  };

  const eraseSubscription = terminal.parser.registerCsiHandler({ final: 'J' }, (params) => {
    if (
      params[0] === 3 &&
      redrawPosition?.buffer === terminal.buffer.active &&
      Date.now() <= redrawDeadline
    ) {
      // Codex clears and reprints its transcript on SIGWINCH. Let the erase
      // happen, but retain a text anchor because all xterm markers are deleted.
      replaying = true;
      clearFit();
    }
    return false;
  });

  const restoreAfterRedraw = () => {
    if (!replaying || terminal.modes.synchronizedOutputMode) return;
    // Wait for the entire synchronized redraw, even when split across writes.
    if (redrawFrame !== undefined) cancelAnimationFrame(redrawFrame);
    redrawFrame = requestAnimationFrame(() => {
      redrawFrame = undefined;
      const saved = redrawPosition;
      if (!replaying || !saved || saved.buffer !== terminal.buffer.active) return;
      const line = saved.atBottom ? saved.buffer.baseY : findRedrawnLine(saved);
      cancelRedraw();
      terminal.scrollLines(-saved.buffer.length);
      if (saved.atBottom) terminal.scrollToBottom();
      else terminal.scrollToLine(Math.min(line, saved.buffer.baseY));
    });
  };
  const parsedSubscription = terminal.onWriteParsed(restoreAfterRedraw);

  // A user's next scroll or keystroke takes precedence over a pending restore.
  const cancelForInput = () => {
    clearFit();
    cancelRedraw();
  };
  const element = terminal.element;
  const inputEvents = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
  for (const event of inputEvents) element?.addEventListener(event, cancelForInput, true);

  const dispose = () => {
    clearFit();
    cancelRedraw();
    eraseSubscription.dispose();
    parsedSubscription.dispose();
    for (const event of inputEvents) element?.removeEventListener(event, cancelForInput, true);
  };

  const fit = () => {
    if (replaying) {
      fitAddon.fit();
      restoreAfterRedraw();
      return;
    }
    const buffer = terminal.buffer.active;
    if (position && position.buffer !== buffer) clearFit();
    const redrawSnapshot = position ? redrawPosition : captureRedrawPosition(terminal);
    if (!position) {
      const atBottom = buffer.viewportY >= buffer.baseY;
      let anchorLine = buffer.viewportY;
      // A continuation row can be deleted when widening the terminal. Anchor
      // the start of its logical line, which survives that reflow instead.
      if (!atBottom) {
        while (anchorLine > 0 && buffer.getLine(anchorLine)?.isWrapped) anchorLine--;
      }
      position = {
        buffer,
        viewportY: buffer.viewportY,
        wrappedOffset: (buffer.viewportY - anchorLine) * terminal.cols,
        atBottom,
        // Markers follow their line through wrapping and scrollback trimming.
        marker: atBottom
          ? undefined
          : terminal.registerMarker(anchorLine - buffer.baseY - buffer.cursorY),
      };
    }

    const { cols, rows } = terminal;
    fitAddon.fit();
    if (cols === terminal.cols && rows === terminal.rows && frame === undefined) {
      clearFit();
      return;
    }
    if (cols !== terminal.cols || rows !== terminal.rows) {
      redrawPosition = redrawSnapshot;
      redrawDeadline = Date.now() + RESIZE_REDRAW_WINDOW_MS;
    }

    // Keep the original position if another resize arrives before restoration.
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const saved = position;
      position = undefined;
      if (!saved) return;

      if (terminal.buffer.active === saved.buffer) {
        const line = saved.marker
          ? saved.marker.isDisposed
            ? // Reflow can evict old text from a full scrollback buffer. Keep
              // the viewport offset instead of forcing a jump to the top.
              saved.viewportY
            : saved.marker.line + Math.floor(saved.wrappedOffset / terminal.cols)
          : saved.viewportY;

        // xterm 6 resizes the buffer synchronously, but synchronizes scrollbar
        // dimensions on the next render. Its public scrolling methods apply a
        // relative delta to that scrollbar, which may still disagree with
        // viewportY after reflow. Clamp to a known position first, then restore
        // in the same frame so the intermediate position is never painted.
        terminal.scrollLines(-saved.buffer.length);
        if (saved.atBottom) {
          terminal.scrollToBottom();
        } else {
          terminal.scrollToLine(Math.min(line, saved.buffer.baseY));
        }
      }
      saved.marker?.dispose();
    });
  };

  return { fit, dispose };
}
