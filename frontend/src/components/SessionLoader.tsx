import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import FileUpload from './FileUpload';
import C3DFileBrowser from './C3DFileBrowser';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';
import { LightningBoltIcon } from '@radix-ui/react-icons';

interface SessionLoaderProps {
  onUploadSuccess: (data: EMGAnalysisResult, filename?: string) => void;
  onUploadError: (error: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  onQuickSelect: (filename: string, uploadDate?: string) => void;
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
  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto">
      {/* File Browser Section - Primary Focus */}
      <C3DFileBrowser onFileSelect={onQuickSelect} isLoading={isLoading} />

      {/* Upload Section - Secondary/Subtle */}
      <div className="border-t border-slate-200 pt-8">
        <Card className="border-slate-200 bg-white">
          <CardContent className="px-6 pb-5 pt-5">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <LightningBoltIcon className="w-5 h-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">Direct Analysis</h3>
                  <p className="text-sm text-slate-600">
                    Upload a C3D file for immediate analysis (not saved to library)
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 w-80">
                <FileUpload
                  onUploadSuccess={onUploadSuccess}
                  onUploadError={onUploadError}
                  setIsLoading={setIsLoading}
                  currentSessionParams={sessionParams}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionLoader; 