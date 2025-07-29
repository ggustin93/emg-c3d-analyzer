import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  DownloadIcon, 
  FileTextIcon, 
  GearIcon, 
  CheckCircledIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
  CopyIcon 
} from '@radix-ui/react-icons';
import { EMGAnalysisResult, GameSessionParameters } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';

interface JsonExportModalProps {
  analysisResult: EMGAnalysisResult | null;
  uploadedFileName?: string;
  children: React.ReactNode;
}

interface ExportOptions {
  includeRawSignals: boolean;
  includeDebugInfo: boolean;
}

interface ExportData {
  export_metadata: {
    export_timestamp: string;
    export_version: string;
    exporter: string;
  };
  file_info: any;
  game_metadata: any;
  processing_parameters: any;
  channels: any;
  analytics: any;
  summary_statistics: any;
  debug_info?: any;
  request_metadata: any;
}

const JsonExportModal: React.FC<JsonExportModalProps> = ({ 
  analysisResult, 
  uploadedFileName,
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeRawSignals: true,
    includeDebugInfo: true
  });
  
  const { sessionParams } = useSessionStore();

  const handleExport = async () => {
    if (!analysisResult) {
      alert("No analysis data available to export");
      return;
    }

    setIsExporting(true);
    
    try {
      // For now, we'll generate mock data since we don't have file storage
      // In production, this would call the /export API endpoint
      handleExportWithMockData();
      
      // TODO: Implement real API call when file storage is available
      // const formData = new FormData();
      // formData.append('file', storedFile);
      // formData.append('include_raw_signals', exportOptions.includeRawSignals.toString());
      // formData.append('include_debug_info', exportOptions.includeDebugInfo.toString());
      
      // const response = await fetch('/api/export', {
      //   method: 'POST',
      //   body: formData
      // });
      
      // if (response.ok) {
      //   const exportData = await response.json();
      //   setExportData(exportData);
      // }
      
    } catch (error) {
      console.error('Export failed:', error);
      alert("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWithMockData = () => {
    // Create mock export data for demonstration
    const mockExportData: ExportData = {
      export_metadata: {
        export_timestamp: new Date().toISOString(),
        export_version: "1.0.0",
        exporter: "EMG C3D Analyzer v0.1.0"
      },
      file_info: {
        source_file: uploadedFileName || "session.c3d",
        full_path: `uploads/${uploadedFileName}`,
        file_size_bytes: 12345,
        file_modified: new Date().toISOString()
      },
      game_metadata: analysisResult?.metadata || {},
      processing_parameters: {
        session_parameters: sessionParams,
        processing_options: {
          threshold_factor: 0.3,
          min_duration_ms: 50,
          smoothing_window: 25
        },
        analysis_functions_used: [
          "basic_metrics", "contraction_analysis", "frequency_analysis", 
          "fatigue_analysis", "clinical_metrics"
        ]
      },
      channels: Object.keys(analysisResult?.analytics || {}).reduce((acc, channel) => {
        acc[channel] = {
          metadata: {
            sampling_rate: 1000,
            data_points: 12000,
            duration_seconds: 12,
            signal_type: "emg_channel"
          },
          ...(exportOptions.includeRawSignals ? {
            signals: {
              raw_data: "Array of " + 12000 + " data points (truncated for display)",
              time_axis: "Array of " + 12000 + " time points (truncated for display)",
              rms_envelope: "Array of " + 12000 + " RMS values (truncated for display)"
            }
          } : {
            signal_summary: {
              min_value: -50.2,
              max_value: 89.7,
              mean_value: 15.3,
              data_points: 12000
            }
          })
        };
        return acc;
      }, {} as any),
      analytics: analysisResult?.analytics || {},
      summary_statistics: {
        total_channels: Object.keys(analysisResult?.analytics || {}).length,
        channels_processed: Object.keys(analysisResult?.analytics || {}).map(name => ({
          name,
          type: "emg_channel"
        })),
        overall_metrics: {
          amplitude_range: {
            min: 10.5,
            max: 89.7,
            mean: 45.2
          },
          contraction_summary: {
            total_contractions: 24,
            avg_per_channel: 12
          }
        }
      },
      request_metadata: {
        user_id: "demo_user",
        patient_id: null,
        session_id: null,
        filename: uploadedFileName || "session.c3d",
        export_timestamp: new Date().toISOString()
      }
    };

    if (exportOptions.includeDebugInfo) {
      mockExportData.debug_info = {
        processor_state: {
          file_loaded: true,
          metadata_extracted: true,
          emg_data_extracted: true,
          analytics_calculated: true
        },
        data_dimensions: Object.keys(analysisResult?.analytics || {}).reduce((acc, channel) => {
          acc[channel] = {
            signal_length: 12000,
            time_axis_length: 12000,
            rms_envelope_length: 12000
          };
          return acc;
        }, {} as any),
        processing_warnings: [],
        system_info: {
          export_timestamp: new Date().toISOString(),
          python_version: "3.9.0"
        }
      };
    }

    setExportData(mockExportData);
  };

  const handleDownload = () => {
    if (!exportData) return;

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `emg_analysis_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // File downloaded successfully
  };

  const handleCopyToClipboard = async () => {
    if (!exportData) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert("JSON data copied to clipboard!");
    } catch (error) {
      alert("Failed to copy to clipboard");
    }
  };

  const getExportSummary = () => {
    if (!exportData) return null;

    const channelCount = Object.keys(exportData.channels || {}).length;
    const analyticsCount = Object.keys(exportData.analytics || {}).length;
    const hasRawSignals = exportOptions.includeRawSignals;
    const hasDebugInfo = exportOptions.includeDebugInfo;

    return {
      channelCount,
      analyticsCount,
      hasRawSignals,
      hasDebugInfo,
      estimatedSize: JSON.stringify(exportData).length
    };
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const summary = getExportSummary();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="w-5 h-5" />
            JSON Data Export
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left Panel - Options & Controls */}
          <div className="w-80 flex-shrink-0 space-y-4">
            {/* Export Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GearIcon className="w-4 h-4" />
                  Export Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="raw-signals" className="text-sm">
                    Include Raw Signals
                  </Label>
                  <Switch
                    id="raw-signals"
                    checked={exportOptions.includeRawSignals}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeRawSignals: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="debug-info" className="text-sm">
                    Include Debug Info
                  </Label>
                  <Switch
                    id="debug-info"
                    checked={exportOptions.includeDebugInfo}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeDebugInfo: checked }))
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Button 
                    onClick={handleExportWithMockData}
                    disabled={!analysisResult || isExporting}
                    className="w-full"
                    size="sm"
                  >
                    {isExporting ? (
                      <>
                        <ReloadIcon className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileTextIcon className="w-4 h-4 mr-2" />
                        Generate Export
                      </>
                    )}
                  </Button>
                  
                  {exportData && (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleDownload}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        Download JSON
                      </Button>
                      <Button 
                        onClick={handleCopyToClipboard}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <CopyIcon className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Export Summary */}
            {summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircledIcon className="w-4 h-4 text-green-600" />
                    Export Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Channels:</span>
                    <Badge variant="secondary">{summary.channelCount}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Analytics:</span>
                    <Badge variant="secondary">{summary.analyticsCount}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Raw Signals:</span>
                    <Badge variant={summary.hasRawSignals ? "default" : "outline"}>
                      {summary.hasRawSignals ? "Included" : "Excluded"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Debug Info:</span>
                    <Badge variant={summary.hasDebugInfo ? "default" : "outline"}>
                      {summary.hasDebugInfo ? "Included" : "Excluded"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Est. Size:</span>
                    <Badge variant="outline">{formatBytes(summary.estimatedSize)}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Panel */}
            <Alert>
              <ExclamationTriangleIcon className="w-4 h-4" />
              <AlertDescription className="text-xs">
                This export includes all processed analysis data, raw signals (optional), 
                and debug information for comprehensive offline analysis.
              </AlertDescription>
            </Alert>
          </div>

          {/* Right Panel - JSON Preview */}
          <div className="flex-1 min-w-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">JSON Preview</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  {exportData ? (
                    <Textarea
                      value={JSON.stringify(exportData, null, 2)}
                      readOnly
                      className="min-h-full font-mono text-xs border-0 resize-none"
                      style={{ minHeight: '100%' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <div className="text-center">
                        <FileTextIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-sm">Click "Generate Export" to preview JSON data</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JsonExportModal;