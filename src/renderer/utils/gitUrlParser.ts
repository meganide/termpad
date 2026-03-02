/**
 * Extracts owner/repo format from various git URL formats.
 * Examples:
 * - https://github.com/anthropics/claude -> anthropics/claude
 * - git@github.com:anthropics/claude.git -> anthropics/claude
 * - https://github.com/anthropics/claude.git/ -> anthropics/claude
 */
export function extractOwnerRepo(url: string): string {
  // Remove trailing slashes and .git suffix
  const cleanUrl = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  // Handle SSH format: git@host:owner/repo
  const sshMatch = cleanUrl.match(/:([^/]+\/[^/]+)$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // Handle HTTPS format: https://host/owner/repo
  const urlParts = cleanUrl.split('/');
  if (urlParts.length >= 2) {
    const repo = urlParts.pop();
    const owner = urlParts.pop();
    if (owner && repo) {
      return `${owner}/${repo}`;
    }
  }

  // Fallback to just repo name if we can't extract owner
  return cleanUrl.split('/').pop() || 'cloned-repo';
}
