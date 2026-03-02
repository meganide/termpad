import { Lock } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import type { WorktreeInfo } from '../../shared/types';

export interface WorktreePickerProps {
  worktrees: WorktreeInfo[];
  selectedPaths: Set<string>;
  onSelectionChange: (selectedPaths: Set<string>) => void;
  /** Unique ID prefix for checkbox elements (for multiple pickers on same page) */
  idPrefix?: string;
}

export function WorktreePicker({
  worktrees,
  selectedPaths,
  onSelectionChange,
  idPrefix = 'worktree',
}: WorktreePickerProps) {
  const handleCheckboxChange = (path: string, checked: boolean) => {
    const newSelected = new Set(selectedPaths);
    if (checked) {
      newSelected.add(path);
    } else {
      newSelected.delete(path);
    }
    onSelectionChange(newSelected);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(worktrees.map((w) => w.path)));
    } else {
      onSelectionChange(new Set());
    }
  };

  if (worktrees.length === 0) {
    return null;
  }

  const allSelected = worktrees.length > 0 && selectedPaths.size === worktrees.length;
  const someSelected = selectedPaths.size > 0 && selectedPaths.size < worktrees.length;
  const showSelectAll = worktrees.length > 1;

  return (
    <div className="flex flex-col">
      {showSelectAll && (
        <div className="flex items-center space-x-3 pb-2 mb-2 border-b shrink-0">
          <Checkbox
            id={`${idPrefix}-toggle-all`}
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={(checked) => handleToggleAll(checked === true)}
          />
          <Label
            htmlFor={`${idPrefix}-toggle-all`}
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </Label>
        </div>
      )}
      <div className="space-y-2 overflow-y-auto pr-1">
        {worktrees.map((worktree) => (
          <div key={worktree.path} className="flex items-center space-x-3 rounded-md border p-3">
            <Checkbox
              id={`${idPrefix}-${worktree.path}`}
              checked={selectedPaths.has(worktree.path)}
              onCheckedChange={(checked) => handleCheckboxChange(worktree.path, checked === true)}
            />
            <Label
              htmlFor={`${idPrefix}-${worktree.path}`}
              className="flex flex-1 items-center gap-2 cursor-pointer"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium truncate">{worktree.branch || '(detached HEAD)'}</span>
                <span className="text-xs text-muted-foreground truncate">{worktree.path}</span>
              </div>
              {worktree.isLocked && (
                <Lock
                  className="h-4 w-4 text-muted-foreground shrink-0"
                  aria-label="Locked worktree"
                />
              )}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
