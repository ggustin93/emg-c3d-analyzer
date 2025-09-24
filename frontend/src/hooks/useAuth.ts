/**
 * useAuth Hook - Authentication Orchestrator for Supabase Integration
 * 
 * Author: Guillaume Gustin with assistance from Claude Code (Sonnet 3.5, Sonnet 4)
 * GitHub: @ggustin93
 * Project: GHOSTLY+ EMG C3D Analyzer
 * Updated: September 2025
 * 
 * CLEAN ARCHITECTURE: Focused on React state management only
 * - KISS: Simple state management, delegates auth operations to authUtils
 * - DRY: Uses shared auth utility instead of duplicating auth logic
 * - SOLID: Single responsibility - React state management only
 * - SSoT: Supabase (via authUtils) is single source of auth truth
 * 
 * Architecture Notes:
 * - Central authentication hook for entire React application
 * - Integrates with Supabase Auth for user management
 * - Manages user roles (ADMIN, THERAPIST, RESEARCHER)
 * - Optimized for performance with React Transitions
 * - 361 lines of authentication orchestration logic
 * 
 * Production Considerations:
 * - Concurrent transitions prevent UI blocking
 * - Automatic session refresh handling
 * - Secure logout with state cleanup
 * - RLS policy compliance (roles for UI only)
 */
import { useState, useEffect, useCallback, useRef, useTransition, startTransition } from 'react'
import { supabase } from '../lib/supabase'
import { logout as utilLogout } from '../lib/authUtils'
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
  logout: () => Promise<{ error: string | null }>
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
          
          // Enhanced role normalization with debugging
          if (profile?.role) {
            const rawRole = profile.role
            const normalizedRole = rawRole.toLowerCase().trim()
            
            console.log('🔍 DEBUG: Role normalization', {
              rawRole,
              normalizedRole,
              type: typeof rawRole
            })
            
            if (normalizedRole === 'admin') setUserRole('ADMIN')
            else if (normalizedRole === 'therapist') setUserRole('THERAPIST') 
            else if (normalizedRole === 'researcher') setUserRole('RESEARCHER')
            else {
              console.warn('🚨 Unknown role detected:', rawRole)
              setUserRole(null)
            }
          } else {
            console.warn('🚨 No role found in profile:', profile)
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
   * Logout the current user
   * CLEAN: Uses shared auth utility, component handles navigation
   * KISS: Simple auth operation - let onAuthStateChange handle state cleanup
   */
  const logout = async () => {
    console.debug('[Auth] Logout initiated')
    
    try {
      // Set loading state
      startAuthTransition(() => {
        setLoading(true)
      })
      
      // Use shared auth utility for logout operation
      const { error } = await utilLogout()
      
      if (error) {
        console.error('[Auth] Logout error:', error)
      } else {
        console.debug('[Auth] Logout successful')
      }
      
      // Note: Navigation should be handled by the calling component
      // onAuthStateChange will handle state cleanup automatically
      
      return { error }
    } catch (error) {
      console.error('[Auth] Logout failed:', error)
      
      // Force state cleanup on error
      startAuthTransition(() => {
        setUser(null)
        setSession(null)
        setUserProfile(null)
        setUserRole(null)
        setLoading(false)
      })
      
      return { 
        error: error instanceof Error ? error.message : 'Logout failed' 
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
