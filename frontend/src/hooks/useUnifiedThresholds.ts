/**
 * Unified Thresholds Hook - Professional React State Management
 * 
 * Senior Software Engineer Implementation:
 * - Signal-agnostic threshold consolidation
 * - Proper memoization with stable references
 * - Zustand state integration
 * - Base channel deduplication 
 * - Comprehensive error boundary handling
 * - Performance-optimized dependency arrays
 * 
 * Author: Senior Software Engineer (20+ years experience)
 * Created: 2025-01-18
 */

import { useMemo, useCallback } from 'react';
import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { logger, LogCategory } from '@/services/logger';

/**
 * Unified threshold data structure for frontend display.
 * Represents a single threshold per base channel, regardless of signal type.
 */
export interface UnifiedThresholdData {
  /** Base channel identifier (e.g., "CH1") */
  channel: string;
  
  /** Human-readable muscle name */
  muscleName: string;
  
  /** Calculated MVC threshold value in volts */
  mvcThreshold: number;
  
  /** Base MVC value used for calculation */
  mvcBaseValue: number;
  
  /** MVC threshold percentage (typically 75%) */
  mvcPercentage: number;
  
  /** Duration threshold in milliseconds */
  durationThreshold: number;
  
  /** Channel display color */
  color: string;
  
  /** Confidence score for MVC estimation (0.0-1.0) */
  confidence: number;
  
  /** Data source: 'database'|'signal'|'session'|'fallback' */
  source: string;
}

/**
 * Hook parameters with proper TypeScript strict typing
 */
interface UseUnifiedThresholdsParams {
  /** Session parameters from Zustand store */
  sessionParams: GameSessionParameters;
  
  /** Channel analytics data from backend */
  analytics?: Record<string, ChannelAnalyticsData> | null;
  
  /** Available data keys from chart data */
  availableDataKeys: string[];
  
  /** Whether the app is in a loading state */
  isLoading: boolean;

  /** Channel to muscle name mapping */
  channelMuscleMapping?: Record<string, string>;
  
  /** Muscle to color mapping */
  muscleColorMapping?: Record<string, string>;
  
  /** Global MVC threshold fallback */
  globalMvcThreshold?: number | null;
  
  /** Color calculation function */
  getColorForChannel: (
    baseChannelName: string, 
    channelMapping?: Record<string, string>, 
    muscleMapping?: Record<string, string>
  ) => { stroke: string };
}

/**
 * Hook return type with comprehensive threshold data
 */
export interface UseUnifiedThresholdsResult {
  /** Consolidated threshold data (one entry per base channel) */
  unifiedThresholds: UnifiedThresholdData[];
  
  /** Get MVC threshold for any channel (signal-agnostic) */
  getMvcThreshold: (channel: string) => number | null;
  
  /** Get duration threshold for any channel */
  getDurationThreshold: (channel: string) => number;
  
  /** Get muscle name for any channel */
  getMuscleName: (channel: string) => string;
  
  /** Check if thresholds are available and loading is complete */
  thresholdsReady: boolean;
  
  /** Get threshold data for specific base channel */
  getThresholdForChannel: (baseChannel: string) => UnifiedThresholdData | null;
}

/**
 * Professional React hook for unified threshold management.
 * 
 * Key Features:
 * - Eliminates duplicate threshold displays
 * - Signal-agnostic threshold calculation
 * - Proper React memoization patterns
 * - Stable function references
 * - Comprehensive error handling
 * - Performance optimization
 */
