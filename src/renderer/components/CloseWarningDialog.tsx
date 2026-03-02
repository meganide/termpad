import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Terminal } from 'lucide-react';

interface CloseWarningDialogProps {
  open: boolean;
  activeCount: number;
  onConfirm: (suppressFutureWarnings: boolean) => void;
  onCancel: () => void;
}

export function CloseWarningDialog({
  open,
  activeCount,
  onConfirm,
  onCancel,
}: CloseWarningDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    onConfirm(dontShowAgain);
    setDontShowAgain(false);
  };

  const handleCancel = () => {
    onCancel();
    setDontShowAgain(false);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2">
              <Terminal className="h-5 w-5 text-amber-500" />
            </div>
            <AlertDialogTitle>
              {activeCount} Active Terminal{activeCount > 1 ? 's' : ''}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left pt-2">
            You have {activeCount} terminal session{activeCount > 1 ? 's' : ''} still running.
            Closing the app will terminate all active sessions.
            <br />
            <br />
            Are you sure you want to close?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <label
            htmlFor="dont-show-again"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Don&apos;t show this warning again
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Keep Open</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Close Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
