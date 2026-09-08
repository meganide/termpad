import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReviewStore } from '@/stores/reviewStore';
import { FileDiff, type FileDiffProps } from './FileDiff';

interface ReviewFileProps extends Omit<
  FileDiffProps,
  | 'comments'
  | 'linesWithComments'
  | 'onToggleExpand'
  | 'onMarkViewed'
  | 'onCommentClick'
  | 'onLineMouseDown'
> {
  forceMount: boolean;
  onRegister: (path: string, element: HTMLDivElement | null) => void;
  onToggleExpand: (path: string) => void;
  onMarkViewed: (path: string) => void;
  onCommentClick: (path: string, line: number, side: 'old' | 'new') => void;
  onLineMouseDown: (path: string, line: number, side: 'old' | 'new') => void;
}

/** Keep drafts mounted once visited; defer React work for offscreen files. */
export const ReviewFile = memo(function ReviewFile({
  forceMount,
  onRegister,
  onToggleExpand,
  onMarkViewed,
  onCommentClick,
  onLineMouseDown,
  ...props
}: ReviewFileProps) {
  const filePath = props.file.path;
  const container = useRef<HTMLDivElement | null>(null);
  const [visited, setVisited] = useState(() => typeof IntersectionObserver === 'undefined');
  if (forceMount && !visited) setVisited(true);
  const ready = visited || forceMount;
  const register = useCallback(
    (element: HTMLDivElement | null) => {
      container.current = element;
      onRegister(filePath, element);
    },
    [filePath, onRegister]
  );

  useEffect(() => {
    if (ready || !container.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisited(true);
          observer.disconnect();
        }
      },
      { root: container.current.closest('[data-testid="diff-content-area"]'), rootMargin: '600px' }
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [ready, forceMount]);

  const comments = useReviewStore(useShallow((state) => state.getFileComments(filePath)));
  const linesWithComments = useMemo(() => {
    const lines = new Set<number>();
    for (const comment of comments) {
      for (let line = comment.lineStart; line <= comment.lineEnd; line++) lines.add(line);
    }
    return lines;
  }, [comments]);
  const toggle = useCallback(() => onToggleExpand(filePath), [onToggleExpand, filePath]);
  const mark = useCallback(() => onMarkViewed(filePath), [onMarkViewed, filePath]);
  const comment = useCallback(
    (line: number, side: 'old' | 'new') => onCommentClick(filePath, line, side),
    [onCommentClick, filePath]
  );
  const select = useCallback(
    (line: number, side: 'old' | 'new') => onLineMouseDown(filePath, line, side),
    [onLineMouseDown, filePath]
  );

  return (
    <div ref={register} className="[content-visibility:auto] [contain-intrinsic-size:auto_600px]">
      {ready ? (
        <FileDiff
          {...props}
          comments={comments}
          linesWithComments={linesWithComments}
          onToggleExpand={toggle}
          onMarkViewed={mark}
          onCommentClick={comment}
          onLineMouseDown={select}
        />
      ) : (
        <div className="min-h-40 p-4">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setVisited(true)}
          >
            {filePath}
          </button>
        </div>
      )}
    </div>
  );
});
