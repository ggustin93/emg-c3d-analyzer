import { redirect } from 'react-router-dom'
import { AuthService } from '../services/authService'

/**
 * Login action for form submission
 */
export async function loginAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const from = formData.get('from') as string || '/dashboard'
  
  const response = await AuthService.login({ email, password })
  
  if (response.success) {
    // Redirect to intended destination
    return redirect(from)
  }
  
  // Return error for display in form
  return { error: response.error }
}