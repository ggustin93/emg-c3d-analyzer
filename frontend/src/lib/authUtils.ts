/**
 * Shared Authentication Utility
 * 
 * CLEAN ARCHITECTURE: Single source for all auth operations
 * - KISS: Simple, direct Supabase calls without caching complexity
 * - DRY: Eliminates duplicate auth logic between useAuth and route loaders
 * - SSoT: Supabase is the only source of auth truth
 */
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  user: User | null
  error: string | null
}

export interface UserProfile {
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

/**
 * Get current authentication session directly from Supabase
 * No caching - always fresh from source (SSoT principle)
 */
export async function getCurrentSession(): Promise<AuthState> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.warn('[Auth] Session check error:', error.message)
      return { session: null, user: null, error: error.message }
    }
    
    return { 
      session, 
      user: session?.user ?? null, 
      error: null 
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Session check failed'
    console.error('[Auth] Session check exception:', message)
    return { session: null, user: null, error: message }
  }
}

/**
 * Check if user is currently authenticated
 * Simple boolean check for route guards
 */
export async function isAuthenticated(): Promise<boolean> {
  const { session, error } = await getCurrentSession()
  return !error && !!session && !!session.user
}

/**
 * Get user profile data for authenticated users
 * Returns null if not authenticated or profile not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('[Auth] Profile fetch error:', error.message)
      return null
    }

    return data as UserProfile
  } catch (err) {
    console.error('[Auth] Profile fetch exception:', err)
    return null
  }
}

/**
 * Get complete auth data for route loaders
 * Includes session, user, and profile in single call
 */
export async function getAuthData() {
  const authState = await getCurrentSession()
  
  if (!authState.session || !authState.user) {
    return { 
      session: null, 
      user: null, 
      profile: null,
      error: authState.error 
    }
  }
  
  const profile = await getUserProfile(authState.user.id)
  
  return {
    session: authState.session,
    user: authState.user,
    profile,
    error: null
  }
}

/**
 * Logout user by calling Supabase signOut
 * Returns success/error status
 */
export async function logout(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.warn('[Auth] Logout error:', error.message)
      return { error: error.message }
    }
    
    console.debug('[Auth] Logout successful')
    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Logout failed'
    console.error('[Auth] Logout exception:', message)
    return { error: message }
  }
}

/**
 * Login with email and password
 * Returns session or error
 */
export async function login(email: string, password: string): Promise<{
  session: Session | null
  error: string | null
}> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { session: null, error: error.message }
    }

    return { session: data.session, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    return { session: null, error: message }
  }
}