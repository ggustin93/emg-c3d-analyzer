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
  const normalizedLevel = Math.max(0, Math.min(10, level));

  if (normalizedLevel === 0) return { label: 'No Exertion', bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' };
  if (normalizedLevel <= 1) return { label: 'Very Light', bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' };
  if (normalizedLevel <= 3) return { label: 'Light', bg: 'bg-green-500', text: 'text-green-600', hex: '#22c55e' };
  if (normalizedLevel <= 5) return { label: 'Moderate', bg: 'bg-amber-500', text: 'text-amber-600', hex: '#eab308' };
  if (normalizedLevel <= 7) return { label: 'Vigorous', bg: 'bg-orange-500', text: 'text-orange-600', hex: '#f97316' };
  if (normalizedLevel <= 9) return { label: 'Very Hard', bg: 'bg-red-500', text: 'text-red-600', hex: '#ef4444' };
  return { label: 'Maximum', bg: 'bg-red-700', text: 'text-red-700', hex: '#b91c1c' };
}

/**
 * Hook that returns color schemes based on Borg CR10 fatigue level
 * @param level - The fatigue level (0-10)
 * @returns Color scheme object with text, background, hex colors and label
 */
export function useFatigueColors(level: number): FatigueColorScheme {
  return useMemo(() => getFatigueColors(level), [level]);
} 