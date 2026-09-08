import { describe, expect, it, vi } from 'vitest';
import { TerminalOutputFlow } from './terminalOutput';

describe('terminal output backpressure', () => {
  it('pauses a fast producer and resumes only after consumers catch up', () => {
    const pty = { pause: vi.fn(), resume: vi.fn() };
    const flow = new TerminalOutputFlow(pty, 100, 25);
    const first = flow.sent(60);
    const second = flow.sent(60);
    expect(pty.pause).toHaveBeenCalledOnce();
    flow.acknowledge(second);
    flow.acknowledge(second); // Duplicate acknowledgements must not drain other frames.
    flow.acknowledge(999);
    expect(pty.resume).not.toHaveBeenCalled();
    flow.acknowledge(first);
    expect(pty.resume).toHaveBeenCalledOnce();
    flow.sent(100);
    expect(pty.pause).toHaveBeenCalledTimes(2);
    flow.reset();
    expect(pty.resume).toHaveBeenCalledTimes(2);
    flow.acknowledge(first);
    expect(pty.resume).toHaveBeenCalledTimes(2);
  });
});
