import React, { memo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthLoadingSpinner from './AuthLoadingSpinner'
import LoginPage from './LoginPage'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Fixed Auth Guard following best practices:
 * 1. Simple conditional rendering
 * 2. No complex logic in render
 * 3. Memoized to prevent unnecessary re-renders
 * 4. Clear loading/auth/unauth states
 */
export const AuthGuardFixed: React.FC<AuthGuardProps> = memo(({ children, fallback }) => {
  const { isAuthenticated, isLoading } = useAuth()
  
  // Loading state - show spinner
  if (isLoading) {
    return <AuthLoadingSpinner />
  }
  
  // Not authenticated - show login or fallback
  if (!isAuthenticated) {
    return <>{fallback || <LoginPage />}</>
  }
  
  // Authenticated - show protected content
  return <>{children}</>
})

AuthGuardFixed.displayName = 'AuthGuardFixed'

/**
 * HOC version for wrapping components
 */
export const withAuthGuard = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) => {
  const GuardedComponent: React.FC<P> = (props) => (
    <AuthGuardFixed fallback={fallback}>
      <Component {...props} />
    </AuthGuardFixed>
  )
  
  GuardedComponent.displayName = `withAuthGuard(${Component.displayName || Component.name})`
  
  return GuardedComponent
}