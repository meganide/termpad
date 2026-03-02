import type { DiffFile } from '../../../../shared/reviewTypes';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  file?: DiffFile;
  children: FileTreeNode[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Builds a hierarchical tree structure from a flat array of DiffFile objects.
 * Folders are sorted before files, and both are sorted alphabetically.
 * Addition/deletion stats are aggregated up to parent folders.
 */
export function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let node = currentLevel.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          file: isFile ? file : undefined,
          children: [],
          totalAdditions: isFile ? file.additions : 0,
          totalDeletions: isFile ? file.deletions : 0,
        };
        currentLevel.push(node);
      }

      if (!isFile) {
        currentLevel = node.children;
      }
    }
  }

  // Aggregate stats and sort the tree
  aggregateAndSort(root);

  return root;
}

/**
 * Recursively aggregates addition/deletion stats from children to parents,
 * and sorts children (folders first, then files, both alphabetically).
 */
function aggregateAndSort(nodes: FileTreeNode[]): { additions: number; deletions: number } {
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const node of nodes) {
    if (node.type === 'folder') {
      const childStats = aggregateAndSort(node.children);
      node.totalAdditions = childStats.additions;
      node.totalDeletions = childStats.deletions;
    }
    totalAdditions += node.totalAdditions;
    totalDeletions += node.totalDeletions;
  }

  // Sort: folders first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { additions: totalAdditions, deletions: totalDeletions };
}
