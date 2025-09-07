import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginPage from './LoginPage';
import AuthLoadingSpinner from './AuthLoadingSpinner';
import { LockClosedIcon } from '@radix-ui/react-icons';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Simplified Authentication Guard Component
 * Protects components that require researcher authentication
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;

  // Loading state - show spinner while checking authentication
  if (loading) {
    return <AuthLoadingSpinner />;
  }

  // Unauthenticated state - show login page
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <LoginPage />;
  }

  // Authenticated - render protected content
  return <>{children}</>;
};

export default AuthGuard;