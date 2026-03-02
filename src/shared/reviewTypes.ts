// Diff Data Types (from git, not persisted)

export type DiffLineType = 'context' | 'add' | 'delete';

export interface DiffLine {
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'binary';

export interface DiffFile {
  path: string;
  oldPath?: string; // For renames
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
  hunks: DiffHunk[];
}

// Review Data Types (persisted to JSON)

export type CommentCategory = 'nitpick' | 'suggestion' | 'issue' | 'question';

export interface ReviewComment {
  id: string;
  reviewId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  side: 'old' | 'new'; // Which side of diff (for split view)
  category: CommentCategory;
  content: string;
  createdAt: string;
}

export interface ReviewFileState {
  path: string;
  viewed: boolean;
  viewedAt?: string;
}

export interface ReviewData {
  id: string;
  projectPath: string;
  baseBranch: string;
  compareBranch: string;
  baseCommit: string; // For detecting outdated comments
  compareCommit: string;
  createdAt: string;
  updatedAt: string;
  files: ReviewFileState[];
  comments: ReviewComment[];
  lastCommitHash?: string; // Track for auto-clear on diff change
}

// LLM Export Types

export interface ReviewExportComment {
  lines: string; // e.g., "42" or "42-45"
  category: string;
  comment: string;
}

export interface ReviewExportFile {
  path: string;
  comments: ReviewExportComment[];
}

export interface ReviewExport {
  project: string;
  baseBranch: string;
  compareBranch: string;
  exportedAt: string;
  files: ReviewExportFile[];
}

// View mode for diff display
export type DiffViewMode = 'unified' | 'split';

// Current review session state (runtime, not persisted directly)
export interface ReviewSession {
  baseBranch: string;
  compareBranch: string;
  files: DiffFile[];
  viewMode: DiffViewMode;
}

// API for review storage
export interface ReviewAPI {
  save(review: ReviewData): Promise<void>;
  load(projectPath: string, reviewId: string): Promise<ReviewData | null>;
  delete(projectPath: string, reviewId: string): Promise<boolean>;
  list(projectPath: string): Promise<string[]>;
}

// Git diff API types
export interface GitDiffResult {
  files: DiffFile[];
  baseCommit: string;
  compareCommit: string;
}

// Working tree diff result (uncommitted changes vs HEAD)
export interface WorkingTreeDiffResult {
  files: DiffFile[];
  headCommit: string;
  isDirty: boolean;
}

// Lightweight file stats without hunks (for lazy loading)
export interface DiffFileStat {
  path: string;
  oldPath?: string; // For renames
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
}

// Working tree stats result (without hunks, for fast initial load)
export interface WorkingTreeStatsResult {
  files: DiffFileStat[];
  headCommit: string;
  isDirty: boolean;
}

// Expanded range for hunk expansion (runtime state, not persisted)
export interface ExpandedRange {
  startLine: number; // 1-based line number
  endLine: number; // 1-based line number (inclusive)
  content: string[]; // Lines of content
}
