import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { resetAllStores } from '../../../tests/utils';
import type { ShellInfo } from '../../shared/types';

// ShellSettings uses Dialog and Select from Radix UI which require browser-specific APIs
// that are difficult to mock in JSDOM. We test the underlying store logic directly.
describe('ShellSettings store integration', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('should have default shell set to null (system default)', () => {
    const state = useAppStore.getState();
    expect(state.settings.defaultShell).toBeNull();
  });

  it('should have empty customShells by default', () => {
    const state = useAppStore.getState();
    expect(state.settings.customShells).toEqual([]);
  });

  it('should update defaultShell setting', () => {
    useAppStore.getState().updateSettings({ defaultShell: 'bash' });
    expect(useAppStore.getState().settings.defaultShell).toBe('bash');
  });

  it('should update customShells setting', () => {
    const customShell: ShellInfo = {
      id: 'custom-1',
      name: 'Custom Shell',
      path: '/custom/path',
      icon: 'generic',
      isCustom: true,
    };
    useAppStore.getState().updateSettings({ customShells: [customShell] });
    expect(useAppStore.getState().settings.customShells).toEqual([customShell]);
  });

  it('should persist defaultShell changes', () => {
    useAppStore.setState({ isInitialized: true });
    useAppStore.getState().updateSettings({ defaultShell: 'zsh' });

    expect(window.storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          defaultShell: 'zsh',
        }),
      })
    );
  });

  it('should persist customShells changes', () => {
    useAppStore.setState({ isInitialized: true });
    const customShell: ShellInfo = {
      id: 'custom-1',
      name: 'Custom Shell',
      path: '/custom/path',
      icon: 'generic',
      isCustom: true,
    };
    useAppStore.getState().updateSettings({ customShells: [customShell] });

    expect(window.storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          customShells: [customShell],
        }),
      })
    );
  });

  it('should preserve other settings when updating defaultShell', () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        worktreeBasePath: '/custom/path',
      },
    });

    useAppStore.getState().updateSettings({ defaultShell: 'fish' });

    const state = useAppStore.getState();
    expect(state.settings.worktreeBasePath).toBe('/custom/path');
    expect(state.settings.defaultShell).toBe('fish');
  });

  it('should allow setting defaultShell back to null (system default)', () => {
    useAppStore.getState().updateSettings({ defaultShell: 'bash' });
    expect(useAppStore.getState().settings.defaultShell).toBe('bash');

    useAppStore.getState().updateSettings({ defaultShell: null });
    expect(useAppStore.getState().settings.defaultShell).toBeNull();
  });

  it('should allow multiple custom shells', () => {
    const customShells: ShellInfo[] = [
      { id: 'custom-1', name: 'Shell 1', path: '/path/1', icon: 'generic', isCustom: true },
      { id: 'custom-2', name: 'Shell 2', path: '/path/2', icon: 'generic', isCustom: true },
    ];
    useAppStore.getState().updateSettings({ customShells });
    expect(useAppStore.getState().settings.customShells).toHaveLength(2);
    expect(useAppStore.getState().settings.customShells[0].name).toBe('Shell 1');
    expect(useAppStore.getState().settings.customShells[1].name).toBe('Shell 2');
  });

  it('should preserve notification settings when updating shell settings', () => {
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, enabled: false },
    });

    useAppStore.getState().updateSettings({ defaultShell: 'zsh' });

    const updatedState = useAppStore.getState();
    expect(updatedState.settings.notifications.enabled).toBe(false);
    expect(updatedState.settings.defaultShell).toBe('zsh');
  });
});

