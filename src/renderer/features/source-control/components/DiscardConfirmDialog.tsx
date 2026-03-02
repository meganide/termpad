import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DiscardConfirmDialogProps {
  open: boolean;
  files: string[];
  onConfirm: (suppressFutureWarnings: boolean) => void;
  onCancel: () => void;
}

export function DiscardConfirmDialog({
  open,
  files,
  onConfirm,
  onCancel,
}: DiscardConfirmDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const isSingleFile = files.length === 1;
  const fileText = isSingleFile ? 'this file' : `these ${files.length} files`;

  const handleConfirm = () => {
    onConfirm(dontAskAgain);
    setDontAskAgain(false);
  };

  const handleCancel = () => {
    onCancel();
    setDontAskAgain(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <AlertDialogContent data-testid="discard-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Discard Changes
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to discard changes to {fileText}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {files.length > 0 && (
          <ScrollArea className="max-h-40 rounded-md border p-2">
            <ul className="space-y-1" data-testid="files-list">
              {files.map((file) => (
                <li
                  key={file}
                  className="font-mono text-xs text-muted-foreground truncate"
                  title={file}
                >
                  {file}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-ask-again"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            data-testid="dont-ask-checkbox"
          />
          <label
            htmlFor="dont-ask-again"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Don&apos;t ask me again
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="confirm-button"
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
