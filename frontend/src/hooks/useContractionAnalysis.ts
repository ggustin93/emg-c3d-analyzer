/**
 * Contraction Analysis Hook
 * Extracts contraction analysis logic from EMGChart component
 */

import { useMemo } from 'react';
import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { CombinedChartDataPoint } from '@/components/tabs/SignalPlotsTab/EMGChart';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';
import { logger, LogCategory } from '@/services/logger';

export interface ContractionArea {
  startTime: number;
  endTime: number;
  isGood: boolean;
  meetsMvc: boolean;
  meetsDuration: boolean;
  channel: string;
  maxAmplitude: number;
  peakTime: number;
}

export interface QualitySummary {
  goodCount: number;
  totalCount: number;
  mvcOnlyCount: number;
  durationOnlyCount: number;
  hasMvcCriteria: boolean;
  hasDurationCriteria: boolean;
  durationThresholdUsed: number | null;
}

export interface ContractionAnalysisResult {
  contractionAreas: ContractionArea[];
  qualitySummary: QualitySummary;
}

interface UseContractionAnalysisProps {
  analytics?: Record<string, ChannelAnalyticsData> | null;
  sessionParams?: GameSessionParameters;
  finalDisplayDataKeys: string[];
  chartData: CombinedChartDataPoint[];
  showGoodContractions: boolean;
  showPoorContractions: boolean;
}

