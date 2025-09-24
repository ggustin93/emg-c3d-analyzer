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
import { UploadIcon } from '@radix-ui/react-icons';
import SupabaseStorageService from '@/services/supabaseStorage';

interface C3DFileUploadProps {
  onUploadComplete: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const C3DFileUpload: React.FC<C3DFileUploadProps> = ({
  onUploadComplete,
  onError,
  disabled = false
}) => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Show confirmation dialog first
    setPendingFiles(files);
    setShowUploadDialog(true);
  };

  const confirmUpload = async () => {
    if (!pendingFiles) return;

    setShowUploadDialog(false);
    setIsUploading(true);

    try {
      let uploadedCount = 0;
      const errors: string[] = [];

      for (const file of Array.from(pendingFiles)) {
        if (!file.name.toLowerCase().endsWith('.c3d')) {
          errors.push(`${file.name}: Only C3D files are allowed`);
          continue;
        }

        try {
          await SupabaseStorageService.uploadFile(file, {
            metadata: {
              uploaded_at: new Date().toISOString(),
              file_size: file.size
            }
          });
          uploadedCount++;
        } catch (err: any) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }

      if (uploadedCount > 0) {
        onUploadComplete();
        if (errors.length > 0) {
          onError(`Uploaded ${uploadedCount} files. Some failed: ${errors.join(', ')}`);
        } else {
          // Success message handled by parent component
        }
      } else {
        onError(`Failed to upload files: ${errors.join(', ')}`);
      }

    } catch (err: any) {
      onError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setPendingFiles(null);
      // Reset the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const cancelUpload = () => {
    setShowUploadDialog(false);
    setPendingFiles(null);
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadIcon className="w-5 h-5 text-blue-600" />
              Upload to C3D Library
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="text-sm text-slate-600">
                You are about to upload <strong className="text-slate-800">
                  {pendingFiles?.length || 0} file{(pendingFiles?.length || 0) !== 1 ? 's' : ''}
                </strong> to the C3D Library.
              </div>
              <div className="bg-blue-50 p-3 rounded-md border-l-4 border-blue-400">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">Files will be accessible to all researchers</p>
                    <p>Uploaded files are stored in the shared C3D bucket and can be viewed, analyzed, and downloaded by all authenticated platform users.</p>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={cancelUpload}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmUpload}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Upload Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default C3DFileUpload;