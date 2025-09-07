/**
 * Simplified Authentication Context
 * 
 * Following KISS principle: Minimal wrapper around useAuth hook.
 * No role checking, no UI logic - just authentication state.
 * RLS handles all authorization at the database level.
 */
import React, { createContext, useContext, ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

// Re-export useAuth for backward compatibility
export { useAuth } from '../hooks/useAuth'

// Export the auth context type for consumers
type AuthContextType = ReturnType<typeof useAuth>

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Authentication Provider Component
 * Wraps the app and provides auth state to all children.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth()
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 * Must be used within AuthProvider.
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  
  return context
}

// That's it! 50 lines instead of 366.
// No canViewFeature(), no role checking, no complex state.
// The UI renders what the API returns - RLS decides what's allowed.