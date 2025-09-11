/**
 * CSV Generator for Client-Side Export
 * 
 * Generates CSV files from export data for stateless uploads.
 * This allows CSV export without requiring a database session.
 */

import { ExportData } from './types';

// Helper function for RPE descriptions
function getRpeDescription(rpe: number): string {
  const rpeDescriptions: Record<number, string> = {
    1: 'Very Easy',
    2: 'Easy', 
    3: 'Moderate',
    4: 'Somewhat Hard',
    5: 'Hard',
    6: 'Very Hard',
    7: 'Very Hard+',
    8: 'Extremely Hard',
    9: 'Extremely Hard+',
    10: 'Maximum Effort'
  };
  return rpeDescriptions[rpe] || 'Unknown';
}

// Helper interfaces for type safety
interface ChannelAnalytics {
  contraction_count?: number;
  avg_duration_ms?: number;
  min_duration_ms?: number;
  max_duration_ms?: number;
  total_time_under_tension_ms?: number;
  avg_amplitude?: number;
  max_amplitude?: number;
  rms?: number;
  mav?: number;
  mpf?: number;
  mdf?: number;
  fatigue_index_fi_nsm5?: number;
  good_contraction_count?: number;
  mvc_compliant_count?: number;
  duration_compliant_count?: number;
  contractions?: Array<{
    start_time_ms: number;
    end_time_ms: number;
    duration_ms: number;
    mean_amplitude: number;
    max_amplitude: number;
    is_good?: boolean;
    meets_mvc?: boolean;
    meets_duration?: boolean;
  }>;
}

interface SignalData {
  sampling_rate: number;
  data?: number[];
  time_axis?: number[];
  rms_envelope?: number[];
  activated_data?: number[];
}

/**
 * Convert export data to CSV format and trigger download
 * @param exportData The prepared export data
 * @param originalFilename The original C3D filename for naming
 */
