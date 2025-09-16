/**
 * Export Tab Custom Hooks
 * Business logic hooks for data management
 */

import { useState, useCallback, useMemo } from 'react';
import { EMGAnalysisResult } from '@/types/emg';
import { 
  ExportOptions, 
  DownsamplingOptions, 
  ChannelSelectionMap,
  ExportData 
} from './types';
import { 
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_DOWNSAMPLING_OPTIONS,
  EXPORT_VERSION
} from './constants';
import {
  extractAvailableChannels,
  downsampleArray,
  detectOriginalFilename,
  calculateMusclePerformance,
  getExpectedContractions,
  isRawChannel,
  isActivatedChannel,
  getPatientCode
} from './utils';
// Use only backend-provided processing metadata; do not fabricate defaults

export function useExportData(
  analysisResult: EMGAnalysisResult | null,
  uploadedFileName: string | null | undefined,
  sessionParams: any
) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [downsamplingOptions, setDownsamplingOptions] = useState<DownsamplingOptions>(DEFAULT_DOWNSAMPLING_OPTIONS);
  const [channelSelection, setChannelSelection] = useState<ChannelSelectionMap>({});

  // Extract available channels
  const availableChannels = useMemo(() => 
    extractAvailableChannels(analysisResult), 
    [analysisResult]
  );

  // Initialize channel selection when channels are available
  const initializeChannelSelection = useCallback(() => {
    if (availableChannels.length === 0) return;
    
    const initialSelection: ChannelSelectionMap = {};
    availableChannels.forEach(channel => {
      initialSelection[channel.baseName] = {
        includeRaw: false,
        includeActivated: false,
        includeProcessedRms: false
      };
    });
    setChannelSelection(initialSelection);
  }, [availableChannels]);

  // Initialize channel selection when available channels change
  useMemo(() => {
    initializeChannelSelection();
  }, [initializeChannelSelection]);

  // Channel selection handlers
  const handleChannelSelectionChange = useCallback((
    channelName: string, 
    field: 'includeRaw' | 'includeActivated' | 'includeProcessedRms', 
    value: boolean
  ) => {
    setChannelSelection(prev => ({
      ...prev,
      [channelName]: {
        ...prev[channelName],
        [field]: value
      }
    }));
  }, []);

  // Check if any channels are selected
  const hasSelectedChannels = useMemo(() => {
    return Object.values(channelSelection).some(
      selection => selection.includeRaw || selection.includeActivated || selection.includeProcessedRms
    );
  }, [channelSelection]);

  // Check if any export data is selected (exclude format field from check)
  const hasSelectedData = useMemo(() => {
    const dataOptions = {
      includeAnalytics: exportOptions.includeAnalytics,
      includeSessionParams: exportOptions.includeSessionParams,
      includePerformanceAnalysis: exportOptions.includePerformanceAnalysis,
      includeC3dMetadata: exportOptions.includeC3dMetadata,
    };
    const hasExportOptions = Object.values(dataOptions).some(Boolean);
    return hasExportOptions || hasSelectedChannels;
  }, [exportOptions, hasSelectedChannels]);

  // Generate export data for download (complete data)
  const generateExportData = useCallback((isPreview: boolean = false): ExportData | null => {
    if (!analysisResult || !hasSelectedData) return null;

    const exportData: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        fileName: detectOriginalFilename(uploadedFileName, analysisResult),
        exportVersion: EXPORT_VERSION,
        exportOptions: exportOptions,
        ...(isPreview && {
          preview_mode: true,
          preview_note: "🔍 PREVIEW MODE: This is a limited extract showing only sample data (5 points per array)",
          download_note: "📥 Complete datasets with ALL data points available in file download"
        })
      }
    };

    // Include backend-provided signal processing pipeline metadata when available (no fabricated defaults)
    try {
      if (analysisResult && analysisResult.emg_signals) {
        const processedEntryKey = Object.keys(analysisResult.emg_signals).find(k => /\bProcessed$/i.test(k));
        const processedEntry: any = processedEntryKey ? (analysisResult.emg_signals as any)[processedEntryKey] : null;
        const analyticsAny: any = (analysisResult as any).analytics || {};
        const firstChannelName = Object.keys(analyticsAny)[0];
        const firstChannelAnalytics = firstChannelName ? analyticsAny[firstChannelName] : undefined;

        const pipelineFromProcessed = processedEntry?.processing_metadata?.complete_pipeline_metadata;
        const pipelineFromAnalytics = firstChannelAnalytics?.signal_processing?.complete_pipeline_metadata;

        const pipeline = pipelineFromAnalytics || pipelineFromProcessed;
        if (pipeline) {
          (exportData as any).signalProcessingPipeline = pipeline;
        }

        // Collect per-channel parameters actually used (if available)
        const perChannelParams: Record<string, any> = {};
        Object.keys(analyticsAny).forEach((channel) => {
          const sp = analyticsAny[channel]?.signal_processing;
          if (sp?.parameters_used) {
            perChannelParams[channel] = sp.parameters_used;
          }
        });
        if (Object.keys(perChannelParams).length > 0) {
          (exportData as any).signalProcessingParametersPerChannel = perChannelParams;
        }
      }
    } catch (e) {
      // Best-effort enrichment; ignore if structure not present
    }

    // Include analytics if selected
    if (exportOptions.includeAnalytics && analysisResult.analytics) {
      const analyticsWithMvc = { ...analysisResult.analytics };
      
      // Enrich analytics with MVC estimation details from session parameters
      if (sessionParams?.session_mvc_values) {
        Object.keys(analyticsWithMvc).forEach(channel => {
          if (sessionParams.session_mvc_values[channel] && analyticsWithMvc[channel]) {
            // Ensure mvc_estimation property exists
            if (!analyticsWithMvc[channel].mvc_estimation) {
              analyticsWithMvc[channel].mvc_estimation = {};
            }
            
            analyticsWithMvc[channel].mvc_estimation!.estimated_mvc_95th_percentile = sessionParams.session_mvc_values[channel];
            analyticsWithMvc[channel].mvc_estimation!.method = analyticsWithMvc[channel].mvc_estimation_method || 'unknown';
          }
        });
      }
      
      exportData.analytics = analyticsWithMvc;
    }

    // Include session parameters if selected - prioritize backend data
    if (exportOptions.includeSessionParams) {
      // Use backend-provided session parameters if available, fallback to frontend params
      if (analysisResult.session_parameters) {
        exportData.sessionParameters = analysisResult.session_parameters;
      } else if (sessionParams) {
        exportData.sessionParameters = sessionParams;
      }
    }

    // Include C3D metadata if selected
    if (exportOptions.includeC3dMetadata && analysisResult.metadata) {
      exportData.originalMetadata = analysisResult.metadata;
      exportData.c3dParameters = analysisResult.c3d_parameters;
    }

    // Include performance analysis if selected - prioritize backend data
    if (exportOptions.includePerformanceAnalysis) {
      // Use backend-provided performance analysis if available
      if (analysisResult.performance_analysis) {
        exportData.performanceAnalysis = analysisResult.performance_analysis;
      } else if (analysisResult.analytics) {
        // Fallback to frontend calculation if backend data not available
        const performanceData: { [key: string]: any } = {};
        
        Object.keys(analysisResult.analytics).forEach((channelName, index) => {
          const analytics = analysisResult.analytics[channelName];
          if (!analytics) return;

          const expectedContractions = getExpectedContractions(sessionParams, index);
          const durationThreshold = sessionParams?.session_duration_threshold || 2000;
          
          performanceData[channelName] = {
            compliance_subscores: calculateMusclePerformance(
              analytics, 
              expectedContractions, 
              durationThreshold
            ),
            raw_metrics: {
              contractions: {
                total: analytics.contraction_count || 0,
                good: analytics.good_contraction_count || 0,
                poor: (analytics.contraction_count || 0) - (analytics.good_contraction_count || 0),
                expected: expectedContractions
              },
              timing: {
                average_duration_ms: analytics.avg_duration_ms || 0,
                total_active_time_ms: analytics.total_time_under_tension_ms || 0,
                min_duration_ms: analytics.min_duration_ms || 0,
                max_duration_ms: analytics.max_duration_ms || 0
              },
              intensity: {
                average_amplitude: analytics.avg_amplitude || 0,
                max_amplitude: analytics.max_amplitude || 0,
                mvc_threshold: sessionParams?.[`session_mvc_${channelName.toLowerCase().replace(/[^a-z0-1]/g, '_')}`] || 100,
                mvc_percentage_achieved: 0 // Not available in current analytics
              },
              // Note: Fatigue analysis is available in main analytics section
              // fatigue_index_fi_nsm5 = ${analytics.fatigue_index_fi_nsm5 || 'not available'}
            }
          };
        });

        exportData.performanceAnalysis = performanceData;
      }
    }

    // Include processing parameters if available from backend
    if (analysisResult.processing_parameters) {
      exportData.processingParameters = analysisResult.processing_parameters;
    }

    // Include selected EMG signals
    if (hasSelectedChannels && analysisResult.emg_signals) {
      const processedSignals: { [key: string]: any } = {};

      Object.keys(channelSelection).forEach(channelBaseName => {
        const selection = channelSelection[channelBaseName];
        if (!selection.includeRaw && !selection.includeActivated && !selection.includeProcessedRms) return;

        // Find matching signals in the analysis result
        Object.keys(analysisResult.emg_signals).forEach(signalName => {
          const signalData = analysisResult.emg_signals[signalName];
          if (!signalData) return;

          // Check if this signal belongs to the selected channel
          const belongsToChannel = signalName.replace(' Raw', '').replace(' activated', '') === channelBaseName;
          if (!belongsToChannel) return;

          // Include raw signals if selected
          if (selection.includeRaw && isRawChannel(signalName)) {
            const processedData: any = { ...signalData };
            
            // For JSON preview: ensure ALL arrays have consistent preview length
            if (isPreview) {
              const PREVIEW_LIMIT = 5;
              let originalLength = 0;
              let hasArrays = false;
              
              // First pass: find the original length from the longest array
              Object.keys(processedData).forEach(key => {
                if (Array.isArray(processedData[key])) {
                  hasArrays = true;
                  originalLength = Math.max(originalLength, processedData[key].length);
                }
              });
              
              // Second pass: limit ALL arrays to consistent preview length
              if (hasArrays) {
                Object.keys(processedData).forEach(key => {
                  if (Array.isArray(processedData[key])) {
                    const currentArray = processedData[key];
                    // Ensure all arrays show the same number of elements (up to PREVIEW_LIMIT)
                    const previewLength = Math.min(PREVIEW_LIMIT, currentArray.length);
                    processedData[key] = currentArray.slice(0, previewLength);
                    
                    // If array is shorter than preview limit, add info
                    if (currentArray.length < PREVIEW_LIMIT && currentArray.length < originalLength) {
                      processedData[`${key}_preview_info`] = `Original array length: ${currentArray.length}`;
                    }
                  }
                });
                
                processedData.preview_note = `PREVIEW EXTRACT: Showing up to ${PREVIEW_LIMIT} elements per array (original max length: ${originalLength})`;
                processedData.total_samples = originalLength;
                processedData.download_note = "Complete signal data available in full download";
              }
            }
            
            // Clean up confusing fields for raw channels
            if (processedData.activated_data === null) {
              delete processedData.activated_data; // Remove unused field
            }
            
            // Apply downsampling if enabled
            if (downsamplingOptions.enabled && processedData.data) {
              processedData.data = downsampleArray(processedData.data, downsamplingOptions.samplingRate);
              processedData.downsampled = true;
              processedData.original_sampling_rate = processedData.sampling_rate;
              processedData.sampling_rate = Math.round(processedData.sampling_rate / downsamplingOptions.samplingRate);
            }
            
            processedSignals[signalName] = processedData;
          }

          // Include activated signals if selected
          if (selection.includeActivated && isActivatedChannel(signalName)) {
            const processedData: any = { ...signalData };
            
            // For JSON preview: ensure ALL arrays have consistent preview length
            if (isPreview) {
              const PREVIEW_LIMIT = 5;
              let originalLength = 0;
              let hasArrays = false;
              
              // First pass: find the original length from the longest array
              Object.keys(processedData).forEach(key => {
                if (Array.isArray(processedData[key])) {
                  hasArrays = true;
                  originalLength = Math.max(originalLength, processedData[key].length);
                }
              });
              
              // Second pass: limit ALL arrays to consistent preview length
              if (hasArrays) {
                Object.keys(processedData).forEach(key => {
                  if (Array.isArray(processedData[key])) {
                    const currentArray = processedData[key];
                    // Ensure all arrays show the same number of elements (up to PREVIEW_LIMIT)
                    const previewLength = Math.min(PREVIEW_LIMIT, currentArray.length);
                    processedData[key] = currentArray.slice(0, previewLength);
                    
                    // If array is shorter than preview limit, add info
                    if (currentArray.length < PREVIEW_LIMIT && currentArray.length < originalLength) {
                      processedData[`${key}_preview_info`] = `Original array length: ${currentArray.length}`;
                    }
                  }
                });
                
                processedData.preview_note = `PREVIEW EXTRACT: Showing up to ${PREVIEW_LIMIT} elements per array (original max length: ${originalLength})`;
                processedData.total_samples = originalLength;
                processedData.download_note = "Complete signal data available in full download";
              }
            }
            
            // Clean up confusing fields for activated channels
            if (processedData.activated_data === null) {
              delete processedData.activated_data; // Remove redundant field
              processedData.signal_info = "Pre-processed activated data from GHOSTLY C3D";
            }
            
            // Apply downsampling if enabled
            if (downsamplingOptions.enabled && processedData.data) {
              processedData.data = downsampleArray(processedData.data, downsamplingOptions.samplingRate);
              processedData.downsampled = true;
              processedData.original_sampling_rate = processedData.sampling_rate;
              processedData.sampling_rate = Math.round(processedData.sampling_rate / downsamplingOptions.samplingRate);
            }
            
            processedSignals[signalName] = processedData;
          }
        });

        // Additionally, if processed RMS is selected, include our rigorous pipeline RMS envelope
        if (selection.includeProcessedRms) {
          const rawKey = `${channelBaseName} Raw`;
          const processedKey = `${channelBaseName} Processed`;
          const raw = analysisResult.emg_signals[rawKey] as any;
          const processedEntry = (analysisResult.emg_signals as any)[processedKey] || null;
          const channelAnalytics: any = (analysisResult as any)?.analytics?.[channelBaseName] || {};
          // Prefer backend-provided processed entry; fallback to RMS envelope from raw
          const sourceSamplingRate = processedEntry?.sampling_rate ?? raw?.sampling_rate;
          const sourceTimeAxis = processedEntry?.time_axis ?? raw?.time_axis;
          const sourceData = processedEntry?.data ?? processedEntry?.rms_envelope ?? raw?.rms_envelope;
          if (Array.isArray(sourceData) && sourceData.length > 0 && Array.isArray(sourceTimeAxis)) {
            const processedData: any = {
              sampling_rate: sourceSamplingRate,
              time_axis: sourceTimeAxis,
              data: sourceData,
              signal_info: 'RMS envelope (processed) from rigorous pipeline',
            };

            // Attach only backend-provided processing metadata if available
            // Prefer analytics pipeline metadata; fallback to what backend placed on processed entry
            const sp = channelAnalytics?.signal_processing;
            const processedMeta = processedEntry?.processing_metadata;

            const parametersUsed = sp?.parameters_used ?? processedMeta ?? undefined;
            const processingSteps = sp?.processing_steps ?? processedEntry?.processing_steps ?? undefined;
            const qualityMetrics = sp?.quality_metrics ?? processedEntry?.quality_metrics ?? undefined;

            if (parametersUsed) processedData.processing_metadata = parametersUsed;
            if (Array.isArray(processingSteps)) processedData.processing_steps = processingSteps;
            if (qualityMetrics) processedData.quality_metrics = qualityMetrics;
            if (sp || processedMeta) {
              processedData.processing_metadata_full = sp ?? {
                parameters_used: processedMeta,
                processing_steps: processingSteps,
                quality_metrics: qualityMetrics,
                source: 'RAW',
              };
              // Serialize the full backend pipeline for transparency
              processedData.signal_processing = {
                source: (sp && sp.source) ? sp.source : 'RAW',
                processing_steps: processingSteps ?? [],
                parameters_used: parametersUsed ?? {},
                quality_metrics: qualityMetrics,
              };
              // Convenience alias explicitly called out in requirements
              processedData.settings_used_for_rms = parametersUsed;
            }

            // Contraction detection context from backend analytics only
            const cd: any = {};
            if (channelAnalytics?.mvc75_threshold != null) {
              cd.mvc75_threshold = channelAnalytics.mvc75_threshold;
            }
            if (channelAnalytics?.duration_threshold_actual_value != null) {
              cd.duration_threshold_actual_value = channelAnalytics.duration_threshold_actual_value;
            }
            if (Object.keys(cd).length > 0) {
              processedData.contraction_detection = cd;
            }

            // Preview handling for processed RMS - ensure ALL arrays are trimmed consistently
            if (isPreview) {
              const PREVIEW_LIMIT = 5;
              // Determine original length from the longest array among keys we care about
              const arraysToCheck = ['data', 'time_axis'];
              let originalLength = 0;
              arraysToCheck.forEach((k) => {
                if (Array.isArray(processedData[k])) {
                  originalLength = Math.max(originalLength, processedData[k].length);
                }
              });

              const previewLength = Math.min(PREVIEW_LIMIT, originalLength || processedData.data.length || 0);
              arraysToCheck.forEach((k) => {
                if (Array.isArray(processedData[k])) {
                  processedData[k] = processedData[k].slice(0, previewLength);
                }
              });

              processedData.preview_note = `PREVIEW EXTRACT: Showing up to ${PREVIEW_LIMIT} elements per array (original max length: ${originalLength})`;
              processedData.total_samples = originalLength;
              processedData.download_note = 'Complete signal data available in full download';
            }

            // Apply downsampling if enabled
            if (downsamplingOptions.enabled && Array.isArray(processedData.data)) {
              processedData.data = downsampleArray(processedData.data, downsamplingOptions.samplingRate);
              processedData.downsampled = true;
              processedData.original_sampling_rate = processedData.sampling_rate;
              processedData.sampling_rate = Math.round(processedData.sampling_rate / downsamplingOptions.samplingRate);
            }

            processedSignals[processedKey] = processedData;
          }
        }
      });

      if (Object.keys(processedSignals).length > 0) {
        exportData.processedSignals = processedSignals;
      }
    }

    return exportData;
  }, [
    analysisResult,
    uploadedFileName,
    sessionParams,
    exportOptions,
    channelSelection,
    downsamplingOptions,
    hasSelectedData,
    hasSelectedChannels
  ]);

  return {
    exportOptions,
    setExportOptions,
    downsamplingOptions,
    setDownsamplingOptions,
    channelSelection,
    handleChannelSelectionChange,
    availableChannels,
    hasSelectedChannels,
    hasSelectedData,
    generateExportData
  };
}