import { useImperativeHandle, useRef, useState, type ReactElement, type Ref } from 'react';
import { X, Maximize2, Copy, ClipboardPaste, EyeOff } from 'lucide-react';
import type { TerminalStatus } from '../../../shared/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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

export interface AgentTileActionsHandle {
  requestClose: () => void;
}

interface AgentTileActionsProps {
  actionsRef?: Ref<AgentTileActionsHandle>;
  enabled: boolean;
  children: ReactElement;
  tabName: string;
  status: TerminalStatus;
  onSelect: () => void;
  onClose: () => void;
  onRestoreFocus: () => void;
  onMenuOpen?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onHide?: () => void;
  selectLabel: string;
}

// Keep this wrapper mounted in every layout so its terminal child never remounts.
export function AgentTileActions({
  actionsRef,
  enabled,
  children,
  tabName,
  status,
  onSelect,
  onClose,
  onRestoreFocus,
  onMenuOpen,
  onCopy,
  onPaste,
  onHide,
  selectLabel,
}: AgentTileActionsProps) {
  const [confirmClose, setConfirmClose] = useState(false);
  const navigating = useRef(false);

  const attemptClose = () => {
    onMenuOpen?.();
    if (status === 'running' || status === 'waiting' || status === 'starting') {
      setConfirmClose(true);
    } else {
      onClose();
    }
  };

  useImperativeHandle(actionsRef, () => ({ requestClose: attemptClose }));

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) {
            navigating.current = false;
            onMenuOpen?.();
          }
        }}
      >
        <ContextMenuTrigger asChild disabled={!enabled}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent
          onClick={(event) => event.stopPropagation()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!confirmClose && !navigating.current) onRestoreFocus();
          }}
        >
          <ContextMenuItem
            onSelect={() => {
              navigating.current = true;
              onSelect();
            }}
          >
            <Maximize2 className="h-4 w-4" />
            {selectLabel}
          </ContextMenuItem>
          {(onCopy || onPaste) && <ContextMenuSeparator />}
          {onCopy && (
            <ContextMenuItem onSelect={onCopy}>
              <Copy className="h-4 w-4" />
              Copy
            </ContextMenuItem>
          )}
          {onPaste && (
            <ContextMenuItem onSelect={onPaste}>
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          {onHide && (
            <ContextMenuItem
              onSelect={() => {
                navigating.current = true;
                onHide();
              }}
            >
              <EyeOff className="h-4 w-4" />
              Hide from overview
            </ContextMenuItem>
          )}
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
            onRestoreFocus();
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
