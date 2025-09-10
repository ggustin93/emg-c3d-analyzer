import React from 'react';
import UserProfile from '../auth/UserProfile';
import FileMetadataBar from './FileMetadataBar';
import { EMGAnalysisResult } from '../../types/emg';


interface HeaderProps {
  analysisResult?: EMGAnalysisResult | null;
  onReset?: () => void;
  isAuthenticated?: boolean;
  uploadDate?: string | null; // Upload date from file browser
}

/**
 * Main application header that adapts to authentication state
 * Features Ghostly+ branding with conditional controls
 */
const Header: React.FC<HeaderProps> = ({ 
  analysisResult, 
  onReset, 
  isAuthenticated = true, 
  uploadDate
}) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="h-full">
        <div className={`flex items-center px-6 ${isAuthenticated ? 'justify-end h-[72px]' : 'justify-center h-[144px]'}`}>
          {/* Logo only for non-authenticated state */}
          {!isAuthenticated && (
            <div className="flex items-center space-x-3">
              <img 
                src="/ghostly_logo.png" 
                alt="Ghostly+ Logo" 
                className="h-36 w-36 object-contain"
              />
              <div>
                <h1 className="text-2xl font-light text-slate-800 tracking-tight">
                  <i> + Research</i>
                </h1>
              </div>
            </div>
          )}

          {/* Right side - User profile (only when authenticated) */}
          {isAuthenticated && <UserProfile compact />}
        </div>

        {/* File metadata bar - only when authenticated and analysis result exists */}
        {isAuthenticated && analysisResult && (
          <FileMetadataBar 
            analysisResult={analysisResult} 
            onReset={onReset}
            uploadDate={uploadDate}
          />
        )}
      </div>
    </header>
  );
};

export default Header;