import React from 'react';
import UserProfile from '../auth/UserProfile';
import FileMetadataBar from './FileMetadataBar';
import { EMGAnalysisResult } from '../../types/emg';
import { Button } from '../ui/button';
import { User, Activity } from 'lucide-react';

type ViewMode = 'dashboard' | 'analysis';

interface HeaderProps {
  analysisResult?: EMGAnalysisResult | null;
  onReset?: () => void;
  isAuthenticated?: boolean;
  uploadDate?: string | null; // Upload date from file browser
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

/**
 * Main application header that adapts to authentication state
 * Features Ghostly+ branding with conditional controls
 */
const Header: React.FC<HeaderProps> = ({ 
  analysisResult, 
  onReset, 
  isAuthenticated = true, 
  uploadDate,
  viewMode = 'dashboard',
  onViewModeChange
}) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto">
        <div className={`flex items-center ${isAuthenticated ? 'justify-between' : 'justify-center'}`}>
          {/* Logo and title */}
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

          {/* Center - View toggle buttons (only when authenticated) */}
          {isAuthenticated && onViewModeChange && (
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
              <Button
                variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('dashboard')}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Dashboard
              </Button>
              <Button
                variant={viewMode === 'analysis' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('analysis')}
                className="flex items-center gap-2"
              >
                <Activity className="w-4 h-4" />
                Analysis
              </Button>
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