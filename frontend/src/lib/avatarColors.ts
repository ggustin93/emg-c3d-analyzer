/**
 * Centralized avatar color system for patient avatars
 * Following DRY principle to avoid code duplication
 */

// Enhanced color palette with 24 distinct, darker colors for better readability
// Using 600/700/800 variants for sufficient contrast with white text
export const AVATAR_COLORS = [
  'bg-blue-600',     // Blue
  'bg-green-600',    // Green  
  'bg-red-600',      // Red
  'bg-purple-600',   // Purple
  'bg-pink-600',     // Pink
  'bg-indigo-600',   // Indigo
  'bg-teal-600',     // Teal
  'bg-orange-600',   // Orange
  'bg-cyan-600',     // Cyan
  'bg-emerald-600',  // Emerald
  'bg-rose-600',     // Rose
  'bg-violet-600',   // Violet
  'bg-amber-600',    // Amber
  'bg-fuchsia-600',  // Fuchsia
  'bg-sky-600',      // Sky
  'bg-slate-600',    // Slate
  'bg-blue-700',     // Blue Dark
  'bg-green-700',    // Green Dark
  'bg-red-700',      // Red Dark
  'bg-purple-700',   // Purple Dark
  'bg-indigo-700',   // Indigo Dark
  'bg-teal-700',     // Teal Dark
  'bg-orange-700',   // Orange Dark
  'bg-rose-700',     // Rose Dark
] as const

/**
 * Generate a consistent avatar color based on an identifier
 * Uses a high-quality hash algorithm (djb2 variant) for optimal distribution
 * @param identifier - Patient name or code to generate color from
 * @returns Tailwind CSS background color class
 */
export function getAvatarColor(identifier: string): string {
  // djb2 hash algorithm variant with multiple prime numbers for better distribution
  let hash = 5381
  
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    // djb2: hash * 33 + char, optimized with bit shifting
    hash = ((hash << 5) + hash + char) | 0
  }
  
  // Additional mixing to reduce collisions
  hash ^= hash >>> 16
  hash *= 0x85ebca6b
  hash ^= hash >>> 13
  hash *= 0xc2b2ae35
  hash ^= hash >>> 16
  
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
 * Extract the best identifier for a patient for avatar color generation
 * Uses priority order: full name > display name > patient code
 * @param patient - Patient object with optional name fields
 * @returns Consistent identifier string for color generation
 */
export function getPatientIdentifier(patient: {
  first_name?: string | null
  last_name?: string | null
  patient_code: string
  display_name?: string | null
}): string {
  const { first_name, last_name, patient_code, display_name } = patient
  
  // Priority order: full name > display name > patient code
  if (first_name && last_name) {
    // Use full name for best distribution
    return `${first_name}${last_name}`.toLowerCase()
  } else if (display_name && display_name !== patient_code) {
    // Use display name if available and different from patient code
    return display_name.toLowerCase().replace(/\s+/g, '')
  } else {
    // Fall back to patient code
    return patient_code
  }
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