/**
 * Simplified Authentication Hook
 * 
 * Following KISS principle: Direct Supabase integration without caching or complexity.
 * RLS handles all authorization - we just manage authentication state.
 * 
 * Includes role fetching for UI conditional rendering (not security).
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'ADMIN' | 'THERAPIST' | 'RESEARCHER' | null

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  userRole: UserRole
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ data: Session | null; error: Error | null }>
  logout: () => Promise<{ error: Error | null }>
}

export const useAuth = (): AuthState & AuthActions => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole>(null)

  // Fetch user role from database (UI only - RLS handles security)
  const fetchUserRole = useCallback(async (userId: string): Promise<UserRole> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Error fetching user role:', error)
        return null
      }

      // Normalize role to uppercase for consistency (database stores lowercase)
      const role = data?.role?.toLowerCase()
      if (role === 'admin') return 'ADMIN'
      if (role === 'therapist') return 'THERAPIST' 
      if (role === 'researcher') return 'RESEARCHER'
      return null
    } catch (error) {
      console.error('Failed to fetch user role:', error)
      return null
    }
  }, [])

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        // Check if session is still valid before using it
        if (session?.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000)
          const now = new Date()
          
          if (expiresAt <= now) {
            console.debug('[Auth] Session expired, signing out:', {
              expired: expiresAt.toISOString(),
              now: now.toISOString()
            })
            await supabase.auth.signOut()
            setSession(null)
            setUser(null)
            setUserRole(null)
            return
          }
        }
        
        setSession(session)
        setUser(session?.user ?? null)
        
        // Fetch role if user is authenticated
        if (session?.user) {
          const role = await fetchUserRole(session.user.id)
          setUserRole(role)
        } else {
          setUserRole(null)
        }
      } catch (error) {
        console.error('Error loading session:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle TOKEN_REFRESHED properly - update session but don't re-fetch role
        if (event === 'TOKEN_REFRESHED' && session) {
          // Only update session state, role doesn't change on token refresh
          setSession(session)
          setUser(session.user)
          // Log refresh for debugging (helps track token lifecycle)
          console.debug('[Auth] Token refreshed at:', new Date().toISOString())
          return // Exit early, no need to set loading false
        }
        
        // For all other events, update state normally
        setSession(session)
        setUser(session?.user ?? null)
        
        // Only fetch role for SIGNED_IN event (new login)
        if (event === 'SIGNED_IN' && session?.user) {
          const role = await fetchUserRole(session.user.id)
          setUserRole(role)
        } else if (event === 'SIGNED_OUT' || !session) {
          setUserRole(null)
        }
        
        // Only set loading false for non-refresh events
        if (event !== 'TOKEN_REFRESHED') {
          setLoading(false)
        }
      }
    )

    // Cleanup subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserRole])

  /**
   * Login with email and password.
   * No role checking - RLS handles authorization.
   */
  const login = async (email: string, password: string) => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setLoading(false)
        
        // Provide more specific error messages for common auth failures
        if (error.message?.includes('Invalid login')) {
          return { data: null, error: new Error('Invalid email or password') }
        }
        if (error.message?.includes('Email not confirmed')) {
          return { data: null, error: new Error('Please verify your email before logging in') }
        }
        if (error.message?.includes('Invalid email')) {
          return { data: null, error: new Error('Please enter a valid email address') }
        }
        
        return { data: null, error }
      }
      
      // State will be updated by onAuthStateChange listener
      return { data: data.session, error: null }
    } catch (error) {
      setLoading(false)
      return { 
        data: null, 
        error: error instanceof Error ? error : new Error('Login failed') 
      }
    }
  }

  /**
   * Logout the current user.
   * Simple and direct - no complex cleanup needed.
   */
  const logout = async () => {
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setLoading(false)
        return { error }
      }
      
      // State will be cleared by onAuthStateChange listener
      return { error: null }
    } catch (error) {
      setLoading(false)
      return { 
        error: error instanceof Error ? error : new Error('Logout failed') 
      }
    }
  }

  return {
    user,
    session,
    loading,
    userRole,
    login,
    logout
  }
}

// That's it! 100 lines instead of 439.
// No caching, no dev bypasses, no timeouts, no retries.
// Just clean, simple authentication that trusts Supabase and RLS.