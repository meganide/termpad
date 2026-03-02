import { Plus, Trash2, Terminal } from 'lucide-react';
import { Button } from '../ui/button';
import { ScriptInput, TERMPAD_VARIABLES } from './ScriptInput';
import { SETUP_SCRIPT_PLACEHOLDER } from './RepositorySettingsOverlay';
import { useAppStore } from '../../stores/appStore';
import type { RepositoryScriptsConfig, RepositoryScript } from '../../../shared/types';

// Map shell ID to display name
function getShellDisplayName(
  shellId: string | null,
  customShells: { id: string; name: string }[]
): string {
  if (!shellId) return 'System Default';

  // Check custom shells first
  const customShell = customShells.find((s) => s.id === shellId);
  if (customShell) return customShell.name;

  const id = shellId.toLowerCase();
  if (id.includes('powershell') || id.includes('pwsh')) return 'PowerShell';
  if (id.includes('cmd') || id === 'command prompt') return 'Command Prompt';
  if (id.includes('fish')) return 'Fish';
  if (id.includes('zsh')) return 'Zsh';
  if (id.includes('bash')) return 'Bash';
  if (id.includes('wsl')) return 'WSL';
  if (id.includes('git-bash')) return 'Git Bash';

  return shellId;
}

interface ScriptsSectionProps {
  scriptsConfig: RepositoryScriptsConfig;
  onUpdate: (updates: Partial<RepositoryScriptsConfig>) => void;
}

/**
 * ScriptsSection - Configures setup, run scripts, and cleanup scripts for a repository.
 *
 * Each script type has a description to guide users:
 * - Setup: Runs automatically when creating new worktrees
 * - Run: Execute common tasks with one click
 * - Cleanup: Runs after worktree deletion from repository root
 *
 * Uses ScriptInput for all script fields to highlight environment variables.
 */
export function ScriptsSection({ scriptsConfig, onUpdate }: ScriptsSectionProps) {
  const settings = useAppStore((state) => state.settings);
  const shellDisplayName = getShellDisplayName(settings.defaultShell, settings.customShells);

  const handleAddRunScript = () => {
    const newScript: RepositoryScript = {
      id: crypto.randomUUID(),
      name: '',
      command: '',
    };
    const isFirstScript = scriptsConfig.runScripts.length === 0;
    onUpdate({
      runScripts: [...scriptsConfig.runScripts, newScript],
      // Auto-select first script as default
      ...(isFirstScript ? { lastUsedRunScriptId: newScript.id } : {}),
    });
  };

  const handleUpdateRunScript = (index: number, updates: Partial<RepositoryScript>) => {
    const newScripts = [...scriptsConfig.runScripts];
    newScripts[index] = { ...newScripts[index], ...updates };
    onUpdate({ runScripts: newScripts });
  };

  const handleDeleteRunScript = (index: number) => {
    const deletedScript = scriptsConfig.runScripts[index];
    const newScripts = scriptsConfig.runScripts.filter((_, i) => i !== index);

    // If we're deleting the currently selected default script, select the next available one
    let newSelectedId = scriptsConfig.lastUsedRunScriptId;
    if (deletedScript && deletedScript.id === scriptsConfig.lastUsedRunScriptId) {
      // Try to get the script at the same index, or the previous one, or null
      newSelectedId =
        newScripts[index]?.id ?? newScripts[index - 1]?.id ?? newScripts[0]?.id ?? null;
    }

    onUpdate({
      runScripts: newScripts,
      lastUsedRunScriptId: newSelectedId,
    });
  };

  return (
    <section data-testid="scripts-section">
      <h2 className="text-lg font-semibold mb-4">Scripts</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Configure scripts that run automatically during worktree lifecycle events.
      </p>

      {/* Shell Info Note */}
      <div className="mb-4 p-3 rounded-lg bg-muted/40">
        <div className="flex items-start gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Scripts run using your selected shell from{' '}
            <span className="font-medium text-foreground">Settings → Terminal</span>
            {'. '}
            Currently: <span className="font-medium text-foreground">{shellDisplayName}</span>
          </p>
        </div>
      </div>

      {/* Environment Variables Helper */}
      <div className="mb-6 p-3 rounded-lg bg-muted/40">
        <p className="text-sm font-medium mb-2">Available Environment Variables</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          {TERMPAD_VARIABLES.map((variable) => (
            <li key={variable} className="font-mono">
              <span className="text-blue-400">{variable}</span>
              {variable === '$TERMPAD_WORKSPACE_NAME' && ' - Workspace name'}
              {variable === '$TERMPAD_WORKSPACE_PATH' && ' - Workspace path'}
              {variable === '$TERMPAD_ROOT_PATH' && ' - Repository root directory path'}
              {variable === '$TERMPAD_PORT' &&
                ' - Unique port for this worktree (100 ports available per repository)'}
            </li>
          ))}
        </ul>
      </div>

      {/* Setup Script */}
      <div className="mb-4 p-4 rounded-xl bg-secondary/60">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="setup-script">
            Setup Script
          </label>
          <p className="text-xs text-muted-foreground">
            Runs automatically when creating new worktrees. Use for installing dependencies, copying
            .env files, or other initialization tasks.
          </p>
          <ScriptInput
            value={scriptsConfig.setupScript || ''}
            onChange={(value) =>
              onUpdate({
                setupScript: value || null,
              })
            }
            placeholder={SETUP_SCRIPT_PLACEHOLDER}
            multiline
            data-testid="setup-script-input"
          />
        </div>
      </div>

      {/* Run Scripts */}
      <div className="mb-4 p-4 rounded-xl bg-secondary/60">
        <div className="space-y-2">
          <label className="text-sm font-medium">Run Scripts</label>
          <p className="text-xs text-muted-foreground">
            Execute common tasks with one click. Add multiple scripts for different actions like
            starting dev server, running tests, or building.
          </p>
          <div className="space-y-2">
            {scriptsConfig.runScripts.map((script, index) => (
              <div key={script.id} className="flex gap-2" data-testid={`run-script-${index}`}>
                <input
                  type="text"
                  value={script.name}
                  onChange={(e) => handleUpdateRunScript(index, { name: e.target.value })}
                  placeholder="Script name"
                  className="w-32 px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                  data-testid={`run-script-name-${index}`}
                />
                <div className="flex-1">
                  <ScriptInput
                    value={script.command}
                    onChange={(value) => handleUpdateRunScript(index, { command: value })}
                    placeholder="npm run dev"
                    data-testid={`run-script-command-${index}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteRunScript(index)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  data-testid={`run-script-delete-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddRunScript}
              className="flex items-center gap-1"
              data-testid="add-run-script-button"
            >
              <Plus className="h-4 w-4" />
              Add Script
            </Button>
          </div>
        </div>
      </div>

      {/* Cleanup Script */}
      <div className="p-4 rounded-xl bg-secondary/60">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="cleanup-script">
            Cleanup Script
          </label>
          <p className="text-xs text-muted-foreground">
            Runs after worktree deletion. Executes from the repository root directory (not the
            deleted worktree path). Use for cleaning up files outside the worktree directory (e.g.,
            cache directories, logs, or external artifacts).
          </p>
          <ScriptInput
            value={scriptsConfig.cleanupScript || ''}
            onChange={(value) =>
              onUpdate({
                cleanupScript: value || null,
              })
            }
            placeholder="docker-compose down"
            multiline
            data-testid="cleanup-script-input"
          />
        </div>
      </div>
    </section>
  );
}
