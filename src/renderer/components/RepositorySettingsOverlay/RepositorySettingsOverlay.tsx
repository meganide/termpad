import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, FileCode, Settings2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ScriptsSection } from './ScriptsSection';
import { AdvancedSection } from './AdvancedSection';
import type { RepositoryScriptsConfig } from '../../../shared/types';

interface RepositorySettingsOverlayProps {
  repositoryId: string;
  onClose: () => void;
}

type SettingsTab = 'scripts' | 'advanced';

const navItems: { id: SettingsTab; label: string; icon: typeof FileCode }[] = [
  { id: 'scripts', label: 'Scripts', icon: FileCode },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

// Placeholder setup script shown for inspiration (not used as default)
export const SETUP_SCRIPT_PLACEHOLDER = `# Copy .env file
cp $TERMPAD_ROOT_PATH/.env .env

# Install dependencies
npm install`;

function getDefaultScriptsConfig(): RepositoryScriptsConfig {
  return {
    setupScript: null,
    runScripts: [],
    cleanupScript: null,
    exclusiveMode: false,
    lastUsedRunScriptId: null,
  };
}

// Inner component that manages the form state
// Key on repositoryId to reset state when repository changes
function RepositorySettingsForm({ repositoryId, onClose }: RepositorySettingsOverlayProps) {
  const repositories = useAppStore((state) => state.repositories);
  const repository = repositories.find((r) => r.id === repositoryId);

  const [activeTab, setActiveTab] = useState<SettingsTab>('scripts');

  // Get current config from repository
  const scriptsConfig = useMemo(
    () => repository?.scriptsConfig || getDefaultScriptsConfig(),
    [repository?.scriptsConfig]
  );

  // Update scripts config and auto-save
  const updateScriptsConfig = useCallback(
    (updates: Partial<RepositoryScriptsConfig>) => {
      if (!repository) return;

      const newConfig = { ...scriptsConfig, ...updates };

      useAppStore.setState((state) => ({
        repositories: state.repositories.map((r) =>
          r.id === repositoryId ? { ...r, scriptsConfig: newConfig } : r
        ),
      }));

      // Persist to storage
      window.storage.saveState(useAppStore.getState());
    },
    [repository, repositoryId, scriptsConfig]
  );

  if (!repository) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background h-full">
        <p className="text-muted-foreground">Repository not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-background h-full" data-testid="repository-settings-overlay">
      {/* Left navigation panel */}
      <div className="w-48 flex flex-col bg-sidebar-panel">
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Back button at bottom - matches Add Repository footer height (57px) */}
        <div className="flex items-center px-3 py-2.5 bg-sidebar-panel">
          <button
            onClick={onClose}
            className="w-full h-9 flex items-center gap-2 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Header with repo name */}
        <div className="px-6 py-4">
          <h1 className="text-lg font-semibold truncate">{repository.name}</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {activeTab === 'scripts' && (
              <ScriptsSection
                repositoryId={repositoryId}
                scriptsConfig={scriptsConfig}
                onUpdate={updateScriptsConfig}
              />
            )}
            {activeTab === 'advanced' && (
              <AdvancedSection scriptsConfig={scriptsConfig} onUpdate={updateScriptsConfig} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that keys on repositoryId to reset form state when repository changes
export function RepositorySettingsOverlay(props: RepositorySettingsOverlayProps) {
  return <RepositorySettingsForm key={props.repositoryId} {...props} />;
}
