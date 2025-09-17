import { redirect } from 'react-router-dom'
import { getAuthData, isAuthenticated } from '../lib/authUtils'

/**
 * Root loader - loads auth state for entire app
 * CLEAN: Direct utility call, no service layer
 */
export async function rootLoader() {
  return await getAuthData()
}

/**
 * Protected route loader
 * Redirects to login if not authenticated
 * CLEAN: Fresh Supabase check every time (SSoT principle)
 */
export async function protectedLoader() {
  const authData = await getAuthData()
  
  // Simple auth validation
  if (!authData.session || !authData.user) {
    // Preserve intended destination for post-login redirect
    const from = window.location.pathname
    console.debug('[Router] Redirecting unauthenticated user from:', from)
    throw redirect(`/login?from=${encodeURIComponent(from)}`)
  }
  
  // Session expiry check
  if (authData.session.expires_at) {
    const expiresAt = new Date(authData.session.expires_at * 1000)
    if (expiresAt <= new Date()) {
      console.debug('[Router] Session expired, redirecting to login')
      throw redirect('/login')
    }
  }
  
  return authData
}

/**
 * Public route loader (redirects authenticated users to dashboard)
 * CLEAN: Direct boolean check, no complex service calls
 */
export async function publicLoader() {
  const authenticated = await isAuthenticated()
  if (authenticated) {
    throw redirect('/dashboard')
  }
  return null
}