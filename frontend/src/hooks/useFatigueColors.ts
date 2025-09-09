import { useMemo } from 'react';

export interface FatigueColorScheme {
  text: string;
  bg: string;
  progress: string;
  hex: string;
  label: string;
}

/**
 * Get color schemes based on Borg CR10 fatigue level (non-hook version)
 * Uses centralized color system with emerald and amber colors
 * @param level - The fatigue level (0-10)
 * @returns Color scheme object with text, background, progress, hex colors and label
 */
export function getFatigueColors(level: number): FatigueColorScheme {
  const normalizedLevel = Math.round(Math.max(0, Math.min(10, level)));

  switch (normalizedLevel) {
    case 0:
    case 1:
      return { 
        label: 'Very Light Effort', 
        bg: 'bg-red-50', 
        progress: 'bg-red-500',
        text: 'text-red-600', 
        hex: '#ef4444' 
      };
    case 2:
      return { 
        label: 'Light Effort', 
        bg: 'bg-orange-50', 
        progress: 'bg-orange-500',
        text: 'text-orange-600', 
        hex: '#f97316' 
      };
    case 3:
      return { 
        label: 'Moderate Effort', 
        bg: 'bg-amber-50', 
        progress: 'bg-amber-500',
        text: 'text-amber-600', 
        hex: '#f59e0b' 
      };
    case 4:
    case 5:
    case 6:
      return { 
        label: 'Optimal Effort', 
        bg: 'bg-emerald-50', 
        progress: 'bg-emerald-500',
        text: 'text-emerald-600', 
        hex: '#10b981' 
      };
    case 7:
      return { 
        label: 'Vigorous Effort', 
        bg: 'bg-amber-50', 
        progress: 'bg-amber-500',
        text: 'text-amber-600', 
        hex: '#f59e0b' 
      };
    case 8:
      return { 
        label: 'Hard Effort', 
        bg: 'bg-orange-50', 
        progress: 'bg-orange-500',
        text: 'text-orange-600', 
        hex: '#f97316' 
      };
    case 9:
    case 10:
      return { 
        label: 'Maximum Effort', 
        bg: 'bg-red-50', 
        progress: 'bg-red-500',
        text: 'text-red-600', 
        hex: '#ef4444' 
      };
    default:
      return { 
        label: 'Unknown', 
        bg: 'bg-gray-50', 
        progress: 'bg-gray-400',
        text: 'text-gray-500', 
        hex: '#9ca3af' 
      };
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