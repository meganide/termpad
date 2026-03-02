import { useState, useMemo } from 'react';
import type { DiffFile } from '../../../../shared/reviewTypes';
import { buildFileTree, type FileTreeNode } from '../utils/buildFileTree';
import { FileTreeFile } from './FileTreeFile';
import { FileTreeFolder } from './FileTreeFolder';

interface FileTreeProps {
  files: DiffFile[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
  isFileViewed: (filePath: string) => boolean;
  onToggleViewed: (filePath: string) => void;
}

export function FileTree({
  files,
  selectedFile,
  onFileSelect,
  isFileViewed,
  onToggleViewed,
}: FileTreeProps) {
  // Build tree from files
  const tree = useMemo(() => buildFileTree(files), [files]);

  // Collapsed folder paths (empty set = all expanded)
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Recursive render function
  const renderNode = (node: FileTreeNode, depth: number, isLast: boolean): React.ReactNode => {
    if (node.type === 'file' && node.file) {
      return (
        <FileTreeFile
          key={node.path}
          file={node.file}
          depth={depth}
          isLast={isLast}
          isSelected={selectedFile === node.path}
          isViewed={isFileViewed(node.path)}
          onClick={() => onFileSelect(node.path)}
          onToggleViewed={() => onToggleViewed(node.path)}
        />
      );
    }

    // Folder node
    const isExpanded = !collapsedPaths.has(node.path);

    return (
      <div key={node.path}>
        <FileTreeFolder
          node={node}
          depth={depth}
          isLast={isLast}
          isExpanded={isExpanded}
          onToggle={() => toggleFolder(node.path)}
        />
        {isExpanded && (
          <div>
            {node.children.map((child, index) =>
              renderNode(child, depth + 1, index === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {tree.map((node, index) => renderNode(node, 0, index === tree.length - 1))}
    </div>
  );
}
