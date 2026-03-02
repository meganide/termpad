import { useCallback } from 'react';
import { Copy, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  errorContent: string[];
  title?: string;
  description?: string;
  isPostHookFailure?: boolean;
}

export function ErrorDialog({
  open,
  onClose,
  errorContent,
  title = 'Commit Failed',
  description = 'The operation failed. See the full error output below.',
  isPostHookFailure = false,
}: ErrorDialogProps) {
  const handleCopy = useCallback(async () => {
    const fullText = errorContent.join('\n');
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success('Error copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [errorContent]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="error-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            {isPostHookFailure ? (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                <XCircle className="size-5" />
              </>
            ) : (
              <XCircle className="size-5" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-80 rounded border bg-muted/30" data-testid="error-content">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
            {errorContent.length > 0 ? errorContent.join('\n') : 'No error details available'}
          </pre>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="gap-2"
            data-testid="copy-button"
          >
            <Copy className="size-4" />
            Copy to Clipboard
          </Button>
          <Button onClick={onClose} data-testid="close-button">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
