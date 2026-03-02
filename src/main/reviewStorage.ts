import { app } from 'electron';
import type { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { ReviewData } from '../shared/reviewTypes';

const REVIEWS_DIR = 'reviews';

/**
 * Get the reviews directory path for a project.
 * Projects are identified by a hash of their path to create safe directory names.
 */
function getReviewsDir(projectPath: string): string {
  const projectId = createProjectId(projectPath);
  return path.join(app.getPath('userData'), REVIEWS_DIR, projectId);
}

/**
 * Create a safe project ID from the project path.
 */
function createProjectId(projectPath: string): string {
  // Use first 12 chars of SHA256 hash
  return crypto.createHash('sha256').update(projectPath).digest('hex').substring(0, 12);
}

/**
 * Get the file path for a specific review.
 */
function getReviewFilePath(projectPath: string, reviewId: string): string {
  return path.join(getReviewsDir(projectPath), `${reviewId}.json`);
}

/**
 * Save a review to storage.
 */
export async function saveReview(review: ReviewData): Promise<void> {
  const reviewsDir = getReviewsDir(review.projectPath);

  // Ensure the reviews directory exists
  await fs.mkdir(reviewsDir, { recursive: true });

  const filePath = getReviewFilePath(review.projectPath, review.id);
  const tempPath = `${filePath}.tmp`;

  // Update the updatedAt timestamp
  const reviewToSave: ReviewData = {
    ...review,
    updatedAt: new Date().toISOString(),
  };

  try {
    // Write to temp file first
    await fs.writeFile(tempPath, JSON.stringify(reviewToSave, null, 2), 'utf-8');
    // Atomic rename
    await fs.rename(tempPath, filePath);
    console.log(`[ReviewStorage] Review ${review.id} saved`);
  } catch (error) {
    console.error('[ReviewStorage] Failed to save review:', error);
    // Attempt cleanup of temp file
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Load a specific review from storage.
 */
export async function loadReview(
  projectPath: string,
  reviewId: string,
): Promise<ReviewData | null> {
  try {
    const filePath = getReviewFilePath(projectPath, reviewId);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as ReviewData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('[ReviewStorage] Failed to load review:', error);
    throw error;
  }
}

/**
 * Delete a review from storage.
 */
export async function deleteReview(
  projectPath: string,
  reviewId: string,
): Promise<boolean> {
  try {
    const filePath = getReviewFilePath(projectPath, reviewId);
    await fs.unlink(filePath);
    console.log(`[ReviewStorage] Review ${reviewId} deleted`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false; // File didn't exist
    }
    console.error('[ReviewStorage] Failed to delete review:', error);
    throw error;
  }
}

/**
 * List all review IDs for a project.
 */
export async function listReviews(projectPath: string): Promise<string[]> {
  try {
    const reviewsDir = getReviewsDir(projectPath);
    const files = await fs.readdir(reviewsDir);

    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // Directory doesn't exist yet
    }
    console.error('[ReviewStorage] Failed to list reviews:', error);
    throw error;
  }
}

/**
 * Load all reviews for a project.
 */
export async function loadAllReviews(projectPath: string): Promise<ReviewData[]> {
  const reviewIds = await listReviews(projectPath);
  const reviews: ReviewData[] = [];

  for (const id of reviewIds) {
    const review = await loadReview(projectPath, id);
    if (review) {
      reviews.push(review);
    }
  }

  // Sort by updatedAt descending (most recent first)
  return reviews.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Find or create a review for a specific branch combination.
 */
export async function findReviewByBranches(
  projectPath: string,
  baseBranch: string,
  compareBranch: string,
): Promise<ReviewData | null> {
  const reviews = await loadAllReviews(projectPath);
  return (
    reviews.find(
      (r) => r.baseBranch === baseBranch && r.compareBranch === compareBranch,
    ) || null
  );
}

/**
 * Set up IPC handlers for review storage operations.
 */
export function setupReviewStorageIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('review:save', async (_, review: ReviewData) => {
    await saveReview(review);
  });

  ipcMain.handle(
    'review:load',
    async (_, projectPath: string, reviewId: string) => {
      return loadReview(projectPath, reviewId);
    },
  );

  ipcMain.handle(
    'review:delete',
    async (_, projectPath: string, reviewId: string) => {
      return deleteReview(projectPath, reviewId);
    },
  );

  ipcMain.handle('review:list', async (_, projectPath: string) => {
    return listReviews(projectPath);
  });

  ipcMain.handle('review:loadAll', async (_, projectPath: string) => {
    return loadAllReviews(projectPath);
  });

  ipcMain.handle(
    'review:findByBranches',
    async (_, projectPath: string, baseBranch: string, compareBranch: string) => {
      return findReviewByBranches(projectPath, baseBranch, compareBranch);
    },
  );
}
