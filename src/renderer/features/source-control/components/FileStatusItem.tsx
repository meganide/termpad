import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  ExternalLink,
  Eye,
  File,
  FileCode,
  FileImage,
  FileInput,
  FileJson,
  FilePen,
  FilePlus,
  FileText,
  FileX,
  Minus,
  Plus,
  Undo2,
} from 'lucide-react';
import type { FileChangeType, FileStatus } from '../../../../shared/types';

export type FileStatusCategory = 'staged' | 'unstaged' | 'untracked';

interface FileStatusItemProps {
  file: FileStatus;
  category: FileStatusCategory;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onViewDiff?: () => void;
  onOpenInEditor?: () => void;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    return <FileCode className="size-4 text-blue-400" />;
  }
  // JSON/YAML/config files
  if (['json', 'yaml', 'yml', 'toml', 'xml'].includes(ext)) {
    return <FileJson className="size-4 text-yellow-400" />;
  }
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return <FileImage className="size-4 text-purple-400" />;
  }
  // Text/docs
  if (['md', 'txt', 'rst', 'doc', 'docx'].includes(ext)) {
    return <FileText className="size-4 text-muted-foreground" />;
  }

  // Default file icon
  return <File className="size-4 text-muted-foreground" />;
}

function getStatusIcon(type: FileChangeType) {
  switch (type) {
    case 'added':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <FilePlus className="size-3.5 text-green-500" data-testid="status-icon-added" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Added</TooltipContent>
        </Tooltip>
      );
    case 'deleted':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <FileX className="size-3.5 text-red-500" data-testid="status-icon-deleted" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Deleted</TooltipContent>
        </Tooltip>
      );
    case 'modified':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <FilePen className="size-3.5 text-yellow-500" data-testid="status-icon-modified" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Modified</TooltipContent>
        </Tooltip>
      );
    case 'renamed':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <FileInput className="size-3.5 text-blue-500" data-testid="status-icon-renamed" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Renamed</TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

export function FileStatusItem({
  file,
  category,
  onStage,
  onUnstage,
  onDiscard,
  onViewDiff,
  onOpenInEditor,
}: FileStatusItemProps) {
  const fileName = file.path.split('/').pop() || file.path;
  // Remove trailing "/" so we can show it separately after ellipsis
  const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

  const canStage = category === 'unstaged' || category === 'untracked';
  const canUnstage = category === 'staged';
  const canDiscard = category === 'unstaged' || category === 'untracked';
  // All files can show diff - untracked files are shown as all additions
  const canViewDiff = true;

  return (
    <div
      className={cn(
        'group relative w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
        'hover:bg-muted/50 rounded-sm'
      )}
      data-testid="file-status-item"
    >
      {/* File type icon */}
      <span className="flex-shrink-0" data-testid="file-type-icon">
        {getFileIcon(fileName)}
      </span>

      {/* Status icon */}
      <span className="flex-shrink-0" data-testid="status-icon">
        {getStatusIcon(file.type)}
      </span>

      {/* File path - directory truncates, filename always visible */}
      {/* Clickable to open diff viewer when available */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex-1 min-w-0 font-mono text-[11px] flex items-baseline overflow-hidden',
              canViewDiff && onViewDiff ? 'cursor-pointer hover:underline' : 'cursor-default'
            )}
            onClick={
              canViewDiff && onViewDiff
                ? (e) => {
                    e.stopPropagation();
                    onViewDiff();
                  }
                : undefined
            }
            data-testid="file-path-clickable"
          >
            {dirPath && (
              <>
                <span className="text-muted-foreground truncate max-w-[120px] flex-shrink">
                  {dirPath}
                </span>
                <span className="text-muted-foreground flex-shrink-0">/</span>
              </>
            )}
            <span className="text-foreground flex-shrink-0">{fileName}</span>
            {file.oldPath && (
              <span className="text-muted-foreground ml-1 flex-shrink-0">
                ({file.oldPath.split('/').pop()})
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="font-mono text-xs">{file.path}</p>
          {file.oldPath && (
            <p className="font-mono text-xs text-muted-foreground">from: {file.oldPath}</p>
          )}
          {canViewDiff && onViewDiff && (
            <p className="text-xs text-muted-foreground mt-1">Click to view diff</p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Diff stats - far right */}
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-mono">
        {file.additions > 0 && (
          <span className="text-green-500" data-testid="additions">
            +{file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-500" data-testid="deletions">
            -{file.deletions}
          </span>
        )}
      </div>

      {/* Action buttons - overlay on hover, positioned to the right */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-muted rounded-sm pl-2 pr-1">
        {/* Stage button (for unstaged/untracked) */}
        {canStage && onStage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onStage();
                }}
                data-testid="stage-button"
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stage file</TooltipContent>
          </Tooltip>
        )}

        {/* Unstage button (for staged) */}
        {canUnstage && onUnstage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnstage();
                }}
                data-testid="unstage-button"
              >
                <Minus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Unstage file</TooltipContent>
          </Tooltip>
        )}

        {/* Discard button (for unstaged/untracked) */}
        {canDiscard && onDiscard && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscard();
                }}
                data-testid="discard-button"
              >
                <Undo2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Discard changes</TooltipContent>
          </Tooltip>
        )}

        {/* View diff button */}
        {canViewDiff && onViewDiff && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDiff();
                }}
                data-testid="view-diff-button"
              >
                <Eye className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Review and comment on changes</TooltipContent>
          </Tooltip>
        )}

        {/* Open in editor button */}
        {onOpenInEditor && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInEditor();
                }}
                data-testid="open-in-editor-button"
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in editor</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
