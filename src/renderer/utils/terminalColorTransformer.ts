/**
 * Transforms true color (24-bit RGB) ANSI escape sequences in terminal output
 * to use theme-appropriate colors instead of hardcoded bright colors.
 *
 * Claude Code uses true color sequences like \e[48;2;R;G;Bm for diff highlighting.
 * These bypass the terminal's 16-color palette, so we need to intercept and replace them.
 */

export interface ColorMapping {
  // Source RGB (what Claude Code outputs)
  from: { r: number; g: number; b: number };
  // Target RGB (what we want to display)
  to: { r: number; g: number; b: number };
  // Tolerance for matching (to handle slight variations)
  tolerance?: number;
}

// Default color mappings for diff highlighting
// These map Claude Code's bright colors to more muted versions
const DEFAULT_COLOR_MAPPINGS: ColorMapping[] = [
  // === RED BACKGROUNDS (deletions) ===
  // Very bright reds -> muted dark red
  { from: { r: 255, g: 85, b: 85 }, to: { r: 100, g: 45, b: 45 }, tolerance: 40 },
  { from: { r: 255, g: 100, b: 100 }, to: { r: 100, g: 45, b: 45 }, tolerance: 40 },
  { from: { r: 255, g: 50, b: 50 }, to: { r: 100, g: 45, b: 45 }, tolerance: 40 },
  { from: { r: 220, g: 50, b: 50 }, to: { r: 95, g: 42, b: 42 }, tolerance: 40 },
  { from: { r: 200, g: 50, b: 50 }, to: { r: 90, g: 40, b: 40 }, tolerance: 40 },
  { from: { r: 180, g: 40, b: 40 }, to: { r: 85, g: 38, b: 38 }, tolerance: 40 },
  { from: { r: 150, g: 40, b: 40 }, to: { r: 80, g: 36, b: 36 }, tolerance: 40 },
  // Medium reds
  { from: { r: 139, g: 0, b: 0 }, to: { r: 75, g: 32, b: 32 }, tolerance: 30 },
  { from: { r: 128, g: 0, b: 0 }, to: { r: 70, g: 30, b: 30 }, tolerance: 30 },
  // Dark reds
  { from: { r: 100, g: 30, b: 30 }, to: { r: 65, g: 30, b: 30 }, tolerance: 25 },
  { from: { r: 80, g: 20, b: 20 }, to: { r: 55, g: 28, b: 28 }, tolerance: 25 },
  { from: { r: 60, g: 20, b: 20 }, to: { r: 50, g: 26, b: 26 }, tolerance: 25 },

  // === GREEN BACKGROUNDS (additions) ===
  // Very bright greens -> muted dark green
  { from: { r: 85, g: 255, b: 85 }, to: { r: 45, g: 90, b: 55 }, tolerance: 40 },
  { from: { r: 100, g: 255, b: 100 }, to: { r: 45, g: 90, b: 55 }, tolerance: 40 },
  { from: { r: 50, g: 255, b: 50 }, to: { r: 45, g: 90, b: 55 }, tolerance: 40 },
  { from: { r: 50, g: 220, b: 50 }, to: { r: 42, g: 85, b: 52 }, tolerance: 40 },
  { from: { r: 50, g: 200, b: 50 }, to: { r: 40, g: 80, b: 50 }, tolerance: 40 },
  { from: { r: 80, g: 200, b: 80 }, to: { r: 40, g: 80, b: 50 }, tolerance: 40 },
  { from: { r: 40, g: 180, b: 40 }, to: { r: 38, g: 75, b: 48 }, tolerance: 40 },
  { from: { r: 40, g: 150, b: 40 }, to: { r: 36, g: 70, b: 45 }, tolerance: 40 },
  // Medium greens
  { from: { r: 0, g: 139, b: 0 }, to: { r: 32, g: 65, b: 40 }, tolerance: 30 },
  { from: { r: 0, g: 128, b: 0 }, to: { r: 30, g: 60, b: 38 }, tolerance: 30 },
  { from: { r: 0, g: 100, b: 0 }, to: { r: 28, g: 55, b: 35 }, tolerance: 30 },
  // Dark greens
  { from: { r: 30, g: 100, b: 30 }, to: { r: 30, g: 55, b: 35 }, tolerance: 25 },
  { from: { r: 20, g: 80, b: 20 }, to: { r: 28, g: 50, b: 32 }, tolerance: 25 },
  { from: { r: 20, g: 60, b: 20 }, to: { r: 26, g: 45, b: 30 }, tolerance: 25 },
];

/**
 * Check if two colors match within a tolerance
 */
function colorsMatch(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  tolerance: number
): boolean {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance
  );
}

/**
 * Find a matching color mapping for the given RGB values
 */
function findColorMapping(
  r: number,
  g: number,
  b: number,
  mappings: ColorMapping[]
): ColorMapping | null {
  for (const mapping of mappings) {
    const tolerance = mapping.tolerance ?? 10;
    if (colorsMatch({ r, g, b }, mapping.from, tolerance)) {
      return mapping;
    }
  }
  return null;
}

/**
 * Detect if a color is "red-ish" (red dominant, used for deletions)
 */
function isRedDominant(r: number, g: number, b: number): boolean {
  // Red should be significantly higher than green and blue
  return r > 100 && r > g * 1.5 && r > b * 1.5;
}

/**
 * Detect if a color is "green-ish" (green dominant, used for additions)
 */
