import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import type { TermpadConfigFile } from '../../shared/types';

/**
 * Converts a TermpadConfigFile to a stable JSON string for comparison.
 * Strips fields that are user-local (lastUsedRunScriptId) and normalizes
 * optional fields so that undefined and null compare equally.
 */
function configToComparableString(config: TermpadConfigFile): string {
  return JSON.stringify({
    setupScript: config.setupScript ?? null,
    runScripts: (config.runScripts ?? []).map((s) => ({
      name: s.name,
      command: s.command,
    })),
    cleanupScript: config.cleanupScript ?? null,
    exclusiveMode: config.exclusiveMode ?? false,
  });
}

/**
 * Converts the current RepositoryScriptsConfig to the same comparable format.
 */
function currentConfigToComparableString(
  scriptsConfig:
    | {
        setupScript: string | null;
        runScripts: { name: string; command: string }[];
        cleanupScript: string | null;
        exclusiveMode: boolean;
      }
    | undefined
): string {
  if (!scriptsConfig) {
    return configToComparableString({});
  }
  return JSON.stringify({
    setupScript: scriptsConfig.setupScript ?? null,
    runScripts: scriptsConfig.runScripts.map((s) => ({
      name: s.name,
      command: s.command,
    })),
    cleanupScript: scriptsConfig.cleanupScript ?? null,
    exclusiveMode: scriptsConfig.exclusiveMode ?? false,
  });
}

/**
 * Hook that manages termpad.json loading and change detection.
 *
 * On init: for each repository, loads termpad.json. If the repo has
 * no scripts config, auto-applies it. Otherwise stores a snapshot for diff detection.
 *
 * On file change: compares new config with current scripts config and marks
 * the repository as having updates if they differ.
 */
export function useTermpadConfig() {
  const repositories = useAppStore((state) => state.repositories);
  const isInitialized = useAppStore((state) => state.isInitialized);
  const applyTermpadConfig = useAppStore((state) => state.applyTermpadConfig);
  const setTermpadConfigUpdate = useAppStore((state) => state.setTermpadConfigUpdate);

  // Track which repos we've already done the initial load for
  const initializedReposRef = useRef<Set<string>>(new Set());

  // Initial load: check for termpad.json in each repository
  useEffect(() => {
    if (!isInitialized) return;

    for (const repository of repositories) {
      if (initializedReposRef.current.has(repository.id)) continue;
      initializedReposRef.current.add(repository.id);

      // Load config file asynchronously
      window.terminal.loadTermpadConfig(repository.path).then((config) => {
        if (!config) return;

        const currentRepo = useAppStore.getState().repositories.find((r) => r.id === repository.id);
        if (!currentRepo) return;

        // If repo has no scripts config at all, auto-apply the shared config
        const hasScripts =
          currentRepo.scriptsConfig &&
          (currentRepo.scriptsConfig.setupScript ||
            currentRepo.scriptsConfig.runScripts.length > 0 ||
            currentRepo.scriptsConfig.cleanupScript);

        if (!hasScripts) {
          console.log(`[useTermpadConfig] Auto-applying termpad.json for ${repository.name}`);
          applyTermpadConfig(repository.id, config);
        } else {
          // Check if current config differs from the file
          const fileStr = configToComparableString(config);
          const currentStr = currentConfigToComparableString(currentRepo.scriptsConfig);
          if (fileStr !== currentStr) {
            setTermpadConfigUpdate(repository.id, true);
          }
        }
      });
    }

    // Clean up tracked repos that were removed
    for (const repoId of initializedReposRef.current) {
      if (!repositories.some((r) => r.id === repoId)) {
        initializedReposRef.current.delete(repoId);
      }
    }
  }, [repositories, isInitialized, applyTermpadConfig, setTermpadConfigUpdate]);

  // Listen for config file changes
  useEffect(() => {
    if (!isInitialized) return;

    const unsubConfigChanged = window.watcher.onConfigChanged((repositoryId: string) => {
      const repository = useAppStore.getState().repositories.find((r) => r.id === repositoryId);
      if (!repository) return;

      // Reload the config file and check for diffs
      window.terminal.loadTermpadConfig(repository.path).then((config) => {
        if (!config) {
          // Config file was deleted, clear any pending update
          setTermpadConfigUpdate(repositoryId, false);
          return;
        }

        const currentRepo = useAppStore.getState().repositories.find((r) => r.id === repositoryId);
        if (!currentRepo) return;

        const fileStr = configToComparableString(config);
        const currentStr = currentConfigToComparableString(currentRepo.scriptsConfig);
        const hasDiff = fileStr !== currentStr;
        setTermpadConfigUpdate(repositoryId, hasDiff);
      });
    });

    return () => {
      unsubConfigChanged();
    };
  }, [isInitialized, setTermpadConfigUpdate]);
}
