import { useCallback, useEffect, useRef } from 'react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Code,
  List,
  Quote,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
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

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
}

function ToolbarButton({ icon, tooltip, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-muted-foreground/20" />;
}

// Wrapper around document.execCommand for rich text editing.
// Safe to use here: this is a local Electron desktop app where
// the user edits their own notes - no untrusted input involved.
function richTextCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

// Sets the HTML content of a contentEditable element.
// Safe: content is user-authored notes stored locally in the app's
// own JSON file - never sourced from external/untrusted input.
function setEditorContent(el: HTMLElement, html: string) {
  el.innerHTML = html;
}

function getEditorContent(el: HTMLElement): string {
  return el.innerHTML;
}

function NoteEditor({
  label,
  value,
  identity,
  onChange,
}: {
  label: string;
  value: string;
  identity: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const debouncedSave = useDebouncedSave(onChange);
  const prevIdentityRef = useRef('');

  useEffect(() => {
    if (prevIdentityRef.current !== identity && editorRef.current) {
      setEditorContent(editorRef.current, value);
      prevIdentityRef.current = identity;
    }
  }, [identity, value]);

  const saveContent = useCallback(() => {
    if (editorRef.current) debouncedSave(getEditorContent(editorRef.current));
  }, [debouncedSave]);

  const run = useCallback(
    (command: string, val?: string) => {
      editorRef.current?.focus();
      richTextCommand(command, val);
      saveContent();
    },
    [saveContent]
  );

  const toggleBlock = useCallback(
    (tag: string) => {
      editorRef.current?.focus();
      const current = document.queryCommandValue('formatBlock').toLowerCase();
      richTextCommand('formatBlock', current === tag ? 'div' : tag);
      saveContent();
    },
    [saveContent]
  );

  const toggleCode = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    editorRef.current?.focus();

    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    let codeEl: HTMLElement | null = null;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement && node.tagName === 'CODE') {
        codeEl = node;
        break;
      }
      node = node.parentNode;
    }

    if (codeEl) {
      const parent = codeEl.parentNode;
      if (parent) {
        while (codeEl.firstChild) parent.insertBefore(codeEl.firstChild, codeEl);
        parent.removeChild(codeEl);
      }
    } else if (!selection.isCollapsed) {
      const code = document.createElement('code');
      try {
        range.surroundContents(code);
      } catch {
        // partial selection across elements
      }
    }
    saveContent();
  }, [saveContent]);

  const iconSize = 'h-3.5 w-3.5';

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
      <label className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground px-1">
        {label}
      </label>
      <div className="flex items-center gap-0.5 px-1 flex-wrap">
        <ToolbarButton
          icon={<Undo2 className={iconSize} />}
          tooltip="Undo (Ctrl+Z)"
          onClick={() => run('undo')}
        />
        <ToolbarButton
          icon={<Redo2 className={iconSize} />}
          tooltip="Redo (Ctrl+Y)"
          onClick={() => run('redo')}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={<Heading1 className={iconSize} />}
          tooltip="Heading 1"
          onClick={() => toggleBlock('h1')}
        />
        <ToolbarButton
          icon={<Heading2 className={iconSize} />}
          tooltip="Heading 2"
          onClick={() => toggleBlock('h2')}
        />
        <ToolbarButton
          icon={<Heading3 className={iconSize} />}
          tooltip="Heading 3"
          onClick={() => toggleBlock('h3')}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={<Bold className={iconSize} />}
          tooltip="Bold (Ctrl+B)"
          onClick={() => run('bold')}
        />
        <ToolbarButton
          icon={<Italic className={iconSize} />}
          tooltip="Italic (Ctrl+I)"
          onClick={() => run('italic')}
        />
        <ToolbarButton
          icon={<Strikethrough className={iconSize} />}
          tooltip="Strikethrough"
          onClick={() => run('strikethrough')}
        />
        <ToolbarButton
          icon={<Code className={iconSize} />}
          tooltip="Inline code"
          onClick={toggleCode}
        />
        <ToolbarDivider />
        <ToolbarButton
          icon={<List className={iconSize} />}
          tooltip="Bullet list"
          onClick={() => run('insertUnorderedList')}
        />
        <ToolbarButton
          icon={<Quote className={iconSize} />}
          tooltip="Blockquote"
          onClick={() => toggleBlock('blockquote')}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={[
          'flex-1 min-h-0 overflow-y-auto rounded-lg bg-obsidian-800/60 px-3 py-2 text-sm text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-primary/30',
          '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-1',
          '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-0.5',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
          '[&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:pl-5',
          '[&_code]:bg-obsidian-950 [&_code]:text-lime-500 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:border [&_code]:border-lime-500/20',
        ].join(' ')}
        onInput={saveContent}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            richTextCommand('redo');
          }
        }}
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
      <NoteEditor
        label={`Repository: ${repositoryName}`}
        value={repoNotes}
        identity={repositoryId}
        onChange={handleRepoNotesChange}
      />
      <NoteEditor
        label={`Worktree: ${worktreeLabel}`}
        value={worktreeNotes}
        identity={worktreeSessionId}
        onChange={handleWorktreeNotesChange}
      />
    </div>
  );
}