function isGreenDominant(r: number, g: number, b: number): boolean {
  // Green should be significantly higher than red and blue
  return g > 100 && g > r * 1.5 && g > b * 1.3;
}

/**
 * Convert a bright/saturated color to a muted version
 * Preserves the hue but reduces saturation and brightness
 */
function muteColor(r: number, g: number, b: number): { r: number; g: number; b: number } {
  const max = Math.max(r, g, b);

  // Target: darker and less saturated
  // Scale down the brightness significantly
  const brightnessScale = Math.min(0.4, 80 / Math.max(max, 1));

  // Desaturate by moving towards gray
  const gray = (r + g + b) / 3;
  const saturationScale = 0.6; // Keep 60% of the saturation

  const maxSafe = Math.max(max, 1);
  const newR = Math.round(gray + (r - gray) * saturationScale * brightnessScale * (255 / maxSafe));
  const newG = Math.round(gray + (g - gray) * saturationScale * brightnessScale * (255 / maxSafe));
  const newB = Math.round(gray + (b - gray) * saturationScale * brightnessScale * (255 / maxSafe));

  return {
    r: Math.max(20, Math.min(120, newR)),
    g: Math.max(20, Math.min(120, newG)),
    b: Math.max(20, Math.min(120, newB)),
  };
}

// Regex to match true color (24-bit) ANSI sequences
// Matches: \e[38;2;R;G;Bm (foreground) and \e[48;2;R;G;Bm (background)
// eslint-disable-next-line no-control-regex
const TRUE_COLOR_REGEX = /\x1b\[(38|48);2;(\d{1,3});(\d{1,3});(\d{1,3})m/g;

// Regex to match 256-color ANSI sequences
// Matches: \e[38;5;Nm (foreground) and \e[48;5;Nm (background)
// eslint-disable-next-line no-control-regex
const COLOR_256_REGEX = /\x1b\[(38|48);5;(\d{1,3})m/g;

// 256-color mappings for diff highlighting
// Maps bright/saturated 256-colors to more muted versions
const COLOR_256_MAPPINGS: Record<number, number> = {
  // Background colors used by Claude Code for diffs
  52: 235, // Dark red bg (52) -> very dark gray with red tint (use 235 = dark gray)
  22: 235, // Dark green bg (22) -> very dark gray with green tint
  28: 236, // Medium green bg (28) -> slightly lighter dark gray

  // Foreground colors (red tones)
  167: 131, // Red text -> more muted red
  203: 131, // Bright red -> muted red
  196: 131, // Pure red -> muted red

  // Foreground colors (green tones)
  77: 65, // Green text -> muted green
  114: 65, // Light green -> muted green
  82: 65, // Bright green -> muted green
};

// Custom muted colors for diff backgrounds (as 256-color approximations)
// These provide better contrast while being less harsh
const MUTED_DIFF_COLORS: Record<number, { r: number; g: number; b: number }> = {
  52: { r: 60, g: 35, b: 35 }, // Muted dark red
  22: { r: 35, g: 55, b: 40 }, // Muted dark green
  28: { r: 40, g: 65, b: 45 }, // Muted medium green
};

/**
 * Transform terminal output to replace bright true colors with muted versions
 * Note: Claude Code uses reverse video (\e[7m) with ANSI colors, not true color.
 * The ANSI colors in the theme handle this case.
 * This function handles any true color sequences that might appear.
 */
export function transformTerminalColors(
  data: string,
  mappings: ColorMapping[] = DEFAULT_COLOR_MAPPINGS
): string {
  // First, transform 256-color sequences (this is what Claude Code uses for diffs)
  const transformed = data.replace(COLOR_256_REGEX, (match, type, colorStr) => {
    const colorNum = parseInt(colorStr, 10);

    // Only transform background colors (type 48) for diff highlighting
    if (type === '48') {
      const mutedColor = MUTED_DIFF_COLORS[colorNum];
      if (mutedColor) {
        // Convert to true color for precise control
        return `\x1b[48;2;${mutedColor.r};${mutedColor.g};${mutedColor.b}m`;
      }
    }

    // Check if we have a simple mapping
    const mappedColor = COLOR_256_MAPPINGS[colorNum];
    if (mappedColor !== undefined) {
      return `\x1b[${type};5;${mappedColor}m`;
    }

    return match;
  });

  // Then transform true color sequences (24-bit RGB)
  return transformed.replace(TRUE_COLOR_REGEX, (match, type, rStr, gStr, bStr) => {
    const r = parseInt(rStr, 10);
    const g = parseInt(gStr, 10);
    const b = parseInt(bStr, 10);

    // First, try to find an exact mapping
    const mapping = findColorMapping(r, g, b, mappings);
    if (mapping) {
      return `\x1b[${type};2;${mapping.to.r};${mapping.to.g};${mapping.to.b}m`;
    }

    // Only transform background colors (type 48), not foreground (type 38)
    if (type === '48') {
      // Fallback: detect red-ish or green-ish colors and mute them
      if (isRedDominant(r, g, b) || isGreenDominant(r, g, b)) {
        const muted = muteColor(r, g, b);
        return `\x1b[${type};2;${muted.r};${muted.g};${muted.b}m`;
      }
    }

    return match;
  });
}

/**
 * Create a color transformer with custom mappings
 */
export function createColorTransformer(customMappings?: ColorMapping[]) {
  const mappings = customMappings ?? DEFAULT_COLOR_MAPPINGS;
  return (data: string) => transformTerminalColors(data, mappings);
}
