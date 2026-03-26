import { Checkbox } from '../ui/checkbox';
import type { RepositoryScriptsConfig } from '../../../shared/types';

interface AdvancedSectionProps {
  scriptsConfig: RepositoryScriptsConfig;
  onUpdate: (updates: Partial<RepositoryScriptsConfig>) => void;
}

/**
 * AdvancedSection - Contains advanced settings for repository scripts.
 *
 * Currently includes:
 * - Exclusive Mode: When enabled, running a script kills any existing instances of that
 *   same script across all worktrees in the repository.
 */
export function AdvancedSection({ scriptsConfig, onUpdate }: AdvancedSectionProps) {
  return (
    <section data-testid="advanced-section" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Advanced</h2>
        <p className="text-sm text-muted-foreground">
          Additional configuration options for script behavior.
        </p>
      </div>

      {/* Exclusive Mode */}
      <div className="p-4 rounded-xl bg-secondary/60">
        <div className="flex items-start gap-3">
          <Checkbox
            id="exclusive-mode"
            checked={scriptsConfig.exclusiveMode}
            onCheckedChange={(checked) => onUpdate({ exclusiveMode: checked === true })}
            className="mt-0.5 border-muted-foreground/60"
            data-testid="exclusive-mode-checkbox"
          />
          <div className="space-y-1">
            <label htmlFor="exclusive-mode" className="text-sm font-medium cursor-pointer">
              Exclusive Mode
            </label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When enabled, running a script will automatically kill any existing instances of that
              same script across all worktrees in this repository. Use this when your dev servers
              compete for the same port. If your tooling supports port configuration, use{' '}
              <code className="text-blue-400">$TERMPAD_PORT</code> in your run scripts instead.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
