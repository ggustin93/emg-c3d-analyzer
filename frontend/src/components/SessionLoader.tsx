import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FileUpload from './FileUpload';
import QuickSelect from './QuickSelect';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';

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
  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Load Session Data</CardTitle>
        <CardDescription className="text-center">
          Upload a C3D file or select a quick sample to begin analysis.
        </CardDescription>
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
  );
};

export default SessionLoader; 