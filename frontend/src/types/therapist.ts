/**
 * TypeScript interfaces for Therapist data from User Profiles
 */

export interface TherapistInfo {
  id: string // UUID from user profiles
  first_name: string | null
  last_name: string | null  
  user_code: string
  display_name: string // "First Last" or fallback user_code
  role?: string
}

export interface TherapistCache {
  [therapistId: string]: TherapistInfo
}