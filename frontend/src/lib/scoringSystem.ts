/**
 * Central scoring system configuration
 * Single source of truth for performance score thresholds, colors, and labels
 */

export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  SATISFACTORY: 40,
} as const;

export const SCORE_STYLES = {
  excellent: {
    label: 'Excellent' as const,
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    hex: '#10b981', // emerald-500
  },
  good: {
    label: 'Good' as const,
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    hex: '#3b82f6', // blue-500
  },
  satisfactory: {
    label: 'Satisfactory' as const,
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    hex: '#f59e0b', // amber-500
  },
  needsImprovement: {
    label: 'Needs Improvement' as const,
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-500',
    hex: '#ef4444', // red-500
  },
} as const;

export interface ScoreColorScheme {
  text: string;
  bg: string;
  hex: string;
  label: string;
  border: string;
}

/**
 * Get score style based on numeric score
 * @param score - The score value (0-100)
 * @returns Score style configuration
 */
export function getScoreStyle(score: number): ScoreColorScheme {
  if (score >= SCORE_THRESHOLDS.EXCELLENT) {
    return SCORE_STYLES.excellent;
  } else if (score >= SCORE_THRESHOLDS.GOOD) {
    return SCORE_STYLES.good;
  } else if (score >= SCORE_THRESHOLDS.SATISFACTORY) {
    return SCORE_STYLES.satisfactory;
  }
  return SCORE_STYLES.needsImprovement;
}

/**
 * Convert hex color to Tailwind border class
 * @param hexColor - Hex color string
 * @returns Tailwind border class
 */
export function hexToBorderClass(hexColor: string): string {
  const colorMap: Record<string, string> = {
    '#10b981': 'border-emerald-500',
    '#3b82f6': 'border-blue-500',
    '#f59e0b': 'border-amber-500',
    '#ef4444': 'border-red-500',
  };
  
  return colorMap[hexColor] || 'border-gray-200';
}

export type ScoreLabel = typeof SCORE_STYLES[keyof typeof SCORE_STYLES]['label'];