import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CommentCategory } from '../../../../shared/reviewTypes';

interface CommentInputProps {
  lineStart: number;
  lineEnd: number;
  side: 'old' | 'new';
  onSubmit: (category: CommentCategory, content: string) => void;
  onCancel: () => void;
}

const categories: { value: CommentCategory; label: string }[] = [
  { value: 'nitpick', label: 'Nitpick' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'issue', label: 'Issue' },
  { value: 'question', label: 'Question' },
];

const categoryStyles: Record<CommentCategory, string> = {
  nitpick: 'text-gray-500',
  suggestion: 'text-blue-500',
  issue: 'text-red-500',
  question: 'text-amber-500',
};

export function CommentInput({
  lineStart,
  lineEnd,
  side: _side,
  onSubmit,
  onCancel,
}: CommentInputProps) {
  const [category, setCategory] = useState<CommentCategory>('suggestion');
  const [content, setContent] = useState('');

  const lineRange = lineStart === lineEnd ? `Line ${lineStart}` : `Lines ${lineStart}-${lineEnd}`;

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(category, content.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Stop the native event from reaching AlertDialog's built-in ESC handler
      e.nativeEvent.stopImmediatePropagation();
      onCancel();
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-3 bg-background w-full',
        'border-border',
        'shadow-lg shadow-black/30'
      )}
      data-testid="comment-input"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Add comment</span>
          <span className="text-xs text-muted-foreground">{lineRange}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onCancel}
          data-testid="cancel-button"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Category selector */}
      <div className="mb-3">
        <Select value={category} onValueChange={(value) => setCategory(value as CommentCategory)}>
          <SelectTrigger className="w-full" data-testid="category-select">
            <SelectValue>
              <span className={categoryStyles[category]}>
                {categories.find((c) => c.value === category)?.label}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value} className={categoryStyles[cat.value]}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content textarea */}
      <div className="mb-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your comment..."
          className="min-h-[80px]"
          autoFocus
          data-testid="comment-textarea"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ctrl+Enter to add, Esc to cancel</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} data-testid="cancel-submit-button">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim()}
            data-testid="add-comment-button"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
