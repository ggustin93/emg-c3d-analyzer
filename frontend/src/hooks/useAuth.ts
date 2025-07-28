import { useState, useEffect, useCallback, useRef } from 'react'
import { AuthService } from '../services/authService'
import { isSupabaseConfigured } from '../lib/supabase'
import { 
  storage, 
  withTimeout, 
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
} from '../utils/authUtils'
import type { AuthState, LoginCredentials, ResearcherRegistration, AuthResponse } from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

/**
 * Simplified authentication hook for EMG analysis application
 * Provides reactive authentication state with efficient management
 */
export const useAuth = () => {
  const [authState, setAuthStateRaw] = useState<AuthState>(createInitialAuthState())
  const isInitializedRef = useRef(false)
  const subscriptionRef = useRef<any>(null)
  const isStableRef = useRef(false) // Track if auth state is stable
  
  // Protected setAuthState that respects stable state
  const setAuthState = useCallback((newState: AuthState | ((prev: AuthState) => AuthState), force?: boolean) => {
    if (isStableRef.current && !force) {
      console.log('Auth state is stable, ignoring state change attempt')
      return
    }
    setAuthStateRaw(newState)
  }, [])
  
  // Force state change function for logout - bypasses all protection
  const forceAuthState = useCallback((newState: AuthState | ((prev: AuthState) => AuthState)) => {
    // Reset stable ref to allow changes
    isStableRef.current = false
    // Use setAuthStateRaw directly to bypass any protection
    console.log('🔥 FORCE LOGOUT: Directly setting auth state')
    setAuthStateRaw(newState)
    console.log('🔥 FORCE LOGOUT: Auth state should be:', typeof newState === 'function' ? 'computed' : newState)
  }, [])

  // Initialize authentication state
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const initializeAuth = async () => {
      // Check for development bypass
      if (isDevBypassActive()) {
        setAuthState(createDevAuthState())
        return
      }

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        setAuthState(createErrorState('Authentication not configured. Please set up Supabase environment variables.'))
        return
      }

      try {
        // Check simple logged-in status first
        if (isMarkedAsLoggedIn()) {
          const storedAuth = loadAuthState()
          if (storedAuth) {
            // Simply trust the cached authentication - no validation needed
            console.log('User is marked as logged in, restored from cache:', storedAuth.user.email)
            const stableAuthState = {
              user: storedAuth.user,
              session: { access_token: 'cached' } as any, // Minimal session object
              profile: storedAuth.profile,
              loading: false,
              error: null
            }
            setAuthState(stableAuthState)
            isStableRef.current = true // Mark as stable to prevent further changes
            return
          }
        }

        // Get fresh auth state with longer timeout
        const [sessionResponse, userResponse] = await Promise.all([
          withTimeout(AuthService.getCurrentSession(), 8000, 'Session check timeout'),
          withTimeout(AuthService.getCurrentUser(), 8000, 'User check timeout')
        ])

        if (sessionResponse.success && userResponse.success && userResponse.data && sessionResponse.data) {
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          const newAuthState = createAuthenticatedState(
            userResponse.data, 
            sessionResponse.data, 
            profileResponse.data
          )
          setAuthState(newAuthState)
          saveAuthState(newAuthState)
        } else {
          setAuthState(createErrorState('No valid session found'))
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        // Don't immediately clear storage on timeout - might be temporary network issue
        const errorMessage = formatAuthError(err)
        if (errorMessage.includes('timeout')) {
          setAuthState(createErrorState('Network timeout during authentication. Please check your connection and try refreshing.'))
        } else {
          setAuthState(createErrorState(errorMessage))
          storage.clear() // Only clear storage for real auth failures
        }
      }
    }

    // Initialize with longer timeout fallback
    const timeoutId = setTimeout(() => {
      // If we still have a loading state after timeout, set a more user-friendly error
      setAuthState(prev => {
        if (prev.loading) {
          return createErrorState('Authentication is taking longer than expected. Please try refreshing the page.')
        }
        return prev
      })
    }, 12000)

    initializeAuth().finally(() => clearTimeout(timeoutId))

    // Only set up auth state listener if we don't have cached auth
    if (isSupabaseConfigured() && !isMarkedAsLoggedIn()) {
      try {
        console.log('Setting up auth state listener for fresh authentication...')
        const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
          if (!isInitializedRef.current) return
          
          console.log('Auth state change detected:', event)
          
          if (event === 'SIGNED_IN' && session?.user) {
            try {
              const profileResponse = await AuthService.getResearcherProfile(session.user.id)
              const newAuthState = createAuthenticatedState(session.user, session, profileResponse.data)
              setAuthState(newAuthState)
              saveAuthState(newAuthState)
              markAsLoggedIn() // Mark as logged in
              
              // Unsubscribe after successful login to prevent further state changes
              console.log('Login successful, unsubscribing from auth changes')
              subscription.unsubscribe()
              subscriptionRef.current = null
            } catch (profileError) {
              console.error('Failed to fetch profile after sign in:', profileError)
              setAuthState(createErrorState('Failed to load user profile'))
            }
          } else if (event === 'SIGNED_OUT') {
            storage.clear()
            clearLoggedInStatus() // Clear logged-in status
            isStableRef.current = false // Reset stable state
            forceAuthState(createLoggedOutState()) // Force state change to logged out
          }
        })
        
        subscriptionRef.current = subscription
      } catch (err) {
        console.warn('Failed to set up auth state listener:', err)
      }
    } else if (isMarkedAsLoggedIn()) {
      console.log('Skipping auth listener setup - using cached authentication')
    }

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      isInitializedRef.current = false
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
    }
  }, [])

  // Login method
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse<Session>> => {
    // If already in stable authenticated state, don't proceed
    if (isStableRef.current && authState.user) {
      console.log('Already authenticated, skipping login')
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
        const [userResponse] = await Promise.all([
          AuthService.getCurrentUser()
        ])
        
        if (userResponse.success && userResponse.data) {
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          const newAuthState = createAuthenticatedState(userResponse.data, response.data, profileResponse.data)
          setAuthState(newAuthState)
          saveAuthState(newAuthState)
          markAsLoggedIn() // Mark as logged in for persistent state
          isStableRef.current = true // Mark as stable
        }
      } else {
        setAuthState(prev => ({ ...prev, loading: false, error: response.error }))
      }
      
      return response
    } catch (err) {
      const error = formatAuthError(err)
      setAuthState(prev => ({ ...prev, loading: false, error }))
      return { data: null, error, success: false }
    }
  }, [])

  // Logout method
  const logout = useCallback(async (): Promise<AuthResponse<void>> => {
    console.log('🚪 LOGOUT STARTED')
    
    // Step 1: Immediately clear all local state
    console.log('🚪 LOGOUT: Clearing storage')
    storage.clear()
    clearLoggedInStatus()
    
    // Step 2: Force immediate state change to trigger re-render
    console.log('🚪 LOGOUT: Creating logged out state')
    const loggedOutState = createLoggedOutState()
    console.log('🚪 LOGOUT: Logged out state:', loggedOutState)
    console.log('🚪 LOGOUT: Calling forceAuthState')
    forceAuthState(loggedOutState)
    
    // Step 3: Background server cleanup (non-blocking)
    setTimeout(async () => {
      try {
        await AuthService.logout()
      } catch (err) {
        console.warn('Server logout failed (local state already cleared):', err)
      }
    }, 0)
    
    console.log('🚪 LOGOUT COMPLETED - should redirect now')
    return { data: null, error: null, success: true }
  }, [forceAuthState])

  // Register method
  const register = useCallback(async (data: ResearcherRegistration): Promise<AuthResponse<User>> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await AuthService.register(data)
    
    if (!response.success) {
      setAuthState(prev => ({ ...prev, loading: false, error: response.error }))
    }
    
    return response
  }, [])

  // Refresh session method
  const refreshSession = useCallback(async (): Promise<AuthResponse<Session>> => {
    const response = await AuthService.refreshSession()
    
    if (response.success && response.data) {
      setAuthState(prev => ({ ...prev, session: response.data }))
    }
    
    return response
  }, [])

  // Reset password method
  const resetPassword = useCallback(async (email: string): Promise<AuthResponse<void>> => {
    return AuthService.resetPassword(email)
  }, [])

  // Check auth status method
  const checkAuthStatus = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return { isAuthenticated: false, error: 'Authentication not configured' }
    }

    try {
      const [sessionResponse, userResponse] = await Promise.all([
        AuthService.getCurrentSession(),
        AuthService.getCurrentUser()
      ])

      if (sessionResponse.success && userResponse.success && userResponse.data && sessionResponse.data) {
        const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
        const newAuthState = createAuthenticatedState(userResponse.data, sessionResponse.data, profileResponse.data)
        setAuthState(newAuthState)
        saveAuthState(newAuthState)
        return { isAuthenticated: true, error: null }
      } else {
        setAuthState(prev => ({ ...prev, loading: false }))
        return { isAuthenticated: false, error: 'No valid session found' }
      }
    } catch (err) {
      const error = formatAuthError(err)
      setAuthState(prev => ({ ...prev, loading: false, error }))
      return { isAuthenticated: false, error }
    }
  }, [])

  const isAuthenticated = !!authState.user
  const isLoading = authState.loading
  
  // Debug current state
  console.log('🔍 CURRENT AUTH STATE:', { 
    user: authState.user ? 'EXISTS' : 'NULL', 
    isAuthenticated, 
    isLoading 
  })

  return {
    authState,
    login,
    logout,
    register,
    refreshSession,
    resetPassword,
    checkAuthStatus,
    isAuthenticated,
    isLoading
  }
}