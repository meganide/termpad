import { useEffect, useState, useCallback } from 'react';
import type { UpdateStatus } from '../../shared/types';

const initialStatus: UpdateStatus = {
  status: 'idle',
  currentVersion: '',
  availableVersion: null,
  progress: null,
  error: null,
  supportsAutoUpdate: true,
};

export function useAutoUpdater() {
  const [status, setStatus] = useState<UpdateStatus>(initialStatus);

  // Listen for status changes from main process
  useEffect(() => {
    // Check if updater API is available (only in packaged app)
    if (!window.updater) {
      return;
    }

    // Get initial status
    window.updater.getStatus().then(setStatus).catch(console.error);

    // Subscribe to status changes
    const unsubscribe = window.updater.onStatusChange(setStatus);

    return unsubscribe;
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!window.updater) return;
    try {
      await window.updater.checkForUpdates();
    } catch (error) {
      console.error('[useAutoUpdater] Failed to check for updates:', error);
    }
  }, []);

  // Download the update
  const downloadUpdate = useCallback(async () => {
    if (!window.updater) return;
    try {
      await window.updater.downloadUpdate();
    } catch (error) {
      console.error('[useAutoUpdater] Failed to download update:', error);
    }
  }, []);

  // Install the update (will restart the app)
  const installUpdate = useCallback(() => {
    if (!window.updater) return;
    window.updater.installUpdate();
  }, []);

  // Dismiss the update notification
  const dismissUpdate = useCallback(() => {
    if (!window.updater) return;
    window.updater.dismissUpdate();
  }, []);

  return {
    status,
    isUpdateAvailable: status.status === 'available',
    isDownloading: status.status === 'downloading',
    isUpdateReady: status.status === 'ready',
    isChecking: status.status === 'checking',
    hasError: status.status === 'error',
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  };
}
