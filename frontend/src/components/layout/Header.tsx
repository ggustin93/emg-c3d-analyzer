import React from 'react';
import { Button } from '../ui/button';
import UserProfile from '../auth/UserProfile';
import { EMGAnalysisResult } from '../../types/emg';

interface HeaderProps {
  analysisResult?: EMGAnalysisResult | null;
  onReset?: () => void;
  isAuthenticated?: boolean;
}

/**
 * Main application header that adapts to authentication state
 * Features Ghostly+ branding with conditional controls
 */
const Header: React.FC<HeaderProps> = ({ analysisResult, onReset, isAuthenticated = true }) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center ${isAuthenticated ? 'justify-between' : 'justify-center'}`}>
          {/* Logo and title */}
          <div className="flex items-center space-x-3">
            <img 
              src="/ghostly_logo.png" 
              alt="Ghostly+ Logo" 
              className="h-32 w-32 object-contain"
            />
            <div>
              <h1 className="text-3xl font-light text-slate-800 tracking-tight">
             <i> + Research</i>
              </h1>
             
            </div>
          </div>

          {/* Right side - User profile (only when authenticated) */}
          {isAuthenticated && <UserProfile compact />}
        </div>

        {/* File info section - only when authenticated and analysis result exists */}
        {isAuthenticated && analysisResult && (
          <div className="flex items-center justify-center mt-4 space-x-4">
            <p className="text-sm text-slate-500">
              File: <span className="font-medium text-slate-700">
                {analysisResult.source_filename}
              </span>
            </p>
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset} className="ml-4">
                Load Another File
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;