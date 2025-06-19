import React, { memo, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceLine
} from 'recharts';
import { getColorForChannel } from '../lib/colorMappings';
import { FilterMode } from './app/ChannelFilter';
import { GameSessionParameters } from '../types/emg';

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
  isLoading = false
}) => {
  const plotMode = sessionParams?.show_raw_signals ? 'raw' : 'activated';

  // Debug logging
  console.log('EMGChart render:', { 
    chartDataLength: chartData?.length || 0,
    availableChannels,
    selectedChannel,
    viewMode
  });

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
    
    console.log(`Getting MVC threshold for ${baseChannelName}`, {
      sessionParams,
      hasSessionMVCValues: !!sessionParams?.session_mvc_values,
      channelMVC: sessionParams?.session_mvc_values?.[baseChannelName],
      channelThresholdPercentage: sessionParams?.session_mvc_threshold_percentages?.[baseChannelName],
      globalThresholdPercentage: sessionParams?.session_mvc_threshold_percentage,
      globalMVCValue: sessionParams?.session_mvc_value,
      mvcThresholdForPlot
    });
    
    if (sessionParams?.session_mvc_values?.[baseChannelName]) {
      const channelMVC = sessionParams.session_mvc_values[baseChannelName];
      if (sessionParams.session_mvc_threshold_percentages?.[baseChannelName]) {
        const thresholdPercentage = sessionParams.session_mvc_threshold_percentages[baseChannelName];
        if (channelMVC !== null && thresholdPercentage !== null) {
          const threshold = channelMVC * (thresholdPercentage / 100);
          console.log(`Using channel-specific threshold for ${baseChannelName}: ${threshold} (${channelMVC} * ${thresholdPercentage}%)`);
          return threshold;
        }
      }
      if (channelMVC !== null && sessionParams.session_mvc_threshold_percentage) {
        const threshold = channelMVC * (sessionParams.session_mvc_threshold_percentage / 100);
        console.log(`Using channel MVC with global percentage for ${baseChannelName}: ${threshold} (${channelMVC} * ${sessionParams.session_mvc_threshold_percentage}%)`);
        return threshold;
      }
    }
    
    if (sessionParams?.session_mvc_value != null && sessionParams?.session_mvc_value != undefined && 
        sessionParams?.session_mvc_threshold_percentage != null && sessionParams?.session_mvc_threshold_percentage != undefined) {
      const threshold = sessionParams.session_mvc_value * (sessionParams.session_mvc_threshold_percentage / 100);
      console.log(`Using global MVC threshold for ${baseChannelName}: ${threshold} (${sessionParams.session_mvc_value} * ${sessionParams.session_mvc_threshold_percentage}%)`);
      return threshold;
    }
    
    if (mvcThresholdForPlot != null) {
      console.log(`Using mvcThresholdForPlot for ${baseChannelName}: ${mvcThresholdForPlot}`);
      return mvcThresholdForPlot;
    }
    
    console.log(`No MVC threshold available for ${baseChannelName}`);
    return null;
  }, [sessionParams, mvcThresholdForPlot]);

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
      </div>
    );
  }, [finalDisplayDataKeys, getChannelMVCThreshold, mvcThresholdForPlot, getMuscleName, channel_muscle_mapping, muscle_color_mapping, sessionParams]);

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
        Math.min(dataMin, maxThreshold * 0.8),
        Math.max(dataMax, maxThreshold * 1.2)
      ];
    } else if (maxThreshold !== -Infinity) {
      domain = [maxThreshold * 0.8, maxThreshold * 1.2];
    }
    return domain;
  }, [chartData, finalDisplayDataKeys, getChannelMVCThreshold, mvcThresholdForPlot]);

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
    <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" label={{ value: "Time (s)", position: "bottom" }} tick={{ fontSize: 10 }} />
          <YAxis 
            tick={{ fontSize: 10 }} 
            label={{ value: "Amplitude (mV)", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
            domain={yDomain}
          />
          <Tooltip formatter={(value: number, name: string) => {
            try {
              return [`${value.toExponential(3)} mV`, name || ''];
            } catch (error) {
              return [`${value.toExponential(3)} mV`, name || ''];
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
              stroke="#f97316" // Default to orange for global threshold
              strokeDasharray="3 3" 
              strokeWidth={2.5}
            />
          )}

          <Brush dataKey="time" height={30} stroke="#1abc9c" y={430} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default EMGChart; 