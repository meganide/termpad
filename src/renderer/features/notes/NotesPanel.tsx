import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';

interface NotesPanelProps {
  repositoryId: string;
  worktreeSessionId: string;
  repositoryName: string;
  worktreeLabel: string;
}

function useDebouncedSave(save: (value: string) => void, delayMs = 500) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedSave = useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => save(value), delayMs);
    },
    [save, delayMs]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debouncedSave;
}

function NoteTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedSave = useDebouncedSave(onChange);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedSave(newValue);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
      <label className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">
        {label}
      </label>
      <textarea
        className="flex-1 min-h-0 resize-none rounded-lg bg-obsidian-800/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        placeholder={`Write ${label.toLowerCase()} here...`}
        value={localValue}
        onChange={handleChange}
      />
    </div>
  );
}

export function NotesPanel({
  repositoryId,
  worktreeSessionId,
  repositoryName,
  worktreeLabel,
}: NotesPanelProps) {
  const { repositories, updateRepositoryNotes, updateWorktreeNotes } = useAppStore();

  const repository = repositories.find((r) => r.id === repositoryId);
  const worktree = repository?.worktreeSessions.find((ws) => ws.id === worktreeSessionId);

  const repoNotes = repository?.notes ?? '';
  const worktreeNotes = worktree?.notes ?? '';

  const handleRepoNotesChange = useCallback(
    (notes: string) => updateRepositoryNotes(repositoryId, notes),
    [repositoryId, updateRepositoryNotes]
  );

  const handleWorktreeNotesChange = useCallback(
    (notes: string) => updateWorktreeNotes(worktreeSessionId, notes),
    [worktreeSessionId, updateWorktreeNotes]
  );

  return (
    <div
      className="absolute inset-0 z-10 flex gap-3 p-3 bg-muted rounded-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <NoteTextarea
        label={`Repository: ${repositoryName}`}
        value={repoNotes}
        onChange={handleRepoNotesChange}
      />
      <NoteTextarea
        label={`Worktree: ${worktreeLabel}`}
        value={worktreeNotes}
        onChange={handleWorktreeNotesChange}
      />
    </div>
  );
}
