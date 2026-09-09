import { Copy, Expand, Flag, GitBranch, Pencil, Terminal, Trash2 } from 'lucide-react';
import * as Dropdown from '../../components/ui/dropdown-menu';
import * as Context from '../../components/ui/context-menu';
import type { TodoItem, TodoPriority, WorktreeSession } from '../../../shared/types';
import { PRIORITY_ORDER, PRIORITY_STYLES } from './priority';

interface TodoActionItemsProps {
  context?: boolean;
  todo: TodoItem;
  onOpen: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onRemove: () => void;
  onPriorityChange: (priority: TodoPriority | undefined) => void;
  moveTargets?: WorktreeSession[];
  onMove: (id: string) => void;
  onSendToTerminal?: () => void;
  onCreateWorktree?: () => void;
}

// Both entry points use the same actions, labels, and availability rules.
export function TodoActionItems({
  context,
  todo,
  onOpen,
  onEdit,
  onCopy,
  onRemove,
  onPriorityChange,
  moveTargets,
  onMove,
  onSendToTerminal,
  onCreateWorktree,
}: TodoActionItemsProps) {
  const Item = context ? Context.ContextMenuItem : Dropdown.DropdownMenuItem;
  const Separator = context ? Context.ContextMenuSeparator : Dropdown.DropdownMenuSeparator;
  const Sub = context ? Context.ContextMenuSub : Dropdown.DropdownMenuSub;
  const SubTrigger = context ? Context.ContextMenuSubTrigger : Dropdown.DropdownMenuSubTrigger;
  const SubContent = context ? Context.ContextMenuSubContent : Dropdown.DropdownMenuSubContent;
  const Portal = context ? Context.ContextMenuPortal : Dropdown.DropdownMenuPortal;
  const RadioGroup = context ? Context.ContextMenuRadioGroup : Dropdown.DropdownMenuRadioGroup;
  const RadioItem = context ? Context.ContextMenuRadioItem : Dropdown.DropdownMenuRadioItem;
  return (
    <>
      <Item onSelect={onOpen}>
        <Expand />
        Open full todo
      </Item>
      <Item onSelect={onEdit}>
        <Pencil />
        Edit
      </Item>
      <Item onSelect={onCopy}>
        <Copy />
        Copy
      </Item>
      <Sub>
        <SubTrigger>
          <Flag />
          Priority
        </SubTrigger>
        <Portal>
          <SubContent>
            <RadioGroup
              value={todo.priority ?? 'none'}
              onValueChange={(value) =>
                onPriorityChange(value === 'none' ? undefined : (value as TodoPriority))
              }
            >
              {PRIORITY_ORDER.map((priority) => (
                <RadioItem key={priority} value={priority}>
                  <span className={`size-2 rounded-full ${PRIORITY_STYLES[priority].dot}`} />
                  {PRIORITY_STYLES[priority].label}
                </RadioItem>
              ))}
              <RadioItem value="none">None</RadioItem>
            </RadioGroup>
          </SubContent>
        </Portal>
      </Sub>
      {moveTargets !== undefined && (
        <Sub>
          <SubTrigger>
            <GitBranch />
            Move to worktree
          </SubTrigger>
          <Portal>
            <SubContent className="max-w-80 max-h-64 overflow-y-auto">
              {moveTargets.length === 0 && <Item disabled>No worktrees available</Item>}
              {moveTargets.map((target) => (
                <Item
                  key={target.id}
                  onSelect={() => onMove(target.id)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="max-w-full truncate">{target.label}</span>
                  <span className="max-w-full truncate text-xs text-muted-foreground">
                    {target.branchName ?? target.path}
                  </span>
                </Item>
              ))}
            </SubContent>
          </Portal>
        </Sub>
      )}
      <Separator />
      <Item disabled={!onSendToTerminal} onSelect={onSendToTerminal}>
        <Terminal />
        Send to active terminal
      </Item>
      <Item disabled={!onCreateWorktree} onSelect={onCreateWorktree}>
        <GitBranch />
        Create worktree from todo…
      </Item>
      <Separator />
      <Item variant="destructive" onSelect={onRemove}>
        <Trash2 />
        Delete
      </Item>
    </>
  );
}
