import { useState } from 'react';
import { Copy, Download, Trash2, MessageCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useReviewStore } from '@/stores/reviewStore';

interface ReviewToolbarProps {
  onClearAll?: () => Promise<void>;
}

export function ReviewToolbar({ onClearAll }: ReviewToolbarProps = {}) {
  const [copied, setCopied] = useState(false);
  const commentCount = useReviewStore((s) => s.getCommentCount());
  const getFormattedCommentsMarkdown = useReviewStore((s) => s.getFormattedCommentsMarkdown);
  const getCommentsForExport = useReviewStore((s) => s.getCommentsForExport);
  const storeClearAllComments = useReviewStore((s) => s.clearAllComments);

  const handleCopy = async () => {
    const markdown = getFormattedCommentsMarkdown();
    if (!markdown) return;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExport = async () => {
    const comments = getCommentsForExport();
    if (comments.length === 0) return;

    try {
      await window.dialog.saveFile({
        title: 'Export Comments',
        defaultPath: 'review-comments.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        content: JSON.stringify(comments, null, 2),
      });
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const handleClear = async () => {
    if (onClearAll) {
      await onClearAll();
    } else {
      await storeClearAllComments();
    }
  };

  return (
    <div className="flex items-center gap-2" data-testid="review-toolbar">
      {/* Comment count */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground"
        data-testid="comment-count"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {/* Copy button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        disabled={commentCount === 0}
        data-testid="copy-button"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </>
        )}
      </Button>

      {/* Export button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExport}
        disabled={commentCount === 0}
        data-testid="export-button"
      >
        <Download className="h-4 w-4 mr-1" />
        Export
      </Button>

      {/* Clear button with confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={commentCount === 0}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            data-testid="clear-button"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all comments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {commentCount} comments. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
