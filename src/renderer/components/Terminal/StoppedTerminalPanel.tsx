import { useEffect } from 'react';
import { Play, Terminal } from 'lucide-react';
import { Button } from '../ui/button';
import type { WorktreeSession } from '../../../shared/types';

interface StoppedTerminalPanelProps {
  session: WorktreeSession;
  onStart: () => void;
}

export function StoppedTerminalPanel({ session, onStart }: StoppedTerminalPanelProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-background text-foreground">
      <div className="mb-6 p-4 rounded-full bg-muted">
        <Terminal className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="mb-8 text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">{session.label}</h2>
        {session.branchName && (
          <p className="text-sm text-muted-foreground mb-1">Branch: {session.branchName}</p>
        )}
        <p className="text-sm text-muted-foreground font-mono truncate px-4">{session.path}</p>
      </div>
      <Button onClick={onStart} size="lg" className="gap-2">
        <Play className="h-5 w-5" />
        Start Terminal
      </Button>
      <p className="mt-4 text-sm text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd> to start
      </p>
    </div>
  );
}
