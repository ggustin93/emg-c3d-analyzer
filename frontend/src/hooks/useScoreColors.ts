import { useMemo } from 'react';

export interface ScoreColorScheme {
  text: string;
  bg: string;
  hex: string;
  label: string;
}

/**
 * Get color schemes based on score thresholds (non-hook version for use in callbacks)
 * @param score - The score value (0-100)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function getScoreColors(score: number): ScoreColorScheme {
  if (score >= 85) {
    return {
      text: 'text-green-500',
      bg: 'bg-green-500',
      hex: '#22c55e', // Tailwind green-500
      label: 'Excellent'
    };
  } else if (score >= 70) {
    return {
      text: 'text-cyan-500',
      bg: 'bg-cyan-500',
      hex: '#06b6d4', // Tailwind cyan-500
      label: 'Good'
    };
  } else if (score >= 55) {
    return {
      text: 'text-yellow-500',
      bg: 'bg-yellow-500',
      hex: '#eab308', // Tailwind yellow-500
      label: 'Satisfactory'
    };
  } else {
    return {
      text: 'text-red-500',
      bg: 'bg-red-500',
      hex: '#ef4444', // Tailwind red-500
      label: 'Needs Improvement'
    };
  }
}

/**
 * Hook that returns color schemes based on score thresholds
 * @param score - The score value (0-100)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function useScoreColors(score: number): ScoreColorScheme {
  return useMemo(() => getScoreColors(score), [score]);
} 