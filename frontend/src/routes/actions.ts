import { redirect } from 'react-router-dom'
import { login, logout } from '../lib/authUtils'

/**
 * Login action for form submission
 * CLEAN: Direct auth utility call, no service layer
 */
export async function loginAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const from = formData.get('from') as string || '/dashboard'
  
  const { session, error } = await login(email, password)
  
  if (session && !error) {
    // Redirect to intended destination
    return redirect(from)
  }
  
  // Return error for display in form
  return { error: error || 'Login failed' }
}

/**
 * Logout action for programmatic logout
 * CLEAN: Simple utility call with guaranteed redirect
 */
export async function logoutAction() {
  await logout()
  
  // Always redirect to login after logout, regardless of success/error
  // This ensures the user is always taken to a safe state
  return redirect('/login')
}