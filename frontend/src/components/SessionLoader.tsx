import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FileUpload from './FileUpload';
import QuickSelect from './QuickSelect';
import ResearcherLoginModal from './auth/ResearcherLoginModal';
import UserProfile from './auth/UserProfile';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';
import { useAuth } from '@/hooks/useAuth';
import { PersonIcon, LightningBoltIcon } from '@radix-ui/react-icons';

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
  const { isAuthenticated, authState } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);


  return (
    <>
      <Card className="w-full max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <div className="space-y-4">
            <div className="text-center">
              <CardTitle className="text-2xl font-bold">Load Session Data</CardTitle>
              <CardDescription>
                Upload a C3D file or select a quick sample to begin analysis.
              </CardDescription>
            </div>
            
            {/* Authentication Section */}
            <div className="border-t pt-4">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                    <LightningBoltIcon className="w-4 h-4" />
                    <span className="font-medium">Researcher mode active</span>
                  </div>
                  <UserProfile compact className="bg-gray-50 p-3 rounded-md" />
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
                    <PersonIcon className="w-4 h-4" />
                    <span>Enhanced features available for researchers</span>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowLoginModal(true)}
                    className="w-full max-w-xs"
                    disabled={isLoading}
                  >
                    <PersonIcon className="w-4 h-4 mr-2" />
                    Connect as a Ghostly researcher
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <FileUpload
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            setIsLoading={setIsLoading}
            currentSessionParams={sessionParams}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <QuickSelect onSelect={onQuickSelect} disabled={isLoading} />
        </CardContent>
      </Card>

      {/* Login Modal */}
      <ResearcherLoginModal 
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
      />
    </>
  );
};

export default SessionLoader; 