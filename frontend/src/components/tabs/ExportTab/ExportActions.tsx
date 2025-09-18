/**
 * Export Actions Component
 * Handles file download and export actions
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  DownloadIcon, 
  FileTextIcon,
  CheckIcon,
  PersonIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons';
import { ExportData } from './types';
import { formatBytes } from './utils';
import { generateCsvFromExportData, canGenerateCsv, estimateCsvSize } from './csvGenerator';

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
  // T018: Extract patient code information from export data
  const patientCode = exportData?.metadata?.patientCode;
  const patientCodeSource = exportData?.metadata?.patientCodeSource || 'unknown';
  const patientCodeConfidence = exportData?.metadata?.patientCodeConfidence || 'low';
  const enhancedFileName = exportData?.metadata?.enhancedFileName;

  // T018: Helper function to get confidence badge variant
  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'default'; // Green
      case 'medium': return 'secondary'; // Gray
      case 'low': return 'outline'; // Light border
      default: return 'outline';
    }
  };

  // T018: Helper function to get confidence description
  const getConfidenceDescription = (source: string, confidence: string) => {
    const descriptions = {
      'patient_id': {
        'high': 'Patient code extracted from patient_id with high reliability',
        'medium': 'Patient code extracted from patient_id but format validation failed', 
        'low': 'Patient code extraction from patient_id failed'
      },
      'filename': {
        'high': 'Patient code extracted from filename pattern with high confidence',
        'medium': 'Patient code found in filename but with lower pattern confidence',
        'low': 'Patient code extraction from filename failed'
      },
      'session_metadata': {
        'high': 'Patient code found in session metadata with high confidence',
        'medium': 'Patient code found in session metadata with moderate confidence', 
        'low': 'Patient code extraction from session metadata failed'
      },
      'unknown': {
        'high': 'Patient code source unknown but high confidence',
        'medium': 'Patient code source unknown with moderate confidence',
        'low': 'Patient code unavailable - no valid extraction method found'
      }
    };
    return descriptions[source as keyof typeof descriptions]?.[confidence as keyof typeof descriptions['patient_id']] || 
           'Patient code confidence assessment unavailable';
  };
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
      if (exportFormat === 'csv') {
        // CSV format: Use client-side generation (same as JSON approach)
        if (!exportData || !canGenerateCsv(exportData)) {
          throw new Error('Export data is not available for CSV generation.');
        }
        generateCsvFromExportData(exportData, originalFilename);
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


  // Estimate export file size
  const estimatedSize = exportData ? 
    (exportFormat === 'csv' ? estimateCsvSize(exportData) : formatBytes(JSON.stringify(exportData).length * 2)) : '0 KB';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileTextIcon className="h-4 w-4" />
          Downloads
          {/* T018: Patient code display in header */}
          {patientCode && (
            <Badge variant={getConfidenceBadgeVariant(patientCodeConfidence)} className="ml-2">
              <PersonIcon className="h-3 w-3 mr-1" />
              {patientCode}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Download original file or export selected data
          {/* T018: Patient code confidence indicator */}
          {patientCode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{getConfidenceDescription(patientCodeSource, patientCodeConfidence)}</p>
              </TooltipContent>
            </Tooltip>
          )}
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
              {/* T018: Show enhanced filename if available */}
              Original file: {enhancedFileName || originalFilename}
              {enhancedFileName && enhancedFileName !== originalFilename && (
                <span className="text-green-600 ml-1"></span>
              )}
            </p>
          </div>

          {/* Export Data Download */}
          <div className="space-y-2">
            <Button
              onClick={handleDownloadExport}
              disabled={!hasSelectedData || downloadStates.export === 'downloading' || (exportFormat === 'csv' && !canGenerateCsv(exportData))}
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
               `Export ${exportFormat.toUpperCase()} Data${patientCode && patientCodeConfidence !== 'low' ? ` (${patientCode})` : ''}`}
            </Button>
            
            {!hasSelectedData ? (
              <Alert className="mt-2">
                <AlertDescription className="text-xs">
                  Select at least one export option or EMG channel to enable export.
                </AlertDescription>
              </Alert>
            ) : exportFormat === 'csv' && !canGenerateCsv(exportData) ? (
              <Alert className="mt-2">
                <AlertDescription className="text-xs">
                  CSV export requires export data with analytics or metadata.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground px-2">
                Estimated size: {estimatedSize}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};