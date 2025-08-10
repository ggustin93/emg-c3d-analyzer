/**
 * MVC Calculations Hook
 * Extracts MVC threshold calculation logic from EMGChart component
 */

import { useCallback, useMemo } from 'react';
import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';
import { logger, LogCategory } from '@/services/logger';

export interface MVCCalculationsResult {
  getChannelMVCThreshold: (channel: string) => number | null;
  getMuscleName: (channelName: string | null) => string;
  getThresholdData: () => Array<{
    channel: string;
    value: number;
    color: string;
    mvcValue?: number | null;
    percentage?: number | null;
    durationThreshold?: number | null;
  }>;
}

interface UseMVCCalculationsProps {
  sessionParams?: GameSessionParameters;
  mvcThresholdForPlot?: number | null;
  analytics?: Record<string, ChannelAnalyticsData> | null;
  channel_muscle_mapping?: Record<string, string>;
  muscle_color_mapping?: Record<string, string>;
  finalDisplayDataKeys: string[];
  effectivePlotMode: string;
  getColorForChannel: (baseChannelName: string, channelMapping?: Record<string, string>, muscleMapping?: Record<string, string>) => { stroke: string };
}

export function useMVCCalculations({
  sessionParams,
  mvcThresholdForPlot,
  analytics,
  channel_muscle_mapping = {},
  muscle_color_mapping = {},
  finalDisplayDataKeys,
  effectivePlotMode,
  getColorForChannel
}: UseMVCCalculationsProps): MVCCalculationsResult {
  
  const getChannelMVCThreshold = useCallback((channel: string): number | null => {
    const baseChannelName = channel.split(' ')[0];
    
    logger.startTimer(`mvc-threshold-${baseChannelName}`);
    
    // PRIORITY: Use backend-calculated threshold from analytics (ensures consistency)
    if (analytics && analytics[baseChannelName] && 
        analytics[baseChannelName].mvc_threshold_actual_value !== null && 
        analytics[baseChannelName].mvc_threshold_actual_value !== undefined) {
      const backendThreshold = analytics[baseChannelName].mvc_threshold_actual_value;
      logger.mvcCalculation(`Using backend-calculated MVC threshold for ${baseChannelName}`, {
        threshold: backendThreshold,
        source: 'backend'
      });
      logger.endTimer(`mvc-threshold-${baseChannelName}`);
      return backendThreshold ?? null; // Ensure null instead of undefined
    }
    
    // FALLBACK: Calculate from session parameters (for backward compatibility)
    if (sessionParams?.session_mvc_values?.[baseChannelName]) {
      const channelMVC = sessionParams.session_mvc_values[baseChannelName];
      if (sessionParams.session_mvc_threshold_percentages?.[baseChannelName]) {
        const thresholdPercentage = sessionParams.session_mvc_threshold_percentages[baseChannelName];
        if (channelMVC !== null && thresholdPercentage !== null) {
          const threshold = channelMVC * (thresholdPercentage / 100);
          logger.mvcCalculation(`Calculated MVC threshold for ${baseChannelName}`, {
            threshold,
            mvcValue: channelMVC,
            percentage: thresholdPercentage,
            source: 'session-specific-fallback'
          });
          logger.endTimer(`mvc-threshold-${baseChannelName}`);
          return threshold;
        }
      }
      if (channelMVC !== null && sessionParams.session_mvc_threshold_percentage) {
        const threshold = channelMVC * (sessionParams.session_mvc_threshold_percentage / 100);
        logger.mvcCalculation(`Calculated MVC threshold for ${baseChannelName}`, {
          threshold,
          mvcValue: channelMVC,
          percentage: sessionParams.session_mvc_threshold_percentage,
          source: 'global-fallback'
        });
        logger.endTimer(`mvc-threshold-${baseChannelName}`);
        return threshold;
      }
    }
    
    // LEGACY: Global session parameters
    if (sessionParams?.session_mvc_value !== null && sessionParams?.session_mvc_value !== undefined && 
        sessionParams?.session_mvc_threshold_percentage !== null && sessionParams?.session_mvc_threshold_percentage !== undefined) {
      const threshold = sessionParams.session_mvc_value * (sessionParams.session_mvc_threshold_percentage / 100);
      logger.mvcCalculation(`Calculated global MVC threshold`, {
        threshold,
        mvcValue: sessionParams.session_mvc_value,
        percentage: sessionParams.session_mvc_threshold_percentage,
        source: 'legacy-global'
      });
      logger.endTimer(`mvc-threshold-${baseChannelName}`);
      return threshold;
    }
    
    // FINAL FALLBACK: External prop
    if (mvcThresholdForPlot != null) {
      logger.mvcCalculation(`Using external MVC threshold`, {
        threshold: mvcThresholdForPlot,
        source: 'prop-fallback'
      });
      logger.endTimer(`mvc-threshold-${baseChannelName}`);
      return mvcThresholdForPlot;
    }
    
    logger.warn(LogCategory.MVC_CALCULATION, `No MVC threshold available for ${baseChannelName}`);
    logger.endTimer(`mvc-threshold-${baseChannelName}`);
    return null;
  }, [sessionParams, mvcThresholdForPlot, analytics]);

  const getMuscleName = useCallback((channelName: string | null): string => {
    if (!channelName) return '';
    try {
      const baseChannelName = channelName.split(' ')[0];
      const muscleName = channel_muscle_mapping?.[baseChannelName] || baseChannelName;
      
      // Support new 3-channel system
      const signalTypeName = effectivePlotMode === 'raw' ? 'Raw (C3D)'
                           : effectivePlotMode === 'activated' ? 'Activated (C3D)'
                           : effectivePlotMode === 'processed' ? 'RMS (Backend)'
                           : effectivePlotMode === 'raw_with_rms' ? 'Raw + RMS (Backend)'
                           : 'Activated'; // fallback
      
      return `${muscleName} ${signalTypeName}`;
    } catch (error) {
      logger.error(LogCategory.MVC_CALCULATION, 'Error generating muscle name', {
        channelName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return channelName || '';
    }
  }, [channel_muscle_mapping, effectivePlotMode]);

  const getThresholdData = useCallback(() => {
    const thresholds: Array<{
      channel: string, 
      value: number, 
      color: string, 
      mvcValue?: number | null, 
      percentage?: number | null,
      durationThreshold?: number | null
    }> = [];
    
    // Ensure thresholds for both left/right channels appear even if one key is missing in the current row
    finalDisplayDataKeys.forEach((key) => {
      const threshold = getChannelMVCThreshold(key);
      if (threshold !== null) {
        const baseChannelName = key.split(' ')[0];
        const muscleName = getMuscleName(baseChannelName);
        const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
        
        // Get MVC value and percentage with proper fallbacks
        const mvcValue = sessionParams?.session_mvc_values?.[baseChannelName] || 
                         sessionParams?.session_mvc_value || null;
        const percentage = sessionParams?.session_mvc_threshold_percentages?.[baseChannelName] || 
                           sessionParams?.session_mvc_threshold_percentage || EMG_CHART_CONFIG.MVC_THRESHOLD_PERCENTAGE;
        
        // Get duration threshold for this channel with proper conversion and backend override
        const backendDuration = analytics?.[baseChannelName]?.duration_threshold_actual_value;
        const defaultDurationThreshold = sessionParams?.contraction_duration_threshold ?? EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;
        let durationThreshold = backendDuration ?? defaultDurationThreshold;
        const perMuscleSeconds = sessionParams?.session_duration_thresholds_per_muscle?.[baseChannelName];
        if (backendDuration == null && perMuscleSeconds != null) {
          durationThreshold = perMuscleSeconds * EMG_CHART_CONFIG.DURATION_THRESHOLD_CONVERSION_FACTOR;
        }
        
        thresholds.push({ 
          channel: muscleName, 
          value: threshold, 
          color: colorStyle.stroke, 
          mvcValue, 
          percentage,
          durationThreshold
        });
      }
    });
    
    if (thresholds.length === 0 && mvcThresholdForPlot != null) {
      const defaultDurationThreshold = sessionParams?.contraction_duration_threshold ?? EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;
      thresholds.push({
        channel: 'Global',
        value: mvcThresholdForPlot,
        color: EMG_CHART_CONFIG.CLINICAL.MVC_LINE_COLOR,
        mvcValue: sessionParams?.session_mvc_value || null,
        percentage: sessionParams?.session_mvc_threshold_percentage || null,
        durationThreshold: defaultDurationThreshold
      });
    }

    logger.dataProcessing('Generated threshold data', {
      thresholdCount: thresholds.length,
      channels: thresholds.map(t => t.channel)
    });

    return thresholds;
  }, [finalDisplayDataKeys, getChannelMVCThreshold, getMuscleName, getColorForChannel, 
      channel_muscle_mapping, muscle_color_mapping, sessionParams, mvcThresholdForPlot]);

  // Memoize the result to avoid unnecessary recalculations
  const result = useMemo(() => ({
    getChannelMVCThreshold,
    getMuscleName,
    getThresholdData
  }), [getChannelMVCThreshold, getMuscleName, getThresholdData]);

  return result;
}