import { useMemo } from 'react';

export interface FatigueColorScheme {
  text: string;
  bg: string;
  hex: string;
  label: string;
}

/**
 * Get color schemes based on Borg CR10 fatigue level (non-hook version)
 * @param level - The fatigue level (0-10)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function getFatigueColors(level: number): FatigueColorScheme {
  const normalizedLevel = Math.round(Math.max(0, Math.min(10, level)));

  switch (normalizedLevel) {
    case 0:
    case 1:
      return { label: 'Very Light Effort', bg: 'bg-red-500', text: 'text-red-600', hex: '#ef4444' };
    case 2:
      return { label: 'Light Effort', bg: 'bg-orange-500', text: 'text-orange-600', hex: '#f97316' };
    case 3:
      return { label: 'Moderate Effort', bg: 'bg-yellow-500', text: 'text-yellow-600', hex: '#eab308' };
    case 4:
    case 5:
    case 6:
      return { label: 'Optimal Effort', bg: 'bg-green-500', text: 'text-green-600', hex: '#22c55e' };
    case 7:
      return { label: 'Vigorous Effort', bg: 'bg-yellow-500', text: 'text-yellow-600', hex: '#eab308' };
    case 8:
      return { label: 'Hard Effort', bg: 'bg-orange-500', text: 'text-orange-600', hex: '#f97316' };
    case 9:
    case 10:
      return { label: 'Maximum Effort', bg: 'bg-red-500', text: 'text-red-600', hex: '#ef4444' };
    default:
      return { label: 'Unknown', bg: 'bg-gray-400', text: 'text-gray-500', hex: '#9ca3af' };
  }
}

/**
 * Hook that returns color schemes based on Borg CR10 fatigue level
 * @param level - The fatigue level (0-10)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function useFatigueColors(level: number): FatigueColorScheme {
  return useMemo(() => getFatigueColors(level), [level]);
} 