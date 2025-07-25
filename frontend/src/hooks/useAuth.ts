import { useState, useEffect, useCallback } from 'react'
import { AuthService } from '../services/authService'
import { isSupabaseConfigured } from '../lib/supabase'
import type { AuthState, LoginCredentials, ResearcherRegistration, AuthResponse } from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

/**
 * Custom hook for managing authentication state in EMG analysis application
 * Provides reactive authentication state and methods for login/logout/registration
 */
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null
  })

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      // Skip initialization if Supabase is not configured
      if (!isSupabaseConfigured()) {
        setAuthState(prev => ({ ...prev, loading: false }))
        return
      }

      try {
        const sessionResponse = await AuthService.getCurrentSession()
        const userResponse = await AuthService.getCurrentUser()

        if (sessionResponse.success && userResponse.success && userResponse.data) {
          const profileResponse = await AuthService.getResearcherProfile(userResponse.data.id)
          
          setAuthState({
            user: userResponse.data,
            session: sessionResponse.data,
            profile: profileResponse.data,
            loading: false,
            error: null
          })
        } else {
          setAuthState(prev => ({ ...prev, loading: false }))
        }
      } catch (err) {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to initialize auth'
        }))
      }
    }

    initializeAuth()

    // Listen for auth state changes only if configured
    let subscription: any = null
    if (isSupabaseConfigured()) {
      const { data: { subscription: sub } } = AuthService.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profileResponse = await AuthService.getResearcherProfile(session.user.id)
          setAuthState({
            user: session.user,
            session,
            profile: profileResponse.data,
            loading: false,
            error: null
          })
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null
          })
        }
      })
      subscription = sub
    }

    return () => subscription?.unsubscribe()
  }, [])

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse<Session>> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await AuthService.login(credentials)
    
    if (!response.success) {
      setAuthState(prev => ({ ...prev, loading: false, error: response.error }))
    }
    
    return response
  }, [])

  const logout = useCallback(async (): Promise<AuthResponse<void>> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await AuthService.logout()
    
    if (response.success) {
      // Clear auth state on successful logout
      setAuthState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: null
      })
    } else {
      setAuthState(prev => ({ ...prev, loading: false, error: response.error }))
    }
    
    return response
  }, [])

  const register = useCallback(async (data: ResearcherRegistration): Promise<AuthResponse<User>> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await AuthService.register(data)
    
    if (!response.success) {
      setAuthState(prev => ({ ...prev, loading: false, error: response.error }))
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

  return {
    authState,
    login,
    logout,
    register,
    refreshSession,
    resetPassword,
    isAuthenticated: !!authState.user,
    isLoading: authState.loading
  }
}