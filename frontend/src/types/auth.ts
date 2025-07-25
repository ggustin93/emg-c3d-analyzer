import { User, Session } from '@supabase/supabase-js'

// Researcher profile extending Supabase User
export interface ResearcherProfile {
  id: string
  email: string
  full_name?: string
  institution?: string
  department?: string
  role: 'researcher' | 'admin' | 'clinical_specialist'
  access_level: 'basic' | 'advanced' | 'full'
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
}

// Authentication state
export interface AuthState {
  user: User | null
  session: Session | null
  profile: ResearcherProfile | null
  loading: boolean
  error: string | null
}

// Login credentials
export interface LoginCredentials {
  email: string
  password: string
}

// Registration data for new researchers
export interface ResearcherRegistration {
  email: string
  password: string
  full_name: string
  institution?: string
  department?: string
  role?: 'researcher' | 'clinical_specialist'
}

// Auth response wrapper
export interface AuthResponse<T = any> {
  data: T | null
  error: string | null
  success: boolean
}

// Password reset request
export interface PasswordResetRequest {
  email: string
}

// Storage access permissions
export interface StoragePermissions {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  allowedBuckets: string[]
  maxFileSize?: number
}

// Session context for the app
export interface AuthContextValue {
  authState: AuthState
  login: (credentials: LoginCredentials) => Promise<AuthResponse<Session>>
  logout: () => Promise<AuthResponse<void>>
  register: (data: ResearcherRegistration) => Promise<AuthResponse<User>>
  resetPassword: (email: string) => Promise<AuthResponse<void>>
  getCurrentUser: () => Promise<AuthResponse<User>>
  refreshSession: () => Promise<AuthResponse<Session>>
  updateProfile: (updates: Partial<ResearcherProfile>) => Promise<AuthResponse<ResearcherProfile>>
  checkStoragePermissions: () => Promise<StoragePermissions>
}