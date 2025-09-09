/**
 * Unified Color System
 * Centralized color management following DRY, KISS, and SOLID principles
 */

import { useMemo } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ColorScheme {
  text: string;
  bg: string;
  border: string;  // Made required for consistency
  progress?: string;
  hex: string;
  label?: string;
  stroke: string;  // Made required for chart usage
  fill?: string;
  symbol?: string;
}

export type ColorContext = 
  | 'score'
  | 'fatigue' 
  | 'quality'
  | 'channel'
  | 'muscle'
  | 'patient'
  | 'therapist';

export interface ColorConfig {
  context: ColorContext;
  value: number | string;
  customColors?: Record<string, string>;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

const PALETTES = {
  performance: {
    excellent: { 
      text: 'text-emerald-700', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-300',
      progress: 'bg-emerald-500',
      hex: '#10b981',
      stroke: '#10b981',
      label: 'Excellent'
    },
    good: { 
      text: 'text-cyan-700', 
      bg: 'bg-cyan-50', 
      border: 'border-cyan-300',
      progress: 'bg-cyan-500',
      hex: '#06b6d4',
      stroke: '#06b6d4',
      label: 'Good'
    },
    adequate: { 
      text: 'text-amber-700', 
      bg: 'bg-amber-50', 
      border: 'border-amber-300',
      progress: 'bg-amber-500',
      hex: '#f59e0b',
      stroke: '#f59e0b',
      label: 'Adequate'
    },
    poor: { 
      text: 'text-red-700', 
      bg: 'bg-red-50', 
      border: 'border-red-300',
      progress: 'bg-red-500',
      hex: '#ef4444',
      stroke: '#ef4444',
      label: 'Poor'
    }
  },
  
  quality: {
    good: { 
      fill: 'rgba(16,185,129,0.28)', 
      stroke: '#047857',
      hex: '#047857',
      symbol: '✓'
    },
    adequate: { 
      fill: 'rgba(245,158,11,0.24)', 
      stroke: '#b45309',
      hex: '#b45309',
      symbol: 'F'
    },
    poor: { 
      fill: 'rgba(239,68,68,0.24)', 
      stroke: '#b91c1c',
      hex: '#b91c1c',
      symbol: '✗'
    }
  },

  neutral: { 
    text: 'text-gray-600', 
    bg: 'bg-gray-100', 
    border: 'border-gray-300',
    hex: '#9ca3af',
    stroke: '#9ca3af',
    label: 'Unknown'
  },

  // Joyful palette for patients
  joyful: [
    { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200', hex: '#84cc16' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#f59e0b' },
    { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', hex: '#f97316' },
    { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', hex: '#d946ef' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', hex: '#f43f5e' },
  ],

  // Professional palette for therapists
  professional: [
    { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-700', hex: '#0284c7' },
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-700', hex: '#4f46e5' },
    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-700', hex: '#7c3aed' },
    { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-700', hex: '#475569' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-700', hex: '#0891b2' },
    { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-700', hex: '#0f766e' },
  ],

  // Channel colors
  channels: [
    { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', stroke: '#06b6d4', hex: '#06b6d4' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#10b981', hex: '#10b981' },
    { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', stroke: '#ff7675', hex: '#ff7675' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', stroke: '#9b59b6', hex: '#9b59b6' },
  ]
} as const;

// Muscle-specific mapping
const MUSCLE_MAPPING: Record<string, ColorScheme> = {
  'Left Quadriceps': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', stroke: '#3b82f6', hex: '#3b82f6' },
  'Right Quadriceps': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', stroke: '#ef4444', hex: '#ef4444' },
  'Left Hamstrings': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#10b981', hex: '#10b981' },
  'Right Hamstrings': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', stroke: '#8b5cf6', hex: '#8b5cf6' },
  'Left Gastrocnemius': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', stroke: '#f97316', hex: '#f97316' },
  'Right Gastrocnemius': { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', stroke: '#ec4899', hex: '#ec4899' },
  'Left Tibialis Anterior': { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', stroke: '#06b6d4', hex: '#06b6d4' },
  'Right Tibialis Anterior': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', stroke: '#6366f1', hex: '#6366f1' },
  'Left Biceps': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#059669', hex: '#059669' },
  'Right Biceps': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', stroke: '#d97706', hex: '#d97706' },
  'Left Triceps': { bg: 'bg-lime-50', border: 'border-lime-300', text: 'text-lime-700', stroke: '#65a30d', hex: '#65a30d' },
  'Right Triceps': { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', stroke: '#e11d48', hex: '#e11d48' },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getStringHash = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

// ============================================================================
// COLOR RESOLVERS
// ============================================================================

const resolveScoreColor = (score: number): ColorScheme => {
  if (score >= 75) return PALETTES.performance.excellent;
  if (score >= 50) return PALETTES.performance.good;
  if (score >= 25) return PALETTES.performance.adequate;
  return PALETTES.performance.poor;
};

const resolveFatigueColor = (level: number): ColorScheme => {
  const normalizedLevel = Math.round(Math.max(0, Math.min(10, level)));
  
  // Map fatigue levels to color schemes
  const fatigueMap: Record<number, { label: string; scheme: ColorScheme }> = {
    0: { label: 'Very Light Effort', scheme: PALETTES.performance.poor },
    1: { label: 'Very Light Effort', scheme: PALETTES.performance.poor },
    2: { label: 'Light Effort', scheme: { ...PALETTES.performance.adequate, bg: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316', stroke: '#f97316' } },
    3: { label: 'Moderate Effort', scheme: PALETTES.performance.adequate },
    4: { label: 'Optimal Effort', scheme: PALETTES.performance.excellent },
    5: { label: 'Optimal Effort', scheme: PALETTES.performance.excellent },
    6: { label: 'Optimal Effort', scheme: PALETTES.performance.excellent },
    7: { label: 'Vigorous Effort', scheme: PALETTES.performance.adequate },
    8: { label: 'Hard Effort', scheme: { ...PALETTES.performance.adequate, bg: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316', stroke: '#f97316' } },
    9: { label: 'Maximum Effort', scheme: PALETTES.performance.poor },
    10: { label: 'Maximum Effort', scheme: PALETTES.performance.poor },
  };

  const mapping = fatigueMap[normalizedLevel] || { label: 'Unknown', scheme: PALETTES.neutral };
  return { ...mapping.scheme, label: mapping.label };
};

const resolveQualityColor = (flags: { isGood: boolean; meetsMvc: boolean; meetsDuration: boolean }): ColorScheme => {
  const defaultScheme = { 
    text: 'text-gray-700', 
    bg: 'bg-gray-50', 
    border: 'border-gray-300',
    stroke: '#000000',
    hex: '#000000'
  };
  
  if (flags.isGood) {
    return { 
      ...defaultScheme, 
      ...PALETTES.quality.good,
      stroke: PALETTES.quality.good.stroke,
      hex: PALETTES.quality.good.hex
    };
  }
  if ((flags.meetsMvc && !flags.meetsDuration) || (!flags.meetsMvc && flags.meetsDuration)) {
    const symbol = flags.meetsMvc ? 'F' : 'D';
    return { 
      ...defaultScheme, 
      ...PALETTES.quality.adequate, 
      symbol,
      stroke: PALETTES.quality.adequate.stroke,
      hex: PALETTES.quality.adequate.hex
    };
  }
  return { 
    ...defaultScheme, 
    ...PALETTES.quality.poor,
    stroke: PALETTES.quality.poor.stroke,
    hex: PALETTES.quality.poor.hex
  };
};

const resolveChannelColor = (index: number | string, customColors?: Record<string, string>): ColorScheme => {
  const idx = typeof index === 'string' ? parseInt(index.replace(/\D/g, '')) - 1 : index;
  const baseColor = PALETTES.channels[idx % PALETTES.channels.length];
  
  if (customColors && typeof index === 'string' && customColors[index]) {
    return { 
      ...baseColor, 
      hex: customColors[index], 
      stroke: customColors[index],
      border: baseColor.border || 'border-gray-300'
    };
  }
  
  return { ...baseColor, border: baseColor.border || 'border-gray-300' };
};

const resolveMuscleColor = (muscleName: string, customColors?: Record<string, string>): ColorScheme => {
  const fallback = { ...PALETTES.channels[0], border: PALETTES.channels[0].border || 'border-gray-300' };
  
  if (customColors && customColors[muscleName]) {
    const baseColor = MUSCLE_MAPPING[muscleName] || fallback;
    return { 
      ...baseColor, 
      hex: customColors[muscleName], 
      stroke: customColors[muscleName],
      border: baseColor.border || 'border-gray-300'
    };
  }
  
  const muscleColor = MUSCLE_MAPPING[muscleName];
  if (muscleColor) {
    return { ...muscleColor, border: muscleColor.border || 'border-gray-300' };
  }
  
  return fallback;
};

const resolveHashColor = (id: string, palette: typeof PALETTES.joyful | typeof PALETTES.professional): ColorScheme => {
  if (!id || id === 'Unknown') {
    return { ...PALETTES.neutral, stroke: PALETTES.neutral.hex };
  }
  const hash = getStringHash(id);
  const index = hash % palette.length;
  const color = palette[index];
  return { ...color, stroke: color.hex || '#000000' };
};

// ============================================================================
// MAIN COLOR RESOLVER
// ============================================================================

export function getColorScheme(config: ColorConfig): ColorScheme {
  const { context, value, customColors } = config;

  switch (context) {
    case 'score':
      return resolveScoreColor(value as number);
    
    case 'fatigue':
      return resolveFatigueColor(value as number);
    
    case 'quality':
      return resolveQualityColor(value as any);
    
    case 'channel':
      return resolveChannelColor(value as number | string, customColors);
    
    case 'muscle':
      return resolveMuscleColor(value as string, customColors);
    
    case 'patient':
      return resolveHashColor(value as string, PALETTES.joyful);
    
    case 'therapist':
      return resolveHashColor(value as string, PALETTES.professional);
    
    default:
      return PALETTES.neutral;
  }
}

// ============================================================================
// UNIFIED HOOK
// ============================================================================

/**
 * Unified color hook following DRY principle
 * Single source of truth for all color needs
 */
export function useColorScheme(config: ColorConfig): ColorScheme {
  return useMemo(() => getColorScheme(config), [config.context, config.value, config.customColors]);
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// These maintain compatibility while migration happens
export const useScoreColors = (score: number) => useColorScheme({ context: 'score', value: score });
export const useFatigueColors = (level: number) => useColorScheme({ context: 'fatigue', value: level });
export const getScoreColors = (score: number) => getColorScheme({ context: 'score', value: score });
export const getFatigueColors = (level: number) => getColorScheme({ context: 'fatigue', value: level });

// Patient/Therapist colors need to map 'background' to 'bg' for backward compatibility
export const getPatientColorClasses = (id: string) => {
  const colors = getColorScheme({ context: 'patient', value: id });
  return { background: colors.bg, text: colors.text, border: colors.border || 'border-gray-300' };
};

export const getTherapistColorClasses = (id: string) => {
  const colors = getColorScheme({ context: 'therapist', value: id });
  return { background: colors.bg, text: colors.text, border: colors.border || 'border-gray-300' };
};

export const getChannelColor = (index: number) => getColorScheme({ context: 'channel', value: index });
export const getMuscleColor = (name: string, custom?: Record<string, string>) => 
  getColorScheme({ context: 'muscle', value: name, customColors: custom });
export const getContractionAreaColors = (flags: any) => getColorScheme({ context: 'quality', value: flags });

// ============================================================================
// PERFORMANCE COLOR SYSTEM MIGRATIONS
// ============================================================================

/**
 * Get progress bar specific colors
 * Used by Progress components for indicator styling
 */
export function getProgressBarColors(score: number) {
  const colors = getColorScheme({ context: 'score', value: score });
  return {
    bg: colors.progress || colors.stroke,
    hex: colors.hex,
    light: colors.progress,
    text: colors.text,
    hexDark: colors.hex, // For backward compatibility
    textDark: colors.text
  };
}

/**
 * Get component-specific colors for performance equation
 * Returns detailed color configs for each metric component
 */
export function getComponentColors(sessionParams?: any) {
  const mvcThreshold = sessionParams?.session_mvc_threshold_percentage ?? 75;
  const durationThreshold = sessionParams?.contraction_duration_threshold ?? 2000;
  
  return {
    completion: {
      hex: '#0891b2', // cyan-600
      text: 'text-cyan-600',
      hover: 'hover:bg-cyan-50',
      name: 'Session Completion',
      description: 'Percentage of expected contractions completed during the session'
    },
    mvcQuality: {
      hex: '#059669', // emerald-600
      text: 'text-emerald-600',
      hover: 'hover:bg-emerald-50',
      name: 'MVC Quality',
      description: `Percentage of contractions reaching therapeutic intensity (≥${mvcThreshold}% MVC)`
    },
    qualityThreshold: {
      hex: '#d97706', // amber-600
      text: 'text-amber-600',
      hover: 'hover:bg-amber-50',
      name: 'Quality Threshold',
      description: `Percentage of contractions meeting adaptive quality threshold (≥${durationThreshold}ms)`
    },
    symmetry: {
      hex: '#7c3aed', // purple-600
      text: 'text-purple-600',
      hover: 'hover:bg-purple-50',
      name: 'Bilateral Symmetry',
      description: 'Balance between left and right muscle performance'
    },
    effort: {
      hex: '#dc2626', // red-600
      text: 'text-red-600',
      hover: 'hover:bg-red-50',
      name: 'Subjective Effort',
      description: 'Perceived exertion assessment using Borg CR10 scale'
    },
    gameScore: {
      hex: '#6b7280', // gray-600
      text: 'text-gray-600',
      hover: 'hover:bg-gray-50',
      name: 'Game Performance',
      description: 'Normalized GHOSTLY game score (experimental feature)'
    }
  };
}

/**
 * Convert hex color to Tailwind border class
 * Utility function for dynamic border styling
 */
export function hexToBorderClass(hexColor: string): string {
  const colorMap: Record<string, string> = {
    '#10b981': 'border-emerald-500',
    '#059669': 'border-emerald-600',
    '#06b6d4': 'border-cyan-500',
    '#0891b2': 'border-cyan-600',
    '#f59e0b': 'border-amber-500',
    '#d97706': 'border-amber-600',
    '#ef4444': 'border-red-500',
    '#dc2626': 'border-red-600',
    '#8b5cf6': 'border-purple-500',
    '#7c3aed': 'border-purple-600',
    '#6b7280': 'border-gray-500',
    '#4b5563': 'border-gray-600',
  };
  
  return colorMap[hexColor] || 'border-gray-300';
}

/**
 * Special color definitions for specific UI elements
 */
export const SPECIAL_COLORS = {
  effort: {
    bg: 'bg-amber-600',
    hex: '#d97706',
    text: 'text-amber-700',
  },
  game: {
    bg: 'bg-slate-600',
    hex: '#64748b',
    text: 'text-slate-700',
  }
} as const;

/**
 * Performance thresholds for score categorization
 */
export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  SATISFACTORY: 40,
} as const;

/**
 * Patient ID color functions for badge styling
 */
export const getPatientColors = (patientId: string) => {
  const colors = [
    { background: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    { background: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    { background: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    { background: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    { background: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  ];
  
  if (!patientId || patientId === 'Unknown') {
    return { background: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };
  }
  
  // Use patient ID hash to get consistent color
  const hash = patientId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/**
 * Therapist ID color functions for badge styling
 */
export const getTherapistColors = (therapistId: string) => {
  const colors = [
    { text: 'text-indigo-600', border: 'border-indigo-300' },
    { text: 'text-emerald-600', border: 'border-emerald-300' },
    { text: 'text-rose-600', border: 'border-rose-300' },
    { text: 'text-amber-600', border: 'border-amber-300' },
    { text: 'text-violet-600', border: 'border-violet-300' },
  ];
  
  if (!therapistId || therapistId === 'Unknown') {
    return { text: 'text-gray-500', border: 'border-gray-300' };
  }
  
  // Use therapist ID hash to get consistent color
  const hash = therapistId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

// Legacy function names for smooth migration
export const getPerformanceColors = getScoreColors;
export const getPerformanceColor = getScoreColors;
export const getScoreStyle = getScoreColors;