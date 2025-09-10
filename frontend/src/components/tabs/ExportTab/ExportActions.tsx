/**
 * Export Actions Component
 * Handles file download and export actions
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DownloadIcon, 
  FileTextIcon,
  CheckIcon 
} from '@radix-ui/react-icons';
import { ExportData } from './types';
import { formatBytes } from './utils';

interface ExportActionsProps {
  exportData: ExportData | null;
  originalFilename: string;
  hasSelectedData: boolean;
  exportFormat: 'json' | 'csv';
  sessionId?: string;
  onDownloadOriginal: () => Promise<void>;
  onDownloadExport: () => Promise<void>;
}

export const ExportActions: React.FC<ExportActionsProps> = ({
  exportData,
  originalFilename,
  hasSelectedData,
  exportFormat,
  sessionId,
  onDownloadOriginal,
  onDownloadExport,
}) => {
  const [downloadStates, setDownloadStates] = useState<{
    original: 'idle' | 'downloading' | 'success';
    export: 'idle' | 'downloading' | 'success';
  }>({
    original: 'idle',
    export: 'idle',
  });

  const handleDownloadOriginal = async () => {
    setDownloadStates(prev => ({ ...prev, original: 'downloading' }));
    try {
      await onDownloadOriginal();
      setDownloadStates(prev => ({ ...prev, original: 'success' }));
      setTimeout(() => {
        setDownloadStates(prev => ({ ...prev, original: 'idle' }));
      }, 2000);
    } catch (error) {
      console.error('Original download failed:', error);
      setDownloadStates(prev => ({ ...prev, original: 'idle' }));
    }
  };

  const handleDownloadExport = async () => {
    setDownloadStates(prev => ({ ...prev, export: 'downloading' }));
    try {
      if (exportFormat === 'csv' && sessionId) {
        // CSV format: Call backend API
        await downloadCsvFromBackend();
      } else {
        // JSON format: Use existing client-side export
        await onDownloadExport();
      }
      setDownloadStates(prev => ({ ...prev, export: 'success' }));
      setTimeout(() => {
        setDownloadStates(prev => ({ ...prev, export: 'idle' }));
      }, 2000);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStates(prev => ({ ...prev, export: 'idle' }));
    }
  };

  const downloadCsvFromBackend = async () => {
    if (!sessionId) {
      throw new Error('Session ID required for CSV export');
    }

    // Call backend API for CSV export
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const response = await fetch(`${apiUrl}/export/session/${sessionId}?format=csv`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to export CSV: ${response.statusText}`);
    }

    // Get the CSV content as blob
    const blob = await response.blob();
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${originalFilename.replace('.c3d', '')}_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  };

  // Estimate export file size
  const estimatedSize = exportData ? 
    formatBytes(JSON.stringify(exportData).length * (exportFormat === 'csv' ? 0.5 : 2)) : '0 KB';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileTextIcon className="h-4 w-4" />
          Downloads
        </CardTitle>
        <CardDescription>
          Download original file or export selected data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Original C3D Download */}
          <div className="space-y-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleDownloadOriginal}
                  disabled={downloadStates.original === 'downloading'}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  {downloadStates.original === 'success' ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                  {downloadStates.original === 'downloading' ? 'Downloading...' : 
                   downloadStates.original === 'success' ? 'Downloaded!' : 
                   'Download Original C3D'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download the original C3D file: {originalFilename}</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground px-2">
              Original file: {originalFilename}
            </p>
          </div>

          {/* Export JSON Download */}
          <div className="space-y-2">
            <Button
              onClick={handleDownloadExport}
              disabled={!hasSelectedData || downloadStates.export === 'downloading'}
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-primary text-primary hover:bg-primary/5"
            >
              {downloadStates.export === 'success' ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
              {downloadStates.export === 'downloading' ? 'Exporting...' : 
               downloadStates.export === 'success' ? 'Exported!' : 
               `Export ${exportFormat.toUpperCase()} Data`}
            </Button>
            
            {hasSelectedData ? (
              <p className="text-xs text-muted-foreground px-2">
                Estimated size: {estimatedSize}
              </p>
            ) : (
              <Alert className="mt-2">
                <AlertDescription className="text-xs">
                  Select at least one export option or EMG channel to enable export.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};