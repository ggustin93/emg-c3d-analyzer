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
import { getColorForChannel } from '../lib/colorMappings';
import { FilterMode } from './app/ChannelFilter';
import { GameSessionParameters, ChannelAnalyticsData } from '../types/emg';

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
  plotMode?: 'raw' | 'activated';
  setPlotMode?: (mode: 'raw' | 'activated') => void;
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
  plotMode: externalPlotMode,
  setPlotMode,
  onParamsChange,
  showSignalSwitch = false,
  
  // Contraction visualization props
  analytics,
  showGoodContractions: propShowGoodContractions = true,
  showPoorContractions: propShowPoorContractions = true,
  showContractionAreas: propShowContractionAreas = true,
  showContractionDots: propShowContractionDots = true
}) => {
  const internalPlotMode = sessionParams?.show_raw_signals ? 'raw' : 'activated';
  const plotMode = externalPlotMode || internalPlotMode;

  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Use props for contraction visualization states
  const showGoodContractions = propShowGoodContractions;
  const showPoorContractions = propShowPoorContractions;
  const showContractionAreas = propShowContractionAreas;
  const showContractionDots = propShowContractionDots;
  

  const dataKeys = useMemo(() => {
    return chartData?.[0] && typeof chartData[0] === 'object' 
      ? Object.keys(chartData[0]).filter(key => key !== 'time') 
      : [];
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

  const getMuscleName = useCallback((channelName: string | null): string => {
    if (!channelName) return '';
    try {
      const baseChannelName = channelName.split(' ')[0];
      const muscleName = channel_muscle_mapping?.[baseChannelName] || baseChannelName;
      return `${muscleName} ${plotMode === 'raw' ? 'Raw' : 'Activated'}`;
    } catch (error) {
      return channelName || '';
    }
  }, [channel_muscle_mapping, plotMode]);

  const getChannelMVCThreshold = useCallback((channel: string): number | null => {
    const baseChannelName = channel.split(' ')[0];
    
    
    if (sessionParams?.session_mvc_values?.[baseChannelName]) {
      const channelMVC = sessionParams.session_mvc_values[baseChannelName];
      if (sessionParams.session_mvc_threshold_percentages?.[baseChannelName]) {
        const thresholdPercentage = sessionParams.session_mvc_threshold_percentages[baseChannelName];
        if (channelMVC !== null && thresholdPercentage !== null) {
          const threshold = channelMVC * (thresholdPercentage / 100);
          return threshold;
        }
      }
      if (channelMVC !== null && sessionParams.session_mvc_threshold_percentage) {
        const threshold = channelMVC * (sessionParams.session_mvc_threshold_percentage / 100);
        return threshold;
      }
    }
    
    if (sessionParams?.session_mvc_value !== null && sessionParams?.session_mvc_value !== undefined && 
        sessionParams?.session_mvc_threshold_percentage !== null && sessionParams?.session_mvc_threshold_percentage !== undefined) {
      const threshold = sessionParams.session_mvc_value * (sessionParams.session_mvc_threshold_percentage / 100);
      return threshold;
    }
    
    if (mvcThresholdForPlot != null) {
      return mvcThresholdForPlot;
    }
    
    return null;
  }, [sessionParams, mvcThresholdForPlot]);


  // Get contraction quality summary for legend (optimized for scatter plot)
  const qualitySummary = useMemo(() => {
    if (!analytics) return { goodCount: 0, totalCount: 0 };
    
    let goodCount = 0;
    let totalCount = 0;
    
    Object.entries(analytics).forEach(([channelName, channelData]) => {
      const channelDisplayed = finalDisplayDataKeys.some(key => key.startsWith(channelName));
      if (channelDisplayed && channelData.contractions) {
        channelData.contractions.forEach(contraction => {
          const isGood = contraction.is_good === true;
          // Only count contractions that are currently visible
          if ((isGood && showGoodContractions) || (!isGood && showPoorContractions)) {
            totalCount++;
            if (isGood) {
              goodCount++;
            }
          }
        });
      }
    });
    
    return { goodCount, totalCount };
  }, [analytics, finalDisplayDataKeys, showGoodContractions, showPoorContractions]);


  const renderLegend = useCallback((props: any) => {
    const thresholds: Array<{
      channel: string, 
      value: number, 
      color: string, 
      mvcValue?: number | null, 
      percentage?: number | null
    }> = [];
    
    finalDisplayDataKeys.forEach((key) => {
      const threshold = getChannelMVCThreshold(key);
      if (threshold !== null) {
        const baseChannelName = key.split(' ')[0];
        const muscleName = getMuscleName(baseChannelName);
        const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
        const mvcValue = sessionParams?.session_mvc_values?.[baseChannelName] || null;
        const percentage = sessionParams?.session_mvc_threshold_percentages?.[baseChannelName] || 
                           sessionParams?.session_mvc_threshold_percentage || null;
        
        thresholds.push({ channel: muscleName, value: threshold, color: colorStyle.stroke, mvcValue, percentage });
      }
    });
    
    if (thresholds.length === 0 && mvcThresholdForPlot != null) {
      thresholds.push({
        channel: 'Global',
        value: mvcThresholdForPlot,
        color: '#f97316',
        mvcValue: sessionParams?.session_mvc_value || null,
        percentage: sessionParams?.session_mvc_threshold_percentage || null
      });
    }
    

    return (
      <div className="recharts-default-legend" style={{ padding: '0 10px' }}>
        <div className="space-y-2">
          {/* MVC Thresholds */}
          <ul className="flex flex-wrap items-center gap-x-6">
            {thresholds.map((item, index) => {
              // Format the values for display
              const thresholdValue = item.value.toExponential(3);
              const mvcValue = item.mvcValue !== undefined && item.mvcValue !== null 
                ? item.mvcValue.toExponential(3) 
                : null;
              const percentage = item.percentage !== undefined && item.percentage !== null 
                ? item.percentage 
                : null;
                
              // Create concise label
              const muscleLabel = item.channel.replace(' Activated', '').replace(' Raw', '');
              
              return (
                <li key={index} className="flex items-center">
                  <span 
                    className="inline-block w-6 h-0 mr-2 border-t-2 border-dashed" 
                    style={{ borderColor: item.color }}
                  />
                  <div>
                    <span style={{ color: item.color, fontWeight: 500 }}>
                      {muscleLabel} Threshold: {thresholdValue} mV
                    </span>
                    {mvcValue !== null && percentage !== null && (
                      <span className="text-xs ml-1 text-gray-500">
                        ({percentage}% of MVC)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          
          {/* Contraction Quality Legend */}
          {qualitySummary.totalCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 text-xs">
              <span className="font-medium text-gray-700">Contraction Quality:</span>
              <div className="flex items-center gap-x-1">
                <span 
                  className="inline-block w-3 h-2 border" 
                  style={{ 
                    backgroundColor: `rgba(34, 197, 94, 0.18)`, 
                    borderColor: '#16a34a',
                    borderWidth: '1px'
                  }}
                />
                <span className="text-green-700 font-medium">Good ({qualitySummary.goodCount})</span>
              </div>
              <div className="flex items-center gap-x-1">
                <span 
                  className="inline-block w-3 h-2 border border-red-600" 
                  style={{ 
                    backgroundColor: `rgba(239, 68, 68, 0.15)`,
                    borderColor: '#dc2626'
                  }}
                />
                <span className="text-red-700 font-medium">Poor ({qualitySummary.totalCount - qualitySummary.goodCount})</span>
              </div>
              <span className="text-gray-600">
                Quality: {qualitySummary.totalCount > 0 ? Math.round((qualitySummary.goodCount / qualitySummary.totalCount) * 100) : 0}%
              </span>
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
  const contractionAreas = useMemo(() => {
    if (!analytics) return [];
    
    const areas: Array<{ 
      startTime: number; 
      endTime: number; 
      isGood: boolean; 
      channel: string;
      maxAmplitude: number;
      peakTime: number;
    }> = [];
    
    // Get time range from chart data for validation
    const timeRange = chartData.length > 0 ? {
      min: Math.min(...chartData.map(d => d.time)),
      max: Math.max(...chartData.map(d => d.time))
    } : { min: 0, max: 0 };
    
    Object.entries(analytics).forEach(([channelName, channelData]) => {
      const channelDisplayed = finalDisplayDataKeys.some(key => key.startsWith(channelName));
      
      if (channelDisplayed && channelData.contractions) {
        channelData.contractions.forEach((contraction, idx) => {
          const startTime = contraction.start_time_ms / 1000;
          const endTime = contraction.end_time_ms / 1000;
          const peakTime = (startTime + endTime) / 2;
          
          // Validate contraction is within chart time range
          if (startTime >= timeRange.min && endTime <= timeRange.max) {
            areas.push({
              startTime,
              endTime,
              isGood: contraction.is_good === true,
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
    
    console.log('🎯 Contraction visualization:', {
      areasCount: areas.length,
      chartTimeRange: timeRange,
      chartDataPoints: chartData.length,
      goodCount: areas.filter(a => a.isGood).length,
      poorCount: areas.filter(a => !a.isGood).length
    });
    
    return areas;
  }, [analytics, finalDisplayDataKeys, chartData]);

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
      <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm relative" ref={chartContainerRef}>
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
              tick={{ fontSize: 10 }} 
              label={{ value: "Amplitude (mV)", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
              domain={yDomain}
              allowDataOverflow={false}
            />
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
            
            {finalDisplayDataKeys.map((dataKey) => {
              const baseChannelName = finalDisplayDataKeys.find(ch => dataKey.startsWith(ch)) || dataKey.split(' ')[0];
              const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
              
              return (
                <Line 
                  key={dataKey}
                  type="monotone" 
                  dataKey={dataKey} 
                  name={dataKey} 
                  stroke={colorStyle.stroke} 
                  dot={false} 
                  isAnimationActive={false} 
                  strokeWidth={2.5}
                />
              );
            })}

            {finalDisplayDataKeys.map((dataKey) => {
              const threshold = getChannelMVCThreshold(dataKey);
              if (threshold !== null) {
                const baseChannelName = dataKey.split(' ')[0];
                const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
                
                return (
                  <ReferenceLine 
                    key={`mvc-${dataKey}`}
                    y={threshold} 
                    stroke={colorStyle.stroke}
                    strokeDasharray="3 3" 
                    strokeWidth={2.5}
                  />
                );
              }
              return null;
            })}

            {finalDisplayDataKeys.every(dataKey => getChannelMVCThreshold(dataKey) === null) && 
             mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
              <ReferenceLine 
                y={mvcThresholdForPlot} 
                stroke="#f97316"
                strokeDasharray="3 3" 
                strokeWidth={2.5}
              />
            )}

            {/* Debug: Log when rendering contraction visualizations */}
            {contractionAreas.length > 0 && console.log('📊 Rendering contractions:', contractionAreas.length)}
            
            {/* Contraction areas - colorize EMG lines between two abscissas */}
            {showContractionAreas && contractionAreas
              .filter(area => (area.isGood && showGoodContractions) || (!area.isGood && showPoorContractions))
              .map((area, index) => {
                console.log(`🔍 ReferenceArea ${index}:`, {
                  x1: area.startTime,
                  x2: area.endTime,
                  isGood: area.isGood,
                  channel: area.channel
                });
                return (
                  <ReferenceArea
                    key={`contraction-area-${index}`}
                    x1={area.startTime}
                    x2={area.endTime}
                    fill={area.isGood ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.25)"}
                    stroke={area.isGood ? "#16a34a" : "#dc2626"}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    ifOverflow="visible"
                  />
                );
              })}
            
            {/* Contraction peak dots - mark the peak amplitude of each contraction */}
            {showContractionDots && contractionAreas
              .filter(area => (area.isGood && showGoodContractions) || (!area.isGood && showPoorContractions))
              .map((area, index) => {
                console.log(`🔍 ReferenceDot ${index}:`, {
                  x: area.peakTime,
                  y: area.maxAmplitude,
                  isGood: area.isGood
                });
                return (
                  <ReferenceDot
                    key={`contraction-dot-${index}`}
                    x={area.peakTime}
                    y={area.maxAmplitude}
                    r={6}
                    fill={area.isGood ? "#22c55e" : "#ef4444"}
                    stroke={area.isGood ? "#16a34a" : "#dc2626"}
                    strokeWidth={2}
                    ifOverflow="visible"
                    label={{
                      value: area.isGood ? "✓" : "✗",
                      position: "top",
                      fill: area.isGood ? "#16a34a" : "#dc2626",
                      fontSize: 12,
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