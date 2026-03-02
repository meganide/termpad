import { ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeGuide } from './TreeGuide';
import type { FileTreeNode } from '../utils/buildFileTree';

interface FileTreeFolderProps {
  node: FileTreeNode;
  depth: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function FileTreeFolder({ node, depth, isLast, isExpanded, onToggle }: FileTreeFolderProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer',
        'hover:bg-muted/50 rounded-md'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onToggle();
        }
      }}
    >
      {/* Tree guide lines */}
      <TreeGuide depth={depth} isLast={isLast} hasChildren />

      {/* Expand/collapse chevron */}
      <ChevronRight
        className={cn(
          'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150',
          isExpanded && 'rotate-90'
        )}
      />

      {/* Folder icon */}
      <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

      {/* Folder name */}
      <span className="flex-1 min-w-0 truncate text-muted-foreground font-mono text-xs">
        {node.name}
      </span>
    </div>
  );
}
