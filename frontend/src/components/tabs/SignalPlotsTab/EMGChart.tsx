import React, { memo, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea
} from 'recharts';
import { getColorForChannel } from '@/lib/colorMappings';
import { FilterMode } from '@/components/shared/ChannelFilter';
import { GameSessionParameters, ChannelAnalyticsData } from "@/types/emg";
import { SignalDisplayType } from './ThreeChannelSignalSelector';
import { getContractionAreaColors, getContractionDotStyle } from '@/lib/qualityColors';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';
import { logger, LogCategory } from '@/services/logger';
import { useMVCCalculations } from '@/hooks/useMVCCalculations';
import { useContractionAnalysis } from '@/hooks/useContractionAnalysis';
import EMGChartLegend from './EMGChartLegend';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Legend } from 'recharts';

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
    logger.dataProcessing('Overlay Availability Check', { availableChannels: keys });
    
    if (!keys || keys.length === 0) return false;
    const baseNames = keys.map(k => k.replace(/ (Raw|activated|Processed)$/,'')).filter((v,i,a)=>a.indexOf(v)===i);
    
    logger.dataProcessing('Base Names', baseNames);
    
    const hasOverlay = baseNames.some(base => {
      const hasRaw = keys.includes(`${base} Raw`);
      const hasProcessed = keys.includes(`${base} Processed`);
      logger.dataProcessing(`Checking signals for ${base}`, { hasRaw, hasProcessed });
      return hasRaw && hasProcessed;
    });
    
    logger.dataProcessing('Overlay Available', { hasOverlay });
    return hasOverlay;
  }, [availableChannels]);

  const effectivePlotMode = plotMode === 'raw_with_rms' && !overlayAvailable ? 'processed' : plotMode;

  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Use props for contraction visualization states
  const showGoodContractions = propShowGoodContractions;
  const showPoorContractions = propShowPoorContractions;
  const showContractionAreas = propShowContractionAreas;
  const showContractionDots = propShowContractionDots;
  

  const availableDataKeys = useMemo(() => {
    if (!chartData || chartData.length === 0) return [] as string[];
    const keySet = new Set<string>();
    for (const point of chartData) {
      if (!point || typeof point !== 'object') continue;
      Object.keys(point).forEach((k) => {
        if (k !== 'time') keySet.add(k);
      });
    }
    const keys = Array.from(keySet);
    logger.dataProcessing('Chart Data Keys (union across all rows)', keys);
    return keys;
  }, [chartData]);

  const finalDisplayDataKeys = useMemo(() => {
    const displayChannels = viewMode === 'comparison'
      ? (availableChannels.length > 0 ? availableChannels : availableDataKeys)
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

  // Initialize hooks for MVC calculations and contraction analysis
  const { getChannelMVCThreshold, getMuscleName, getThresholdData } = useMVCCalculations({
    sessionParams,
    mvcThresholdForPlot,
    analytics,
    channel_muscle_mapping,
    muscle_color_mapping,
    finalDisplayDataKeys,
    effectivePlotMode,
    getColorForChannel
  });

  const { contractionAreas, qualitySummary } = useContractionAnalysis({
    analytics,
    sessionParams,
    finalDisplayDataKeys,
    chartData,
    showGoodContractions,
    showPoorContractions
  });

  // For overlay mode, we need both Raw and RMS data keys
  const overlayDataKeys = useMemo(() => {
    logger.dataProcessing('Overlay Debug', { plotMode, overlayAvailable });
    
    if (plotMode !== 'raw_with_rms') return null;
    
    const rawKeys: string[] = [];
    const rmsKeys: string[] = [];
    
    // Extract base channel names from current display keys
    const baseChannels = finalDisplayDataKeys.map(key => key.split(' ')[0]);
    
    logger.dataProcessing('Overlay Debug', {
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
      
      logger.dataProcessing(`Channel mapping for ${baseChannel}`, { rawKey, processedKey });
    });
    
    logger.dataProcessing('Overlay Keys Result', { rawKeys, rmsKeys });
    return { rawKeys, rmsKeys };
  }, [plotMode, finalDisplayDataKeys, availableDataKeys, chartData]);

  // Additional safety check for overlay mode - must be after overlayDataKeys definition
  const hasValidOverlayData = useMemo(() => {
    if (plotMode !== 'raw_with_rms' || !overlayDataKeys) return true;
    const hasValid = overlayDataKeys.rawKeys.length > 0 && overlayDataKeys.rmsKeys.length > 0;
    logger.dataProcessing('Has Valid Overlay Data', { 
      hasValid,
      rawKeys: overlayDataKeys.rawKeys, 
      rmsKeys: overlayDataKeys.rmsKeys 
    });
    return hasValid;
  }, [plotMode, overlayDataKeys]);

  // Note: getMuscleName and getChannelMVCThreshold are now provided by useMVCCalculations hook


  // Note: qualitySummary is now provided by useContractionAnalysis hook


  // Note: renderLegend function has been completely replaced with EMGChartLegend component

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



  // Note: contractionAreas is now provided by useContractionAnalysis hook

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
              content={() => (
                <EMGChartLegend 
                  thresholds={getThresholdData()}
                  qualitySummary={qualitySummary}
                  sessionParams={sessionParams}
                />
              )}
            />
            
            {(() => {
              const shouldRenderOverlay = plotMode === 'raw_with_rms' && overlayDataKeys && hasValidOverlayData;
              logger.chartRender('Rendering Decision', { 
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
              logger.chartRender('MVC Reference Lines Keys', keysForThresholds);
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
            {contractionAreas.length > 0 && logger.chartRender('Rendering contractions', { 
              count: contractionAreas.length, 
              sample: contractionAreas.slice(0, 2).map(a => ({isGood: a.isGood, meetsMvc: a.meetsMvc, meetsDuration: a.meetsDuration}))
            })}
            
            {/* Contraction areas - colorize EMG lines between two abscissas with enhanced quality colors */}
            {showContractionAreas && contractionAreas && chartData.length > 0 && finalDisplayDataKeys.length > 0 &&
             contractionAreas
              .filter(area => {
                // Three quality categories: Good (green), Adequate (yellow), Poor (red)
                if (area.isGood) {
                  const show = showGoodContractions;
                  logger.chartRender(`🎯 Filtering AREA ${area.channel}`, { 
                    category: 'good', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show 
                  });
                  return show;
                }
                
                // For non-good contractions, check if they're adequate (yellow) or poor (red)
                const isAdequate = (area.meetsMvc && !area.meetsDuration) || (!area.meetsMvc && area.meetsDuration);
                const isPoor = !area.meetsMvc && !area.meetsDuration;
                
                if (isAdequate) {
                  // Show adequate contractions when either good OR poor contractions are enabled
                  // This ensures yellow contractions are visible in the legacy 2-toggle system
                  const show = showGoodContractions || showPoorContractions;
                  logger.chartRender(`🟡 Filtering AREA ${area.channel}`, { 
                    category: 'adequate', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show,
                    reason: area.meetsMvc && !area.meetsDuration ? 'mvc-only' : 'duration-only'
                  });
                  return show;
                }
                
                if (isPoor) {
                  // Only show poor contractions when explicitly enabled
                  const show = showPoorContractions;
                  logger.chartRender(`🔴 Filtering AREA ${area.channel}`, { 
                    category: 'poor', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show 
                  });
                  return show;
                }
                
                logger.warn(LogCategory.CHART_RENDER, `⚠️  Unknown AREA category for ${area.channel}`, {
                  isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration
                });
                return false;
              })
              .map((area, index) => {
                logger.chartRender(`ReferenceArea ${index}`, {
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
                
                logger.chartRender(`Color for area ${index}`, {
                  flags: { isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration },
                  colors: { fill: fillColor, stroke: strokeColor },
                  channel: area.channel
                });
                
                const stableAreaKey = `area-${area.channel}-${area.startTime}-${area.endTime}`;
                return (
                  <ReferenceArea
                    key={stableAreaKey}
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
            {showContractionDots && contractionAreas && chartData.length > 0 && finalDisplayDataKeys.length > 0 &&
             contractionAreas
              .filter(area => {
                // Three quality categories: Good (green), Adequate (yellow), Poor (red)
                if (area.isGood) {
                  const show = showGoodContractions;
                  logger.chartRender(`🎯 Filtering DOT ${area.channel}`, { 
                    category: 'good', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show 
                  });
                  return show;
                }
                
                // For non-good contractions, check if they're adequate (yellow) or poor (red)
                const isAdequate = (area.meetsMvc && !area.meetsDuration) || (!area.meetsMvc && area.meetsDuration);
                const isPoor = !area.meetsMvc && !area.meetsDuration;
                
                if (isAdequate) {
                  // Show adequate contractions when either good OR poor contractions are enabled
                  // This ensures yellow contractions are visible in the legacy 2-toggle system
                  const show = showGoodContractions || showPoorContractions;
                  logger.chartRender(`🟡 Filtering DOT ${area.channel}`, { 
                    category: 'adequate', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show,
                    reason: area.meetsMvc && !area.meetsDuration ? 'mvc-only' : 'duration-only'
                  });
                  return show;
                }
                
                if (isPoor) {
                  // Only show poor contractions when explicitly enabled
                  const show = showPoorContractions;
                  logger.chartRender(`🔴 Filtering DOT ${area.channel}`, { 
                    category: 'poor', isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration, show 
                  });
                  return show;
                }
                
                logger.warn(LogCategory.CHART_RENDER, `⚠️  Unknown DOT category for ${area.channel}`, {
                  isGood: area.isGood, meetsMvc: area.meetsMvc, meetsDuration: area.meetsDuration
                });
                return false;
              })
              .map((area, index) => {
                logger.chartRender(`ReferenceDot ${index}`, {
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
                
                const stableDotKey = `dot-${area.channel}-${area.peakTime}-${area.maxAmplitude}`;
                return (
                  <ReferenceDot
                    key={stableDotKey}
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