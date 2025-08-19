/**
 * 🎨 Color Palette Definitions for Patient and Therapist IDs
 * 
 * As per UX/UI expert guidance, these palettes use non-semantic colors
 * to provide clear visual distinction without implying meaning.
 */

// Palette 1: "Joyful" for Patient IDs - Vibrant and engaging
const PATIENT_COLOR_PALETTE = [
  { background: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  { background: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { background: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { background: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { background: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  { background: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
];

// Palette 2: "Professional" for Therapist IDs - Clear and subdued
const THERAPIST_COLOR_PALETTE = [
  { background: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-700' },
  { background: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-700' },
  { background: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-700' },
  { background: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-700' },
  { background: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-700' },
  { background: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-700' },
];

const NEUTRAL_COLOR = { background: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };

/**
 * Creates a simple numeric hash from a string to ensure consistent color mapping.
 */
const getStringHash = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Assigns a color from a specific palette based on a string ID.
 */
const getColorFromPalette = (id: string, palette: typeof PATIENT_COLOR_PALETTE) => {
  if (!id || id === 'Unknown') {
    return NEUTRAL_COLOR;
  }
  const hash = getStringHash(id);
  const index = hash % palette.length;
  return palette[index];
};

/**
 * Consistently assigns a "joyful" color for a given Patient ID.
 */
export const getPatientColorClasses = (id: string): { background: string; text: string; border: string } => {
  return getColorFromPalette(id, PATIENT_COLOR_PALETTE);
};

/**
 * Consistently assigns a "professional" color for a given Therapist ID.
 */
export const getTherapistColorClasses = (id: string): { background: string; text: string; border: string } => {
  return getColorFromPalette(id, THERAPIST_COLOR_PALETTE);
};
