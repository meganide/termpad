import { useEffect, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { PRESET_ICONS } from '../IconPicker';
import { Button } from '../ui/button';
import { useAppStore } from '../../stores/appStore';

interface EmptyTerminalStateProps {
  onCreateTab: (name?: string, command?: string, icon?: string) => void;
  /** Info about the default preset (name, command, icon) */
  defaultPreset?: {
    name: string;
    command: string;
    icon: string;
  };
}

export function EmptyTerminalState({ onCreateTab, defaultPreset }: EmptyTerminalStateProps) {
  const focusArea = useAppStore((state) => state.focusArea);

  // Handle Enter key to create a new tab with the default preset command
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only respond to Enter when mainTerminal is focused (not sidebar, etc.)
      if (focusArea !== 'mainTerminal') {
        return;
      }
      // Only respond to Enter without modifiers
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        // Don't respond if we're in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        // Use default preset name, command, and icon, or undefined for plain shell
        onCreateTab(defaultPreset?.name, defaultPreset?.command || undefined, defaultPreset?.icon);
      }
    },
    [onCreateTab, defaultPreset, focusArea]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Determine the preset display info
  const presetName = defaultPreset?.name ?? 'Terminal';
  const PresetIcon = PRESET_ICONS[defaultPreset?.icon ?? 'terminal'] ?? Terminal;

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-md px-8">
        <div className="rounded-full bg-primary/10 p-4">
          <Terminal className="h-12 w-12 text-primary" />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">No Terminal Tabs</h2>
          <p className="text-muted-foreground">Press Enter or click below to start {presetName}.</p>
        </div>

        <Button
          size="lg"
          onClick={() =>
            onCreateTab(
              defaultPreset?.name,
              defaultPreset?.command || undefined,
              defaultPreset?.icon
            )
          }
        >
          <PresetIcon className="mr-2 h-5 w-5" />
          Start {presetName}
        </Button>

        <p className="text-xs text-muted-foreground">
          Or use the + button in the tab bar to create a terminal
        </p>
      </div>
    </div>
  );
}
