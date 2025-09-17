import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { 
  LoginCredentials, 
  ResearcherRegistration, 
  AuthResponse, 
  ResearcherProfile,
  StoragePermissions 
} from '../types/auth'
import { User, Session } from '@supabase/supabase-js'

/**
 * Authentication service for researcher access to EMG analysis system
 * Handles login, logout, registration, and profile management
 */
export class AuthService {
  
  /**
   * Check if Supabase is properly configured
   */
  private static checkConfiguration() {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: 'Authentication is not configured. Please set up Supabase environment variables.',
        success: false
      }
    }
    return null
  }
  
  /**
   * Clear potentially corrupted auth state from localStorage
   * This helps recover from corrupted session data that causes white screens
   */
  private static async clearCorruptedAuthState() {
    try {
      console.log('🧹 Clearing potentially corrupted auth state...')
      
      // Clear all Supabase-related localStorage keys
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth-token'))) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => {
        console.log(`  Removing: ${key}`)
        localStorage.removeItem(key)
      })
      
      // Also clear sessionStorage
      const sessionKeysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth-token'))) {
          sessionKeysToRemove.push(key)
        }
      }
      
      sessionKeysToRemove.forEach(key => {
        console.log(`  Removing from session: ${key}`)
        sessionStorage.removeItem(key)
      })
      
      console.log('✅ Auth state cleared')
    } catch (err) {
      console.error('Failed to clear auth state:', err)
    }
  }
  
  /**
   * Authenticate researcher with email and password
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse<Session>> {
    const configCheck = this.checkConfiguration()
    if (configCheck) return configCheck as AuthResponse<Session>
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        return { data: null, error: error.message, success: false }
      }

      // Update last login timestamp
      if (data.user) {
        await this.updateLastLogin(data.user.id)
      }
      
      // Clear and update cache with new session
      this.sessionCache = {
        session: data.session,
        timestamp: Date.now()
      };

      return { 
        data: data.session, 
        error: null, 
        success: true 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Sign out current researcher with timeout protection and fallback
   */
  static async logout(): Promise<AuthResponse<void>> {
    const configCheck = this.checkConfiguration()
    if (configCheck) return configCheck as AuthResponse<void>

    try {
      console.log('🔄 Starting Supabase signOut...')
      
      // Clear session cache immediately on logout
      this.clearSessionCache()
      
      // Direct signOut without timeout wrapper
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.warn('Logout error from Supabase:', error)
        // Don't treat timeout or network errors as failures
        // The auth state listener will handle cleanup
        if (error.message.includes('timeout') || error.message.includes('network')) {
          console.log('✅ Treating timeout/network error as successful logout')
          return { data: null, error: null, success: true }
        }
        return { data: null, error: error.message, success: false }
      }

      console.log('✅ Supabase signOut completed successfully')
      return { data: null, error: null, success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout error'
      console.error('❌ Logout failed:', errorMessage)
      
      // For timeout errors, treat as success since the user wants to logout
      if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        console.log('✅ Treating timeout/network error as successful logout')
        return { data: null, error: null, success: true }
      }
      
      return { 
        data: null, 
        error: errorMessage, 
        success: false 
      }
    }
  }

  /**
   * Register new researcher account
   */
  static async register(registrationData: ResearcherRegistration): Promise<AuthResponse<User>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: registrationData.email,
        password: registrationData.password,
        options: {
          data: {
            full_name: registrationData.full_name,
            institution: registrationData.institution,
            department: registrationData.department,
            role: registrationData.role || 'researcher'
          }
        }
      })

      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: data.user, 
        error: null, 
        success: true 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Get current authenticated user
   */
  static async getCurrentUser(): Promise<AuthResponse<User>> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: user, 
        error: null, 
        success: !!user 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  // Simple session cache to prevent repeated Supabase calls during navigation
  private static sessionCache: {
    session: Session | null;
    timestamp: number;
  } | null = null;
  
  private static readonly SESSION_CACHE_TTL = 30000; // 30 seconds
  
  /**
   * Get current session with caching to prevent repeated auth checks
   */
  static async getCurrentSession(): Promise<AuthResponse<Session>> {
    try {
      // Check cache first
      if (this.sessionCache) {
        const now = Date.now();
        if (now - this.sessionCache.timestamp < this.SESSION_CACHE_TTL) {
          console.debug('🔄 Using cached session');
          return {
            data: this.sessionCache.session,
            error: null,
            success: !!this.sessionCache.session
          };
        }
      }
      
      // Add timeout to prevent hanging on initial load
      const timeout = new Promise<AuthResponse<Session>>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️ Auth session check timeout - treating as unauthenticated')
          // Don't clear auth storage on timeout - it might be a network issue
          resolve({ data: null, error: 'Session check timeout', success: false })
        }, 5000) // 5 second timeout
      )
      
      const sessionCheck = supabase.auth.getSession().then(async ({ data: { session }, error }) => {
        if (error) {
          // Only clear auth state on errors that truly indicate corruption
          if (error.message.includes('invalid') || error.message.includes('malformed') || error.message.includes('JWT')) {
            console.warn('🔄 Clearing corrupted auth state due to:', error.message)
            await this.clearCorruptedAuthState()
          }
          return { data: null, error: error.message, success: false }
        }
        
        // Cache the successful session
        this.sessionCache = {
          session,
          timestamp: Date.now()
        };
        
        return { 
          data: session, 
          error: null, 
          success: !!session 
        }
      })
      
      // Race between session check and timeout
      return await Promise.race([sessionCheck, timeout])
    } catch (err) {
      console.error('Session check error:', err)
      // Don't clear auth state on general errors - might be temporary
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }
  
  /**
   * Clear session cache (call on logout or auth state change)
   */
  private static clearSessionCache() {
    this.sessionCache = null;
  }

  /**
   * Refresh the current session
   */
  static async refreshSession(): Promise<AuthResponse<Session>> {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: data.session, 
        error: null, 
        success: !!data.session 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Reset password for researcher account
   */
  static async resetPassword(email: string): Promise<AuthResponse<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { data: null, error: null, success: true }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Get user profile from user_profiles table
   */
  static async getResearcherProfile(userId: string): Promise<AuthResponse<ResearcherProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: data as ResearcherProfile, 
        error: null, 
        success: true 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<ResearcherProfile>): Promise<AuthResponse<ResearcherProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: data as ResearcherProfile, 
        error: null, 
        success: true 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Authentication error', 
        success: false 
      }
    }
  }

  /**
   * Check storage permissions for current user
   */
  static async checkStoragePermissions(): Promise<StoragePermissions> {
    try {
      const userResponse = await this.getCurrentUser()
      
      if (!userResponse.success || !userResponse.data) {
        return {
          canRead: false,
          canWrite: false,
          canDelete: false,
          allowedBuckets: []
        }
      }

      const profileResponse = await this.getResearcherProfile(userResponse.data.id)
      const profile = profileResponse.data

      // Define permissions based on role and access level
      const permissions: StoragePermissions = {
        canRead: true, // All authenticated researchers can read
        canWrite: profile?.access_level !== 'basic',
        canDelete: profile?.role === 'admin',
        allowedBuckets: ['c3d-files', 'analysis-results'],
        maxFileSize: profile?.access_level === 'full' ? 100 * 1024 * 1024 : 50 * 1024 * 1024 // 100MB or 50MB
      }

      return permissions
    } catch (err) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false,
        allowedBuckets: []
      }
    }
  }

  /**
   * Update last login timestamp
   */
  private static async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase
        .from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId)
    } catch (err) {
      // Silently fail - not critical
      console.warn('Failed to update last login:', err)
    }
  }

  /**
   * Listen to authentication state changes
   */
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }

  /**
   * Check if user is authenticated (for React Router guards)
   */
  static async isAuthenticated(): Promise<boolean> {
    const response = await this.getCurrentSession()
    return response.success && !!response.data
  }

  /**
   * Get auth data for route loaders
   * Includes both session and profile for role information
   */
  static async getAuthData() {
    try {
      // Add overall timeout for the entire auth check
      const timeout = new Promise<{ session: null, profile: null, user: null }>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️ Auth data check timeout - treating as unauthenticated')
          resolve({ session: null, profile: null, user: null })
        }, 8000) // 8 second overall timeout
      )
      
      const authCheck = (async () => {
        const sessionResponse = await this.getCurrentSession()
        
        if (!sessionResponse.success || !sessionResponse.data) {
          return { session: null, profile: null, user: null }
        }
        
        const profileResponse = await this.getResearcherProfile(
          sessionResponse.data.user.id
        )
        
        return {
          session: sessionResponse.data,
          user: sessionResponse.data.user,
          profile: profileResponse.data
        }
      })()
      
      // Race between auth check and timeout
      return await Promise.race([authCheck, timeout])
    } catch (err) {
      console.error('Auth data check error:', err)
      return { session: null, profile: null, user: null }
    }
  }
}