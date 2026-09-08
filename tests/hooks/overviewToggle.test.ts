import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../../src/renderer/hooks/useKeyboardShortcuts';

const platform = vi.hoisted(() => ({ isMac: false }));
vi.mock('../../src/renderer/utils/shortcuts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/renderer/utils/shortcuts')>()),
  get isMac() {
    return platform.isMac;
  },
}));

describe.each([false, true])('overview toggle (Mac: %s)', (mac) => {
  it('opens the current repository overview with the platform modifier and I', () => {
    platform.isMac = mac;
    const onOpenRepositoryOverview = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onOpenRepositoryOverview }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', metaKey: !mac, ctrlKey: mac }));
    expect(onOpenRepositoryOverview).not.toHaveBeenCalled();
    const event = new KeyboardEvent('keydown', {
      key: 'i',
      cancelable: true,
      metaKey: mac,
      ctrlKey: !mac,
    });
    const input = document.createElement('textarea');
    input.className = 'xterm';
    const terminalHandler = vi.fn();
    input.addEventListener('keydown', terminalHandler);
    document.body.appendChild(input);
    try {
      input.focus();
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(terminalHandler).not.toHaveBeenCalled();
      expect(onOpenRepositoryOverview).toHaveBeenCalledTimes(1);
    } finally {
      input.remove();
    }
  });

  it('uses the platform modifier and leaves the other modifier alone', () => {
    platform.isMac = mac;
    const onToggleOverview = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onToggleOverview }));
    const correct = new KeyboardEvent('keydown', {
      key: 'o',
      cancelable: true,
      metaKey: mac,
      ctrlKey: !mac,
    });
    window.dispatchEvent(correct);
    expect(correct.defaultPrevented).toBe(true);
    expect(onToggleOverview).toHaveBeenCalledTimes(1);
    const other = new KeyboardEvent('keydown', {
      key: 'o',
      cancelable: true,
      metaKey: !mac,
      ctrlKey: mac,
    });
    window.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(onToggleOverview).toHaveBeenCalledTimes(1);
  });
});
