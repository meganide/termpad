import { useState, useEffect } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAppStore } from '../stores/appStore';
import { ShellIcon } from './ShellIcon';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import type { ShellInfo } from '../../shared/types';

// Constant for system default shell option
const SYSTEM_DEFAULT_ID = 'system-default';

export function ShellSettings() {
  const { settings, updateSettings } = useAppStore();
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Custom shell dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [customName, setCustomName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch available shells on mount
  useEffect(() => {
    let cancelled = false;
    const fetchShells = async () => {
      try {
        const availableShells = await window.terminal.getAvailableShells();
        if (!cancelled) {
          setShells(availableShells);
        }
      } catch (error) {
        console.error('Failed to fetch available shells:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchShells();
    return () => {
      cancelled = true;
    };
  }, []);

  // Combine detected shells with custom shells from settings
  const allShells = [...shells, ...settings.customShells];

  // Current value for the select (use system-default when defaultShell is null)
  const selectedValue = settings.defaultShell ?? SYSTEM_DEFAULT_ID;

  const handleShellChange = (value: string) => {
    // If system default is selected, set defaultShell to null
    const newShell = value === SYSTEM_DEFAULT_ID ? null : value;
    updateSettings({ defaultShell: newShell });
  };

  // Get the display name for a shell
  const getShellDisplayName = (shellId: string): string => {
    if (shellId === SYSTEM_DEFAULT_ID) {
      return 'System Default';
    }
    const shell = allShells.find((s) => s.id === shellId);
    return shell?.name ?? shellId;
  };

  // Get the icon for a shell
  const getShellIcon = (shellId: string): string => {
    if (shellId === SYSTEM_DEFAULT_ID) {
      return 'generic';
    }
    const shell = allShells.find((s) => s.id === shellId);
    return shell?.icon ?? 'generic';
  };

  // Generate a unique ID for custom shells
  const generateCustomId = (): string => {
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  // Reset dialog state
  const resetDialog = () => {
    setCustomPath('');
    setCustomName('');
    setValidationError(null);
    setIsValidating(false);
  };

  // Handle dialog open/close
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetDialog();
    }
    setDialogOpen(open);
  };

  // Handle deleting a custom shell
  const handleDeleteCustomShell = (shellId: string) => {
    const updatedCustomShells = settings.customShells.filter((s) => s.id !== shellId);
    // If the deleted shell was the default, reset to system default
    const newDefaultShell = settings.defaultShell === shellId ? null : settings.defaultShell;
    updateSettings({
      customShells: updatedCustomShells,
      defaultShell: newDefaultShell,
    });
  };

  // Handle adding a custom shell
  const handleAddCustomShell = async () => {
    if (!customPath.trim()) {
      setValidationError('Please enter a shell path');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await window.terminal.validateShellPath(customPath.trim());

      if (!result.valid) {
        setValidationError(result.error || 'Invalid shell path');
        setIsValidating(false);
        return;
      }

      // Create the custom shell info
      const shellName = customName.trim() || customPath.split(/[/\\]/).pop() || 'Custom Shell';
      const newShell: ShellInfo = {
        id: generateCustomId(),
        name: shellName,
        path: customPath.trim(),
        icon: 'generic',
        isCustom: true,
      };

      // Add to custom shells and select it
      const updatedCustomShells = [...settings.customShells, newShell];
      updateSettings({
        customShells: updatedCustomShells,
        defaultShell: newShell.id,
      });

      // Close dialog and reset
      handleDialogOpenChange(false);
    } catch (error) {
      setValidationError('Failed to validate shell path');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-0.5">
          <Label htmlFor="default-shell">Default Shell</Label>
          <p className="text-sm text-muted-foreground">
            Select the shell to use for new terminal sessions
          </p>
        </div>

        <Select value={selectedValue} onValueChange={handleShellChange} disabled={isLoading}>
          <SelectTrigger id="default-shell" className="w-full">
            <SelectValue placeholder={isLoading ? 'Loading shells...' : 'Select a shell'}>
              <span className="flex items-center gap-2">
                <ShellIcon shellId={getShellIcon(selectedValue)} size={16} />
                <span>{getShellDisplayName(selectedValue)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* System default option */}
            <SelectItem value={SYSTEM_DEFAULT_ID}>
              <span className="flex items-center gap-2">
                <ShellIcon shellId="generic" size={16} />
                <span>System Default</span>
              </span>
            </SelectItem>

            {/* Available shells */}
            {allShells.map((shell) => (
              <SelectItem key={shell.id} value={shell.id}>
                <span className="flex items-center gap-2 w-full">
                  <ShellIcon shellId={shell.icon} size={16} />
                  <span className="flex-1">{shell.name}</span>
                  {shell.isCustom && (
                    <span className="text-xs text-muted-foreground">(custom)</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom shell management buttons */}
        <div className="flex items-center gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Shell
          </Button>
          {/* Show delete button if current selection is a custom shell */}
          {settings.customShells.some((s) => s.id === settings.defaultShell) && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (settings.defaultShell) {
                  handleDeleteCustomShell(settings.defaultShell);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          )}
        </div>
      </div>

      {/* Add Custom Shell Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Shell</DialogTitle>
            <DialogDescription>
              Enter the path to a shell executable. The path will be validated before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-shell-path">Shell Path</Label>
              <Input
                id="custom-shell-path"
                placeholder="/usr/local/bin/fish"
                value={customPath}
                onChange={(e) => {
                  setCustomPath(e.target.value);
                  setValidationError(null);
                }}
                disabled={isValidating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-shell-name">Display Name (optional)</Label>
              <Input
                id="custom-shell-name"
                placeholder="Custom Shell"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={isValidating}
              />
              <p className="text-xs text-muted-foreground">
                If not provided, the filename will be used.
              </p>
            </div>

            {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCustomShell} disabled={isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Add Shell'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
