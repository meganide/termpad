import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useAppStore } from '../stores/appStore';
import type { WorktreeSession, CustomShortcut } from '../../shared/types';
import {
  formatShortcut,
  isShortcutBlocked,
  parseKeyboardEvent,
  shortcutsEqual,
} from '../utils/shortcuts';

interface AssignShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorktreeSession | null;
}

type ValidationError = 'blocked' | null;

export function AssignShortcutDialog({ open, onOpenChange, session }: AssignShortcutDialogProps) {
  // Initialize state based on whether dialog is open and session exists
  const initialShortcut = open ? (session?.customShortcut ?? null) : null;
  const [capturedShortcut, setCapturedShortcut] = useState<CustomShortcut | null>(initialShortcut);
  const [conflictSession, setConflictSession] = useState<WorktreeSession | null>(null);
  const [validationError, setValidationError] = useState<ValidationError>(null);
  const { repositories, updateWorktreeSessionShortcut } = useAppStore();

  // Reset state when dialog opens (using key prop pattern would be better, but this is a fix)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCapturedShortcut(session?.customShortcut ?? null);
      setConflictSession(null);
      setValidationError(null);
    }
  }

  // Check for conflicts with existing shortcuts
  const checkConflict = useCallback(
    (shortcut: CustomShortcut): WorktreeSession | null => {
      for (const repository of repositories) {
        for (const s of repository.worktreeSessions) {
          if (
            s.id !== session?.id &&
            s.customShortcut &&
            shortcutsEqual(s.customShortcut, shortcut)
          ) {
            return s;
          }
        }
      }
      return null;
    },
    [repositories, session?.id]
  );

  // Listen for key presses
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier-only key presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      // Ignore Escape (let dialog handle it)
      if (e.key === 'Escape') return;

      e.preventDefault();
      e.stopPropagation();

      const shortcut = parseKeyboardEvent(e);

      // Validate against blocklist
      if (isShortcutBlocked(shortcut)) {
        setValidationError('blocked');
        setCapturedShortcut(shortcut);
        setConflictSession(null);
        return;
      }

      setValidationError(null);
      setCapturedShortcut(shortcut);

      // Check for conflicts
      const conflict = checkConflict(shortcut);
      setConflictSession(conflict);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [open, checkConflict]);

  const handleSave = () => {
    if (!session || !capturedShortcut || validationError) return;

    // If there's a conflict, clear the other session's shortcut
    if (conflictSession) {
      updateWorktreeSessionShortcut(conflictSession.id, undefined);
    }

    updateWorktreeSessionShortcut(session.id, capturedShortcut);
    onOpenChange(false);
  };

  const handleClear = () => {
    if (!session) return;
    updateWorktreeSessionShortcut(session.id, undefined);
    onOpenChange(false);
  };

  const canSave = capturedShortcut && !validationError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Keyboard Shortcut</DialogTitle>
          <DialogDescription>Press a key combination to assign as a shortcut</DialogDescription>
        </DialogHeader>

        <div className="py-6 text-center">
          {capturedShortcut ? (
            <div className="text-3xl font-mono font-bold text-foreground">
              {formatShortcut(capturedShortcut)}
            </div>
          ) : (
            <div className="text-lg text-muted-foreground">Press a key combination to capture</div>
          )}

          {validationError === 'blocked' && (
            <p className="mt-4 text-sm text-destructive">
              This shortcut is reserved for system use and cannot be assigned.
            </p>
          )}

          {conflictSession && !validationError && (
            <p className="mt-4 text-sm text-amber-500">
              This shortcut is already assigned to &quot;{conflictSession.label}&quot;. Saving will
              reassign it.
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          {session?.customShortcut && (
            <Button variant="outline" onClick={handleClear}>
              Clear Shortcut
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
