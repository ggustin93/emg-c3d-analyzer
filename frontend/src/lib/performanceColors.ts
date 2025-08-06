// Couleurs sémantiques pour les scores de performance
export const getPerformanceColor = (score: number) => {
  if (score >= 90) return {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    hex: '#10b981',
    label: 'Excellent'
  };
  if (score >= 80) return {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    hex: '#22c55e',
    label: 'Good'
  };
  if (score >= 70) return {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    hex: '#eab308',
    label: 'Fair'
  };
  if (score >= 60) return {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    hex: '#f97316',
    label: 'Needs Improvement'
  };
  return {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    hex: '#ef4444',
    label: 'Poor'
  };
};

export const getSymmetryColor = (score: number) => {
  if (score >= 90) return {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    hex: '#10b981',
    label: 'Excellent Balance'
  };
  if (score >= 80) return {
    bg: 'bg-green-100',
    text: 'text-green-800',
    hex: '#22c55e',
    label: 'Good Balance'
  };
  if (score >= 70) return {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    hex: '#eab308',
    label: 'Moderate Asymmetry'
  };
  return {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    hex: '#f97316',
    label: 'Significant Asymmetry'
  };
};

export const getEffortColor = (score: number) => {
  if (score >= 90) return {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    hex: '#10b981',
    label: 'Optimal Effort'
  };
  if (score >= 80) return {
    bg: 'bg-green-100',
    text: 'text-green-800',
    hex: '#22c55e',
    label: 'Good Effort'
  };
  if (score >= 60) return {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    hex: '#eab308',
    label: 'Moderate Effort'
  };
  return {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    hex: '#f97316',
    label: 'Suboptimal Effort'
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