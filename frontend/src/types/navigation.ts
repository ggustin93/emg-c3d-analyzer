/**
 * Navigation types for React Router location state
 * Provides type safety for admin dashboard navigation
 */

export type AdminTabType = 'overview' | 'users' | 'patients' | 'configuration' | 'sessions' | 'password-vault'

export interface AdminLocationState {
  activeTab?: AdminTabType
  from?: string
  returnTo?: string
}

export interface NavigationState {
  activeTab?: string
  [key: string]: any
}

// Type guard for admin location state
export function isAdminLocationState(state: unknown): state is AdminLocationState {
  if (!state || typeof state !== 'object') return false
  const s = state as any
  return !s.activeTab || ['overview', 'users', 'patients', 'configuration', 'sessions', 'password-vault'].includes(s.activeTab)
}