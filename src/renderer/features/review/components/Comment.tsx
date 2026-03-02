import { useState } from 'react';
import { Trash2, Edit2, Check, X, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ReviewComment, CommentCategory } from '../../../../shared/reviewTypes';

interface CommentProps {
  comment: ReviewComment;
  onDelete: (commentId: string) => void;
  onUpdate: (commentId: string, content: string) => void;
  onFixWithAI?: (comment: ReviewComment) => void;
}

const categoryStyles: Record<CommentCategory, { bg: string; text: string; label: string }> = {
  nitpick: { bg: 'bg-gray-500/20', text: 'text-gray-500', label: 'Nitpick' },
  suggestion: { bg: 'bg-blue-500/20', text: 'text-blue-500', label: 'Suggestion' },
  issue: { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Issue' },
  question: { bg: 'bg-amber-500/20', text: 'text-amber-500', label: 'Question' },
};

export function Comment({ comment, onDelete, onUpdate, onFixWithAI }: CommentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const style = categoryStyles[comment.category];
  const lineRange =
    comment.lineStart === comment.lineEnd
      ? `Line ${comment.lineStart}`
      : `Lines ${comment.lineStart}-${comment.lineEnd}`;

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onUpdate(comment.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className="border rounded-lg p-3 bg-background shadow-md shadow-black/20"
      data-testid="comment"
      data-comment-id={comment.id}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Category badge */}
        <span
          className={cn('text-xs px-2 py-0.5 rounded-full font-medium', style.bg, style.text)}
          data-testid="comment-category"
        >
          {style.label}
        </span>

        {/* Line range */}
        <span className="text-xs text-muted-foreground" data-testid="comment-line-range">
          {lineRange}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            {onFixWithAI && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onFixWithAI(comment)}
                    data-testid="fix-with-ai-button"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Fix
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fix with AI</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsEditing(true)}
                  data-testid="edit-button"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit comment</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => onDelete(comment.id)}
                  data-testid="delete-button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete comment</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] text-sm"
            autoFocus
            data-testid="edit-textarea"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7"
              onClick={handleSaveEdit}
              disabled={!editContent.trim()}
              data-testid="save-edit-button"
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleCancelEdit}
              data-testid="cancel-edit-button"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">Ctrl+Enter to save, Esc to cancel</span>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap" data-testid="comment-content">
          {comment.content}
        </p>
      )}
    </div>
  );
}
