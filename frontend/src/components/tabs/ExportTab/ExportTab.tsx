/**
 * ExportTab Component - Refactored with Modular Architecture
 * Senior software architect cleanup: SOLID principles, separation of concerns, maintainable code
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { 
  FileTextIcon, 
  CopyIcon, 
  CheckIcon,
  CodeIcon,
  PersonIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons';
import { EMGAnalysisResult } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { useAuth } from '@/contexts/AuthContext';
import SupabaseStorageService from '@/services/supabaseStorage';
import { logger, LogCategory } from '@/services/logger';

// Import modular components
import { ExportOptionsPanel } from './ExportOptionsPanel';
import { ExportActions } from './ExportActions';
import { useExportData } from './hooks';
import { useEnhancedExportData } from './hooks/useEnhancedExportData';
import { detectOriginalFilename } from './utils';

interface ExportTabProps {
  analysisResult: EMGAnalysisResult | null;
  uploadedFileName?: string | null;
}

const ExportTab: React.FC<ExportTabProps> = ({ analysisResult, uploadedFileName }) => {
  const { sessionParams } = useSessionStore();
  const { userRole } = useAuth();
  
  // T019: Use enhanced export data hook with patient code integration
  const {
    exportOptions,
    setExportOptions,
    downsamplingOptions,
    setDownsamplingOptions,
    channelSelection,
    handleChannelSelectionChange,
    availableChannels,
    hasSelectedChannels,
    hasSelectedData,
    generateExportData,
    // Enhanced functionality with patient code
    patientCode: patientCodeInfo,
    enhancedMetadata
  } = useEnhancedExportData(analysisResult, uploadedFileName, sessionParams);

  // Local UI state
  const [jsonData, setJsonData] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect original filename
  const originalFilename = useMemo(() => 
    detectOriginalFilename(uploadedFileName, analysisResult),
    [uploadedFileName, analysisResult]
  );

  // Generate JSON preview (limited data for display)
  const generateJsonPreview = useCallback(async () => {
    setIsGenerating(true);
    try {
      const exportData = generateExportData(true); // isPreview = true
      if (exportData) {
        setJsonData(JSON.stringify(exportData, null, 2));
      } else {
        setJsonData('');
      }
    } catch (error) {
      logger.error(LogCategory.DATA_PROCESSING, 'Error generating JSON data:', error);
      setJsonData('');
    } finally {
      setIsGenerating(false);
    }
  }, [generateExportData]);

  // Copy JSON to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error(LogCategory.USER_INTERACTION, 'Failed to copy to clipboard:', error);
    }
  }, [jsonData]);

  // Download original C3D file
  const downloadOriginalFile = useCallback(async (): Promise<void> => {
    if (!analysisResult?.source_filename) {
      throw new Error('No source filename available');
    }
    
    const blob = await SupabaseStorageService.downloadFile(
      analysisResult.source_filename
    );
    
    // Create download URL and trigger browser download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = analysisResult.source_filename.split('/').pop() || 'download.c3d';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    URL.revokeObjectURL(url);
  }, [analysisResult?.source_filename]);

  // Memoize export data to prevent recreation on every render
  const fullExportData = useMemo(() => generateExportData(false), [generateExportData]);

  // T019: Use enhanced download functionality with patient code integration
  const downloadExportData = useCallback(async (): Promise<void> => {
    const exportData = fullExportData;
    if (!exportData) {
      throw new Error('No export data available');
    }

    // Use enhanced filename if available (with patient code)
    const filename = enhancedMetadata?.enhancedFileName || originalFilename;
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace('.c3d', '')}_analysis_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }, [fullExportData, originalFilename, enhancedMetadata]);

  // Auto-generate preview when selection changes
  React.useEffect(() => {
    if (hasSelectedData) {
      generateJsonPreview();
    } else {
      setJsonData('');
    }
  }, [hasSelectedData, generateJsonPreview]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Left Column - Configuration & Downloads */}
        <div className="space-y-6">
          {/* Export Options (includes EMG Channels in Advanced) */}
          <ExportOptionsPanel
            options={exportOptions}
            onChange={setExportOptions}
            availableChannels={availableChannels}
            channelSelection={channelSelection}
            onChannelSelectionChange={handleChannelSelectionChange}
            hasSelectedChannels={hasSelectedChannels}
            downsamplingOptions={downsamplingOptions}
            onDownsamplingChange={setDownsamplingOptions}
          />

          {/* Export Actions - Moved to left */}
          <ExportActions
            exportData={fullExportData} 
            originalFilename={originalFilename}
            hasSelectedData={hasSelectedData}
            hasSelectedChannels={hasSelectedChannels}
            exportFormat={exportOptions.format}
            sessionId={analysisResult?.session_id || undefined}
            onDownloadOriginal={downloadOriginalFile}
            onDownloadExport={downloadExportData}
          />
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          {/* JSON Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CodeIcon className="h-4 w-4" />
                JSON Preview
                {/* T020: Patient code in preview header */}
                {enhancedMetadata?.patientCode && enhancedMetadata?.patientCodeConfidence !== 'low' && (
                  <Badge variant="outline" className="ml-2">
                    <PersonIcon className="h-3 w-3 mr-1" />
                    {enhancedMetadata.patientCode}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Live Preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Preview shows 5 sample points per signal. Complete data available for download.
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          <strong>JSON:</strong> Includes {hasSelectedChannels ? 'full signals + ' : ''}all selected data<br />
                          <strong>CSV:</strong> Exports {hasSelectedChannels ? 'analytics & metadata only' : 'all selected data'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generate Preview Button */}
              <div className="flex gap-2">
                <Button
                  onClick={generateJsonPreview}
                  disabled={!hasSelectedData || isGenerating}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {isGenerating ? 'Generating...' : 'Refresh Preview'}
                </Button>
                
                <Button
                  onClick={copyToClipboard}
                  disabled={!jsonData}
                  variant="outline"
                  size="sm"
                  className="px-3"
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </Button>
              </div>

              {/* Preview Content */}
              {hasSelectedData ? (
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-96">
                    <Textarea
                      value={jsonData || (isGenerating ? 'Generating preview...' : 'No data to preview')}
                      readOnly
                      className="min-h-96 font-mono text-xs border-0 resize-none focus:ring-0"
                      style={{
                        tabSize: '2',
                        MozTabSize: '2'
                      }}
                    />
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select export options or EMG channels to see preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Export Options Note - Role-based */}
        <div className="col-span-full">
          <div className="text-center">
            <div className="bg-blue-50 rounded-lg p-4 max-w-lg mx-auto">
              <p className="text-sm text-blue-700">
                <strong>Need more export options?</strong> For advanced data workflows, 
                {userRole === 'RESEARCHER' || userRole === 'ADMIN' ? (
                  <>
                    consider <strong>Supabase Studio</strong> for direct database access, 
                    <strong> NocoDB</strong> for spreadsheet-style editing, or 
                    <strong> Metabase</strong> for custom analytics dashboards.
                  </>
                ) : (
                  <>
                    contact your technical team about <strong>Supabase Studio</strong>, 
                    <strong> NocoDB</strong>, or <strong> Metabase</strong> for advanced data tools.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ExportTab;