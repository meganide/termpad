import { ChevronDown, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileStatusItem, type FileStatusCategory } from './FileStatusItem';
import type { FileStatus } from '../../../../shared/types';

interface FileStatusSectionProps {
  title: string;
  category: FileStatusCategory;
  files: FileStatus[];
  defaultOpen?: boolean;
  showWhenEmpty?: boolean;
  onStageFile?: (file: FileStatus) => void;
  onUnstageFile?: (file: FileStatus) => void;
  onDiscardFile?: (file: FileStatus) => void;
  onViewDiff?: (file: FileStatus) => void;
  onOpenInEditor?: (file: FileStatus) => void;
  onBulkAction?: () => void;
}

export function FileStatusSection({
  title,
  category,
  files,
  defaultOpen = true,
  showWhenEmpty = false,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onViewDiff,
  onOpenInEditor,
  onBulkAction,
}: FileStatusSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const showBulkStage = category === 'unstaged' || category === 'untracked';
  const bulkActionLabel = showBulkStage ? 'Stage All' : 'Unstage All';
  const BulkActionIcon = showBulkStage ? Plus : Minus;

  if (files.length === 0 && !showWhenEmpty) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid="file-status-section">
      <div className="flex items-center justify-between px-2 py-1.5">
        <CollapsibleTrigger
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="section-trigger"
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !isOpen && '-rotate-90')}
            data-testid="chevron-icon"
          />
          <span data-testid="section-title">{title}</span>
          <span
            className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
            data-testid="file-count-badge"
          >
            {files.length}
          </span>
        </CollapsibleTrigger>

        {onBulkAction && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onBulkAction();
                }}
                data-testid="bulk-action-button"
              >
                <BulkActionIcon className="size-3.5 mr-1" />
                {bulkActionLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{bulkActionLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <CollapsibleContent data-testid="section-content">
        <div className="space-y-0.5">
          {files.map((file) => (
            <FileStatusItem
              key={file.path}
              file={file}
              category={category}
              onStage={onStageFile ? () => onStageFile(file) : undefined}
              onUnstage={onUnstageFile ? () => onUnstageFile(file) : undefined}
              onDiscard={onDiscardFile ? () => onDiscardFile(file) : undefined}
              onViewDiff={onViewDiff ? () => onViewDiff(file) : undefined}
              onOpenInEditor={onOpenInEditor ? () => onOpenInEditor(file) : undefined}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
