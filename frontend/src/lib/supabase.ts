import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we have valid Supabase configuration
const hasValidConfig = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your_supabase_anon_key_here'

if (!hasValidConfig) {
  console.warn(`
🔧 Supabase Configuration Required
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To enable authentication features, please:

1. Create a Supabase project at https://supabase.com
2. Update your .env file with:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_actual_anon_key

Current values:
- VITE_SUPABASE_URL: ${supabaseUrl || 'Not set'}
- VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '[SET]' : 'Not set'}

The app will continue to work without authentication features.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)
}

// Create Supabase client with fallback values for development
export const supabase = createClient(
  supabaseUrl || 'https://localhost:54321',
  supabaseAnonKey || 'fallback-key',
  {
    auth: {
      autoRefreshToken: !!hasValidConfig,
      persistSession: !!hasValidConfig,
      detectSessionInUrl: !!hasValidConfig
    },
    global: {
      headers: {
        'X-Client-Info': 'emg-c3d-analyzer'
      }
    }
  }
)

// Helper function to check if client is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!hasValidConfig
}