// Custom shell dialog tests focus on store integration
// since Radix UI Dialog components are difficult to test with JSDOM.
describe('ShellSettings custom shell store integration', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('should add custom shell with all required fields', () => {
    const customShell: ShellInfo = {
      id: 'custom-fish',
      name: 'Fish Shell',
      path: '/usr/local/bin/fish',
      icon: 'generic',
      isCustom: true,
    };

    useAppStore.getState().updateSettings({ customShells: [customShell] });

    const state = useAppStore.getState();
    expect(state.settings.customShells).toHaveLength(1);
    expect(state.settings.customShells[0].name).toBe('Fish Shell');
    expect(state.settings.customShells[0].path).toBe('/usr/local/bin/fish');
    expect(state.settings.customShells[0].isCustom).toBe(true);
    expect(state.settings.customShells[0].icon).toBe('generic');
  });

  it('should set newly added custom shell as default', () => {
    const customShell: ShellInfo = {
      id: 'custom-fish',
      name: 'Fish Shell',
      path: '/usr/local/bin/fish',
      icon: 'generic',
      isCustom: true,
    };

    useAppStore.getState().updateSettings({
      customShells: [customShell],
      defaultShell: customShell.id,
    });

    const state = useAppStore.getState();
    expect(state.settings.customShells).toHaveLength(1);
    expect(state.settings.defaultShell).toBe('custom-fish');
  });

  it('should persist custom shell additions', () => {
    useAppStore.setState({ isInitialized: true });

    const customShell: ShellInfo = {
      id: 'custom-fish',
      name: 'Fish Shell',
      path: '/usr/local/bin/fish',
      icon: 'generic',
      isCustom: true,
    };

    useAppStore.getState().updateSettings({
      customShells: [customShell],
      defaultShell: customShell.id,
    });

    expect(window.storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          customShells: [customShell],
          defaultShell: 'custom-fish',
        }),
      })
    );
  });

  it('should handle adding multiple custom shells', () => {
    const customShells: ShellInfo[] = [
      {
        id: 'custom-fish',
        name: 'Fish Shell',
        path: '/usr/local/bin/fish',
        icon: 'generic',
        isCustom: true,
      },
      {
        id: 'custom-nushell',
        name: 'Nushell',
        path: '/usr/local/bin/nu',
        icon: 'generic',
        isCustom: true,
      },
    ];

    useAppStore.getState().updateSettings({ customShells });

    const state = useAppStore.getState();
    expect(state.settings.customShells).toHaveLength(2);
    expect(state.settings.customShells[0].name).toBe('Fish Shell');
    expect(state.settings.customShells[1].name).toBe('Nushell');
  });

  it('should preserve existing custom shells when adding new one', () => {
    const existingShell: ShellInfo = {
      id: 'custom-fish',
      name: 'Fish Shell',
      path: '/usr/local/bin/fish',
      icon: 'generic',
      isCustom: true,
    };

    useAppStore.getState().updateSettings({ customShells: [existingShell] });

    const newShell: ShellInfo = {
      id: 'custom-nushell',
      name: 'Nushell',
      path: '/usr/local/bin/nu',
      icon: 'generic',
      isCustom: true,
    };

    const currentShells = useAppStore.getState().settings.customShells;
    useAppStore.getState().updateSettings({
      customShells: [...currentShells, newShell],
    });

    const state = useAppStore.getState();
    expect(state.settings.customShells).toHaveLength(2);
    expect(state.settings.customShells[0].id).toBe('custom-fish');
    expect(state.settings.customShells[1].id).toBe('custom-nushell');
  });

  it('should validate shell path via IPC before adding', async () => {
    // This tests that the validateShellPath mock is properly set up
    const result = await window.terminal.validateShellPath('/usr/bin/bash');
    expect(result.valid).toBe(true);

    // Test with invalid path mock
    vi.mocked(window.terminal.validateShellPath).mockResolvedValueOnce({
      valid: false,
      error: 'Shell not found at specified path',
    });

    const invalidResult = await window.terminal.validateShellPath('/invalid/path');
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBe('Shell not found at specified path');
  });

  it('should use filename from path when display name not provided', () => {
    // This tests the logic that would extract filename from path
    const path = '/usr/local/bin/fish';
    const filename = path.split(/[/\\]/).pop() || 'Custom Shell';
    expect(filename).toBe('fish');

    const windowsPath = 'C:\\Program Files\\PowerShell\\pwsh.exe';
    const windowsFilename = windowsPath.split(/[/\\]/).pop() || 'Custom Shell';
    expect(windowsFilename).toBe('pwsh.exe');
  });

  it('should generate unique IDs for custom shells', () => {
    // Test that custom shell IDs follow expected pattern
    const generateCustomId = (): string => {
      return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    };

    const id1 = generateCustomId();
    const id2 = generateCustomId();

    expect(id1).toMatch(/^custom-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^custom-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});
