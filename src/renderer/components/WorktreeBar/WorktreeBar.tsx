import { useCallback } from 'react';
import { GitBranch, NotebookPen, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { SplitButton, SplitButtonItem } from '../ui/split-button';
import { useAppStore } from '../../stores/appStore';

interface WorktreeBarProps {
  sessionId: string | null;
  sessionPath?: string;
  branchName?: string;
  repositoryId?: string;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  onError?: (message: string) => void;
}

export function WorktreeBar({
  sessionId,
  sessionPath,
  branchName,
  repositoryId,
  notesOpen,
  onToggleNotes,
  onError,
}: WorktreeBarProps) {
  const { settings, updateSettings } = useAppStore();
  const preferredEditor = settings.preferredEditor;

  const hasConfigUpdate = useAppStore((state) =>
    repositoryId ? state.termpadConfigUpdates.has(repositoryId) : false
  );
  const applyTermpadConfig = useAppStore((state) => state.applyTermpadConfig);
  const repository = useAppStore((state) =>
    repositoryId ? state.repositories.find((r) => r.id === repositoryId) : undefined
  );

  const handleRefreshConfig = useCallback(async () => {
    if (!repositoryId || !repository) return;
    const config = await window.terminal.loadTermpadConfig(repository.path);
    if (config) {
      applyTermpadConfig(repositoryId, config);
    }
  }, [repositoryId, repository, applyTermpadConfig]);

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

      {/* Right side: Config refresh + Notes toggle + Split button for editor selection */}
      <div className="flex items-center gap-2">
        {hasConfigUpdate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground relative"
                onClick={handleRefreshConfig}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="text-xs">Sync Config</span>
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-lime-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>termpad.json has new changes</TooltipContent>
          </Tooltip>
        )}
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
