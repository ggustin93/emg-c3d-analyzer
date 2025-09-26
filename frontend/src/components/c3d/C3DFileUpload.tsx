import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, FileIcon, CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import SupabaseStorageService from '@/services/supabaseStorage';

interface C3DFileUploadProps {
  onUploadComplete: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  patientId?: string; // Add patient ID for folder structure
}

const C3DFileUpload: React.FC<C3DFileUploadProps> = ({
  onUploadComplete,
  onError,
  disabled = false,
  patientId
}) => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadResults, setUploadResults] = useState<Array<{
    file: File;
    status: 'success' | 'error';
    message: string;
  }>>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Show confirmation dialog first
    setPendingFiles(files);
    setShowUploadDialog(true);
  };

  const confirmUpload = async () => {
    if (!pendingFiles) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResults([]);
    setUploadStatus('uploading');

    try {
      const files = Array.from(pendingFiles);
      const results: Array<{
        file: File;
        status: 'success' | 'error';
        message: string;
      }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = Math.round(((i + 1) / files.length) * 100);
        setUploadProgress(progress);

        if (!file.name.toLowerCase().endsWith('.c3d')) {
          results.push({
            file,
            status: 'error',
            message: 'Only C3D files are allowed'
          });
          continue;
        }

        try {
          await SupabaseStorageService.uploadFile(file, {
            patientId: patientId, // Pass patient ID for folder structure
            metadata: {
              uploaded_at: new Date().toISOString(),
              file_size: file.size,
              patient_id: patientId
            }
          });
          results.push({
            file,
            status: 'success',
            message: 'Uploaded successfully'
          });
        } catch (err: any) {
          results.push({
            file,
            status: 'error',
            message: err.message || 'Upload failed'
          });
        }
      }

      setUploadResults(results);
      setUploadStatus('success');

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      if (successCount > 0) {
        onUploadComplete();
        if (errorCount > 0) {
          onError(`Uploaded ${successCount} files. ${errorCount} failed.`);
        }
      } else {
        onError(`Failed to upload all files.`);
      }

    } catch (err: any) {
      setUploadStatus('error');
      onError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      // Keep dialog open to show results
    }
  };

  const cancelUpload = () => {
    setShowUploadDialog(false);
    setPendingFiles(null);
    setUploadResults([]);
    setUploadProgress(0);
    setUploadStatus('idle');
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const closeUploadDialog = () => {
    setShowUploadDialog(false);
    setPendingFiles(null);
    setUploadResults([]);
    setUploadProgress(0);
    setUploadStatus('idle');
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <>
      {/* Upload Files Button */}
      <div className="relative">
        <input
          type="file"
          multiple
          accept=".c3d"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || isUploading}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isUploading}
          className="flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
        >
          {isUploading ? (
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <UploadIcon className="w-4 h-4" />
          )}
          {isUploading ? 'Uploading...' : 'Upload Files'}
        </Button>
      </div>

      {/* Upload Confirmation Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadIcon className="w-5 h-5 text-blue-600" />
              Upload C3D Files
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="text-sm text-gray-700">
                Upload C3D files to the patient's session library for analysis and review.
              </p>
              
              {patientId && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <CheckCircledIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">Patient: {patientId}</p>
                      <p className="text-blue-700 font-mono text-xs mt-1">
                        Files will be uploaded to patient-specific folder
                      </p>
                      <p className="text-blue-600 text-xs mt-2">
                        Uploaded files are organized by patient and accessible for clinical analysis.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* File Details */}
              {pendingFiles && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-2">
                    <FileIcon className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-green-900">
                        {pendingFiles.length} file{(pendingFiles.length !== 1 ? 's' : '')} selected
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-1 mt-2">
                        {Array.from(pendingFiles).map((file, index) => (
                          <div key={index} className="text-xs text-green-700 font-mono">
                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* Upload Progress */}
          {isUploading && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0">
                  <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Uploading files...</p>
                  <p className="text-amber-700 text-xs mt-1">{uploadProgress}% complete</p>
                  <Progress value={uploadProgress} className="w-full mt-2" />
                </div>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0">
                  {uploadResults.every(r => r.status === 'success') ? (
                    <CheckCircledIcon className="w-4 h-4 text-green-600" />
                  ) : (
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-slate-900">Upload Results</p>
                  <div className="max-h-24 overflow-y-auto space-y-1 mt-2">
                    {uploadResults.map((result, index) => (
                      <div key={index} className="text-xs font-mono">
                        <span className={result.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                          {result.status === 'success' ? '✓' : '✗'} {result.file.name}
                        </span>
                        <span className="text-slate-500 ml-2">{result.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {uploadResults.length > 0 ? (
              <Button 
                onClick={closeUploadDialog}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Close
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={cancelUpload}
                  className="flex-1"
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmUpload}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default C3DFileUpload;