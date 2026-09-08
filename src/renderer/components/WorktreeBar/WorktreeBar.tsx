import { FolderOpen, GitBranch } from 'lucide-react';
import { SplitButton, SplitButtonItem } from '../ui/split-button';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAppStore } from '../../stores/appStore';

interface WorktreeBarProps {
  sessionId: string | null;
  sessionPath?: string;
  branchName?: string;
  onError?: (message: string) => void;
}

export function WorktreeBar({ sessionId, sessionPath, branchName, onError }: WorktreeBarProps) {
  const { settings, updateSettings } = useAppStore();
  // Older settings allowed Folder as the primary action. Keep an editor selected now
  // that the file manager has its own dedicated button.
  const preferredEditor =
    settings.preferredEditor === 'folder' ? 'cursor' : settings.preferredEditor;

  const labelMap: Record<string, string> = {
    cursor: 'Cursor',
    vscode: 'VS Code',
  };
  const editorLabel = labelMap[preferredEditor] ?? 'Cursor';

  const editorItems: SplitButtonItem[] = [
    { id: 'vscode', label: 'VS Code', selected: preferredEditor === 'vscode' },
    { id: 'cursor', label: 'Cursor', selected: preferredEditor === 'cursor' },
  ];

  const openInEditor = async (editor: 'cursor' | 'vscode') => {
    if (!sessionPath) return;
    const editorName = labelMap[editor];
    try {
      const result = await window.electronAPI.openInEditor(sessionPath, editor);
      if (!result.success)
        onError?.(`Failed to open ${editorName}: ${result.error ?? 'Unknown error'}`);
    } catch (error) {
      onError?.(
        `Failed to open ${editorName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const openInFolder = async () => {
    if (!sessionPath) return;
    try {
      const result = await window.electronAPI.openFolder(sessionPath);
      if (!result.success) onError?.(`Failed to open folder: ${result.error ?? 'Unknown error'}`);
    } catch (error) {
      onError?.(
        `Failed to open folder: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleOpenPreferred = async () => {
    if (!sessionPath) return;
    await openInEditor(preferredEditor);
  };

  const handleItemSelect = async (id: string) => {
    if (id !== 'cursor' && id !== 'vscode') return;
    if (id !== settings.preferredEditor) updateSettings({ preferredEditor: id });
    await openInEditor(id);
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

      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
                size="sm"
                className="size-8 p-0"
                aria-label="Open worktree folder"
                disabled={!sessionId || !sessionPath}
                onClick={openInFolder}
              >
                <FolderOpen className="size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Open worktree folder</TooltipContent>
        </Tooltip>
        <SplitButton
          label={`Open in ${editorLabel}`}
          onClick={handleOpenPreferred}
          disabled={!sessionId || !sessionPath}
          items={editorItems}
          onItemSelect={handleItemSelect}
          showCheckmark={true}
        />
      </div>
    </div>
  );
}
