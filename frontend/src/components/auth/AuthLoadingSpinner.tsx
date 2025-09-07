import React, { useState, useEffect } from 'react';
import Spinner from '@/components/ui/Spinner';
import { PersonIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface AuthLoadingSpinnerProps {
  message?: string;
  className?: string;
  timeout?: number; // Timeout in milliseconds (default: 10 seconds)
  onTimeout?: () => void; // Callback when timeout is reached
}

/**
 * Professional loading spinner for authentication checks
 * Used during authentication state determination in AuthGuard
 * 
 * Features:
 * - Automatic timeout handling to prevent infinite loading
 * - Progressive messaging to inform users of potential issues
 * - Accessibility improvements with proper ARIA labels
 */
const AuthLoadingSpinner: React.FC<AuthLoadingSpinnerProps> = ({ 
  message = "Verifying authentication...",
  className = "",
  timeout = 10000, // 10 seconds default timeout
  onTimeout
}) => {
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Track elapsed time
    const startTime = Date.now();
    const interval = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsed(currentElapsed);
    }, 100);

    // Set timeout handler
    const timeoutId = setTimeout(() => {
      setTimeoutReached(true);
      if (onTimeout) {
        onTimeout();
      }
    }, timeout);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [timeout, onTimeout]);

  // Show timeout warning after specified duration
  if (timeoutReached) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Authentication Timeout
            </h2>
            <p className="text-sm text-gray-600">
              Authentication is taking longer than expected. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              type="button"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show warning message if loading takes more than 5 seconds
  const showDelayWarning = elapsed > 5000;

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${className}`}>
      <div className="text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <PersonIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="space-y-3 flex flex-col items-center">
          <Spinner />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {message}
            </p>
            {showDelayWarning && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                This is taking longer than usual...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingSpinner;