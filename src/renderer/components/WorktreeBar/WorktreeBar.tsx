import { GitBranch, NotebookPen } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { SplitButton, SplitButtonItem } from '../ui/split-button';
import { useAppStore } from '../../stores/appStore';

interface WorktreeBarProps {
  sessionId: string | null;
  sessionPath?: string;
  branchName?: string;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  onError?: (message: string) => void;
}

export function WorktreeBar({
  sessionId,
  sessionPath,
  branchName,
  notesOpen,
  onToggleNotes,
  onError,
}: WorktreeBarProps) {
  const { settings, updateSettings } = useAppStore();
  const preferredEditor = settings.preferredEditor;

  const labelMap: Record<string, string> = {
    cursor: 'Cursor',
    vscode: 'VS Code',
    folder: 'Folder',
  };
  const editorLabel = labelMap[preferredEditor] ?? 'Cursor';

  const editorItems: SplitButtonItem[] = [
    { id: 'vscode', label: 'VS Code', selected: preferredEditor === 'vscode' },
    { id: 'cursor', label: 'Cursor', selected: preferredEditor === 'cursor' },
    { id: 'folder', label: 'Folder', selected: preferredEditor === 'folder' },
  ];

  const openInEditor = async (editor: 'cursor' | 'vscode') => {
    if (!sessionPath) return;
    const result = await window.electronAPI.openInEditor(sessionPath, editor);
    if (!result.success) {
      const editorName = editor === 'cursor' ? 'Cursor' : 'VS Code';
      onError?.(`Failed to open ${editorName}: ${result.error}`);
    }
  };

  const openInFolder = async () => {
    if (!sessionPath) return;
    const result = await window.electronAPI.openFolder(sessionPath);
    if (!result.success) {
      onError?.(`Failed to open folder: ${result.error}`);
    }
  };

  const handleOpenPreferred = async () => {
    if (!sessionPath) return;
    if (preferredEditor === 'folder') {
      await openInFolder();
    } else {
      await openInEditor(preferredEditor);
    }
  };

  const handleItemSelect = async (id: string) => {
    const selection = id as 'cursor' | 'vscode' | 'folder';
    if (selection !== preferredEditor) {
      updateSettings({ preferredEditor: selection });
    }
    if (selection === 'folder') {
      await openInFolder();
    } else {
      await openInEditor(selection);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/80 backdrop-blur-sm shrink-0">
      {/* Left side: Branch info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GitBranch className="h-4 w-4" />
        {sessionId ? (
          <span className="font-medium text-foreground">{branchName ?? 'No branch'}</span>
        ) : (
          <span>No worktree selected</span>
        )}
      </div>

      {/* Right side: Notes toggle + Split button for editor selection */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${notesOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={onToggleNotes}
              disabled={!sessionId}
            >
              <NotebookPen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notes</TooltipContent>
        </Tooltip>
        <SplitButton
          label={`Open in ${editorLabel}`}
          onClick={handleOpenPreferred}
          disabled={!sessionId}
          items={editorItems}
          onItemSelect={handleItemSelect}
          showCheckmark={true}
        />
      </div>
    </div>
  );
}
