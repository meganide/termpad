import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOverviewShortcuts } from './useOverviewShortcuts';

const platform = vi.hoisted(() => ({ isMac: false }));
vi.mock('../../utils/shortcuts', () => ({
  get isMac() {
    return platform.isMac;
  },
}));

describe.each([false, true])('overview shortcuts (Mac: %s)', (mac) => {
  const setup = (activeTerminalId: string | null = 'b', enabled = true) => {
    platform.isMac = mac;
    const options = {
      enabled,
      terminalIds: ['a', 'b', 'd', 'e', 'f'],
      activeTerminalId,
      columns: 3,
      onFocus: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
    };
    const { result } = renderHook(() => useOverviewShortcuts(options));
    const key = (key: string, extra: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', {
        key,
        cancelable: true,
        [mac ? 'metaKey' : 'ctrlKey']: true,
        ...extra,
      });
      return { handled: result.current(event), event };
    };
    return { ...options, key };
  };

  it('moves by grid row and column using only visible agent IDs', () => {
    const { key, onFocus } = setup();
    expect(key('ArrowDown').event.defaultPrevented).toBe(true);
    expect(onFocus).toHaveBeenLastCalledWith('f');
    key('ArrowRight');
    expect(onFocus).toHaveBeenLastCalledWith('d');
    key('ArrowLeft');
    expect(onFocus).toHaveBeenLastCalledWith('a');
  });

  it('stays at grid edges and selects the first agent when selection is filtered out', () => {
    const edge = setup('d');
    edge.key('ArrowRight');
    expect(edge.onFocus).toHaveBeenLastCalledWith('d');
    edge.key('ArrowDown');
    expect(edge.onFocus).toHaveBeenLastCalledWith('f');
    const missing = setup('hidden');
    missing.key('ArrowLeft');
    expect(missing.onFocus).toHaveBeenCalledWith('a');
    missing.key('-');
    expect(missing.onClose).not.toHaveBeenCalled();
  });

  it('opens and closes the selected agent but ignores repeats and ordinary terminal keys', () => {
    const { key, onOpen, onClose } = setup();
    key('Enter', { shiftKey: true });
    expect(onOpen).toHaveBeenCalledWith('b');
    key('-');
    key('-', { repeat: true });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(key('ArrowRight', { metaKey: false, ctrlKey: false }).handled).toBe(false);
    expect(key('Enter').handled).toBe(false);
    expect(key('-', { altKey: true }).handled).toBe(false);
    expect(setup('a', false).key('ArrowRight').handled).toBe(false);
  });
});