export function useUnifiedThresholds(params: UseUnifiedThresholdsParams): UseUnifiedThresholdsResult {
  const {
    sessionParams,
    analytics,
    availableDataKeys,
    isLoading,
    channelMuscleMapping = {},
    muscleColorMapping = {},
    globalMvcThreshold,
    getColorForChannel
  } = params;

  /**
   * Extract base channels from available data keys.
   * Professional deduplication logic with Set for O(1) lookup.
   */
  const baseChannels = useMemo(() => {
    const channelSet = new Set<string>();
    
    try {
      availableDataKeys.forEach(key => {
        // Extract base channel name (remove signal type suffixes)
        const baseChannel = key.split(' ')[0]; // "CH1 Raw" -> "CH1"
        channelSet.add(baseChannel);
      });
      
      const channels = Array.from(channelSet).sort(); // Stable ordering
      
        availableDataKeys,
        baseChannels: channels,
        count: channels.length
      });
      
      return channels;
      
    } catch (error) {
      logger.error(LogCategory.DATA_PROCESSING, 'Error extracting base channels', {
        error: error instanceof Error ? error.message : 'Unknown error',
        availableDataKeys
      });
      return [];
    }
  }, [availableDataKeys]);

  /**
   * Calculate MVC threshold for a base channel.
   * Professional fallback hierarchy with proper error handling.
   * 
   * Critical fix: Added comprehensive dependency array and logging to debug stale closures
   */
  const calculateMvcThreshold = useCallback((baseChannel: string): {
    threshold: number | null;
    baseValue: number | null;
    percentage: number;
    confidence: number;
    source: string;
  } => {
    try {
      // Priority 1: Per-muscle session MVC
      const sessionMvcValues = sessionParams?.session_mvc_values || {};
      const perMuscleMvc = sessionMvcValues[baseChannel];
      
      if (perMuscleMvc && perMuscleMvc > 0.00001) { // Clinical minimum check (10μV - realistic EMG threshold)
        const percentage = getPerChannelMvcPercentage(baseChannel, sessionParams);
        const threshold = perMuscleMvc * (percentage / 100.0);
        
        return {
          threshold,
          baseValue: perMuscleMvc,
          percentage,
          confidence: 0.8, // High confidence for user-configured values
          source: 'session_per_muscle'
        };
      }
      
      // Priority 2: Analytics-derived MVC (from backend analysis)
      if (analytics && typeof analytics === 'object' && Object.keys(analytics).length > 0) {
        // Try direct access first (most reliable)
        let channelAnalytics: ChannelAnalyticsData | null = analytics[baseChannel] || null;
        
        // If not found, try startsWith pattern (fallback)
        if (!channelAnalytics) {
          const found = Object.entries(analytics).find(([key]) => 
            key.startsWith(baseChannel)
          );
          channelAnalytics = found ? found[1] : null;
        }
        
        // Use mvc_threshold_actual_value to reverse-calculate MVC base value
        if (channelAnalytics?.mvc_threshold_actual_value && channelAnalytics.mvc_threshold_actual_value > 0.00001) {
          const percentage = getPerChannelMvcPercentage(baseChannel, sessionParams);
          const threshold = channelAnalytics.mvc_threshold_actual_value;
          const baseValue = threshold / (percentage / 100.0); // Reverse-calculate base MVC
          
          return {
            threshold,
            baseValue,
            percentage,
            confidence: 0.7, // Good confidence for backend-calculated values
            source: 'analytics'
          };
        }
      }
      
      // Priority 3: Global session MVC
      const globalMvc = sessionParams?.session_mvc_value;
      if (globalMvc && globalMvc > 0.00001) {
        const percentage = getPerChannelMvcPercentage(baseChannel, sessionParams);
        const threshold = globalMvc * (percentage / 100.0);
        
        return {
          threshold,
          baseValue: globalMvc,
          percentage,
          confidence: 0.4, // Lower confidence for global values
          source: 'session_global'
        };
      }
      
      // Priority 4: Global MVC threshold fallback
      if (globalMvcThreshold && globalMvcThreshold > 0.00001) {
        const percentage = getPerChannelMvcPercentage(baseChannel, sessionParams);
        
        return {
          threshold: globalMvcThreshold,
          baseValue: globalMvcThreshold / (percentage / 100.0), // Reverse-calculate base
          percentage,
          confidence: 0.2, // Low confidence for fallback
          source: 'global_fallback'
        };
      }
      
      // No valid MVC found
      return {
        threshold: null,
        baseValue: null,
        percentage: getPerChannelMvcPercentage(baseChannel, sessionParams),
        confidence: 0.0,
        source: 'none'
      };
      
    } catch (error) {
      logger.error(LogCategory.MVC_CALCULATION, `Error calculating MVC for ${baseChannel}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseChannel
      });
      
      return {
        threshold: null,
        baseValue: null,
        percentage: 75.0,
        confidence: 0.0,
        source: 'error'
      };
    }
  }, [sessionParams, analytics, globalMvcThreshold]);

  /**
   * Main unified thresholds calculation.
   * Professional memoization with stable dependency array.
   * 
   * Critical fix: Enhanced debugging and comprehensive dependency management
   */
  const unifiedThresholds = useMemo((): UnifiedThresholdData[] => {
    try {
      const thresholds: UnifiedThresholdData[] = [];
      
      baseChannels.forEach(baseChannel => {
        // Calculate MVC threshold with fallback hierarchy
        const mvcResult = calculateMvcThreshold(baseChannel);
        
        // Get duration threshold - safer access with optional chaining
        const durationThreshold = sessionParams?.contraction_duration_threshold || 2000;
        
        // Get muscle name
        const muscleName = channelMuscleMapping[baseChannel] || baseChannel;
        
        // Get display color
        const colorResult = getColorForChannel(baseChannel, channelMuscleMapping, muscleColorMapping);
        const color = colorResult.stroke;
        
        // Only include channels with valid MVC thresholds
        if (mvcResult.threshold !== null && mvcResult.baseValue !== null) {
          const thresholdData: UnifiedThresholdData = {
            channel: baseChannel,
            muscleName,
            mvcThreshold: mvcResult.threshold,
            mvcBaseValue: mvcResult.baseValue,
            mvcPercentage: mvcResult.percentage,
            durationThreshold,
            color,
            confidence: mvcResult.confidence,
            source: mvcResult.source
          };
          
          thresholds.push(thresholdData);
        }
      });
      
        baseChannels,
        thresholdCount: thresholds.length,
        thresholds: thresholds.map(t => ({
          channel: t.channel,
          mvcThreshold: t.mvcThreshold,
          source: t.source,
          confidence: t.confidence
        }))
      });
      
      return thresholds;
      
    } catch (error) {
      logger.error(LogCategory.DATA_PROCESSING, 'Error calculating unified thresholds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseChannels
      });
      return [];
    }
  }, [
    baseChannels,
    calculateMvcThreshold,
    sessionParams, // Changed from sessionParams.contraction_duration_threshold to full sessionParams
    channelMuscleMapping,
    muscleColorMapping,
    getColorForChannel,
    analytics, // Added analytics as explicit dependency
    globalMvcThreshold, // Added globalMvcThreshold as explicit dependency  
    isLoading // Added isLoading as explicit dependency for completeness
  ]);

  /**
   * Signal-agnostic MVC threshold getter.
   * Extracts base channel and returns unified threshold.
   */
  const getMvcThreshold = useCallback((channel: string): number | null => {
    const baseChannel = channel.split(' ')[0];
    const threshold = unifiedThresholds.find(t => t.channel === baseChannel);
    return threshold?.mvcThreshold || null;
  }, [unifiedThresholds]);

  /**
   * Duration threshold getter with fallback.
   */
  const getDurationThreshold = useCallback((channel: string): number => {
    const baseChannel = channel.split(' ')[0];
    const threshold = unifiedThresholds.find(t => t.channel === baseChannel);
    return threshold?.durationThreshold || sessionParams.contraction_duration_threshold || 2000;
  }, [unifiedThresholds, sessionParams.contraction_duration_threshold]);

  /**
   * Muscle name getter with fallback.
   */
  const getMuscleName = useCallback((channel: string): string => {
    const baseChannel = channel.split(' ')[0];
    const threshold = unifiedThresholds.find(t => t.channel === baseChannel);
    return threshold?.muscleName || channelMuscleMapping[baseChannel] || baseChannel;
  }, [unifiedThresholds, channelMuscleMapping]);

  /**
   * Check if valid thresholds are available and the app is not loading.
   * This prevents the UI from being stuck in a "calculating" state.
   */
  const thresholdsReady = useMemo(() => {
    // If loading, thresholds are not ready.
    if (isLoading) return false;
    
    // If not loading, and we have analytics data, we consider them "ready",
    // even if there are no valid thresholds to display. This means processing is complete.
    return !!analytics;

  }, [isLoading, analytics]);

  /**
   * Get threshold data for specific base channel.
   */
  const getThresholdForChannel = useCallback((baseChannel: string): UnifiedThresholdData | null => {
    return unifiedThresholds.find(t => t.channel === baseChannel) || null;
  }, [unifiedThresholds]);

  return {
    unifiedThresholds,
    getMvcThreshold,
    getDurationThreshold,
    getMuscleName,
    thresholdsReady,
    getThresholdForChannel
  };
}

/**
 * Helper function to get per-channel MVC percentage.
 * Professional parameter extraction with fallback.
 */
function getPerChannelMvcPercentage(
  baseChannel: string, 
  sessionParams: GameSessionParameters
): number {
  try {
    // Check per-muscle percentages first
    const percentages = sessionParams.session_mvc_threshold_percentages || {};
    const perChannelPercentage = percentages[baseChannel];
    
    if (perChannelPercentage && perChannelPercentage > 0) {
      return perChannelPercentage;
    }
    
    // Fall back to global percentage
    return sessionParams.session_mvc_threshold_percentage || 75.0;
    
  } catch (error) {
    logger.warn(LogCategory.MVC_CALCULATION, 
      `Error getting MVC percentage for ${baseChannel}: ${error}`);
    return 75.0; // Clinical standard fallback
  }
}

/**
 * Legacy compatibility function for existing components.
 * Provides drop-in replacement for useMVCCalculations hook.
 */
export function useLegacyMVCCalculations(params: any) {
  const unifiedResult = useUnifiedThresholds(params);
  
  return {
    getChannelMVCThreshold: unifiedResult.getMvcThreshold,
    getMuscleName: unifiedResult.getMuscleName,
    getThresholdData: () => unifiedResult.unifiedThresholds.map(t => ({
      channel: t.channel,
      value: t.mvcThreshold,
      color: t.color,
      mvcValue: t.mvcBaseValue,
      percentage: t.mvcPercentage,
      durationThreshold: t.durationThreshold
    }))
  };
}