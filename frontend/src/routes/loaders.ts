import { redirect } from 'react-router-dom'
import { AuthService } from '../services/authService'

/**
 * Root loader - loads auth state for entire app
 */
export async function rootLoader() {
  return await AuthService.getAuthData()
}

/**
 * Protected route loader
 * Redirects to login if not authenticated
 */
export async function protectedLoader() {
  const authData = await AuthService.getAuthData()
  
  if (!authData.session) {
    // Preserve intended destination for post-login redirect
    const from = window.location.pathname
    throw redirect(`/login?from=${encodeURIComponent(from)}`)
  }
  
  return authData
}

/**
 * Public route loader (redirects authenticated users to dashboard)
 */
export async function publicLoader() {
  const isAuth = await AuthService.isAuthenticated()
  if (isAuth) {
    throw redirect('/dashboard')
  }
  return null
}