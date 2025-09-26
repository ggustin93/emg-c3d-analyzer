/**
 * Environment Configuration
 * 
 * This file contains the environment variables needed for the application.
 * In production, these should be set via environment variables.
 * In development, you can modify these values directly.
 */

export const ENV_CONFIG = {
  // Supabase Configuration - REQUIRED from .env
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  // Storage Configuration - REQUIRED from .env
  STORAGE_BUCKET_NAME: import.meta.env.VITE_STORAGE_BUCKET_NAME,
  
  // API Configuration - REQUIRED from .env
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  
  // Development flags
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
}

// Validate required environment variables
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!ENV_CONFIG.SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL is required - set it in .env file')
  }
  
  if (!ENV_CONFIG.SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_ANON_KEY is required - set it in .env file')
  }
  
  if (!ENV_CONFIG.STORAGE_BUCKET_NAME) {
    errors.push('VITE_STORAGE_BUCKET_NAME is required - set it in .env file')
  }
  
  if (!ENV_CONFIG.API_BASE_URL) {
    errors.push('VITE_API_BASE_URL is required - set it in .env file')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Log environment status in development
if (ENV_CONFIG.IS_DEVELOPMENT) {
  const validation = validateEnvironment()
  if (!validation.isValid) {
    console.error('🚨 Environment configuration issues:')
    validation.errors.forEach(error => console.error(`  ❌ ${error}`))
    console.error('📝 Create a .env file with the required variables. See .env.example for reference.')
  } else {
    console.log('✅ Environment configuration is valid')
  }
}
