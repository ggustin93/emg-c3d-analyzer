import React from 'react';
import Spinner from '@/components/ui/Spinner';
import { PersonIcon } from '@radix-ui/react-icons';

interface AuthLoadingSpinnerProps {
  message?: string;
  className?: string;
}

/**
 * Professional loading spinner for authentication checks
 * Used during authentication state determination in AuthGuard
 */
const AuthLoadingSpinner: React.FC<AuthLoadingSpinnerProps> = ({ 
  message = "Checking researcher access...",
  className = ""
}) => {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${className}`}>
      <div className="text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <PersonIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="space-y-2">
          <Spinner />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingSpinner;