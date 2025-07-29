import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

interface FileUploadProps {
  onUploadSuccess: (data: EMGAnalysisResult) => void;
  onUploadError: (error: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  currentSessionParams: GameSessionParameters;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onUploadSuccess, 
  onUploadError, 
  setIsLoading,
  currentSessionParams
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      onUploadError(''); // Clear previous errors
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      onUploadError('Please select a C3D file first.');
      return;
    }

    setIsUploading(true);
    setIsLoading(true); // Inform App component
    onUploadError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    
    if (currentSessionParams.session_mvc_value !== null && currentSessionParams.session_mvc_value !== undefined) {
      formData.append('session_mvc_value', String(currentSessionParams.session_mvc_value));
    }
    if (currentSessionParams.session_mvc_threshold_percentage !== null && currentSessionParams.session_mvc_threshold_percentage !== undefined) {
      formData.append('session_mvc_threshold_percentage', String(currentSessionParams.session_mvc_threshold_percentage));
    }
    if (currentSessionParams.session_expected_contractions !== null && currentSessionParams.session_expected_contractions !== undefined) {
      formData.append('session_expected_contractions', String(currentSessionParams.session_expected_contractions));
    }
    if (currentSessionParams.session_expected_contractions_ch1 !== null && currentSessionParams.session_expected_contractions_ch1 !== undefined) {
      formData.append('session_expected_contractions_ch1', String(currentSessionParams.session_expected_contractions_ch1));
    }
    if (currentSessionParams.session_expected_contractions_ch2 !== null && currentSessionParams.session_expected_contractions_ch2 !== undefined) {
      formData.append('session_expected_contractions_ch2', String(currentSessionParams.session_expected_contractions_ch2));
    }
    
    try {
      const response = await axios.post<EMGAnalysisResult>(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onUploadSuccess(response.data);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (axios.isAxiosError(error) && error.response) {
        onUploadError(`Upload failed: ${error.response.data.detail || error.message}`);
      } else {
        onUploadError(`Upload failed: ${error.message || 'An unknown error occurred.'}`);
      }
    } finally {
      setIsUploading(false);
      setIsLoading(false); // Inform App component
    }
  };

  return (
    <div className="pt-4">
      {/* Choose File Button - Similar to Upload Files Button */}
      <div className="relative">
        <input
          type="file"
          accept=".c3d"
          onChange={handleFileChange}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={isUploading}
          className="w-full flex items-center gap-2 h-9"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          {selectedFile ? selectedFile.name : 'Choose File'}
        </Button>
      </div>
        
      {selectedFile && !isUploading && (
        <div className="flex items-center text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">Ready for analysis</span>
        </div>
      )}
      
      <Button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Analyze File
          </span>
        )}
      </Button>
    </div>
  );
};

export default FileUpload; 