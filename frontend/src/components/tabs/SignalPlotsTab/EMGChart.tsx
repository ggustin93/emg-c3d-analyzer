import React, { memo, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea
} from 'recharts';
import { getColorForChannel } from '@/lib/colorMappings';
import { FilterMode } from '@/components/shared/ChannelFilter';
import { GameSessionParameters, ChannelAnalyticsData } from "@/types/emg";
import { SignalDisplayType } from './ThreeChannelSignalSelector';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getContractionAreaColors, getContractionDotStyle } from '@/lib/qualityColors';

const Spinner = () => (
  <div className="flex items-center justify-center space-x-2">
    <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span className="text-gray-600">Loading chart data...</span>
  </div>
);

export interface CombinedChartDataPoint {
  time: number;
  [key: string]: number | undefined; // Allow undefined for dynamic channel data values
  good_contraction?: number;
  poor_contraction?: number;
}

export interface MultiChannelEMGChartProps {
  chartData: CombinedChartDataPoint[];
  availableChannels: string[];
  selectedChannel: string | null;
  viewMode: FilterMode;
  mvcThresholdForPlot?: number | null;
  channel_muscle_mapping?: Record<string, string>;
  muscle_color_mapping?: Record<string, string>;
  sessionParams?: GameSessionParameters;
  isLoading?: boolean;
  plotMode?: 'raw' | 'activated'; // Deprecated - use externalPlotMode
  setPlotMode?: (mode: 'raw' | 'activated') => void; // Deprecated
  externalPlotMode?: SignalDisplayType;
  onParamsChange?: (params: GameSessionParameters) => void;
  showSignalSwitch?: boolean;
  
  // Contraction visualization props
  analytics?: Record<string, ChannelAnalyticsData> | null;
  showGoodContractions?: boolean;
  showPoorContractions?: boolean;
  showContractionAreas?: boolean;
  showContractionDots?: boolean;
}

