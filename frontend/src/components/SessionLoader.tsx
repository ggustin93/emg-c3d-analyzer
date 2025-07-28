import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FileUpload from './FileUpload';
import C3DFileBrowser from './C3DFileBrowser';
import UserProfile from './auth/UserProfile';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';
import { useAuth } from '@/hooks/useAuth';
import { LightningBoltIcon } from '@radix-ui/react-icons';

interface SessionLoaderProps {
  onUploadSuccess: (data: EMGAnalysisResult) => void;
  onUploadError: (error: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  onQuickSelect: (filename: string) => void;
  isLoading: boolean;
  sessionParams: GameSessionParameters;
}

const SessionLoader: React.FC<SessionLoaderProps> = ({ 
  onUploadSuccess,
  onUploadError,
  setIsLoading,
  onQuickSelect,
  isLoading,
  sessionParams
}) => {
  const { authState } = useAuth();

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      {/* Upload Section - Compact */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="text-center">
            <CardTitle className="text-lg font-semibold">Load Session Data</CardTitle>
            <CardDescription className="text-sm">
              Upload a new C3D file to begin analysis
            </CardDescription>
          </div>
        </CardHeader>
          
        <CardContent className="pt-0">
          <FileUpload
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            setIsLoading={setIsLoading}
            currentSessionParams={sessionParams}
          />
        </CardContent>
      </Card>

      {/* File Browser Section - Primary Focus */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm font-medium">
          <span className="bg-slate-50 px-6 text-slate-700">C3D File Library</span>
        </div>
      </div>

      <C3DFileBrowser onFileSelect={onQuickSelect} isLoading={isLoading} />
    </div>
  );
};

export default SessionLoader; 