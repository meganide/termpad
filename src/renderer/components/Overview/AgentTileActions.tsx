import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { TerminalStatus } from '../../../shared/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface AgentTileActionsProps {
  terminalId: string;
  label: string;
  tabName: string;
  status: TerminalStatus;
  onSelect: () => void;
  onClose: () => void;
}

export function AgentTileActions({
  terminalId,
  label,
  tabName,
  status,
  onSelect,
  onClose,
}: AgentTileActionsProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const attemptClose = () => {
    // Match the tab bar's confirmation for processes that are still active.
    if (status === 'running' || status === 'waiting' || status === 'starting') {
      setConfirmClose(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            data-overview-terminal-id={terminalId}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            onContextMenu={(event) => event.currentTarget.focus({ preventScroll: true })}
            aria-label={label}
            className="absolute inset-0 z-10 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          />
        </ContextMenuTrigger>
        <ContextMenuContent
          onClick={(event) => event.stopPropagation()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!confirmClose) buttonRef.current?.focus({ preventScroll: true });
          }}
        >
          <ContextMenuItem variant="destructive" onSelect={attemptClose}>
            <X className="h-4 w-4" />
            Close
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent
          onClick={(event) => event.stopPropagation()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus({ preventScroll: true });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Close Running Terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              Process &quot;{tabName}&quot; is running. Close anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
