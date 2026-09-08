function countNewlines(data: string): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i] === '\n') count++;
  return count;
}

/** Bounded replay history, including output that redraws without newlines. */
export class TerminalOutputBuffer {
  private chunks: Array<{ data: string; lines: number; bytes: number } | undefined> = [];
  private head = 0;
  private lineCount = 0;
  private byteCount = 0;

  constructor(
    private maxLines = 10_000,
    private maxBytes = 4 * 1024 * 1024
  ) {}

  append(data: string): void {
    if (!data) return;
    const chunk = { data, lines: countNewlines(data), bytes: Buffer.byteLength(data) };
    const last = this.chunks[this.chunks.length - 1];
    if (last && !last.lines && !chunk.lines && last.bytes + chunk.bytes <= 16 * 1024) {
      // Tiny redraws should not turn a bounded byte history into millions of objects.
      last.data += data;
      last.bytes += chunk.bytes;
    } else {
      this.chunks.push(chunk);
    }
    this.lineCount += chunk.lines;
    this.byteCount += chunk.bytes;
    while (
      (this.lineCount > this.maxLines || this.byteCount > this.maxBytes) &&
      this.chunks.length - this.head > 1
    ) {
      const removed = this.chunks[this.head]!;
      this.chunks[this.head++] = undefined;
      this.lineCount -= removed.lines;
      this.byteCount -= removed.bytes;
    }
    if (this.lineCount > this.maxLines || this.byteCount > this.maxBytes) {
      let tail = this.chunks[this.head]!.data;
      if (this.lineCount > this.maxLines) {
        let start = 0;
        for (let n = this.lineCount - this.maxLines; n > 0; n--) {
          start = tail.indexOf('\n', start) + 1;
        }
        tail = tail.slice(start);
      }
      if (Buffer.byteLength(tail) > this.maxBytes) {
        const bytes = Buffer.from(tail);
        let start = bytes.length - this.maxBytes;
        // Do not retain half a UTF-8 character at the truncation boundary.
        while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
        tail = bytes.subarray(start).toString();
      }
      this.lineCount = countNewlines(tail);
      this.byteCount = Buffer.byteLength(tail);
      this.chunks[this.head] = { data: tail, lines: this.lineCount, bytes: this.byteCount };
    }
    if (this.head >= 1024) {
      this.chunks = this.chunks.slice(this.head);
      this.head = 0;
    }
  }

  getAll(): string {
    return this.chunks
      .slice(this.head)
      .map((chunk) => chunk!.data)
      .join('');
  }
  getLineCount(): number {
    return this.lineCount;
  }
  clear(): void {
    this.chunks = [];
    this.head = this.lineCount = this.byteCount = 0;
  }
}

/** Track outstanding IPC frames, tolerating duplicate/out-of-order acknowledgements. */
export class TerminalOutputFlow {
  private frames = new Map<number, number>();
  private sequence = 0;
  private pending = 0;
  private paused = false;

  constructor(
    private pty: { pause(): void; resume(): void },
    private highWatermark = 256 * 1024,
    private lowWatermark = 64 * 1024
  ) {}

  sent(chars: number): number {
    const sequence = ++this.sequence;
    this.frames.set(sequence, chars);
    this.pending += chars;
    if (!this.paused && this.pending >= this.highWatermark) {
      this.paused = true;
      this.pty.pause();
    }
    return sequence;
  }

  acknowledge(sequence: number): void {
    const chars = this.frames.get(sequence);
    if (chars === undefined) return;
    this.frames.delete(sequence);
    this.pending -= chars;
    if (this.paused && this.pending <= this.lowWatermark) {
      this.paused = false;
      this.pty.resume();
    }
  }

  reset(): void {
    this.frames.clear();
    this.pending = 0;
    if (this.paused) {
      this.paused = false;
      this.pty.resume();
    }
  }
}
