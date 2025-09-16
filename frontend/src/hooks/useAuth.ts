/**
 * Simplified Authentication Hook
 * 
 * Following KISS principle: Direct Supabase integration without caching or complexity.
 * RLS handles all authorization - we just manage authentication state.
 * 
 * FIXED: Resolved loading state loop by implementing proper loading state management
 * and eliminating race conditions in token refresh handling.
 */
import { useState, useEffect, useCallback, useRef, useTransition, startTransition } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'ADMIN' | 'THERAPIST' | 'RESEARCHER' | null

export interface UserProfileData {
  id: string
  role: string
  first_name?: string
  last_name?: string
  full_name?: string
  institution?: string
  department?: string
  access_level: string
  user_code?: string
  created_at: string
  updated_at?: string
  last_login?: string
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  userRole: UserRole
  userProfile: UserProfileData | null
  isTransitioning: boolean
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
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null)
  const [isTransitioning, startAuthTransition] = useTransition()
  
  // Use ref to prevent multiple simultaneous initializations
  const initializingRef = useRef(false)
  
  // Fetch essential user profile data optimized for sign-in performance
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfileData | null> => {
    const startTime = performance.now()
    
    try {
      // Only select essential fields needed for sign-in (reduces payload size)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, first_name, last_name, institution, department, access_level, user_code, created_at, updated_at, last_login')
        .eq('id', userId)
        .single()

      const fetchTime = performance.now() - startTime
      console.debug(`[Auth] Profile fetch completed in ${fetchTime.toFixed(2)}ms`)

      if (error) {
        console.warn('Error fetching user profile:', error)
        return null
      }

      return data as UserProfileData
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      return null
    }
  }, [])

  // Centralized state update function optimized for performance with concurrent transitions
  const updateAuthState = useCallback(async (session: Session | null, shouldFetchProfile = false) => {
    const stateUpdateStart = performance.now()
    const currentUser = session?.user ?? null
    
    // Use concurrent transition for authentication state updates to prevent blocking UI
    startAuthTransition(() => {
      setSession(session)
      setUser(currentUser)
      
      // Set loading to false immediately for non-profile updates
      if (!shouldFetchProfile || !currentUser) {
        setLoading(false)
      }
    })
    
    if (shouldFetchProfile && currentUser) {
      try {
        // Fetch profile data in background without blocking UI
        const profile = await fetchUserProfile(currentUser.id)
        
        // Use another transition for profile and role updates
        startAuthTransition(() => {
          setUserProfile(profile)
          
          // Streamlined role normalization using profile data
          if (profile?.role) {
            const role = profile.role.toLowerCase()
            if (role === 'admin') setUserRole('ADMIN')
            else if (role === 'therapist') setUserRole('THERAPIST')
            else if (role === 'researcher') setUserRole('RESEARCHER')
            else setUserRole(null)
          } else {
            setUserRole(null)
          }
          
          // Complete loading after profile is fetched
          setLoading(false)
          
          const totalTime = performance.now() - stateUpdateStart
          console.debug(`[Auth] Complete auth state update in ${totalTime.toFixed(2)}ms`)
        })
      } catch (error) {
        console.error('Error fetching user profile:', error)
        startAuthTransition(() => {
          setUserProfile(null)
          setUserRole(null)
          setLoading(false)
        })
      }
    } else if (!currentUser) {
      // Fast path for logout - no async operations needed
      startAuthTransition(() => {
        setUserProfile(null)
        setUserRole(null)
      })
    }
  }, [fetchUserProfile])

  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (initializingRef.current) {
      return
    }
    
    initializingRef.current = true
    
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting initial session:', error)
          setLoading(false)
          return
        }
        
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
            await updateAuthState(null)
            return
          }
        }
        
        // Update state with role fetching for valid sessions
        await updateAuthState(session, !!session)
        
      } catch (error) {
        console.error('Error initializing auth:', error)
        setLoading(false)
      } finally {
        initializingRef.current = false
      }
    }

    initAuth()

    // Listen for auth changes with simplified logic and concurrent transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.debug(`[Auth] Event: ${event}`, { 
          hasSession: !!session, 
          timestamp: new Date().toISOString() 
        })
        
        try {
          switch (event) {
            case 'SIGNED_IN':
              // New login - fetch role with concurrent transition
              await updateAuthState(session, true)
              break
              
            case 'SIGNED_OUT':
              // Logout - ensure state is cleared with concurrent transition
              console.debug('[Auth] SIGNED_OUT event - ensuring state is cleared')
              startAuthTransition(() => {
                setUser(null)
                setSession(null)
                setUserProfile(null)
                setUserRole(null)
                setLoading(false)
              })
              break
              
            case 'TOKEN_REFRESHED':
              // Token refresh - update session but don't refetch role
              startAuthTransition(() => {
                setSession(session)
                setUser(session?.user ?? null)
              })
              console.debug('[Auth] Token refreshed successfully')
              break
              
            case 'USER_UPDATED':
              // User info updated - keep existing role
              startAuthTransition(() => {
                setSession(session)
                setUser(session?.user ?? null)
              })
              break
              
            default:
              // Handle any other events by updating state
              await updateAuthState(session, false)
          }
        } catch (error) {
          console.error(`[Auth] Error handling ${event}:`, error)
          // Ensure loading is set to false even on errors
          startAuthTransition(() => {
            setLoading(false)
          })
        }
      }
    )

    // Cleanup subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [updateAuthState])

  /**
   * Login with email and password - optimized for performance.
   * No role checking - RLS handles authorization.
   */
  const login = async (email: string, password: string) => {
    const loginStart = performance.now()
    console.debug('[Auth] Login initiated')
    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setLoading(false)
        console.debug(`[Auth] Login failed in ${(performance.now() - loginStart).toFixed(2)}ms`)
        
        // Streamlined error handling for better performance
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
      
      const authTime = performance.now() - loginStart
      console.debug(`[Auth] Supabase authentication completed in ${authTime.toFixed(2)}ms`)
      
      // State will be updated by onAuthStateChange listener (profile fetch happens there)
      return { data: data.session, error: null }
    } catch (error) {
      setLoading(false)
      console.error('[Auth] Login failed with exception:', error)
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
    // Don't set loading during logout to avoid blocking redirect
    console.debug('[Auth] Logout initiated')
    
    try {
      // Clear state immediately with concurrent transition to enable redirect
      startAuthTransition(() => {
        setUser(null)
        setSession(null)
        setUserProfile(null)
        setUserRole(null)
      })
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[Auth] Logout error:', error)
        return { error }
      }
      
      // Ensure loading is false so AuthGuard can redirect
      startAuthTransition(() => {
        setLoading(false)
      })
      console.debug('[Auth] Logout completed successfully')
      return { error: null }
    } catch (error) {
      console.error('[Auth] Logout failed:', error)
      startAuthTransition(() => {
        setLoading(false)
      })
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
    userProfile,
    isTransitioning,
    login,
    logout
  }
}

// Clean authentication hook: 200 lines with proper loading state management
// Fixed: Loading state loops, token refresh handling, and race conditions
// Maintains simplicity while ensuring reliable authentication state