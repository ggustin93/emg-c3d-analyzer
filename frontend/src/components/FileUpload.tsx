import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button'; // Assuming Shadcn Button
import { Input } from '../components/ui/input';   // Assuming Shadcn Input for file
import { EMGAnalysisResult } from '../types/emg'; // Adjust path as needed

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

interface FileUploadProps {
  onUploadSuccess: (data: EMGAnalysisResult) => void;
  onUploadError: (error: string) => void;
  setIsLoading: (isLoading: boolean) => void; // To control global loading state if needed
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, onUploadError, setIsLoading }) => {
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
    // Add other form data if needed, e.g.:
    // formData.append('patient_id', 'some_patient_id');

    try {
      // Corrected API URL
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
    <div className="my-4 p-4 border rounded-lg shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Upload C3D File</h2>
      <div className="flex items-center space-x-2">
        <Input
          type="file"
          accept=".c3d"
          onChange={handleFileChange}
          disabled={isUploading}
          className="flex-grow"
        />
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
    </div>
  );
};

export default FileUpload; 