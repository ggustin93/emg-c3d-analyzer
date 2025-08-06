import { useState, useEffect, useCallback, useRef } from 'react'
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

/**
 * Fixed Authentication Hook following best practices:
 * 1. Single initialization with proper cleanup
 * 2. Stable references using useRef for subscriptions
 * 3. Clear state transitions
 * 4. No re-initialization loops
 */
export const useAuthFixed = () => {
  const [authState, setAuthState] = useState<AuthState>(createInitialAuthState())
  
  // Stable refs to prevent re-initialization
  const isInitializedRef = useRef(false)
  const authSubscriptionRef = useRef<any>(null)
  const initTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  
  // Initialize auth only once
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) return
    isInitializedRef.current = true
    
    const initializeAuth = async () => {
      console.log('🔐 Initializing authentication (fixed version)...')
      
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
        }, 10000)
        
        // Check for cached auth state
        if (isMarkedAsLoggedIn()) {
          const cached = loadAuthState()
          if (cached) {
            console.log('✅ Restored cached auth state')
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
        const [sessionResponse, userResponse] = await Promise.all([
          AuthService.getCurrentSession(),
          AuthService.getCurrentUser()
        ])
        
        if (sessionResponse.success && userResponse.success && 
            sessionResponse.data && userResponse.data) {
          console.log('✅ Found valid session:', userResponse.data.email)
          
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
          console.log('❌ No valid session found')
          setAuthState(createLoggedOutState())
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
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
        console.log('🔐 Auth state change:', event, session?.user?.email)
        
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
          }
        } else if (event === 'SIGNED_OUT') {
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
      isInitializedRef.current = false
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
      
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe()
        authSubscriptionRef.current = null
      }
    }
  }, []) // Empty deps - run only once
  
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
    console.log('🚪 Logout initiated')
    
    // Clear local state immediately
    storage.clear()
    clearLoggedInStatus()
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await AuthService.logout()
      
      if (response.success) {
        console.log('✅ Logout successful')
        // State will be updated by auth state listener
      }
      
      return response
    } catch (error) {
      console.error('Logout error:', error)
      // Force local logout even on error
      setAuthState(createLoggedOutState())
      return { data: null, error: null, success: true }
    }
  }, [])
  
  // Other methods remain similar but with stable implementations...
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
  
  // Computed values
  const isAuthenticated = !!authState.user
  const isLoading = authState.loading
  
  return {
    authState,
    login,
    logout,
    register,
    refreshSession,
    resetPassword,
    isAuthenticated,
    isLoading
  }
}