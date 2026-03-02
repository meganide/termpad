import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../stores/appStore';
import { resetAllStores } from '../../../tests/utils';

// NotificationSettings uses Switch from Radix UI which requires browser-specific APIs
// that are difficult to mock in JSDOM. We test the underlying store logic directly.
describe('NotificationSettings store integration', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('should have default notification settings', () => {
    const state = useAppStore.getState();
    expect(state.settings.notifications).toEqual({
      enabled: true,
      backgroundOnly: true,
      cooldownMs: 8000,
    });
  });

  it('should update enabled setting', () => {
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, enabled: false },
    });

    expect(useAppStore.getState().settings.notifications.enabled).toBe(false);
  });

  it('should update backgroundOnly setting', () => {
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, backgroundOnly: false },
    });

    expect(useAppStore.getState().settings.notifications.backgroundOnly).toBe(false);
  });

  it('should update cooldownMs setting', () => {
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, cooldownMs: 15000 },
    });

    expect(useAppStore.getState().settings.notifications.cooldownMs).toBe(15000);
  });

  it('should persist notification settings changes', () => {
    // Mark store as initialized so persistence works
    useAppStore.setState({ isInitialized: true });
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, enabled: false },
    });

    expect(window.storage.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          notifications: expect.objectContaining({
            enabled: false,
          }),
        }),
      })
    );
  });

  it('should preserve other notification settings when updating one', () => {
    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, enabled: false },
    });

    const updatedState = useAppStore.getState();
    expect(updatedState.settings.notifications.backgroundOnly).toBe(true);
    expect(updatedState.settings.notifications.cooldownMs).toBe(8000);
  });

  it('should preserve other settings when updating notifications', () => {
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        worktreeBasePath: '/custom/path',
      },
    });

    const state = useAppStore.getState();
    useAppStore.getState().updateSettings({
      notifications: { ...state.settings.notifications, enabled: false },
    });

    const updatedState = useAppStore.getState();
    expect(updatedState.settings.worktreeBasePath).toBe('/custom/path');
  });
});
