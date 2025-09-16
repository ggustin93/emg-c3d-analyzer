/**
 * Centralized avatar color system for patient avatars
 * Following DRY principle to avoid code duplication
 */

// Extended color palette with 20 distinct, high-contrast colors
export const AVATAR_COLORS = [
  'bg-blue-500',     // Blue
  'bg-green-500',    // Green
  'bg-red-500',      // Red
  'bg-purple-500',   // Purple
  'bg-yellow-500',   // Yellow
  'bg-pink-500',     // Pink
  'bg-indigo-500',   // Indigo
  'bg-teal-500',     // Teal
  'bg-orange-500',   // Orange
  'bg-cyan-500',     // Cyan
  'bg-emerald-500',  // Emerald
  'bg-rose-500',     // Rose
  'bg-violet-500',   // Violet
  'bg-amber-500',    // Amber
  'bg-lime-500',     // Lime
  'bg-fuchsia-500',  // Fuchsia
  'bg-sky-500',      // Sky
  'bg-slate-500',    // Slate
  'bg-zinc-500',     // Zinc
  'bg-stone-500',    // Stone
] as const

/**
 * Generate a consistent avatar color based on an identifier
 * Uses an enhanced hash algorithm for better color distribution
 * @param identifier - Patient name or code to generate color from
 * @returns Tailwind CSS background color class
 */
export function getAvatarColor(identifier: string): string {
  // Enhanced hash algorithm with better distribution
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    // Use prime multiplier for better distribution
    hash = ((hash << 5) - hash + char) | 0
    hash = hash * 33 ^ char
  }
  
  // Ensure positive index and select color
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

/**
 * Generate patient avatar initials from patient code
 * @param patientCode - Patient code (e.g., "P001")
 * @returns Formatted initials (e.g., "P1")
 */
export function getPatientInitials(patientCode: string): string {
  // Extract numeric part from patient code (P001 → 001 → 1)
  const numericPart = patientCode.replace(/\D/g, '')
  const number = parseInt(numericPart) || 0
  return `P${number}`
}

/**
 * Get avatar color for a patient with full name or code fallback
 * @param firstName - Patient's first name (optional)
 * @param lastName - Patient's last name (optional)
 * @param patientCode - Patient code as fallback
 * @returns Tailwind CSS background color class
 */
export function getPatientAvatarColor(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  patientCode: string
): string {
  // Use full name if available for more distinct colors, fallback to patient code
  const identifier = firstName && lastName 
    ? `${firstName}${lastName}` 
    : patientCode
  
  return getAvatarColor(identifier)
}

/**
 * Get avatar initials for a patient
 * @param firstName - Patient's first name (optional)
 * @param lastName - Patient's last name (optional)
 * @param patientCode - Patient code as fallback
 * @returns Avatar initials
 */
export function getPatientAvatarInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  patientCode: string
): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
  return getPatientInitials(patientCode)
}