export function generateCsvFromExportData(exportData: ExportData, originalFilename: string): void {
  if (!exportData) {
    console.error('No export data available for CSV generation');
    return;
  }

  const csvRows: string[] = [];
  
  // Add professional header with better formatting
  csvRows.push('# EMG Analysis Export Report');
  csvRows.push(`# Source File: ${originalFilename}`);
  csvRows.push(`# Generated: ${new Date().toLocaleString()}`);
  csvRows.push(`# Export Type: Client-Side Processing`);
  csvRows.push('#');
  csvRows.push('');
  
  // Add metadata section with better structure
  if (exportData.metadata) {
    csvRows.push('"=== FILE METADATA ==="');
    csvRows.push('Property,Value');
    Object.entries(exportData.metadata).forEach(([key, value]) => {
      if (typeof value !== 'object') {
        // Format key names for better readability
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .replace(/([a-z])([A-Z])/g, '$1 $2');
        csvRows.push(`"${formattedKey}","${value ?? ''}"`); 
      }
    });
    csvRows.push('');
  }
  
  // Add session parameters (scoring configuration, RPE, etc.)
  if (exportData.sessionParameters) {
    csvRows.push('"=== SESSION CONFIGURATION ==="');
    csvRows.push('Parameter,Value');
    
    const sessionParams = exportData.sessionParameters;
    
    // RPE Data
    if (sessionParams.rpe_pre_session !== undefined) {
      csvRows.push(`"RPE Pre-Session","${sessionParams.rpe_pre_session} (${getRpeDescription(sessionParams.rpe_pre_session)})"`); 
    }
    if (sessionParams.rpe_post_session !== undefined) {
      csvRows.push(`"RPE Post-Session","${sessionParams.rpe_post_session} (${getRpeDescription(sessionParams.rpe_post_session)})"`); 
    }
    
    // MVC Thresholds
    if (sessionParams.mvc_threshold_ch1 !== undefined) {
      csvRows.push(`"MVC Threshold CH1","${(sessionParams.mvc_threshold_ch1 * 100).toFixed(1)}% (${sessionParams.mvc_threshold_ch1.toExponential(3)})"`); 
    }
    if (sessionParams.mvc_threshold_ch2 !== undefined) {
      csvRows.push(`"MVC Threshold CH2","${(sessionParams.mvc_threshold_ch2 * 100).toFixed(1)}% (${sessionParams.mvc_threshold_ch2.toExponential(3)})"`); 
    }
    
    // Duration Thresholds
    if (sessionParams.contraction_duration_threshold !== undefined) {
      csvRows.push(`"Contraction Duration Threshold","${sessionParams.contraction_duration_threshold} ms"`); 
    }
    if (sessionParams.target_duration_ch1_ms !== undefined) {
      csvRows.push(`"Target Duration CH1","${sessionParams.target_duration_ch1_ms} ms"`); 
    }
    if (sessionParams.target_duration_ch2_ms !== undefined) {
      csvRows.push(`"Target Duration CH2","${sessionParams.target_duration_ch2_ms} ms"`); 
    }
    
    // Session Settings
    if (sessionParams.session_duration_seconds !== undefined) {
      csvRows.push(`"Session Duration","${sessionParams.session_duration_seconds} seconds (${(sessionParams.session_duration_seconds / 60).toFixed(1)} min)"`); 
    }
    if (sessionParams.rest_duration_seconds !== undefined) {
      csvRows.push(`"Rest Duration","${sessionParams.rest_duration_seconds} seconds"`); 
    }
    
    csvRows.push('');
  }
  
  // Add performance analysis/scoring if available
  if (exportData.performanceAnalysis) {
    csvRows.push('"=== PERFORMANCE SCORING ==="');
    csvRows.push('');
    
    const perfAnalysis = exportData.performanceAnalysis;
    
    // Overall scores
    if (perfAnalysis.overall_score !== undefined) {
      csvRows.push(`"Overall Performance Score","${perfAnalysis.overall_score.toFixed(1)}%"`); 
    }
    
    // Component scores
    csvRows.push('"=== COMPONENT SCORES ==="');
    csvRows.push('Component,Score,Weight,Weighted Score');
    
    const components = ['compliance', 'symmetry', 'effort', 'game'];
    components.forEach(component => {
      const score = perfAnalysis[`${component}_score`];
      const weight = perfAnalysis[`${component}_weight`] || perfAnalysis.weights?.[component];
      if (score !== undefined) {
        const weightedScore = weight ? (score * weight).toFixed(1) : 'N/A';
        const weightDisplay = weight ? `${(weight * 100).toFixed(1)}%` : 'N/A';
        csvRows.push(`"${component.charAt(0).toUpperCase() + component.slice(1)}","${score.toFixed(1)}%","${weightDisplay}","${weightedScore}%"`); 
      }
    });
    
    csvRows.push('');
  }
  
  // Add analytics section with improved formatting
  if (exportData.analytics && typeof exportData.analytics === 'object') {
    csvRows.push('"=== CHANNEL ANALYTICS SUMMARY ==="');
    csvRows.push('');
    
    // Create a comprehensive table with all channels
    const analyticsData = exportData.analytics as Record<string, ChannelAnalytics>;
    const channelNames = Object.keys(analyticsData);
    
    if (channelNames.length > 0) {
      // Header row with all channels
      csvRows.push(['Metric', ...channelNames].map(item => `"${item}"`).join(','));
      
      // Data rows with proper number formatting
      const metrics = [
        { key: 'contraction_count', label: 'Contraction Count', format: (val: any) => val ?? 0 },
        { key: 'avg_duration_ms', label: 'Average Duration (ms)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'min_duration_ms', label: 'Min Duration (ms)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'max_duration_ms', label: 'Max Duration (ms)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'total_time_under_tension_ms', label: 'Total Time Under Tension (ms)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'avg_amplitude', label: 'Average Amplitude', format: (val: any) => (val ?? 0).toExponential(3) },
        { key: 'max_amplitude', label: 'Max Amplitude', format: (val: any) => (val ?? 0).toExponential(3) },
        { key: 'rms', label: 'RMS', format: (val: any) => (val ?? 0).toExponential(3) },
        { key: 'mav', label: 'Mean Absolute Value (MAV)', format: (val: any) => (val ?? 0).toExponential(3) },
        { key: 'mpf', label: 'Mean Power Frequency (Hz)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'mdf', label: 'Median Frequency (Hz)', format: (val: any) => (val ?? 0).toFixed(2) },
        { key: 'fatigue_index_fi_nsm5', label: 'Fatigue Index', format: (val: any) => (val ?? 0).toExponential(3) }
      ];
      
      metrics.forEach(({ key, label, format }) => {
        const row = [label, ...channelNames.map(channel => {
          const analytics = analyticsData[channel];
          return format((analytics as any)[key]);
        })];
        csvRows.push(row.map(item => `"${item}"`).join(','));
      });
      
      csvRows.push('');
      
      // Quality metrics section
      csvRows.push('"=== QUALITY METRICS ==="');
      csvRows.push(['Metric', ...channelNames].map(item => `"${item}"`).join(','));
      
      const qualityMetrics = [
        { key: 'good_contraction_count', label: 'Good Contractions' },
        { key: 'mvc_compliant_count', label: 'MVC Compliant' },
        { key: 'duration_compliant_count', label: 'Duration Compliant' }
      ];
      
      qualityMetrics.forEach(({ key, label }) => {
        const row = [label, ...channelNames.map(channel => {
          const analytics = analyticsData[channel];
          const value = (analytics as any)[key];
          return value !== undefined ? value : 'N/A';
        })];
        csvRows.push(row.map(item => `"${item}"`).join(','));
      });
      
      csvRows.push('');
    }
  }
  
  // Add contractions details with improved formatting
  if (exportData.analytics && typeof exportData.analytics === 'object') {
    const analyticsData = exportData.analytics as Record<string, ChannelAnalytics>;
    const hasContractions = Object.values(analyticsData).some(analytics => 
      analytics.contractions && analytics.contractions.length > 0
    );
    
    if (hasContractions) {
      csvRows.push('"=== INDIVIDUAL CONTRACTIONS DETAIL ==="');
      csvRows.push('');
      
      // Combined header for all channels
      csvRows.push(['"Channel"', '"Contraction #"', '"Start Time (ms)"', '"End Time (ms)"', '"Duration (ms)"', '"Mean Amplitude"', '"Max Amplitude"', '"Quality: Good"', '"Quality: MVC"', '"Quality: Duration"'].join(','));
      
      Object.entries(analyticsData).forEach(([channelName, analytics]) => {
        if (analytics.contractions && analytics.contractions.length > 0) {
          analytics.contractions.forEach((contraction, index) => {
            csvRows.push([
              `"${channelName}"`,
              `"${index + 1}"`,
              `"${contraction.start_time_ms.toFixed(2)}"`,
              `"${contraction.end_time_ms.toFixed(2)}"`,
              `"${contraction.duration_ms.toFixed(2)}"`,
              `"${contraction.mean_amplitude.toExponential(3)}"`,
              `"${contraction.max_amplitude.toExponential(3)}"`,
              `"${contraction.is_good ? 'Yes' : 'No'}"`,
              `"${contraction.meets_mvc ? 'Yes' : 'No'}"`,
              `"${contraction.meets_duration ? 'Yes' : 'No'}"`
            ].join(','));
          });
        }
      });
      csvRows.push('');
    }
  }
  
  // Add signal data with better organization (if included)
  if (exportData.processedSignals && typeof exportData.processedSignals === 'object') {
    csvRows.push('"=== SIGNAL DATA SUMMARY ==="');
    csvRows.push('');
    
    // Signal metadata table
    const signalsData = exportData.processedSignals as Record<string, SignalData>;
    csvRows.push(['"Channel"', '"Sampling Rate (Hz)"', '"Data Points"', '"Duration (s)"'].join(','));
    
    Object.entries(signalsData).forEach(([channelName, signalData]) => {
      const dataLength = signalData.data?.length ?? 0;
      const duration = dataLength > 0 ? (dataLength / signalData.sampling_rate).toFixed(2) : '0';
      csvRows.push([
        `"${channelName}"`,
        `"${signalData.sampling_rate}"`,
        `"${dataLength}"`,
        `"${duration}"`
      ].join(','));
    });
    csvRows.push('');
    
    // Note about full signal data
    csvRows.push('"# NOTE: Full time-series signal data available in JSON export"');
    csvRows.push('"# CSV format shows summary metrics for optimal file size and readability"');
    csvRows.push('');
  }
  
  // Add footer with export information
  csvRows.push('');
  csvRows.push('"=== EXPORT INFORMATION ==="');
  csvRows.push(`"Report Generated:","${new Date().toLocaleString()}"`);
  csvRows.push(`"Original File:","${originalFilename}"`);
  csvRows.push(`"Export Method:","Client-Side Processing"`);
  csvRows.push(`"Data Format:","Comma-Separated Values (CSV)"`);
  csvRows.push('');
  csvRows.push('"# End of EMG Analysis Report"');
  
  // Convert to CSV string with proper encoding
  const csvContent = csvRows.join('\n');
  
  // Create blob with BOM for better Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${originalFilename.replace('.c3d', '')}_analysis_report.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('📊 CSV Analysis Report generated successfully:', link.download);
}

/**
 * Check if CSV generation is supported for the given export data
 */
export function canGenerateCsv(exportData: ExportData | null): boolean {
  return !!(exportData && (exportData.analytics || exportData.metadata));
}

/**
 * Get estimated CSV file size for user information
 */
export function estimateCsvSize(exportData: ExportData | null): string {
  if (!canGenerateCsv(exportData)) return '0 KB';
  
  let estimatedRows = 50; // Base structure
  
  if (exportData?.analytics) {
    const analyticsData = exportData.analytics as Record<string, ChannelAnalytics>;
    const channelCount = Object.keys(analyticsData).length;
    estimatedRows += channelCount * 15; // Analytics metrics
    
    // Add contractions count
    Object.values(analyticsData).forEach(analytics => {
      if (analytics.contractions) {
        estimatedRows += analytics.contractions.length;
      }
    });
  }
  
  // Estimate ~80 characters per row
  const estimatedBytes = estimatedRows * 80;
  
  if (estimatedBytes < 1024) return `${estimatedBytes} B`;
  if (estimatedBytes < 1024 * 1024) return `${(estimatedBytes / 1024).toFixed(1)} KB`;
  return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
}