import type { ReviewData, ReviewExport, DiffFile } from '../../../../shared/reviewTypes';

/**
 * Export review data to JSON format for LLM consumption
 */
export function exportToJson(
  reviewData: ReviewData,
  files: DiffFile[],
  projectPath: string
): ReviewExport {
  // Group comments by file
  const fileMap = new Map<string, typeof reviewData.comments>();
  for (const comment of reviewData.comments) {
    const existing = fileMap.get(comment.filePath) || [];
    fileMap.set(comment.filePath, [...existing, comment]);
  }

  const exportData: ReviewExport = {
    project: projectPath,
    baseBranch: reviewData.baseBranch,
    compareBranch: reviewData.compareBranch,
    exportedAt: new Date().toISOString(),
    files: Array.from(fileMap.entries()).map(([path, comments]) => ({
      path,
      comments: comments
        .sort((a, b) => a.lineStart - b.lineStart)
        .map((c) => ({
          lines: c.lineStart === c.lineEnd ? `${c.lineStart}` : `${c.lineStart}-${c.lineEnd}`,
          category: c.category,
          comment: c.content,
        })),
    })),
  };

  return exportData;
}

/**
 * Generate a prompt text suitable for sending to an LLM
 */
export function generatePrompt(reviewData: ReviewData, projectPath: string): string {
  // Group comments by file
  const fileMap = new Map<string, typeof reviewData.comments>();
  for (const comment of reviewData.comments) {
    const existing = fileMap.get(comment.filePath) || [];
    fileMap.set(comment.filePath, [...existing, comment]);
  }

  if (fileMap.size === 0) {
    return 'No comments to address.';
  }

  let prompt = `Please fix the following code review comments in my codebase:\n\n`;
  prompt += `Project: ${projectPath}\n`;
  prompt += `Branch: ${reviewData.compareBranch} (compared to ${reviewData.baseBranch})\n\n`;

  for (const [filePath, comments] of fileMap.entries()) {
    prompt += `## ${filePath}\n\n`;
    const sortedComments = [...comments].sort((a, b) => a.lineStart - b.lineEnd);

    for (const comment of sortedComments) {
      const lineRange =
        comment.lineStart === comment.lineEnd
          ? `Line ${comment.lineStart}`
          : `Lines ${comment.lineStart}-${comment.lineEnd}`;
      prompt += `- **${lineRange}** [${comment.category.toUpperCase()}]: ${comment.content}\n`;
    }
    prompt += '\n';
  }

  prompt += `Please address each comment by modifying the appropriate files. Focus on the ${getCategoryPriority(reviewData.comments)} first.`;

  return prompt;
}

/**
 * Generate a prompt for a single comment
 */
export function generateSingleCommentPrompt(
  comment: ReviewData['comments'][0],
  filePath: string
): string {
  const lineRange =
    comment.lineStart === comment.lineEnd
      ? `line ${comment.lineStart}`
      : `lines ${comment.lineStart}-${comment.lineEnd}`;

  return `Please fix this ${comment.category} issue in ${filePath} at ${lineRange}:\n\n${comment.content}`;
}

/**
 * Get priority categories for the prompt
 */
function getCategoryPriority(comments: ReviewData['comments']): string {
  const categories = new Set(comments.map((c) => c.category));
  const priority = [];

  if (categories.has('issue')) priority.push('issues');
  if (categories.has('suggestion')) priority.push('suggestions');
  if (categories.has('question')) priority.push('questions');
  if (categories.has('nitpick')) priority.push('nitpicks');

  return priority.length > 0 ? priority.join(' and ') : 'items';
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Download JSON data as a file
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(projectPath: string, compareBranch: string): string {
  const projectName = projectPath.split('/').pop() || 'review';
  const sanitizedBranch = compareBranch.replace(/[^a-zA-Z0-9-_]/g, '-');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${projectName}-${sanitizedBranch}-review-${timestamp}.json`;
}
