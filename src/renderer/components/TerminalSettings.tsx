import { ShellSettings } from './ShellSettings';
import { TerminalPresetsSettings } from './TerminalPresetsSettings';

/**
 * Terminal settings panel containing shell configuration and terminal presets
 */
export function TerminalSettings() {
  return (
    <div className="space-y-8">
      <ShellSettings />
      <TerminalPresetsSettings />
    </div>
  );
}
