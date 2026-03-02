import { useState, useEffect, useRef } from 'react';
import { Link } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddRemoteDialogProps {
  open: boolean;
  onSubmit: (url: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const GIT_URL_PATTERNS = [
  // HTTPS URLs: https://github.com/user/repo.git or https://github.com/user/repo
  /^https?:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+(?:\.git)?$/,
  // SSH URLs: git@github.com:user/repo.git or git@github.com:user/repo
  /^git@[^\s:]+:[^\s/]+\/[^\s/]+(?:\.git)?$/,
  // SSH with protocol: ssh://git@github.com/user/repo.git
  /^ssh:\/\/git@[^\s/]+\/[^\s/]+\/[^\s/]+(?:\.git)?$/,
];

function isValidGitUrl(url: string): boolean {
  const trimmed = url.trim();
  return GIT_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function AddRemoteDialog({
  open,
  onSubmit,
  onCancel,
  isLoading = false,
}: AddRemoteDialogProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const prevOpenRef = useRef(open);

  // Reset form state when dialog opens (handles close/reopen cycle)
  // Track previous open state to detect when dialog transitions from closed to open
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    // Reset form when dialog opens after being closed
    if (open && !wasOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on dialog open
      setUrl('');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on dialog open
      setError(null);
    }
  }, [open]);

  const trimmedUrl = url.trim();
  const hasUrl = trimmedUrl.length > 0;
  const isValid = hasUrl && isValidGitUrl(trimmedUrl);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasUrl) {
      setError('URL is required');
      return;
    }

    if (!isValid) {
      setError('Please enter a valid git URL (HTTPS or SSH)');
      return;
    }

    try {
      await onSubmit(trimmedUrl);
      setUrl('');
      setError(null);
    } catch {
      // Error is handled by the caller
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setUrl('');
      setError(null);
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="add-remote-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="dialog-title">
              <Link className="size-5" />
              Add Remote
            </DialogTitle>
            <DialogDescription>
              Add a remote repository URL to enable push and pull operations.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="remote-url">Remote URL</Label>
              <Input
                id="remote-url"
                type="text"
                placeholder="https://github.com/user/repo.git"
                value={url}
                onChange={handleUrlChange}
                disabled={isLoading}
                aria-invalid={error !== null}
                data-testid="remote-url-input"
              />
              {error && (
                <p className="text-sm text-destructive" data-testid="url-error">
                  {error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Supports HTTPS and SSH URLs (e.g., git@github.com:user/repo.git)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!hasUrl || isLoading} data-testid="submit-button">
              {isLoading ? 'Adding...' : 'Add Remote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
