import { useMemo } from 'react';
import { getScoreStyle, type ScoreColorScheme } from '@/lib/scoringSystem';

// Re-export types from central configuration
export type { ScoreColorScheme } from '@/lib/scoringSystem';

/**
 * Get color schemes based on score thresholds (non-hook version for use in callbacks)
 * @param score - The score value (0-100)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function getScoreColors(score: number): ScoreColorScheme {
  return getScoreStyle(score);
}

/**
 * Hook that returns color schemes based on score thresholds
 * @param score - The score value (0-100)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function useScoreColors(score: number): ScoreColorScheme {
  return useMemo(() => getScoreColors(score), [score]);
} 