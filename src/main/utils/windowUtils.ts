import { screen } from 'electron';

/**
 * Constrains window dimensions to a percentage of the screen's work area size.
 * This ensures windows don't exceed the available screen space, especially
 * useful for users with smaller displays.
 *
 * @param preferredWidth - The desired window width
 * @param preferredHeight - The desired window height
 * @param maxScreenPercent - Maximum percentage of screen size (0-1), defaults to 0.9 (90%)
 * @returns The constrained width and height
 */
export function getConstrainedWindowSize(
  preferredWidth: number,
  preferredHeight: number,
  maxScreenPercent = 0.9
): { width: number; height: number } {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const maxWidth = Math.floor(screenWidth * maxScreenPercent);
  const maxHeight = Math.floor(screenHeight * maxScreenPercent);
  return {
    width: Math.min(preferredWidth, maxWidth),
    height: Math.min(preferredHeight, maxHeight),
  };
}
