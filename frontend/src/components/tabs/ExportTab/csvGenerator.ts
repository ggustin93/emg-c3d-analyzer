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
  
  // T017: Enhanced header with patient code information
  const patientCode = exportData.metadata?.patientCode;
  const enhancedFilename = exportData.metadata?.enhancedFileName || originalFilename;
  
  csvRows.push('# EMG Analysis Export Report');
  if (patientCode) {
    csvRows.push(`# Patient: ${patientCode} - EMG Analysis Export Report`);
  }
  csvRows.push(`# Source File: ${enhancedFilename}`);
  csvRows.push(`# Generated: ${new Date().toLocaleString()}`);
  csvRows.push(`# Export Type: Client-Side Processing`);
  csvRows.push('#');
  csvRows.push('');
  
  // T017: Enhanced metadata section with patient code information
  if (exportData.metadata) {
    csvRows.push('"=== FILE METADATA ==="');
    csvRows.push('Property,Value');
    
    // Process metadata with special handling for patient code fields
    Object.entries(exportData.metadata).forEach(([key, value]) => {
      if (typeof value !== 'object') {
        // Format key names for better readability
        let formattedKey = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .replace(/([a-z])([A-Z])/g, '$1 $2');
        
        // Special formatting for patient code fields
        if (key === 'patientCode') {
          formattedKey = 'Patient Code';
          csvRows.push(`"${formattedKey}","${value || 'N/A'}"`);
        } else if (key === 'patientCodeSource') {
          formattedKey = 'Patient Code Source';
          csvRows.push(`"${formattedKey}","${value || 'unknown'}"`);
        } else if (key === 'patientCodeConfidence') {
          formattedKey = 'Patient Code Confidence';
          csvRows.push(`"${formattedKey}","${value || 'low'}"`);
        } else if (key === 'enhancedFileName') {
          formattedKey = 'Enhanced File Name';
          csvRows.push(`"${formattedKey}","${value || 'N/A'}"`);
        } else {
          csvRows.push(`"${formattedKey}","${value ?? ''}"`);
        }
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
    if (perfAnalysis.overall_score !== undefined && perfAnalysis.overall_score !== null) {
      csvRows.push(`"Overall Performance Score","${perfAnalysis.overall_score.toFixed(1)}%"`); 
    }
    
    // Component scores
    csvRows.push('"=== COMPONENT SCORES ==="');
    csvRows.push('Component,Score,Weight,Weighted Score');
    
    const components = ['compliance', 'symmetry', 'effort', 'game'];
    components.forEach(component => {
      const score = perfAnalysis[`${component}_score`];
      const weight = perfAnalysis[`${component}_weight`] || perfAnalysis.weights?.[component];
      if (score !== undefined && score !== null) {
        const weightedScore = weight ? (score * weight).toFixed(1) : 'N/A';
        const weightDisplay = weight ? `${(weight * 100).toFixed(1)}%` : 'N/A';
        csvRows.push(`"${component.charAt(0).toUpperCase() + component.slice(1)}","${score.toFixed(1)}%","${weightDisplay}","${weightedScore}%"`); 
      }
    });
    
    csvRows.push('');
    
    // Add per-muscle compliance breakdown
    if (perfAnalysis.compliance_components) {
      csvRows.push('"=== PER-MUSCLE COMPLIANCE BREAKDOWN ==="');
      csvRows.push('');
      
      const comp = perfAnalysis.compliance_components;
      
      // Left muscle metrics
      csvRows.push('"Left Muscle Metrics"');
      csvRows.push('Metric,Rate,Score');
      if (comp.left_muscle_compliance !== undefined && comp.left_muscle_compliance !== null) {
        csvRows.push(`"Overall Compliance","","${comp.left_muscle_compliance.toFixed(1)}%"`);
      }
      if (comp.completion_rate_left !== undefined && comp.completion_rate_left !== null) {
        csvRows.push(`"Completion Rate","${(comp.completion_rate_left * 100).toFixed(1)}%",""`);
      }
      if (comp.intensity_rate_left !== undefined && comp.intensity_rate_left !== null) {
        csvRows.push(`"Intensity Rate (≥75% MVC)","${(comp.intensity_rate_left * 100).toFixed(1)}%",""`);
      }
      if (comp.duration_rate_left !== undefined && comp.duration_rate_left !== null) {
        csvRows.push(`"Duration Rate (≥2s)","${(comp.duration_rate_left * 100).toFixed(1)}%",""`);
      }
      
      csvRows.push('');
      
      // Right muscle metrics
      csvRows.push('"Right Muscle Metrics"');
      csvRows.push('Metric,Rate,Score');
      if (comp.right_muscle_compliance !== undefined && comp.right_muscle_compliance !== null) {
        csvRows.push(`"Overall Compliance","","${comp.right_muscle_compliance.toFixed(1)}%"`);
      }
      if (comp.completion_rate_right !== undefined && comp.completion_rate_right !== null) {
        csvRows.push(`"Completion Rate","${(comp.completion_rate_right * 100).toFixed(1)}%",""`);
      }
      if (comp.intensity_rate_right !== undefined && comp.intensity_rate_right !== null) {
        csvRows.push(`"Intensity Rate (≥75% MVC)","${(comp.intensity_rate_right * 100).toFixed(1)}%",""`);
      }
      if (comp.duration_rate_right !== undefined && comp.duration_rate_right !== null) {
        csvRows.push(`"Duration Rate (≥2s)","${(comp.duration_rate_right * 100).toFixed(1)}%",""`);
      }
      
      csvRows.push('');
    }
    
    // Add RPE scoring section
    if (perfAnalysis.rpe_value !== undefined || perfAnalysis.effort_score !== undefined) {
      csvRows.push('"=== RPE (RATING OF PERCEIVED EXERTION) ==="');
      csvRows.push('');
      
      if (perfAnalysis.rpe_value !== undefined && perfAnalysis.rpe_value !== null) {
        csvRows.push(`"RPE Value (Borg CR-10 Scale)","${perfAnalysis.rpe_value}"`);
      }
      if (perfAnalysis.effort_score !== undefined && perfAnalysis.effort_score !== null) {
        csvRows.push(`"Effort Score","${perfAnalysis.effort_score.toFixed(1)}%"`);
      }
      
      // Add RPE mapping configuration
      if (perfAnalysis.rpe_mapping) {
        csvRows.push('');
        csvRows.push('"RPE Mapping Configuration"');
        csvRows.push('Range,RPE Values,Score');
        csvRows.push(`"Optimal","4-6","100%"`);
        csvRows.push(`"Acceptable","3, 7","80%"`);
        csvRows.push(`"Suboptimal","2, 8","60%"`);
        csvRows.push(`"Poor","0-1, 9-10","20%"`);
      }
      
      // Add RPE source
      if (perfAnalysis.data_completeness?.rpe_source) {
        csvRows.push('');
        csvRows.push(`"RPE Data Source","${perfAnalysis.data_completeness.rpe_source}"`);
      }
      
      csvRows.push('');
    }
    
    // Add scoring configuration weights
    if (perfAnalysis.weights) {
      csvRows.push('"=== SCORING CONFIGURATION ==="');
      csvRows.push('');
      
      csvRows.push('"Main Component Weights"');
      csvRows.push('Component,Weight,Description');
      csvRows.push(`"Compliance","${((perfAnalysis.weights.w_compliance || 0.5) * 100).toFixed(1)}%","Therapeutic Compliance"`);
      csvRows.push(`"Symmetry","${((perfAnalysis.weights.w_symmetry || 0.25) * 100).toFixed(1)}%","Muscle Symmetry"`);
      csvRows.push(`"Effort","${((perfAnalysis.weights.w_effort || 0.25) * 100).toFixed(1)}%","Subjective Effort (RPE)"`);
      csvRows.push(`"Game","${((perfAnalysis.weights.w_game || 0.0) * 100).toFixed(1)}%","Game Performance"`);
      
      csvRows.push('');
      
      csvRows.push('"Compliance Sub-Component Weights"');
      csvRows.push('Sub-Component,Weight,Description');
      csvRows.push(`"Completion","${((perfAnalysis.weights.w_completion || 0.333) * 100).toFixed(1)}%","Contractions Completed"`);
      csvRows.push(`"Intensity","${((perfAnalysis.weights.w_intensity || 0.333) * 100).toFixed(1)}%","≥75% MVC Achievement"`);
      csvRows.push(`"Duration","${((perfAnalysis.weights.w_duration || 0.334) * 100).toFixed(1)}%","≥2s Duration Compliance"`);
      
      csvRows.push('');
    }
    
    // Add data completeness indicators
    if (perfAnalysis.data_completeness) {
      csvRows.push('"=== DATA COMPLETENESS ==="');
      csvRows.push('Data Type,Available');
      
      const dc = perfAnalysis.data_completeness;
      csvRows.push(`"EMG Data","${dc.has_emg_data ? 'Yes' : 'No'}"`);
      csvRows.push(`"RPE Data","${dc.has_rpe ? 'Yes' : 'No'}"`);
      csvRows.push(`"Game Data","${dc.has_game_data ? 'Yes' : 'No'}"`);
      csvRows.push(`"BFR Data","${dc.has_bfr_data ? 'Yes' : 'No'}"`);
      
      csvRows.push('');
    }
    
    csvRows.push('');
  }

  // Add processing parameters if available
  if (exportData.processingParameters) {
    csvRows.push('"=== PROCESSING PARAMETERS ==="');
    csvRows.push('Parameter,Value');
    
    const processingParams = exportData.processingParameters;
    
    // Processing version and system info
    if (processingParams.processing_version) {
      csvRows.push(`"Processing Version","${processingParams.processing_version}"`);
    }
    if (processingParams.sampling_rate_hz) {
      csvRows.push(`"Sampling Rate","${processingParams.sampling_rate_hz} Hz"`);
    }
    
    // Filter settings
    if (processingParams.filter_low_cutoff_hz !== undefined) {
      csvRows.push(`"High-pass Filter","${processingParams.filter_low_cutoff_hz} Hz"`);
    }
    if (processingParams.filter_high_cutoff_hz !== undefined) {
      csvRows.push(`"Low-pass Filter","${processingParams.filter_high_cutoff_hz} Hz"`);
    }
    if (processingParams.filter_order !== undefined) {
      csvRows.push(`"Filter Order","${processingParams.filter_order}"`);
    }
    
    // RMS settings
    if (processingParams.rms_window_ms !== undefined) {
      csvRows.push(`"RMS Window","${processingParams.rms_window_ms} ms"`);
    }
    if (processingParams.rms_overlap_percent !== undefined) {
      csvRows.push(`"RMS Overlap","${processingParams.rms_overlap_percent}%"`);
    }
    
    // Detection thresholds
    if (processingParams.threshold_factor !== undefined) {
      csvRows.push(`"Detection Threshold","${(processingParams.threshold_factor * 100).toFixed(1)}% of max amplitude"`);
    }
    if (processingParams.min_duration_ms !== undefined) {
      csvRows.push(`"Minimum Duration","${processingParams.min_duration_ms} ms"`);
    }
    
    // Any additional parameters
    Object.entries(processingParams).forEach(([key, value]) => {
      if (!['processing_version', 'sampling_rate_hz', 'filter_low_cutoff_hz', 'filter_high_cutoff_hz', 
            'filter_order', 'rms_window_ms', 'rms_overlap_percent', 'threshold_factor', 'min_duration_ms'].includes(key)) {
        csvRows.push(`"${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}","${value}"`);
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
  
  // T017: Generate CSV filename with patient code enhancement
  let csvFilename = originalFilename.replace('.c3d', '');
  
  // Use enhanced filename if available, otherwise try to prefix with patient code
  if (exportData.metadata?.enhancedFileName) {
    csvFilename = exportData.metadata.enhancedFileName.replace('.c3d', '');
  } else if (patientCode && exportData.metadata?.patientCodeConfidence !== 'low') {
    // Add patient code prefix if not already present
    if (!csvFilename.startsWith(patientCode)) {
      csvFilename = `${patientCode}_${csvFilename}`;
    }
  }
  
  const finalCsvFilename = `${csvFilename}_analysis_report.csv`;
  
  // Create blob with BOM for better Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalCsvFilename;
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
  
  // T017: Account for patient code metadata in size estimation
  if (exportData?.metadata) {
    // Patient code adds minimal rows but enhances header
    if (exportData.metadata.patientCode) {
      estimatedRows += 5; // Patient code metadata rows
    }
  }
  
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
  
  // Estimate ~80 characters per row (patient code may slightly increase average line length)
  const avgCharsPerRow = exportData?.metadata?.patientCode ? 85 : 80;
  const estimatedBytes = estimatedRows * avgCharsPerRow;
  
  if (estimatedBytes < 1024) return `${estimatedBytes} B`;
  if (estimatedBytes < 1024 * 1024) return `${(estimatedBytes / 1024).toFixed(1)} KB`;
  return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
}