export function useContractionAnalysis({
  analytics,
  sessionParams,
  finalDisplayDataKeys,
  chartData,
  showGoodContractions,
  showPoorContractions
}: UseContractionAnalysisProps): ContractionAnalysisResult {

  // Enhanced contraction quality summary for legend with detailed breakdown
  const qualitySummary = useMemo((): QualitySummary => {
    if (!analytics || !sessionParams) return { 
      goodCount: 0, totalCount: 0, mvcOnlyCount: 0, durationOnlyCount: 0,
      hasMvcCriteria: false, hasDurationCriteria: false,
      durationThresholdUsed: null
    };
    
    // Get default duration threshold - should be consistent with backend logic
    const defaultDurationThreshold = sessionParams.contraction_duration_threshold ?? EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;
    
    logger.contractionAnalysis('Analyzing contraction quality summary', {
      defaultDurationThreshold,
      sessionParams_contraction_duration_threshold: sessionParams.contraction_duration_threshold,
      sessionParams_session_duration_thresholds_per_muscle: sessionParams.session_duration_thresholds_per_muscle,
      unit: 'milliseconds'
    });
    
    let goodCount = 0;        // Meets both MVC and duration
    let mvcOnlyCount = 0;     // Meets MVC only (but not duration)
    let durationOnlyCount = 0; // Meets duration only (but not MVC)
    let totalCount = 0;
    let hasMvcCriteria = false;
    let hasDurationCriteria = false;
    
    Object.entries(analytics).forEach(([channelName, channelData]) => {
      const channelDisplayed = finalDisplayDataKeys.some(key => key.startsWith(channelName));
      if (channelDisplayed && channelData.contractions) {
        // Check if we have quality criteria data
        if (channelData.mvc_threshold_actual_value !== null && channelData.mvc_threshold_actual_value !== undefined) {
          hasMvcCriteria = true;
        }
        if (channelData.duration_threshold_actual_value !== null && channelData.duration_threshold_actual_value !== undefined) {
          hasDurationCriteria = true;
        }
        
        // Calculate good contractions using the same logic as backend processor.py
        const mvcThreshold = channelData.mvc_threshold_actual_value;
        
        // Get per-muscle duration threshold with same priority as backend
        let durationThreshold = defaultDurationThreshold;
        if (sessionParams.session_duration_thresholds_per_muscle && 
            sessionParams.session_duration_thresholds_per_muscle[channelName]) {
          const muscleThresholdSeconds = sessionParams.session_duration_thresholds_per_muscle[channelName];
          if (muscleThresholdSeconds !== null && muscleThresholdSeconds !== undefined) {
            durationThreshold = muscleThresholdSeconds * EMG_CHART_CONFIG.DURATION_THRESHOLD_CONVERSION_FACTOR;
          }
        }
        
        logger.contractionAnalysis(`Duration threshold for ${channelName}`, {
          perMuscleThresholdSeconds: sessionParams.session_duration_thresholds_per_muscle?.[channelName],
          finalThresholdMs: durationThreshold,
          defaultThresholdMs: defaultDurationThreshold
        });
        
        channelData.contractions.forEach((contraction, idx) => {
          // PRIORITY: Always use backend calculation when available for consistency
          const hasBackendMvc = contraction.meets_mvc !== null && contraction.meets_mvc !== undefined;
          const hasBackendDuration = contraction.meets_duration !== null && contraction.meets_duration !== undefined;
          const hasBackendGood = contraction.is_good !== null && contraction.is_good !== undefined;
          
          // Use backend values when available, otherwise calculate
          const meetsMvc = hasBackendMvc 
            ? contraction.meets_mvc 
            : (mvcThreshold !== null && mvcThreshold !== undefined && contraction.max_amplitude >= mvcThreshold);
          const meetsDuration = hasBackendDuration 
            ? contraction.meets_duration 
            : (contraction.duration_ms >= durationThreshold);
          const isGood = hasBackendGood 
            ? contraction.is_good 
            : (meetsMvc && meetsDuration);
          
          logger.contractionAnalysis(`Contraction ${idx} in ${channelName}`, {
            duration_ms: contraction.duration_ms,
            max_amplitude: contraction.max_amplitude,
            durationThreshold,
            mvcThreshold,
            backend: {
              is_good: contraction.is_good,
              meets_mvc: contraction.meets_mvc,
              meets_duration: contraction.meets_duration,
              hasValues: { mvc: hasBackendMvc, duration: hasBackendDuration, good: hasBackendGood }
            },
            final: {
              meetsMvc,
              meetsDuration,
              isGood,
              source: hasBackendGood ? 'backend' : 'frontend-calculated'
            }
          });
          
          // Only count contractions that are currently visible
          if ((isGood && showGoodContractions) || (!isGood && showPoorContractions)) {
            totalCount++;
            
            if (isGood) {
              goodCount++;
            } else if (meetsMvc && !meetsDuration) {
              mvcOnlyCount++;
            } else if (meetsDuration && !meetsMvc) {
              durationOnlyCount++;
            }
          }
        });
      }
    });
    
    return { 
      goodCount, 
      totalCount, 
      mvcOnlyCount, 
      durationOnlyCount,
      hasMvcCriteria,
      hasDurationCriteria,
      durationThresholdUsed: defaultDurationThreshold
    };
  }, [analytics, finalDisplayDataKeys, showGoodContractions, showPoorContractions, sessionParams]);

  // Separate contraction areas from main chart data
  const contractionAreas = useMemo((): ContractionArea[] => {
    if (!analytics || !sessionParams) return [];
    
    logger.startTimer('contraction-areas-calculation');
    
    // Get default duration threshold - consistent with legend calculation
    const defaultDurationThreshold = sessionParams.contraction_duration_threshold ?? EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;
    
    const areas: ContractionArea[] = [];
    
    // Get time range from chart data for validation
    const timeRange = chartData.length > 0 ? {
      min: Math.min(...chartData.map(d => d.time)),
      max: Math.max(...chartData.map(d => d.time))
    } : { min: 0, max: 0 };
    
    logger.contractionAnalysis('Processing contraction areas', {
      defaultDurationThreshold,
      sessionParams_contraction_duration_threshold: sessionParams.contraction_duration_threshold,
      sessionParams_session_duration_thresholds_per_muscle: sessionParams.session_duration_thresholds_per_muscle,
      unit: 'milliseconds',
      timeRange,
      chartDataPoints: chartData.length
    });
    
    Object.entries(analytics).forEach(([channelName, channelData]) => {
      const channelDisplayed = finalDisplayDataKeys.some(key => key.startsWith(channelName));
      
      if (channelDisplayed && channelData.contractions) {
        const mvcThreshold = channelData.mvc_threshold_actual_value;
        
        // Get per-muscle duration threshold with same priority as backend
        let durationThreshold = defaultDurationThreshold;
        if (sessionParams.session_duration_thresholds_per_muscle && 
            sessionParams.session_duration_thresholds_per_muscle[channelName]) {
          const muscleThresholdSeconds = sessionParams.session_duration_thresholds_per_muscle[channelName];
          if (muscleThresholdSeconds !== null && muscleThresholdSeconds !== undefined) {
            durationThreshold = muscleThresholdSeconds * EMG_CHART_CONFIG.DURATION_THRESHOLD_CONVERSION_FACTOR;
          }
        }
        
        channelData.contractions.forEach((contraction, idx) => {
          const startTime = contraction.start_time_ms / 1000;
          const endTime = contraction.end_time_ms / 1000;
          const peakTime = (startTime + endTime) / 2;
          
          // Validate contraction is within chart time range
          if (startTime >= timeRange.min && endTime <= timeRange.max) {
            // PRIORITY: Always use backend calculation when available for consistency
            const hasBackendMvc = contraction.meets_mvc !== null && contraction.meets_mvc !== undefined;
            const hasBackendDuration = contraction.meets_duration !== null && contraction.meets_duration !== undefined;
            const hasBackendGood = contraction.is_good !== null && contraction.is_good !== undefined;
            
            // Use backend values when available, otherwise calculate
            const meetsMvc = hasBackendMvc 
              ? contraction.meets_mvc 
              : (mvcThreshold !== null && mvcThreshold !== undefined && contraction.max_amplitude >= mvcThreshold);
            const meetsDuration = hasBackendDuration 
              ? contraction.meets_duration 
              : (contraction.duration_ms >= durationThreshold);
            const isGood = hasBackendGood 
              ? contraction.is_good 
              : (meetsMvc && meetsDuration);
            
            // Validation: Warn if backend and frontend calculations differ
            if (hasBackendGood && mvcThreshold !== null && mvcThreshold !== undefined && durationThreshold !== null) {
              const frontendMeetsMvc = contraction.max_amplitude >= mvcThreshold;
              const frontendMeetsDuration = contraction.duration_ms >= durationThreshold;
              const frontendIsGood = frontendMeetsMvc && frontendMeetsDuration;
              
              if (isGood !== frontendIsGood) {
                logger.warn(LogCategory.CONTRACTION_ANALYSIS, `Backend/Frontend mismatch for contraction ${idx} in ${channelName}`, {
                  backend: { isGood, meetsMvc, meetsDuration },
                  frontend: { isGood: frontendIsGood, meetsMvc: frontendMeetsMvc, meetsDuration: frontendMeetsDuration },
                  data: { max_amplitude: contraction.max_amplitude, duration_ms: contraction.duration_ms },
                  thresholds: { mvcThreshold, durationThreshold }
                });
              }
            }
            
            logger.contractionAnalysis(`Area ${idx} in ${channelName}`, {
              duration_ms: contraction.duration_ms,
              max_amplitude: contraction.max_amplitude,
              durationThreshold,
              mvcThreshold,
              backend: {
                is_good: contraction.is_good,
                meets_mvc: contraction.meets_mvc,
                meets_duration: contraction.meets_duration
              },
              final: {
                meetsMvc,
                meetsDuration,
                isGood,
                source: hasBackendGood ? 'backend' : 'frontend-calculated'
              },
              visualization: { startTime, endTime }
            });
            
            areas.push({
              startTime,
              endTime,
              isGood: isGood === true, // Ensure boolean type
              meetsMvc: meetsMvc === true, // Ensure boolean type
              meetsDuration: meetsDuration === true, // Ensure boolean type
              channel: channelName,
              maxAmplitude: contraction.max_amplitude,
              peakTime
            });
          } else {
            logger.warn(LogCategory.CONTRACTION_ANALYSIS, `Contraction ${idx} outside chart range`, {
              contractionTime: [startTime, endTime],
              chartTimeRange: timeRange
            });
          }
        });
      }
    });
    
    logger.contractionAnalysis('Contraction visualization completed', {
      areasCount: areas.length,
      chartTimeRange: timeRange,
      chartDataPoints: chartData.length,
      goodCount: areas.filter(a => a.isGood).length,
      mvcOnlyCount: areas.filter(a => a.meetsMvc && !a.meetsDuration).length,
      durationOnlyCount: areas.filter(a => !a.meetsMvc && a.meetsDuration).length,
      poorCount: areas.filter(a => !a.meetsMvc && !a.meetsDuration).length
    });
    
    logger.endTimer('contraction-areas-calculation');
    return areas;
  }, [analytics, finalDisplayDataKeys, chartData, sessionParams]);

  return { contractionAreas, qualitySummary };
}