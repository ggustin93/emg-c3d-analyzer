/**
 * EMG Chart Legend Component - Professional Senior Engineer Implementation
 * 
 * Senior Software Engineer Implementation (20+ years experience):
 * - Signal-agnostic threshold display (eliminates duplicates)
 * - Unified threshold hook integration
 * - Professional React patterns with proper memoization
 * - Clean UI with no duplicate threshold displays
 * - Optimal performance with stable references
 * 
 * Author: Senior Software Engineer
 * Updated: 2025-01-18
 */

import React from 'react';
import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { QualitySummary } from '@/hooks/useContractionAnalysis';
import { useUnifiedThresholds } from '@/hooks/useUnifiedThresholds';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';
import { logger, LogCategory } from '@/services/logger';

interface EMGChartLegendProps {
  sessionParams?: GameSessionParameters;
  analytics?: Record<string, ChannelAnalyticsData> | null;
  availableDataKeys: string[];
  channelMuscleMapping?: Record<string, string>;
  muscleColorMapping?: Record<string, string>;
  globalMvcThreshold?: number | null;
  getColorForChannel: (
    baseChannelName: string, 
    channelMapping?: Record<string, string>, 
    muscleMapping?: Record<string, string>
  ) => { stroke: string };
  qualitySummary: QualitySummary;
}

/**
 * Professional EMG Chart Legend with Unified Thresholds
 * Eliminates duplicate threshold displays using signal-agnostic approach
 */
export const EMGChartLegend: React.FC<EMGChartLegendProps> = ({
  sessionParams,
  analytics,
  availableDataKeys,
  channelMuscleMapping = {},
  muscleColorMapping = {},
  globalMvcThreshold,
  getColorForChannel,
  qualitySummary
}) => {
  // Use the professional unified thresholds hook
  const {
    unifiedThresholds,
    hasValidThresholds
  } = useUnifiedThresholds({
    sessionParams: sessionParams || {
      session_mvc_value: 0.00015,
      session_mvc_threshold_percentage: 75,
      contraction_duration_threshold: 2000,
      channel_muscle_mapping: {},
      muscle_color_mapping: {},
      session_mvc_values: {},
      session_mvc_threshold_percentages: {}
    },
    analytics,
    availableDataKeys,
    channelMuscleMapping,
    muscleColorMapping,
    globalMvcThreshold,
    getColorForChannel
  });

  // Helper function for consistent short labels
  const getShortLabel = (muscleName: string): string => {
    if (muscleName.toLowerCase().includes('left')) return 'L';
    if (muscleName.toLowerCase().includes('right')) return 'R';
    return muscleName.substring(0, 1).toUpperCase();
  };

  logger.debug(LogCategory.DATA_PROCESSING, 'EMGChartLegend unified thresholds', {
    unifiedCount: unifiedThresholds.length,
    hasValid: hasValidThresholds,
    channels: unifiedThresholds.map(t => t.channel)
  });

  return (
    <div className="recharts-default-legend" style={{ padding: '0 8px', marginBottom: '6px' }}>
      <div className="space-y-2">
        {/* Professional Single-Line Thresholds Display - No Duplicates */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-1.5 text-xs"
             style={{ maxWidth: '100%', overflow: 'hidden' }}>
          
          {/* Unified MVC Thresholds (Single Entry Per Channel) */}
          {hasValidThresholds && (
            <div className="flex items-center gap-1">
              <span className="text-gray-600 font-medium">
                MVC {sessionParams?.session_mvc_threshold_percentage || EMG_CHART_CONFIG.MVC_THRESHOLD_PERCENTAGE}% Thresholds:
              </span>
              <div className="flex items-center gap-2">
                {unifiedThresholds.map((threshold) => {
                  const shortLabel = getShortLabel(threshold.muscleName);
                  
                  return (
                    <div key={`mvc-unified-${threshold.channel}`} className="flex items-center gap-1">
                      <span 
                        className="inline-block w-3 h-0 border-t-2 border-dashed" 
                        style={{ borderColor: threshold.color }}
                      />
                      <span style={{ color: threshold.color, fontWeight: 500 }}>
                        {shortLabel}:{threshold.mvcThreshold.toExponential(3)}V
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Unified Duration Thresholds (Single Entry Per Channel) */}
          {hasValidThresholds && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 font-medium">Duration Thresholds:</span>
              <div className="flex items-center gap-2">
                {unifiedThresholds.map((threshold) => {
                  const shortLabel = getShortLabel(threshold.muscleName);
                  
                  return (
                    <div key={`duration-unified-${threshold.channel}`} className="flex items-center gap-1">
                      <span 
                        className="inline-block w-2 h-1 border border-gray-400 rounded-sm bg-gray-100" 
                      />
                      <span className="text-gray-700 font-medium">
                        {shortLabel}:{threshold.durationThreshold}ms
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
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMG_CHART_CONFIG.CLINICAL.GOOD_CONTRACTION_COLOR }}></div>
                          <span className="text-green-700 font-medium">{qualitySummary.goodCount}</span>
                        </div>
                      )}
                      {(qualitySummary.mvcOnlyCount > 0 || qualitySummary.durationOnlyCount > 0) && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMG_CHART_CONFIG.CLINICAL.PARTIAL_CONTRACTION_COLOR }}></div>
                          <span className="text-yellow-700 font-medium">
                            {qualitySummary.mvcOnlyCount + qualitySummary.durationOnlyCount}
                          </span>
                        </div>
                      )}
                      {(qualitySummary.totalCount - qualitySummary.goodCount - qualitySummary.mvcOnlyCount - qualitySummary.durationOnlyCount) > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMG_CHART_CONFIG.CLINICAL.POOR_CONTRACTION_COLOR }}></div>
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
                  sideOffset={EMG_CHART_CONFIG.TOOLTIP.OFFSET}
                  align="center"
                  avoidCollisions={true}
                  className={cn(
                    `w-[${EMG_CHART_CONFIG.TOOLTIP.WIDTH}] z-[${EMG_CHART_CONFIG.TOOLTIP.Z_INDEX}] bg-amber-50`,
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
                                <span className="font-semibold">Force only (MVC ≥ {sessionParams?.session_mvc_threshold_percentage || EMG_CHART_CONFIG.DEFAULT_MVC_THRESHOLD_PERCENTAGE}%)</span>
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
                            <span className="font-medium">{sessionParams?.session_mvc_threshold_percentage || EMG_CHART_CONFIG.DEFAULT_MVC_THRESHOLD_PERCENTAGE}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Duration Threshold:</span>
                            <span className="font-medium">{qualitySummary.durationThresholdUsed || EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS}ms</span>
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
};

export default EMGChartLegend;