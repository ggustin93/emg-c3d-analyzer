import React from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  const { isAuthenticated, isLoading, authState } = useAuth();

  // Loading state
  if (isLoading) {
    return <AuthLoadingSpinner />;
  }

  // Configuration error state
  if (authState.error?.includes('not configured')) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockClosedIcon className="w-8 h-8 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Authentication Setup Required</CardTitle>
          <CardDescription>
            EMG C3D Analyzer requires Supabase authentication configuration.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Quick Setup:</h3>
            <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
              <li>Create Supabase project at <code>supabase.com</code></li>
              <li>Add environment variables to <code>.env</code></li>
              <li>Restart development server</li>
            </ol>
          </div>
          <LoginPage />
          <div className="text-xs text-muted-foreground text-center border-t pt-4">
            Development bypass available in login form
          </div>
        </CardContent>
      </Card>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <LoginPage />;
  }

  // Authenticated - render protected content
  return <>{children}</>;
};

export default AuthGuard;