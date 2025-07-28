import type { AuthState, ResearcherProfile } from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

// Simplified storage keys
const STORAGE_KEYS = {
  AUTH_STATE: 'emg_auth_state',
  DEV_BYPASS: 'emg_dev_bypass',
  LOGGED_IN: 'emg_logged_in'
} as const

// Unified timeout duration - increased for better reliability
const TIMEOUT_DURATION = 10000

/**
 * Simplified storage utilities
 */
export const storage = {
  save: (key: string, data: any) => {
    try {
      if (data) {
        localStorage.setItem(key, JSON.stringify(data))
      } else {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Storage save failed: ${key}`, error)
    }
  },

  load: (key: string) => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.warn(`Storage load failed: ${key}`, error)
      return null
    }
  },

  clear: () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }
}

/**
 * Unified timeout wrapper for async operations
 */
export const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number = TIMEOUT_DURATION,
  errorMessage: string = 'Operation timeout'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })
  
  return Promise.race([promise, timeoutPromise])
}

/**
 * Create initial auth state
 */
export const createInitialAuthState = (): AuthState => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  error: null
})

/**
 * Create logged out auth state (not loading, ready for login)
 */
export const createLoggedOutState = (): AuthState => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  error: null
})

/**
 * Create authenticated auth state
 */
export const createAuthenticatedState = (
  user: User, 
  session: Session, 
  profile: ResearcherProfile | null
): AuthState => ({
  user,
  session,
  profile,
  loading: false,
  error: null
})

/**
 * Create error auth state
 */
export const createErrorState = (error: string): AuthState => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  error
})

/**
 * Check if development bypass is active
 */
export const isDevBypassActive = (): boolean => {
  return sessionStorage.getItem(STORAGE_KEYS.DEV_BYPASS) === 'true'
}

/**
 * Create development auth state
 */
export const createDevAuthState = (): AuthState => ({
  user: { id: 'dev-user', email: 'dev@localhost' } as any,
  session: { access_token: 'dev-token' } as any,
  profile: { 
    id: 'dev-user', 
    email: 'dev@localhost',
    full_name: 'Development User',
    role: 'researcher',
    access_level: 'full',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  } as ResearcherProfile,
  loading: false,
  error: null
})

/**
 * Save auth state to storage (only user and profile, not session)
 */
export const saveAuthState = (authState: AuthState) => {
  if (authState.user && authState.profile) {
    storage.save(STORAGE_KEYS.AUTH_STATE, {
      user: authState.user,
      profile: authState.profile,
      timestamp: Date.now()
    })
  }
}

/**
 * Load auth state from storage
 */
export const loadAuthState = (): { user: User; profile: ResearcherProfile } | null => {
  try {
    const stored = storage.load(STORAGE_KEYS.AUTH_STATE)
    if (stored?.user && stored?.profile) {
      // Check if stored data is not too old (48 hours - increased for better UX)
      const isRecent = stored.timestamp && (Date.now() - stored.timestamp) < 48 * 60 * 60 * 1000
      if (isRecent) {
        return { user: stored.user, profile: stored.profile }
      }
    }
  } catch (error) {
    console.warn('Failed to load auth state from storage:', error)
    // Clear corrupted storage
    storage.clear()
  }
  return null
}

/**
 * Simple error formatter
 */
export const formatAuthError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : 'Authentication error'
}

/**
 * Simple logged-in state management
 */
export const markAsLoggedIn = () => {
  storage.save(STORAGE_KEYS.LOGGED_IN, { 
    timestamp: Date.now(),
    status: 'authenticated'
  })
}

export const isMarkedAsLoggedIn = (): boolean => {
  const logged = storage.load(STORAGE_KEYS.LOGGED_IN)
  if (logged?.status === 'authenticated') {
    // Consider logged in for 7 days
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return logged.timestamp && (Date.now() - logged.timestamp) < sevenDays
  }
  return false
}

export const clearLoggedInStatus = () => {
  storage.save(STORAGE_KEYS.LOGGED_IN, null)
}

/**
 * Storage keys export
 */
export { STORAGE_KEYS }