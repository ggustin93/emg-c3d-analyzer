export const CHANNEL_COLORS: Record<number, { 
  bg: string, 
  border: string, 
  text: string,
  stroke: string // For chart lines
}> = {
  0: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', stroke: '#06b6d4' },
  1: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#10b981' },
  2: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', stroke: '#ff7675' },
  3: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', stroke: '#9b59b6' },
};

export const getChannelColor = (index: number) => {
  // Ensure CHANNEL_COLORS is defined before using Object.keys
  const colorsLength = CHANNEL_COLORS && typeof CHANNEL_COLORS === 'object' ? 
    Object.keys(CHANNEL_COLORS).length : 1;
  return CHANNEL_COLORS[index % colorsLength];
};

// Muscle-specific color mapping for consistent colors across the app
export const MUSCLE_COLORS: Record<string, { 
  bg: string, 
  border: string, 
  text: string,
  stroke: string 
}> = {
  'Left Quadriceps': { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', stroke: '#06b6d4' },
  'Right Quadriceps': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', stroke: '#ef4444' },
  'Left Hamstrings': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#10b981' },
  'Right Hamstrings': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', stroke: '#8b5cf6' },
  'Left Gastrocnemius': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', stroke: '#f97316' },
  'Right Gastrocnemius': { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', stroke: '#ec4899' },
  'Left Tibialis Anterior': { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', stroke: '#06b6d4' },
  'Right Tibialis Anterior': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', stroke: '#6366f1' },
  'Left Biceps': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', stroke: '#059669' },
  'Right Biceps': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', stroke: '#d97706' },
  'Left Triceps': { bg: 'bg-lime-50', border: 'border-lime-300', text: 'text-lime-700', stroke: '#65a30d' },
  'Right Triceps': { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', stroke: '#e11d48' },
};

// Default fallback colors for unknown muscles
const DEFAULT_MUSCLE_COLORS = [
  { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700', stroke: '#6b7280' },
  { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', stroke: '#64748b' },
];

// Helper to get tailwind classes from a hex color
const getTailwindClassesFromHex = (hexColor: string) => {
  // This is a simplified mapping - in a real app you'd want a more comprehensive mapping
  // or use a library like tailwind-color-matcher
  const colorMap: Record<string, { bg: string, border: string, text: string }> = {
    '#3b82f6': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' }, // Blue
    '#10b981': { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700' }, // Green
    '#ef4444': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' }, // Red
    '#8b5cf6': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' }, // Purple
    '#f97316': { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' }, // Orange
    '#ec4899': { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700' }, // Pink
    '#06b6d4': { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700' }, // Cyan
    '#6366f1': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700' }, // Indigo
    '#059669': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' }, // Emerald
    '#d97706': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' }, // Amber
    '#65a30d': { bg: 'bg-lime-50', border: 'border-lime-300', text: 'text-lime-700' }, // Lime
    '#e11d48': { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700' }, // Rose
  };

  return colorMap[hexColor] || { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' };
};

export const getMuscleColor = (muscleName: string, customColors?: Record<string, string>) => {
  // If we have a custom color for this muscle, use it
  if (customColors && customColors[muscleName]) {
    const customHex = customColors[muscleName];
    const tailwindClasses = getTailwindClassesFromHex(customHex);
    return {
      ...tailwindClasses,
      stroke: customHex
    };
  }
  
  // Otherwise use the default color
  return MUSCLE_COLORS[muscleName] || DEFAULT_MUSCLE_COLORS[0];
};

export const getColorForChannel = (channelName: string, muscleMapping?: Record<string, string>, customColors?: Record<string, string>) => {
  if (!muscleMapping) {
    // Fallback to index-based coloring if no mapping provided
    const baseChannelName = channelName.replace(/ (Raw|activated|Processed)$/, '');
    const channelIndex = parseInt(baseChannelName.replace('CH', '')) - 1;
    return getChannelColor(channelIndex);
  }
  
  const baseChannelName = channelName.replace(/ (Raw|activated|Processed)$/, '');
  const muscleName = muscleMapping[baseChannelName];
  
  if (muscleName) {
    return getMuscleColor(muscleName, customColors);
  }
  
  // Fallback to index-based coloring
  const channelIndex = parseInt(baseChannelName.replace('CH', '')) - 1;
  return getChannelColor(channelIndex);
}; 