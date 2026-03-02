import { cn } from '@/lib/utils';
import { Comment } from './Comment';
import type { ReviewComment } from '../../../../shared/reviewTypes';

interface CommentThreadProps {
  comments: ReviewComment[];
  onDelete: (commentId: string) => void;
  onUpdate: (commentId: string, content: string) => void;
  onFixWithAI?: (comment: ReviewComment) => void;
  className?: string;
}

export function CommentThread({
  comments,
  onDelete,
  onUpdate,
  onFixWithAI,
  className,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return null;
  }

  // Sort comments by creation time
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className={cn('space-y-2 w-full', className)} data-testid="comment-thread">
      {sortedComments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onFixWithAI={onFixWithAI}
        />
      ))}
    </div>
  );
}