const EMGChart: React.FC<MultiChannelEMGChartProps> = memo(({ 
  chartData, 
  availableChannels,
  selectedChannel,
  viewMode,
  mvcThresholdForPlot,
  channel_muscle_mapping = {},
  muscle_color_mapping = {},
  sessionParams,
  isLoading = false,
  plotMode: legacyPlotMode,
  setPlotMode,
  externalPlotMode,
  onParamsChange,
  showSignalSwitch = false,
  
  // Contraction visualization props
  analytics,
  showGoodContractions: propShowGoodContractions = true,
  showPoorContractions: propShowPoorContractions = true,
  showContractionAreas: propShowContractionAreas = true,
  showContractionDots: propShowContractionDots = true
}) => {
  // Support both new 3-channel system and legacy 2-channel system
  const internalPlotMode = sessionParams?.show_raw_signals ? 'raw' : 'activated';
  
  // Priority: externalPlotMode (3-channel) > legacyPlotMode > sessionParams
  const plotMode = externalPlotMode || legacyPlotMode || internalPlotMode;

  // Normalize overlay availability: allow 'raw_with_rms' only if both raw and processed keys exist
  const overlayAvailable = React.useMemo(() => {
    const keys = availableChannels;
    console.log('🔍 Overlay Availability Check:', { availableChannels: keys });
    
    if (!keys || keys.length === 0) return false;
    const baseNames = keys.map(k => k.replace(/ (Raw|activated|Processed)$/,'')).filter((v,i,a)=>a.indexOf(v)===i);
    
    console.log('🔍 Base Names:', baseNames);
    
    const hasOverlay = baseNames.some(base => {
      const hasRaw = keys.includes(`${base} Raw`);
      const hasProcessed = keys.includes(`${base} Processed`);
      console.log(`🔍 ${base}: Raw=${hasRaw}, Processed=${hasProcessed}`);
      return hasRaw && hasProcessed;
    });
    
    console.log('🔍 Overlay Available:', hasOverlay);
    return hasOverlay;
  }, [availableChannels]);

  const effectivePlotMode = plotMode === 'raw_with_rms' && !overlayAvailable ? 'processed' : plotMode;

  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Use props for contraction visualization states
  const showGoodContractions = propShowGoodContractions;
  const showPoorContractions = propShowPoorContractions;
  const showContractionAreas = propShowContractionAreas;
  const showContractionDots = propShowContractionDots;
  

  const dataKeys = useMemo(() => {
    const keys = chartData?.[0] && typeof chartData[0] === 'object' 
      ? Object.keys(chartData[0]).filter(key => key !== 'time') 
      : [];
    console.log('🔍 Chart Data Keys:', keys);
    return keys;
  }, [chartData]);

  const availableDataKeys = useMemo(() => {
    return dataKeys.length > 0 ? dataKeys : [];
  }, [dataKeys]);

  const finalDisplayDataKeys = useMemo(() => {
    const displayChannels = viewMode === 'comparison'
      ? availableChannels.length > 0 ? availableChannels : availableDataKeys
      : selectedChannel 
        ? [selectedChannel] 
        : availableChannels.length > 0 ? [availableChannels[0]] : [];
    
    const displayDataKeys = displayChannels.map(channel => {
      if (availableDataKeys.includes(channel)) return channel;
      const matchingKey = availableDataKeys.find(key => key.startsWith(channel));
      if (matchingKey) return matchingKey;
      return channel;
    }).filter(key => availableDataKeys.includes(key));
    
    return displayDataKeys.length > 0 ? displayDataKeys : availableDataKeys;
  }, [viewMode, availableChannels, selectedChannel, availableDataKeys]);

  // For overlay mode, we need both Raw and RMS data keys
  const overlayDataKeys = useMemo(() => {
    console.log('🔍 Overlay Debug - plotMode:', plotMode, 'overlayAvailable:', overlayAvailable);
    
    if (plotMode !== 'raw_with_rms') return null;
    
    const rawKeys: string[] = [];
    const rmsKeys: string[] = [];
    
    // Extract base channel names from current display keys
    const baseChannels = finalDisplayDataKeys.map(key => key.split(' ')[0]);
    
    console.log('🔍 Overlay Debug:', {
      finalDisplayDataKeys,
      availableDataKeys,
      baseChannels,
      chartDataKeys: chartData?.[0] ? Object.keys(chartData[0]) : []
    });
    
    baseChannels.forEach(baseChannel => {
      // Find Raw signal
      const rawKey = availableDataKeys.find(key => key === `${baseChannel} Raw`);
      if (rawKey) rawKeys.push(rawKey);
      
      // Find Processed signal (RMS Envelope)
      const processedKey = availableDataKeys.find(key => key === `${baseChannel} Processed`);
      if (processedKey) rmsKeys.push(processedKey);
      
      console.log(`🔍 ${baseChannel}: Raw=${rawKey}, Processed=${processedKey}`);
    });
    
    console.log('🔍 Overlay Keys Result:', { rawKeys, rmsKeys });
    return { rawKeys, rmsKeys };
  }, [plotMode, finalDisplayDataKeys, availableDataKeys, chartData]);

  // Additional safety check for overlay mode - must be after overlayDataKeys definition
  const hasValidOverlayData = useMemo(() => {
    if (plotMode !== 'raw_with_rms' || !overlayDataKeys) return true;
    const hasValid = overlayDataKeys.rawKeys.length > 0 && overlayDataKeys.rmsKeys.length > 0;
    console.log('🔍 Has Valid Overlay Data:', hasValid, { 
      rawKeys: overlayDataKeys.rawKeys, 
      rmsKeys: overlayDataKeys.rmsKeys 
    });
    return hasValid;
  }, [plotMode, overlayDataKeys]);

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
      return channelName || '';
    }
  }, [channel_muscle_mapping, effectivePlotMode]);

  const getChannelMVCThreshold = useCallback((channel: string): number | null => {
    const baseChannelName = channel.split(' ')[0];
    
    // PRIORITY: Use backend-calculated threshold from analytics (ensures consistency)
    if (analytics && analytics[baseChannelName] && analytics[baseChannelName].mvc_threshold_actual_value !== null && analytics[baseChannelName].mvc_threshold_actual_value !== undefined) {
      const backendThreshold = analytics[baseChannelName].mvc_threshold_actual_value;
      console.log(`🎯 Using backend-calculated MVC threshold for ${baseChannelName}: ${backendThreshold}`);
      return backendThreshold ?? null; // Ensure null instead of undefined
    }
    
    // FALLBACK: Calculate from session parameters (for backward compatibility)
    if (sessionParams?.session_mvc_values?.[baseChannelName]) {
      const channelMVC = sessionParams.session_mvc_values[baseChannelName];
      if (sessionParams.session_mvc_threshold_percentages?.[baseChannelName]) {
        const thresholdPercentage = sessionParams.session_mvc_threshold_percentages[baseChannelName];
        if (channelMVC !== null && thresholdPercentage !== null) {
          const threshold = channelMVC * (thresholdPercentage / 100);
          console.log(`📊 Calculated MVC threshold for ${baseChannelName}: ${threshold} (fallback calculation)`);
          return threshold;
        }
      }
      if (channelMVC !== null && sessionParams.session_mvc_threshold_percentage) {
        const threshold = channelMVC * (sessionParams.session_mvc_threshold_percentage / 100);
        console.log(`📊 Calculated MVC threshold for ${baseChannelName}: ${threshold} (fallback calculation)`);
        return threshold;
      }
    }
    
    // LEGACY: Global session parameters
    if (sessionParams?.session_mvc_value !== null && sessionParams?.session_mvc_value !== undefined && 
        sessionParams?.session_mvc_threshold_percentage !== null && sessionParams?.session_mvc_threshold_percentage !== undefined) {
      const threshold = sessionParams.session_mvc_value * (sessionParams.session_mvc_threshold_percentage / 100);
      console.log(`📊 Calculated global MVC threshold: ${threshold} (legacy fallback)`);
      return threshold;
    }
    
    // FINAL FALLBACK: External prop
    if (mvcThresholdForPlot != null) {
      console.log(`📊 Using external MVC threshold: ${mvcThresholdForPlot} (prop fallback)`);
      return mvcThresholdForPlot;
    }
    
    console.log(`⚠️ No MVC threshold available for ${baseChannelName}`);
    return null;
  }, [sessionParams, mvcThresholdForPlot, analytics]);


  // Enhanced contraction quality summary for legend with detailed breakdown
  // This matches the calculation in usePerformanceMetrics.ts for consistency
  const qualitySummary = useMemo(() => {
    if (!analytics || !sessionParams) return { 
      goodCount: 0, totalCount: 0, mvcOnlyCount: 0, durationOnlyCount: 0,
      hasMvcCriteria: false, hasDurationCriteria: false,
      durationThresholdUsed: null
    };
    
    // Get default duration threshold - should be consistent with backend logic
    const defaultDurationThreshold = sessionParams.contraction_duration_threshold ?? 2000;
    
    console.log('🔍 EMGChart Duration Threshold Debug:', {
      sessionParams_contraction_duration_threshold: sessionParams.contraction_duration_threshold,
      sessionParams_session_duration_thresholds_per_muscle: sessionParams.session_duration_thresholds_per_muscle,
      defaultDurationThreshold,
      expectedValue: '2000ms (2 seconds)',
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
            durationThreshold = muscleThresholdSeconds * 1000; // Convert seconds to milliseconds
          }
        }
        
        console.log(`🔍 Duration threshold for ${channelName}:`, {
          perMuscleThresholdSeconds: sessionParams.session_duration_thresholds_per_muscle?.[channelName],
          finalThresholdMs: durationThreshold,
          defaultThresholdMs: defaultDurationThreshold
        });
        
        channelData.contractions.forEach((contraction, idx) => {
          // PRIORITY: Always use backend calculation when available for consistency
          // Backend values should be authoritative - only fallback to frontend calculation when backend is null/undefined
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
          
          // Enhanced debug logging to track backend vs frontend calculations
          console.log(`🔍 Contraction ${idx} in ${channelName}:`, {
            // Raw data
            duration_ms: contraction.duration_ms,
            max_amplitude: contraction.max_amplitude,
            // Thresholds
            durationThreshold,
            mvcThreshold,
            // Backend values (as received)
            backend: {
              is_good: contraction.is_good,
              meets_mvc: contraction.meets_mvc,
              meets_duration: contraction.meets_duration,
              hasValues: { mvc: hasBackendMvc, duration: hasBackendDuration, good: hasBackendGood }
            },
            // Final values used
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


  const renderLegend = useCallback((props: any) => {
    const thresholds: Array<{
      channel: string, 
      value: number, 
      color: string, 
      mvcValue?: number | null, 
      percentage?: number | null,
      durationThreshold?: number | null
    }> = [];
    
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
                           sessionParams?.session_mvc_threshold_percentage || 75;
        
        // Get duration threshold for this channel with proper conversion
        const defaultDurationThreshold = sessionParams?.contraction_duration_threshold ?? 2000;
        let durationThreshold = defaultDurationThreshold;
        if (sessionParams?.session_duration_thresholds_per_muscle?.[baseChannelName]) {
          const muscleThresholdSeconds = sessionParams.session_duration_thresholds_per_muscle[baseChannelName];
          if (muscleThresholdSeconds !== null && muscleThresholdSeconds !== undefined) {
            durationThreshold = muscleThresholdSeconds * 1000; // Convert seconds to milliseconds
          }
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
      const defaultDurationThreshold = sessionParams?.contraction_duration_threshold ?? 2000;
      thresholds.push({
        channel: 'Global',
        value: mvcThresholdForPlot,
        color: '#f97316',
        mvcValue: sessionParams?.session_mvc_value || null,
        percentage: sessionParams?.session_mvc_threshold_percentage || null,
        durationThreshold: defaultDurationThreshold
      });
    }
    

    // Debug logging for data retrieval
    console.log('🔍 Legend Data Debug:', {
      thresholds,
      sessionParams: {
        mvc_values: sessionParams?.session_mvc_values,
        mvc_threshold_percentages: sessionParams?.session_mvc_threshold_percentages,
        global_mvc_threshold: sessionParams?.session_mvc_threshold_percentage,
        duration_thresholds: sessionParams?.session_duration_thresholds_per_muscle,
        global_duration: sessionParams?.contraction_duration_threshold
      }
    });

    // Debug each threshold item
    thresholds.forEach((item, index) => {
      console.log(`🎯 Threshold ${index}:`, {
        channel: item.channel,
        mvcValue: item.mvcValue,
        percentage: item.percentage,
        durationThreshold: item.durationThreshold,
        color: item.color
      });
    });

    return (
      <div className="recharts-default-legend" style={{ padding: '0 8px', marginBottom: '6px' }}>
        <div className="space-y-2">
          {/* Compact Single-Line Thresholds Display */}
          <div className="flex flex-wrap items-center justify-center gap-4 py-1.5 text-xs"
               style={{ maxWidth: '100%', overflow: 'hidden' }}>
            {/* MVC Thresholds */}
            {thresholds.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 font-medium">MVC 75% Thresholds:</span>
                <div className="flex items-center gap-2">
                  {thresholds.map((item, index) => {
                    const mvcValue = item.mvcValue;
                    const muscleLabel = item.channel.replace(' Activated', '').replace(' Raw', '');
                    const shortLabel = muscleLabel.includes('Left') ? 'L' : muscleLabel.includes('Right') ? 'R' : muscleLabel.substring(0, 1);
                    
                    return (
                      <div key={`mvc-${index}`} className="flex items-center gap-1">
                        <span 
                          className="inline-block w-3 h-0 border-t-2 border-dashed" 
                          style={{ borderColor: item.color }}
                        />
                        <span style={{ color: item.color, fontWeight: 500 }}>
                          {shortLabel}:{(() => {
                            console.log(`🔍 MVC Value Debug for ${shortLabel}:`, {
                              mvcValue,
                              type: typeof mvcValue,
                              isNull: mvcValue === null,
                              isUndefined: mvcValue === undefined,
                              isZero: mvcValue === 0,
                              stringValue: String(mvcValue)
                            });
                            
                            // FIXED: Show the actual threshold value being used, not the MVC base value
                            const actualThreshold = item.value; // This is the threshold from getChannelMVCThreshold
                            return `${actualThreshold.toExponential(3)}V`;
                          })()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Duration Thresholds */}
            {thresholds.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 font-medium">Duration Thresholds:</span>
                <div className="flex items-center gap-2">
                  {thresholds.map((item, index) => {
                    const durationMs = item.durationThreshold ?? 2000;
                    const muscleLabel = item.channel.replace(' Activated', '').replace(' Raw', '');
                    const shortLabel = muscleLabel.includes('Left') ? 'L' : muscleLabel.includes('Right') ? 'R' : muscleLabel.substring(0, 1);
                    
                    return (
                      <div key={`duration-${index}`} className="flex items-center gap-1">
                        <span 
                          className="inline-block w-2 h-1 border border-gray-400 rounded-sm bg-gray-100" 
                        />
                        <span className="text-gray-700 font-medium">
                          {shortLabel}:{durationMs}ms
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Compact Contraction Legend with Clinical Tooltip */}
          {qualitySummary.totalCount > 0 && (
            <div className="flex justify-center w-full">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-2 bg-white rounded-md border border-gray-200 px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow cursor-help">
                      {/* Compact Summary */}
                      <span className="text-xs font-medium text-gray-700">Contractions:</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">{qualitySummary.totalCount}</span>
                        {qualitySummary.goodCount > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-green-700 font-medium">{qualitySummary.goodCount}</span>
                          </div>
                        )}
                        {(qualitySummary.mvcOnlyCount > 0 || qualitySummary.durationOnlyCount > 0) && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <span className="text-yellow-700 font-medium">
                              {qualitySummary.mvcOnlyCount + qualitySummary.durationOnlyCount}
                            </span>
                          </div>
                        )}
                        {(qualitySummary.totalCount - qualitySummary.goodCount - qualitySummary.mvcOnlyCount - qualitySummary.durationOnlyCount) > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-red-700 font-medium">
                              {qualitySummary.totalCount - qualitySummary.goodCount - qualitySummary.mvcOnlyCount - qualitySummary.durationOnlyCount}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top"
                    sideOffset={8}
                    align="center"
                    avoidCollisions={true}
                    className={cn(
                      "w-[28rem] z-[999] bg-amber-50",
                      "border-2 border-amber-300 shadow-2xl p-0 overflow-hidden rounded-lg"
                    )}
                  >
                    <div>
                      {/* Elegant Header */}
                      <div className="bg-amber-500 px-4 py-3">
                        <p className="font-bold tracking-tight text-white drop-shadow-sm text-sm">
                          Contraction Quality Analysis
                        </p>
                      </div>

                      {/* Content */}
                      <div className="px-4 py-3 space-y-3">
                        {/* Description */}
                        <p className="text-slate-700 leading-relaxed font-medium text-xs">
                          Real-time analysis of muscle contractions based on MVC intensity and duration criteria.
                        </p>

                        {/* Quality Categories Section */}
                        <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                            <h4 className="font-bold text-slate-800 text-xs">Quality Categories:</h4>
                          </div>
                          
                          <div className="space-y-1.5 text-slate-700 text-xs">
                            <div className="flex items-center justify-between py-1 border-b border-amber-100">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <span className="font-semibold">Excellent (both criteria)</span>
                              </div>
                              <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                {qualitySummary.goodCount} ({Math.round((qualitySummary.goodCount / qualitySummary.totalCount) * 100)}%)
                              </span>
                            </div>
                            
                            {qualitySummary.mvcOnlyCount > 0 && (
                              <div className="flex items-center justify-between py-1 border-b border-amber-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                  <span className="font-semibold">Force only (MVC ≥ {sessionParams?.session_mvc_threshold_percentage || 70}%)</span>
                                </div>
                                <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                                  {qualitySummary.mvcOnlyCount} ({Math.round((qualitySummary.mvcOnlyCount / qualitySummary.totalCount) * 100)}%)
                                </span>
                              </div>
                            )}
                            
                            {qualitySummary.durationOnlyCount > 0 && (
                              <div className="flex items-center justify-between py-1 border-b border-amber-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                  <span className="font-semibold">Duration only (≥ {qualitySummary.durationThresholdUsed ? (qualitySummary.durationThresholdUsed / 1000).toFixed(1) : '2.0'}s)</span>
                                </div>
                                <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                                  {qualitySummary.durationOnlyCount} ({Math.round((qualitySummary.durationOnlyCount / qualitySummary.totalCount) * 100)}%)
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <span className="font-semibold">Insufficient (neither)</span>
                              </div>
                              <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                                {qualitySummary.totalCount - qualitySummary.goodCount - qualitySummary.mvcOnlyCount - qualitySummary.durationOnlyCount} 
                                ({Math.round(((qualitySummary.totalCount - qualitySummary.goodCount - qualitySummary.mvcOnlyCount - qualitySummary.durationOnlyCount) / qualitySummary.totalCount) * 100)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Compliance Metrics Section */}
                        <div className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                            <h4 className="font-bold text-slate-800 text-xs">Compliance Metrics:</h4>
                          </div>
                          
                          <div className="space-y-1.5 text-slate-700 text-xs">
                            <div className="flex items-center justify-between py-1 border-b border-amber-100">
                              <span className="font-semibold text-slate-800">Force Compliance</span>
                              <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
                                {Math.round(((qualitySummary.goodCount + qualitySummary.mvcOnlyCount) / qualitySummary.totalCount) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-amber-100">
                              <span className="font-semibold text-slate-800">Duration Compliance</span>
                              <span className="font-bold tabular-nums px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
                                {Math.round(((qualitySummary.goodCount + qualitySummary.durationOnlyCount) / qualitySummary.totalCount) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Threshold Settings Section */}
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-gray-500 rounded-full"></div>
                            <h4 className="font-bold text-slate-800 text-xs">Current Thresholds:</h4>
                          </div>
                          <div className="text-xs text-gray-700 space-y-1">
                            <div className="flex items-center justify-between">
                              <span>MVC Threshold:</span>
                              <span className="font-medium">{sessionParams?.session_mvc_threshold_percentage || 75}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Duration Threshold:</span>
            <span className="font-medium">{qualitySummary.durationThresholdUsed || 2000}ms</span>
                            </div>
                            <p className="mt-2 text-xs text-gray-600 italic">
                              Hover over chart dots to see individual contraction details
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    );
  }, [finalDisplayDataKeys, getChannelMVCThreshold, mvcThresholdForPlot, getMuscleName, channel_muscle_mapping, muscle_color_mapping, sessionParams, qualitySummary]);

  const yDomain = useMemo(() => {
    let domain: [number | 'auto', number | 'auto'] = ['auto', 'auto'];
    
    if (!chartData || chartData.length === 0) return domain;

    let dataMin = Infinity;
    let dataMax = -Infinity;
    chartData.forEach(point => {
      finalDisplayDataKeys.forEach(channel => {
        if (point[channel] !== undefined) {
          dataMin = Math.min(dataMin, point[channel]!);
          dataMax = Math.max(dataMax, point[channel]!);
        }
      });
    });

    let maxThreshold = -Infinity;
    finalDisplayDataKeys.forEach(key => {
      const threshold = getChannelMVCThreshold(key);
      if (threshold !== null) {
        maxThreshold = Math.max(maxThreshold, threshold);
      }
    });
    
    if (maxThreshold === -Infinity && mvcThresholdForPlot != null) {
      maxThreshold = mvcThresholdForPlot;
    }
    
    if (dataMin !== Infinity && dataMax !== -Infinity && maxThreshold !== -Infinity) {
      domain = [
        Math.min(dataMin, maxThreshold * 0.8) - (dataMax - dataMin) * 0.1,
        Math.max(dataMax, maxThreshold * 1.2) + (dataMax - dataMin) * 0.1
      ];
    } else if (maxThreshold !== -Infinity) {
      domain = [maxThreshold * 0.8, maxThreshold * 1.2];
    } else if (dataMin !== Infinity && dataMax !== -Infinity) {
      // Add padding for small values
      const padding = Math.max((dataMax - dataMin) * 0.1, dataMax * 0.1);
      domain = [dataMin - padding, dataMax + padding];
    }
    return domain;
  }, [chartData, finalDisplayDataKeys, getChannelMVCThreshold, mvcThresholdForPlot]);



  // Optimized: Separate contraction areas from main chart data
  // CRITICAL: Use the same calculation logic as the legend for consistency
  // FORCE REFRESH: Added analytics timestamp to dependencies to force recalculation
  const contractionAreas = useMemo(() => {
    if (!analytics || !sessionParams) return [];
    
    // Get default duration threshold - consistent with legend calculation
    const defaultDurationThreshold = sessionParams.contraction_duration_threshold ?? 2000;
    
    const areas: Array<{ 
      startTime: number; 
      endTime: number; 
      isGood: boolean;
      meetsMvc: boolean;
      meetsDuration: boolean;
      channel: string;
      maxAmplitude: number;
      peakTime: number;
    }> = [];
    
    // Get time range from chart data for validation
    const timeRange = chartData.length > 0 ? {
      min: Math.min(...chartData.map(d => d.time)),
      max: Math.max(...chartData.map(d => d.time))
    } : { min: 0, max: 0 };
    
    console.log('🎯 Contraction Areas - Using Duration Threshold:', {
      defaultDurationThreshold,
      sessionParams_contraction_duration_threshold: sessionParams.contraction_duration_threshold,
      sessionParams_session_duration_thresholds_per_muscle: sessionParams.session_duration_thresholds_per_muscle,
      unit: 'milliseconds'
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
            durationThreshold = muscleThresholdSeconds * 1000; // Convert seconds to milliseconds
          }
        }
        
        channelData.contractions.forEach((contraction, idx) => {
          const startTime = contraction.start_time_ms / 1000;
          const endTime = contraction.end_time_ms / 1000;
          const peakTime = (startTime + endTime) / 2;
          
          // Validate contraction is within chart time range
          if (startTime >= timeRange.min && endTime <= timeRange.max) {
            // PRIORITY: Always use backend calculation when available for consistency
            // Backend values should be authoritative - only fallback to frontend calculation when backend is null/undefined
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
                console.warn(`⚠️ Backend/Frontend mismatch for contraction ${idx} in ${channelName}:`, {
                  backend: { isGood, meetsMvc, meetsDuration },
                  frontend: { isGood: frontendIsGood, meetsMvc: frontendMeetsMvc, meetsDuration: frontendMeetsDuration },
                  data: { max_amplitude: contraction.max_amplitude, duration_ms: contraction.duration_ms },
                  thresholds: { mvcThreshold, durationThreshold }
                });
              }
            }
            
            console.log(`🎯 Area ${idx} in ${channelName}:`, {
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
              visualization: {
                startTime,
                endTime
              }
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
            console.warn(`⚠️ Contraction ${idx} outside chart range:`, {
              contractionTime: [startTime, endTime],
              chartTimeRange: timeRange
            });
          }
        });
      }
    });
    
    console.log('🎯 Contraction visualization (corrected):', {
      areasCount: areas.length,
      chartTimeRange: timeRange,
      chartDataPoints: chartData.length,
      goodCount: areas.filter(a => a.isGood).length,
      mvcOnlyCount: areas.filter(a => a.meetsMvc && !a.meetsDuration).length,
      durationOnlyCount: areas.filter(a => !a.meetsMvc && a.meetsDuration).length,
      poorCount: areas.filter(a => !a.meetsMvc && !a.meetsDuration).length
    });
    
    return areas;
  }, [analytics, finalDisplayDataKeys, chartData, sessionParams]);

  // Chart margins, must match the margin prop of ComposedChart
  const chartMargins = useMemo(() => ({ top: 5, right: 30, left: 20, bottom: 25 }), []);


  if (isLoading) {
    return (
      <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm flex items-center justify-center">
        <p className="text-center text-gray-500">No data available for chart.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Chart Container */}
      <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm relative overflow-hidden" ref={chartContainerRef}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={chartMargins}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey="time" 
              label={{ value: "Time (s)", position: "bottom" }} 
              tick={{ fontSize: 10 }} 
              domain={['dataMin', 'dataMax']}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 10 }} 
              label={{ value: plotMode === 'raw_with_rms' ? "Raw Signal (mV)" : "Amplitude (mV)", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
              domain={yDomain}
              allowDataOverflow={false}
            />
            {plotMode === 'raw_with_rms' && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }} 
                label={{ value: "RMS Envelope (mV)", angle: 90, position: "insideRight", offset: 10, fontSize: 12 }}
                domain={yDomain}
                allowDataOverflow={false}
              />
            )}
            <Tooltip formatter={(value: number, name: string) => {
              try {
                return [`${value.toExponential(3)} mV`, getMuscleName(name)];
              } catch (error) {
                return [`${value.toExponential(3)} mV`, name];
              }
            }} labelFormatter={(label: number) => `Time: ${label.toFixed(3)}s`} />
            <Legend 
              verticalAlign="top" 
              height={36} 
              wrapperStyle={{ top: -5, right: 0, backgroundColor: 'transparent' }} 
              content={renderLegend}
            />
            
            {(() => {
              const shouldRenderOverlay = plotMode === 'raw_with_rms' && overlayDataKeys && hasValidOverlayData;
              console.log('🔍 Rendering Decision:', { 
                plotMode, 
                isRawWithRms: plotMode === 'raw_with_rms',
                overlayDataKeys: !!overlayDataKeys, 
                hasValidOverlayData, 
                shouldRenderOverlay,
                overlayAvailable,
                effectivePlotMode
              });
              return shouldRenderOverlay;
            })() ? (
              // Render overlay mode with Raw on left axis and RMS on right axis
              <>
                {/* Raw signals with transparency */}
                {overlayDataKeys?.rawKeys.map((dataKey) => {
                  const baseChannelName = dataKey.split(' ')[0];
                  const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
                  
                  return (
                    <Line 
                      key={`raw-${dataKey}`}
                      yAxisId="left"
                      type="monotone" 
                      dataKey={dataKey} 
                      name={`${getMuscleName(baseChannelName)} Raw`}
                      stroke={colorStyle.stroke} 
                      strokeOpacity={0.4}
                      dot={false} 
                      isAnimationActive={false} 
                      strokeWidth={1.5}
                    />
                  );
                })}
                {/* RMS signals with bold styling */}
                {overlayDataKeys?.rmsKeys.map((dataKey) => {
                  const baseChannelName = dataKey.split(' ')[0];
                  const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
                  
                  return (
                    <Line 
                      key={`rms-${dataKey}`}
                      yAxisId="right"
                      type="monotone" 
                      dataKey={dataKey} 
                      name={`${getMuscleName(baseChannelName)} RMS (Backend)`}
                      stroke={colorStyle.stroke} 
                      strokeOpacity={1.0}
                      dot={false} 
                      isAnimationActive={false} 
                      strokeWidth={3.0}
                      strokeDasharray="0"
                    />
                  );
                })}
              </>
            ) : (
              // Standard single-signal mode
              finalDisplayDataKeys.map((dataKey) => {
                const baseChannelName = finalDisplayDataKeys.find(ch => dataKey.startsWith(ch)) || dataKey.split(' ')[0];
                const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
                
                return (
                  <Line 
                    key={dataKey}
                    yAxisId="left"
                    type="monotone" 
                    dataKey={dataKey} 
                    name={dataKey} 
                    stroke={colorStyle.stroke} 
                    dot={false} 
                    isAnimationActive={false} 
                    strokeWidth={2.5}
                  />
                );
              })
            )}

            {/* MVC Reference Lines - use appropriate Y-axis for overlay mode */}
            {(() => {
              const keysForThresholds = plotMode === 'raw_with_rms' && overlayDataKeys ? overlayDataKeys.rmsKeys : finalDisplayDataKeys;
              console.log('🔍 MVC Reference Lines Keys:', keysForThresholds);
              return keysForThresholds;
            })().map((dataKey) => {
              const threshold = getChannelMVCThreshold(dataKey);
              if (threshold !== null) {
                const baseChannelName = dataKey.split(' ')[0];
                const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
                
                return (
                  <ReferenceLine 
                    key={`mvc-${dataKey}`}
                    yAxisId={plotMode === 'raw_with_rms' ? 'right' : 'left'}
                    y={threshold} 
                    stroke={colorStyle.stroke}
                    strokeDasharray="3 3" 
                    strokeWidth={2.5}
                  />
                );
              }
              return null;
            })}

            {/* Global MVC threshold fallback */}
            {(plotMode === 'raw_with_rms' && overlayDataKeys ? overlayDataKeys.rmsKeys : finalDisplayDataKeys).every(dataKey => getChannelMVCThreshold(dataKey) === null) && 
             mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
              <ReferenceLine 
                yAxisId={plotMode === 'raw_with_rms' ? 'right' : 'left'}
                y={mvcThresholdForPlot} 
                stroke="#f97316"
                strokeDasharray="3 3" 
                strokeWidth={2.5}
              />
            )}

            {/* Debug: Log when rendering contraction visualizations */}
            {contractionAreas.length > 0 && console.log('📊 Rendering contractions:', contractionAreas.length, 'Sample areas:', contractionAreas.slice(0, 2).map(a => ({isGood: a.isGood, meetsMvc: a.meetsMvc, meetsDuration: a.meetsDuration})))}
            
            {/* Contraction areas - colorize EMG lines between two abscissas with enhanced quality colors */}
            {showContractionAreas && contractionAreas && chartData.length > 0 && finalDisplayDataKeys.length > 0 && hasValidOverlayData &&
             contractionAreas
              .filter(area => (area.isGood && showGoodContractions) || (!area.isGood && showPoorContractions))
              .map((area, index) => {
                console.log(`🔍 ReferenceArea ${index}:`, {
                  x1: area.startTime,
                  x2: area.endTime,
                  isGood: area.isGood,
                  meetsMvc: area.meetsMvc,
                  meetsDuration: area.meetsDuration,
                  channel: area.channel
                });
                
                const { fill: fillColor, stroke: strokeColor } = getContractionAreaColors({
                  isGood: area.isGood,
                  meetsMvc: area.meetsMvc,
                  meetsDuration: area.meetsDuration
                });
                
                return (
                  <ReferenceArea
                    key={`contraction-area-${index}`}
                    yAxisId={plotMode === 'raw_with_rms' ? 'right' : 'left'}
                    x1={area.startTime}
                    x2={area.endTime}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={2.25}
                    strokeDasharray="3 3"
                    ifOverflow="discard"
                  />
                );
              })}
            
            {/* Contraction peak dots - mark the peak amplitude of each contraction with enhanced quality indicators */}
            {showContractionDots && contractionAreas && chartData.length > 0 && finalDisplayDataKeys.length > 0 && hasValidOverlayData &&
             contractionAreas
              .filter(area => (area.isGood && showGoodContractions) || (!area.isGood && showPoorContractions))
              .map((area, index) => {
                console.log(`🔍 ReferenceDot ${index}:`, {
                  x: area.peakTime,
                  y: area.maxAmplitude,
                  isGood: area.isGood,
                  meetsMvc: area.meetsMvc,
                  meetsDuration: area.meetsDuration
                });
                
                const { fill: fillColor, stroke: strokeColor, symbol } = getContractionDotStyle({
                  isGood: area.isGood,
                  meetsMvc: area.meetsMvc,
                  meetsDuration: area.meetsDuration
                });
                
                return (
                  <ReferenceDot
                    key={`contraction-dot-${index}`}
                    yAxisId={plotMode === 'raw_with_rms' ? 'right' : 'left'}
                    x={area.peakTime}
                    y={area.maxAmplitude}
                    r={6}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={2.25}
                    ifOverflow="discard"
                    label={{
                      value: symbol,
                      position: "top",
                      fill: strokeColor,
                      fontSize: 10,
                      fontWeight: "bold",
                      offset: 8
                    }}
                  />
                );
              })}
            
            <Brush dataKey="time" height={30} stroke="#1abc9c" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default EMGChart; 