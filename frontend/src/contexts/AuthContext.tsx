import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { AuthService } from '../services/authService'
import { isSupabaseConfigured } from '../lib/supabase'
import { 
  storage, 
  createInitialAuthState, 
  createLoggedOutState,
  createAuthenticatedState, 
  createErrorState,
  createDevAuthState,
  isDevBypassActive,
  saveAuthState,
  loadAuthState,
  formatAuthError,
  markAsLoggedIn,
  isMarkedAsLoggedIn,
  clearLoggedInStatus
} from '../lib/authUtils'
import type { AuthState, LoginCredentials, ResearcherRegistration, AuthResponse } from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  authState: AuthState
  login: (credentials: LoginCredentials) => Promise<AuthResponse<Session>>
  logout: () => Promise<AuthResponse<void>>
  register: (data: ResearcherRegistration) => Promise<AuthResponse<User>>
  refreshSession: () => Promise<AuthResponse<Session>>
  resetPassword: (email: string) => Promise<AuthResponse<void>>
  isAuthenticated: boolean
  isLoading: boolean
  // RBAC - UI display only (security is enforced by database RLS)
  userRole: 'ADMIN' | 'THERAPIST' | 'RESEARCHER' | null
  canViewFeature: (feature: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Singleton Auth Provider - manages authentication state for entire app
 * Prevents multiple initializations and ensures stable auth state
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(createInitialAuthState())
  
  // Single initialization flag - persists for app lifetime
  const isInitializedRef = useRef(false)
  const authSubscriptionRef = useRef<any>(null)
  const initTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  // Initialize auth only once for the entire app
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true
    
    console.log('🔐 Auth Provider: Single initialization starting...')
    
    const initializeAuth = async () => {
      // Check dev bypass first
      if (isDevBypassActive()) {
        console.log('✅ Development bypass active')
        setAuthState(createDevAuthState())
        return
      }
      
      // Check Supabase configuration
      if (!isSupabaseConfigured()) {
        console.log('❌ Supabase not configured')
        setAuthState(createErrorState('Authentication not configured'))
        return
      }
      
      try {
        // Set initialization timeout
        initTimeoutRef.current = setTimeout(() => {
          console.warn('⚠️ Auth initialization timeout')
          setAuthState(prev => ({ ...prev, loading: false, error: 'Authentication timeout' }))
        }, 8000)
        
        // Check for cached auth state first
        if (isMarkedAsLoggedIn()) {
          const cached = loadAuthState()
          if (cached) {
            console.log('✅ Auth Provider: Restored cached state for', cached.user.email)
            setAuthState({
              user: cached.user,
              session: { access_token: 'cached' } as any,
              profile: cached.profile,
              loading: false,
              error: null
            })
            clearTimeout(initTimeoutRef.current)
            return
          }
        }
        
        // Get current session from Supabase
        console.log('🔍 Auth Provider: Checking Supabase session...')
        const [sessionResponse, userResponse] = await Promise.all([
          AuthService.getCurrentSession(),
          AuthService.getCurrentUser()
        ])
        
        if (sessionResponse.success && userResponse.success && 
            sessionResponse.data && userResponse.data) {
          console.log('✅ Auth Provider: Valid session found for', userResponse.data.email)
          
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          const newAuthState = createAuthenticatedState(
            userResponse.data,
            sessionResponse.data,
            profileResponse.data
          )
          
          setAuthState(newAuthState)
          saveAuthState(newAuthState)
          markAsLoggedIn()
        } else {
          console.log('❌ Auth Provider: No valid session found')
          setAuthState(createLoggedOutState())
        }
      } catch (error) {
        console.error('Auth Provider initialization error:', error)
        setAuthState(createErrorState(formatAuthError(error)))
      } finally {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current)
        }
      }
    }
    
    // Set up auth state listener BEFORE initialization
    try {
      const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth Provider: State change -', event, session?.user?.email)
        
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const profileResponse = await AuthService.getResearcherProfile(session.user.id)
            const newAuthState = createAuthenticatedState(
              session.user,
              session,
              profileResponse.data
            )
            setAuthState(newAuthState)
            saveAuthState(newAuthState)
            markAsLoggedIn()
          } catch (error) {
            console.error('Failed to load profile:', error)
            setAuthState(createErrorState('Failed to load user profile'))
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('✅ Auth Provider: Processing sign out')
          storage.clear()
          clearLoggedInStatus()
          setAuthState(createLoggedOutState())
        }
      })
      
      authSubscriptionRef.current = subscription
    } catch (error) {
      console.warn('Failed to set up auth listener:', error)
    }
    
    // Initialize auth
    initializeAuth()
    
    // Cleanup function
    return () => {
      console.log('🧹 Auth Provider: Cleaning up...')
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
      
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe()
        authSubscriptionRef.current = null
      }
      
      // Don't reset isInitializedRef - let it persist for app lifetime
    }
  }, []) // Empty deps - run only once for entire app
  
  // Stable login method
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse<Session>> => {
    if (authState.user) {
      return { 
        data: authState.session, 
        error: null, 
        success: true 
      }
    }
    
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await AuthService.login(credentials)
      
      if (response.success && response.data) {
        const userResponse = await AuthService.getCurrentUser()
        
        if (userResponse.success && userResponse.data) {
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          const newAuthState = createAuthenticatedState(
            userResponse.data,
            response.data,
            profileResponse.data
          )
          
          setAuthState(newAuthState)
          saveAuthState(newAuthState)
          markAsLoggedIn()
        }
      } else {
        setAuthState(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error || 'Login failed' 
        }))
      }
      
      return response
    } catch (error) {
      const errorMsg = formatAuthError(error)
      setAuthState(prev => ({ ...prev, loading: false, error: errorMsg }))
      return { data: null, error: errorMsg, success: false }
    }
  }, [authState.user, authState.session])
  
  // Stable logout method
  const logout = useCallback(async (): Promise<AuthResponse<void>> => {
    console.log('🚪 Auth Provider: Logout initiated')
    
    // Clear local state immediately and set to logged out state
    storage.clear()
    clearLoggedInStatus()
    setAuthState(createLoggedOutState()) // Immediate transition to logged out, no loading state
    
    try {
      const response = await AuthService.logout()
      
      if (response.success) {
        console.log('✅ Auth Provider: Logout successful')
        // State already set to logged out above
      }
      
      return response
    } catch (error) {
      console.error('Auth Provider logout error:', error)
      // State already set to logged out above
      return { data: null, error: null, success: true }
    }
  }, [])
  
  // Other methods
  const register = useCallback(async (data: ResearcherRegistration): Promise<AuthResponse<User>> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await AuthService.register(data)
    
    if (!response.success) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: response.error || 'Registration failed' 
      }))
    }
    
    return response
  }, [])
  
  const refreshSession = useCallback(async (): Promise<AuthResponse<Session>> => {
    const response = await AuthService.refreshSession()
    
    if (response.success && response.data) {
      setAuthState(prev => ({ ...prev, session: response.data }))
    }
    
    return response
  }, [])
  
  const resetPassword = useCallback(async (email: string): Promise<AuthResponse<void>> => {
    return AuthService.resetPassword(email)
  }, [])
  
  // IMPORTANT: This is UI display logic ONLY. All actual security enforcement 
  // is handled by database Row Level Security (RLS) policies in Supabase.
  // Frontend should NEVER be trusted for authorization decisions.
  
  // Get user role for UI display purposes
  const userRole = authState.profile?.role 
    ? (authState.profile.role.toUpperCase() as 'ADMIN' | 'THERAPIST' | 'RESEARCHER') 
    : null
  
  // UI feature visibility - for showing/hiding buttons, menu items, etc.
  // This does NOT provide security - it only improves UX by hiding irrelevant features
  const canViewFeature = useCallback((feature: string) => {
    if (!userRole) return false
    
    // Basic feature visibility based on role
    // All security enforcement happens at the database level via RLS
    switch (feature) {
      // Admin features
      case 'user-management':
      case 'system-settings':
      case 'audit-logs':
        return userRole === 'ADMIN'
      
      // Therapist features  
      case 'patient-management':
      case 'session-notes':
      case 'c3d-upload':
        return userRole === 'ADMIN' || userRole === 'THERAPIST'
      
      // Researcher features
      case 'analytics':
      case 'export-data':
        return userRole === 'ADMIN' || userRole === 'RESEARCHER'
      
      // Common features available to authenticated users
      case 'reports':
      case 'dashboard':
        return true
      
      default:
        // Conservative default - don't show unknown features
        return userRole === 'ADMIN'
    }
  }, [userRole])

  // Computed values
  const isAuthenticated = !!authState.user
  const isLoading = authState.loading
  
  const value: AuthContextType = {
    authState,
    login,
    logout,
    register,
    refreshSession,
    resetPassword,
    isAuthenticated,
    isLoading,
    userRole,
    canViewFeature
  }
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use auth context - replaces individual useAuth calls
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}