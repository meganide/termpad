import { useCallback } from 'react';
import { isMac } from '../../utils/shortcuts';

interface OverviewShortcutsOptions {
  enabled: boolean;
  terminalIds: string[];
  activeTerminalId: string | null;
  columns: number;
  onFocus: (terminalId: string) => void;
  onOpen: (terminalId: string) => void;
  onClose: (terminalId: string) => void;
}

// Runs through the app's capture listener, before xterm receives keyboard input.
export function useOverviewShortcuts({
  enabled,
  terminalIds,
  activeTerminalId,
  columns,
  onFocus,
  onOpen,
  onClose,
}: OverviewShortcutsOptions) {
  return useCallback(
    (event: KeyboardEvent): boolean => {
      const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (!enabled || !modifier || event.altKey || event.isComposing || event.defaultPrevented)
        return false;
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
        )
      )
        return false;
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest('.xterm') &&
        target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]')
      )
        return false;

      const isArrow =
        !event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
      const isOpen = event.shiftKey && event.key === 'Enter';
      const isClose = !event.shiftKey && event.key === '-';
      if (!isArrow && !isOpen && !isClose) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (terminalIds.length === 0) return true;

      const index = activeTerminalId ? terminalIds.indexOf(activeTerminalId) : -1;
      if (isArrow) {
        let next = index;
        if (index < 0) next = 0;
        else if (event.key === 'ArrowLeft' && index % columns > 0) next--;
        else if (
          event.key === 'ArrowRight' &&
          index % columns < columns - 1 &&
          index + 1 < terminalIds.length
        )
          next++;
        else if (event.key === 'ArrowUp' && index >= columns) next -= columns;
        else if (
          event.key === 'ArrowDown' &&
          Math.floor(index / columns) < Math.floor((terminalIds.length - 1) / columns)
        ) {
          next = Math.min(index + columns, terminalIds.length - 1);
        }
        onFocus(terminalIds[next]);
      } else if (index >= 0 && !event.repeat) {
        if (isOpen) onOpen(terminalIds[index]);
        else onClose(terminalIds[index]);
      }
      return true;
    },
    [enabled, terminalIds, activeTerminalId, columns, onFocus, onOpen, onClose]
  );
}
