import { useState, useRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import { GitCommit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HookManifest } from '../../../../shared/types';

interface CommitSectionProps {
  stagedFilesCount: number;
  onCommit: (message: string) => Promise<void>;
  isLoading?: boolean;
  hookManifest?: HookManifest | null;
}

export function CommitSection({
  stagedFilesCount,
  onCommit,
  isLoading = false,
  hookManifest,
}: CommitSectionProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedMessage = message.trim();
  const canCommit = trimmedMessage.length > 0 && stagedFilesCount > 0 && !isLoading;

  // Build tooltip content showing detected commit hooks
  const tooltipContent = useMemo(() => {
    if (!hookManifest) return null;

    const commitHooks: string[] = [];
    if (hookManifest['pre-commit']) commitHooks.push('pre-commit');
    if (hookManifest['commit-msg']) commitHooks.push('commit-msg');
    if (hookManifest['post-commit']) commitHooks.push('post-commit');

    if (commitHooks.length === 0) return null;

    return (
      <>
        <p className="font-medium">Commit changes</p>
        <p className="text-xs text-muted-foreground">Hooks: {commitHooks.join(', ')}</p>
      </>
    );
  }, [hookManifest]);

  const handleCommit = useCallback(async () => {
    if (!canCommit) return;

    await onCommit(trimmedMessage);
    setMessage('');
  }, [canCommit, trimmedMessage, onCommit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter or Cmd+Enter to commit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit]
  );

  return (
    <div
      className="p-2 space-y-2 mx-2 mt-2 mb-2 rounded-lg bg-card/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
      data-testid="commit-section"
    >
      <Textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message"
        className={cn(
          'min-h-[80px] resize-none text-sm',
          'focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none focus-visible:border-input'
        )}
        disabled={isLoading}
        data-testid="commit-message-input"
      />
      {tooltipContent ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleCommit}
              disabled={!canCommit}
              className="w-full"
              size="sm"
              data-testid="commit-button"
            >
              <GitCommit className="size-4 mr-1.5" />
              {isLoading ? 'Committing...' : 'Commit'}
              {stagedFilesCount > 0 && !isLoading && (
                <span className="ml-1 text-xs opacity-70">
                  ({stagedFilesCount} file{stagedFilesCount !== 1 ? 's' : ''})
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          onClick={handleCommit}
          disabled={!canCommit}
          className="w-full"
          size="sm"
          data-testid="commit-button"
        >
          <GitCommit className="size-4 mr-1.5" />
          {isLoading ? 'Committing...' : 'Commit'}
          {stagedFilesCount > 0 && !isLoading && (
            <span className="ml-1 text-xs opacity-70">
              ({stagedFilesCount} file{stagedFilesCount !== 1 ? 's' : ''})
            </span>
          )}
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Press{' '}
        <kbd className="px-1 py-0.5 bg-muted/40 rounded text-[10px] font-mono shadow-[0_1px_0_1px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
          Ctrl+Enter
        </kbd>{' '}
        to commit
      </p>
    </div>
  );
}
