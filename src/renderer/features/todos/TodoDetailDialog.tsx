import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import type { TodoItem } from '../../../shared/types';
import { PRIORITY_STYLES } from './priority';

interface TodoDetailDialogProps {
  todo: TodoItem;
  onClose: () => void;
  onSave: (text: string) => void;
}

// Mounted only while open, so the draft always starts from the current text
export function TodoDetailDialog({ todo, onClose, onSave }: TodoDetailDialogProps) {
  const [draft, setDraft] = useState(todo.text);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== todo.text;

  const handleSave = () => {
    if (canSave) onSave(trimmed);
    onClose();
  };

  const priorityStyle = todo.priority ? PRIORITY_STYLES[todo.priority] : undefined;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="todo-detail-dialog">
        <DialogHeader>
          <DialogTitle>Todo</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {priorityStyle && (
              <span className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${priorityStyle.dot}`} />
                {priorityStyle.label}
              </span>
            )}
            <span>Created {format(new Date(todo.createdAt), 'PPp')}</span>
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleSave();
            }
          }}
          aria-label="Todo text"
          className="min-h-60 resize-none rounded-lg border-obsidian-400 bg-obsidian-800/60 text-sm focus-visible:border-primary"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
