import { useRef, useCallback } from 'react';
import { GripVertical, Plus, Trash2, Star } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { IconPicker } from './IconPicker';
import { cn } from '@/lib/utils';
import type { TerminalPreset } from '../../shared/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_USER_PRESETS = 9;

interface SortablePresetRowProps {
  preset: TerminalPreset;
  isDefault: boolean;
  onUpdate: (presetId: string, updates: Partial<Omit<TerminalPreset, 'id' | 'isBuiltIn'>>) => void;
  onDelete: (presetId: string) => void;
  onSetDefault: (presetId: string | null) => void;
}

function SortablePresetRow({
  preset,
  isDefault,
  onUpdate,
  onDelete,
  onSetDefault,
}: SortablePresetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: preset.id,
    disabled: preset.isBuiltIn,
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleNameBlur = useCallback(() => {
    const value = nameInputRef.current?.value?.trim();
    if (value && value !== preset.name) {
      onUpdate(preset.id, { name: value });
    } else if (nameInputRef.current) {
      nameInputRef.current.value = preset.name;
    }
  }, [preset.id, preset.name, onUpdate]);

  const handleCommandBlur = useCallback(() => {
    const value = commandInputRef.current?.value?.trim();
    if (value && value !== preset.command) {
      onUpdate(preset.id, { command: value });
    } else if (commandInputRef.current) {
      commandInputRef.current.value = preset.command;
    }
  }, [preset.id, preset.command, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, onBlur: () => void) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onBlur();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    []
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border bg-background',
        isDragging && 'opacity-50 z-50',
        preset.isBuiltIn && 'bg-muted/50'
      )}
    >
      {/* Drag handle */}
      {preset.isBuiltIn ? (
        <div className="w-6 h-6 flex items-center justify-center">
          <div className="w-3.5 h-3.5" />
        </div>
      ) : (
        <span
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </span>
      )}

      {/* Icon picker */}
      <IconPicker
        value={preset.icon}
        onSelect={(iconName) => onUpdate(preset.id, { icon: iconName })}
        disabled={preset.isBuiltIn}
      />

      {/* Name field */}
      {preset.isBuiltIn ? (
        <span className="text-sm font-medium min-w-[100px]">{preset.name}</span>
      ) : (
        <Input
          ref={nameInputRef}
          defaultValue={preset.name}
          onBlur={handleNameBlur}
          onKeyDown={(e) => handleKeyDown(e, handleNameBlur)}
          className="h-8 min-w-[100px] max-w-[140px]"
          placeholder="Name"
        />
      )}

      {/* Command field */}
      {preset.isBuiltIn ? (
        <span className="text-sm text-muted-foreground flex-1">(default shell)</span>
      ) : (
        <Input
          ref={commandInputRef}
          defaultValue={preset.command}
          onBlur={handleCommandBlur}
          onKeyDown={(e) => handleKeyDown(e, handleCommandBlur)}
          className="h-8 flex-1 min-w-0"
          placeholder="Command (e.g., claude)"
        />
      )}

      {/* Default toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSetDefault(isDefault ? null : preset.id)}
            className={cn(isDefault && 'text-yellow-500 hover:text-yellow-600')}
            aria-label={isDefault ? 'Remove as default' : 'Set as default'}
          >
            <Star className={cn('h-4 w-4', isDefault && 'fill-current')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isDefault ? 'Default preset (click to unset)' : 'Set as default'}
        </TooltipContent>
      </Tooltip>

      {/* Delete button */}
      {!preset.isBuiltIn && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(preset.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete preset"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Delete preset</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function TerminalPresetsSettings() {
  const {
    settings,
    addTerminalPreset,
    updateTerminalPreset,
    deleteTerminalPreset,
    reorderTerminalPresets,
    setDefaultPresetId,
  } = useAppStore();

  const presets = settings.terminalPresets || [];
  const defaultPresetId = settings.defaultPresetId;

  // Sort presets by order
  const sortedPresets = [...presets].sort((a, b) => a.order - b.order);
  const userPresets = sortedPresets.filter((p) => !p.isBuiltIn);
  const canAddMore = userPresets.length < MAX_USER_PRESETS;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedPresets.findIndex((p) => p.id === active.id);
      const newIndex = sortedPresets.findIndex((p) => p.id === over.id);

      // Don't allow moving above the built-in preset
      if (newIndex === 0 && sortedPresets[0]?.isBuiltIn) {
        return;
      }

      const reorderedPresets = arrayMove(sortedPresets, oldIndex, newIndex);
      reorderTerminalPresets(reorderedPresets);
    }
  };

  const handleUpdate = useCallback(
    (presetId: string, updates: Partial<Omit<TerminalPreset, 'id' | 'isBuiltIn'>>) => {
      updateTerminalPreset(presetId, updates);
    },
    [updateTerminalPreset]
  );

  const handleAddPreset = useCallback(() => {
    if (!canAddMore) return;
    addTerminalPreset({
      name: 'New Preset',
      command: 'echo "Configure this preset"',
      icon: 'terminal',
    });
  }, [canAddMore, addTerminalPreset]);

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <Label>Terminal Presets</Label>
        <p className="text-sm text-muted-foreground">
          Configure presets for quick terminal creation. The default preset (starred) is used when
          pressing Enter in a worktree.
        </p>
      </div>

      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={sortedPresets.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedPresets.map((preset) => (
              <SortablePresetRow
                key={preset.id}
                preset={preset}
                isDefault={
                  defaultPresetId === preset.id ||
                  (defaultPresetId === null && preset.id === 'new-terminal')
                }
                onUpdate={handleUpdate}
                onDelete={deleteTerminalPreset}
                onSetDefault={setDefaultPresetId}
              />
            ))}
          </SortableContext>
        </DndContext>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddPreset}
          disabled={!canAddMore}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Preset
          {!canAddMore && (
            <span className="ml-1 text-muted-foreground">(max {MAX_USER_PRESETS})</span>
          )}
        </Button>
      </div>
    </div>
  );
}
