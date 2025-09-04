import { getScoreColors } from '@/hooks/useScoreColors';

// Semantic colors for performance scores - delegating to single source of truth
export const getPerformanceColor = (score: number) => {
  const baseColors = getScoreColors(score);
  
  // Add border property for backward compatibility
  return {
    ...baseColors,
    border: getBorderColorFromHex(baseColors.hex)
  };
};

// Helper function to convert hex colors to Tailwind border classes
const getBorderColorFromHex = (hex: string): string => {
  const colorMap: Record<string, string> = {
    '#22c55e': 'border-green-500',
    '#06b6d4': 'border-cyan-500', 
    '#eab308': 'border-yellow-500',
    '#ef4444': 'border-red-500'
  };
  return colorMap[hex] || 'border-gray-300';
};

// Specialized color functions for specific domains
export const getSymmetryColor = (score: number) => {
  const baseColors = getScoreColors(score);
  
  // Custom labels for symmetry scoring
  const symmetryLabels: Record<string, string> = {
    'Excellent': 'Excellent Balance',
    'Good': 'Good Balance', 
    'Satisfactory': 'Moderate Asymmetry',
    'Needs Improvement': 'Significant Asymmetry'
  };
  
  return {
    ...baseColors,
    label: symmetryLabels[baseColors.label] || baseColors.label
  };
};

export const getEffortColor = (score: number) => {
  const baseColors = getScoreColors(score);
  
  // Custom labels for effort scoring
  const effortLabels: Record<string, string> = {
    'Excellent': 'Optimal Effort',
    'Good': 'Good Effort',
    'Satisfactory': 'Moderate Effort', 
    'Needs Improvement': 'Suboptimal Effort'
  };
  
  return {
    ...baseColors,
    label: effortLabels[baseColors.label] || baseColors.label
  };
};

// Couleurs spécifiques pour chaque composant de l'équation (cohérentes avec l'UI)
export const getComponentColors = (sessionParams?: any) => {
  const mvcThreshold = sessionParams?.session_mvc_threshold_percentage ?? 75;
  const durationThreshold = sessionParams?.contraction_duration_threshold ?? 2000;

  return {
    completion: {
      hex: '#3b82f6',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-50',
      name: 'Session Completion',
      description: 'Percentage of expected contractions completed during the session'
    },
    mvcQuality: {
      hex: '#059669',
      text: 'text-emerald-600',
      hover: 'hover:bg-emerald-50',
      name: 'MVC Quality',
      description: `Percentage of contractions reaching therapeutic intensity (≥${mvcThreshold}% MVC)`
    },
    qualityThreshold: {
      hex: '#d97706',
      text: 'text-amber-600',
      hover: 'hover:bg-amber-50',
      name: 'Quality Threshold',
      description: `Percentage of contractions meeting adaptive quality threshold (≥${durationThreshold}ms)`
    },
    symmetry: {
      hex: '#7c3aed',
      text: 'text-purple-600',
      hover: 'hover:bg-purple-50',
      name: 'Bilateral Symmetry',
      description: 'Balance between left and right muscle performance'
    },
    effort: {
      hex: '#dc2626',
      text: 'text-red-600',
      hover: 'hover:bg-red-50',
      name: 'Subjective Effort',
      description: 'Perceived exertion assessment using Borg CR10 scale'
    },
    gameScore: {
      hex: '#6b7280',
      text: 'text-gray-600',
      hover: 'hover:bg-gray-50',
      name: 'Game Performance',
      description: 'Normalized GHOSTLY game score (experimental feature)'
    }
  };
};