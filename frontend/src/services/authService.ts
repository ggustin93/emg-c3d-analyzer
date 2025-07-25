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

      return { 
        data: data.session, 
        error: null, 
        success: true 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Login failed', 
        success: false 
      }
    }
  }

  /**
   * Sign out current researcher
   */
  static async logout(): Promise<AuthResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { data: null, error: null, success: true }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Logout failed', 
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
        error: err instanceof Error ? err.message : 'Registration failed', 
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
        error: err instanceof Error ? err.message : 'Failed to get current user', 
        success: false 
      }
    }
  }

  /**
   * Get current session
   */
  static async getCurrentSession(): Promise<AuthResponse<Session>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        return { data: null, error: error.message, success: false }
      }

      return { 
        data: session, 
        error: null, 
        success: !!session 
      }
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err.message : 'Failed to get session', 
        success: false 
      }
    }
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
        error: err instanceof Error ? err.message : 'Failed to refresh session', 
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
        error: err instanceof Error ? err.message : 'Password reset failed', 
        success: false 
      }
    }
  }

  /**
   * Get researcher profile from profiles table
   */
  static async getResearcherProfile(userId: string): Promise<AuthResponse<ResearcherProfile>> {
    try {
      const { data, error } = await supabase
        .from('researcher_profiles')
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
        error: err instanceof Error ? err.message : 'Failed to get profile', 
        success: false 
      }
    }
  }

  /**
   * Update researcher profile
   */
  static async updateProfile(userId: string, updates: Partial<ResearcherProfile>): Promise<AuthResponse<ResearcherProfile>> {
    try {
      const { data, error } = await supabase
        .from('researcher_profiles')
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
        error: err instanceof Error ? err.message : 'Failed to update profile', 
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
        .from('researcher_profiles')
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
}