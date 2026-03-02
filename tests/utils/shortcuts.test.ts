import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CustomShortcut } from '../../src/shared/types';

// We need to test the module with different navigator.platform values
// So we'll need to mock it before importing

describe('shortcuts utility functions', () => {
  describe('formatShortcut', () => {
    describe('on Mac', () => {
      let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

      beforeEach(async () => {
        // Mock navigator.platform as Mac
        vi.stubGlobal('navigator', { platform: 'MacIntel' });
        // Re-import the module to pick up the new platform
        vi.resetModules();
        shortcuts = await import('../../src/renderer/utils/shortcuts');
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should format Ctrl+Shift+K with Mac symbols', () => {
        const shortcut: CustomShortcut = {
          key: 'k',
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('⌃⇧K');
      });

      it('should format Cmd+Option+S with Mac symbols', () => {
        const shortcut: CustomShortcut = {
          key: 's',
          ctrlKey: false,
          shiftKey: false,
          altKey: true,
          metaKey: true,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('⌥⌘S');
      });

      it('should format a single number key with modifier', () => {
        const shortcut: CustomShortcut = {
          key: '1',
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('⌃⇧1');
      });
    });

    describe('on Windows/Linux', () => {
      let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

      beforeEach(async () => {
        // Mock navigator.platform as Windows
        vi.stubGlobal('navigator', { platform: 'Win32' });
        vi.resetModules();
        shortcuts = await import('../../src/renderer/utils/shortcuts');
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should format Ctrl+Shift+K with text format', () => {
        const shortcut: CustomShortcut = {
          key: 'k',
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('Ctrl+Shift+K');
      });

      it('should format Alt+Win+S with text format', () => {
        const shortcut: CustomShortcut = {
          key: 's',
          ctrlKey: false,
          shiftKey: false,
          altKey: true,
          metaKey: true,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('Alt+Win+S');
      });

      it('should format Ctrl+Shift+1 with text format', () => {
        const shortcut: CustomShortcut = {
          key: '1',
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        };
        expect(shortcuts.formatShortcut(shortcut)).toBe('Ctrl+Shift+1');
      });
    });
  });

  describe('formatShortcutMac', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should format with all modifiers', () => {
      const shortcut: CustomShortcut = {
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      };
      expect(shortcuts.formatShortcutMac(shortcut)).toBe('⌃⌥⇧⌘A');
    });

    it('should handle key only', () => {
      const shortcut: CustomShortcut = {
        key: 'f',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.formatShortcutMac(shortcut)).toBe('F');
    });
  });

  describe('formatShortcutWindows', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should format with all modifiers', () => {
      const shortcut: CustomShortcut = {
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      };
      expect(shortcuts.formatShortcutWindows(shortcut)).toBe('Ctrl+Alt+Shift+Win+A');
    });

    it('should handle key only', () => {
      const shortcut: CustomShortcut = {
        key: 'f',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.formatShortcutWindows(shortcut)).toBe('F');
    });
  });

  describe('isShortcutBlocked', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should block Ctrl+C', () => {
      const shortcut: CustomShortcut = {
        key: 'c',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(true);
    });

    it('should block Ctrl+V', () => {
      const shortcut: CustomShortcut = {
        key: 'v',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(true);
    });

    it('should block Ctrl+Z', () => {
      const shortcut: CustomShortcut = {
        key: 'z',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(true);
    });

    it('should NOT block Ctrl+Shift+C (different modifiers)', () => {
      const shortcut: CustomShortcut = {
        key: 'c',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(false);
    });

    it('should NOT block Alt+C', () => {
      const shortcut: CustomShortcut = {
        key: 'c',
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(false);
    });

    it('should NOT block Ctrl+Shift+K (not in blocklist)', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(false);
    });

    it('should be case-insensitive for key', () => {
      const shortcut: CustomShortcut = {
        key: 'C', // uppercase
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.isShortcutBlocked(shortcut)).toBe(true);
    });
  });

  describe('hasModifier', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return true when ctrlKey is pressed', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.hasModifier(shortcut)).toBe(true);
    });

    it('should return true when shiftKey is pressed', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.hasModifier(shortcut)).toBe(true);
    });

    it('should return true when altKey is pressed', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        metaKey: false,
      };
      expect(shortcuts.hasModifier(shortcut)).toBe(true);
    });

    it('should return true when metaKey is pressed', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: true,
      };
      expect(shortcuts.hasModifier(shortcut)).toBe(true);
    });

    it('should return false when no modifier is pressed', () => {
      const shortcut: CustomShortcut = {
        key: 'k',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.hasModifier(shortcut)).toBe(false);
    });
  });

  describe('parseKeyboardEvent', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should parse a keyboard event correctly', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });

      const result = shortcuts.parseKeyboardEvent(event);
      expect(result).toEqual({
        key: 'k', // lowercase
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });

    it('should handle all modifiers', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      });

      const result = shortcuts.parseKeyboardEvent(event);
      expect(result).toEqual({
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: true,
      });
    });
  });

  describe('shortcutsEqual', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return true for identical shortcuts', () => {
      const a: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const b: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.shortcutsEqual(a, b)).toBe(true);
    });

    it('should return true for same key with different case', () => {
      const a: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const b: CustomShortcut = {
        key: 'K',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.shortcutsEqual(a, b)).toBe(true);
    });

    it('should return false for different keys', () => {
      const a: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const b: CustomShortcut = {
        key: 'j',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.shortcutsEqual(a, b)).toBe(false);
    });

    it('should return false for different modifiers', () => {
      const a: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      };
      const b: CustomShortcut = {
        key: 'k',
        ctrlKey: true,
        shiftKey: false, // different
        altKey: false,
        metaKey: false,
      };
      expect(shortcuts.shortcutsEqual(a, b)).toBe(false);
    });
  });

  describe('migrateOldShortcut', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should migrate "1" to Ctrl+Shift+1', () => {
      const result = shortcuts.migrateOldShortcut('1');
      expect(result).toEqual({
        key: '1',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });

    it('should migrate "k" to Ctrl+Shift+K', () => {
      const result = shortcuts.migrateOldShortcut('k');
      expect(result).toEqual({
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    });
  });

  describe('getDefaultShortcut', () => {
    let shortcuts: typeof import('../../src/renderer/utils/shortcuts');

    beforeEach(async () => {
      vi.stubGlobal('navigator', { platform: 'Win32' });
      vi.resetModules();
      shortcuts = await import('../../src/renderer/utils/shortcuts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return plain "1" (no modifiers) for index 1', () => {
      const result = shortcuts.getDefaultShortcut(1);
      expect(result).toEqual({
        key: '1',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
    });

    it('should return plain "9" (no modifiers) for index 9', () => {
      const result = shortcuts.getDefaultShortcut(9);
      expect(result).toEqual({
        key: '9',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      });
    });
  });
});
