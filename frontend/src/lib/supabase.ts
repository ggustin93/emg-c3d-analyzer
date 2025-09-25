/**
 * Supabase Client Configuration
 * 
 * ARCHITECTURE PRINCIPLES:
 * - KISS: Simple client initialization with clear validation
 * - SOLID: Single responsibility - only handles Supabase client creation
 * - DRY: Centralized configuration validation and error handling
 * - Fail Fast: Clear error messages and early detection of misconfigurations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

interface SupabaseConfig {
  url: string
  anonKey: string
  isValid: boolean
  environment: 'development' | 'production' | 'test'
  validationErrors: string[]
}

interface SupabaseHealthCheck {
  isConfigured: boolean
  hasValidUrl: boolean
  hasValidKey: boolean
  environment: string
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Loading
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const environment = import.meta.env.MODE as 'development' | 'production' | 'test'

// ═══════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates a Supabase URL
 * - Must be a valid HTTPS URL
 * - Must not be localhost or placeholder
 * - Must follow Supabase URL pattern
 */
function validateSupabaseUrl(url: string | undefined): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: 'Supabase URL is not set' }
  }

  // Check for placeholder values
  if (url === 'https://your-project.supabase.co' || url.includes('your-project')) {
    return { valid: false, error: 'Supabase URL contains placeholder value' }
  }

  // Prevent localhost URLs in any environment
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0')) {
    return { valid: false, error: 'Localhost URLs are not allowed for Supabase' }
  }

  // Validate URL format
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'https:') {
      return { valid: false, error: 'Supabase URL must use HTTPS protocol' }
    }
    
    // Validate Supabase domain pattern
    if (!urlObj.hostname.endsWith('.supabase.co')) {
      return { valid: false, error: 'Invalid Supabase domain' }
    }
    
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Validates a Supabase anonymous key
 * - Must be a valid JWT-like string
 * - Must not be a placeholder
 */
function validateSupabaseKey(key: string | undefined): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'Supabase anonymous key is not set' }
  }

  // Check for placeholder values
  if (key === 'your_supabase_anon_key_here' || key.includes('your_') || key === 'not-configured-key') {
    return { valid: false, error: 'Supabase key contains placeholder value' }
  }

  // Basic JWT format validation (three base64 segments separated by dots)
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
  if (!jwtPattern.test(key)) {
    return { valid: false, error: 'Invalid Supabase key format' }
  }

  return { valid: true }
}

/**
 * Performs complete configuration validation
 */
function validateConfiguration(): SupabaseConfig {
  const config: SupabaseConfig = {
    url: supabaseUrl || '',
    anonKey: supabaseAnonKey || '',
    isValid: false,
    environment,
    validationErrors: []
  }

  // Validate URL
  const urlValidation = validateSupabaseUrl(supabaseUrl)
  if (!urlValidation.valid && urlValidation.error) {
    config.validationErrors.push(urlValidation.error)
  }

  // Validate Key
  const keyValidation = validateSupabaseKey(supabaseAnonKey)
  if (!keyValidation.valid && keyValidation.error) {
    config.validationErrors.push(keyValidation.error)
  }

  // Set overall validity
  config.isValid = urlValidation.valid && keyValidation.valid

  return config
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Validation & Error Reporting
// ═══════════════════════════════════════════════════════════════════════════

const config = validateConfiguration()

// Display configuration errors if present
if (!config.isValid) {
  const errorMessage = `
🚨 Supabase Configuration Error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment: ${config.environment}
Issues Found:
${config.validationErrors.map(e => `  ❌ ${e}`).join('\n')}

Current Configuration:
  VITE_SUPABASE_URL: ${supabaseUrl ? '✅ SET' : '❌ NOT SET'}
  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ SET (hidden)' : '❌ NOT SET'}

To fix this issue:

1. Ensure your .env file contains valid values:
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (your actual key)

2. If using Docker, rebuild the image:
   ./start_dev_docker.sh down
   ./start_dev_docker.sh up --build
   
   ⚠️  Vite environment variables are embedded at BUILD time!
   ⚠️  You MUST rebuild after changing .env variables!

3. For local development (without Docker):
   npm run dev

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim()
  
  console.error(errorMessage)
  
  // In production, fail fast with clear error
  if (environment === 'production') {
    throw new Error(`Supabase configuration is invalid: ${config.validationErrors.join(', ')}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase Client Creation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Supabase client with appropriate configuration
 * Falls back to safe dummy values that will fail fast in development
 */
export const supabase: SupabaseClient = createClient(
  config.isValid ? config.url : 'https://not-configured.supabase.co',
  config.isValid ? config.anonKey : 'not-configured-key',
  {
    auth: {
      autoRefreshToken: config.isValid,
      persistSession: config.isValid,
      detectSessionInUrl: config.isValid,
      storage: config.isValid ? window.localStorage : undefined,
      storageKey: 'emg-c3d-analyzer-auth',
      flowType: 'pkce' // More secure for public clients
    },
    global: {
      headers: {
        'X-Client-Info': 'emg-c3d-analyzer',
        'X-Environment': environment
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10 // Rate limiting for real-time subscriptions
      }
    }
  }
)

// ═══════════════════════════════════════════════════════════════════════════
// Health Check Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if Supabase client is properly configured
 * @returns boolean indicating if configuration is valid
 */
export function isSupabaseConfigured(): boolean {
  return config.isValid
}

/**
 * Get detailed health check information
 * Useful for debugging and monitoring
 */
export function getSupabaseHealthCheck(): SupabaseHealthCheck {
  return {
    isConfigured: config.isValid,
    hasValidUrl: !config.validationErrors.some(e => e.includes('URL')),
    hasValidKey: !config.validationErrors.some(e => e.includes('key')),
    environment: config.environment,
    timestamp: new Date().toISOString()
  }
}

/**
 * Get configuration status for display in UI
 * Returns user-friendly status message
 */
export function getConfigurationStatus(): string {
  if (config.isValid) {
    return '✅ Supabase configured successfully'
  }
  
  if (config.validationErrors.length === 0) {
    return '⏳ Supabase configuration loading...'
  }
  
  return `❌ Configuration errors: ${config.validationErrors.join(', ')}`
}

/**
 * Verify Supabase connection by attempting a simple query
 * Useful for health checks and monitoring
 */
export async function verifySupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  if (!config.isValid) {
    return { 
      success: false, 
      error: 'Supabase client is not properly configured' 
    }
  }

  try {
    // Attempt a simple auth check - this doesn't require authentication
    const { error } = await supabase.auth.getSession()
    
    if (error) {
      return { 
        success: false, 
        error: `Connection test failed: ${error.message}` 
      }
    }
    
    return { success: true }
  } catch (err) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown connection error' 
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Development Helpers (Only in non-production)
// ═══════════════════════════════════════════════════════════════════════════

if (environment !== 'production') {
  // Attach to window for debugging
  (window as any).__supabaseConfig = {
    config,
    healthCheck: getSupabaseHealthCheck,
    verifyConnection: verifySupabaseConnection,
    status: getConfigurationStatus
  }
  
  // Log configuration status on load
  console.debug('[Supabase]', getConfigurationStatus())
  console.debug('[Supabase] Health Check:', getSupabaseHealthCheck())
}

// ═══════════════════════════════════════════════════════════════════════════
// Type Exports
// ═══════════════════════════════════════════════════════════════════════════

export type { SupabaseConfig, SupabaseHealthCheck }