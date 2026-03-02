import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-xl p-4 max-w-[85%] text-sm leading-relaxed',
          isUser
            ? 'bg-accent text-foreground'
            : 'bg-transparent',
          isError && 'bg-destructive/10'
        )}
      >
        {isError ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Something went wrong</span>
          </div>
        ) : isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
