import React, { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from './LoginPage';
import AuthLoadingSpinner from './AuthLoadingSpinner';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingTimeout?: number; // Timeout in milliseconds
}

/**
 * Enhanced Authentication Guard Component
 * Protects components that require authentication with improved UX and concurrent transitions
 * 
 * Features:
 * - Timeout handling to prevent infinite loading states
 * - Progressive loading messages
 * - Better error recovery
 * - Concurrent transitions for smooth navigation
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback, 
  loadingTimeout = 10000 
}) => {
  const { user, loading, logout, isTransitioning } = useAuth();
  const isAuthenticated = !!user;

  // Handle timeout scenarios by forcing a logout and refresh
  const handleTimeout = useCallback(async () => {
    console.warn('[AuthGuard] Authentication timeout reached, forcing logout');
    try {
      await logout();
      // Force a page refresh as a last resort
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('[AuthGuard] Error during timeout logout:', error);
      // Force refresh if logout fails
      window.location.reload();
    }
  }, [logout]);

  // Loading state - show spinner while checking authentication
  if (loading) {
    return (
      <AuthLoadingSpinner 
        message="Verifying authentication..."
        timeout={loadingTimeout}
        onTimeout={handleTimeout}
      />
    );
  }

  // Transitioning state - show current content with subtle transition indicator
  if (isTransitioning && isAuthenticated) {
    return (
      <div className="relative">
        {children}
        <div className="fixed top-2 right-2 z-50 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-600 animate-pulse">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated state - show login page
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : <LoginPage />;
  }

  // Authenticated - render protected content
  return <>{children}</>;
};

export default AuthGuard;