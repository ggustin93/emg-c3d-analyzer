import React, { memo } from 'react';
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
}

const EMGChart: React.FC<MultiChannelEMGChartProps> = memo(({ 
  chartData, 
  availableChannels,
  selectedChannel,
  viewMode,
  mvcThresholdForPlot,
  channel_muscle_mapping = {},
  muscle_color_mapping = {},
  sessionParams
}) => {
  const plotMode = sessionParams?.show_raw_signals ? 'raw' : 'activated';

  // Debug logging
  console.log('EMGChart render:', { 
    chartDataLength: chartData?.length || 0,
    availableChannels,
    selectedChannel,
    viewMode
  });

  if (!chartData || chartData.length === 0) {
    return <p className="text-center text-gray-500 my-4">No data available for chart.</p>;
  }

  // Check for data keys in chartData
  const dataKeys = chartData[0] && typeof chartData[0] === 'object' ? 
    Object.keys(chartData[0]).filter(key => key !== 'time') : [];
  console.log('Chart data keys:', dataKeys);

  // Map available channels to actual data keys in the chart data
  const availableDataKeys = dataKeys.length > 0 ? dataKeys : [];
  console.log('Available data keys:', availableDataKeys);

  // Determine which channels to display - use dataKeys if availableChannels is empty
  const displayChannels = viewMode === 'comparison'
    ? availableChannels.length > 0 ? availableChannels : availableDataKeys
    : selectedChannel 
      ? [selectedChannel] 
      : availableChannels.length > 0 ? [availableChannels[0]] : [];
  
  // Map display channels to actual data keys
  const displayDataKeys = displayChannels.map(channel => {
    // Try to find an exact match first
    if (availableDataKeys.includes(channel)) {
      return channel;
    }
    
    // Try to find a key that starts with this channel name
    const matchingKey = availableDataKeys.find(key => key.startsWith(channel));
    if (matchingKey) {
      return matchingKey;
    }
    
    // If no match found, return the channel name (it won't be rendered)
    return channel;
  }).filter(key => availableDataKeys.includes(key));
  
  // If no display keys were found, use all available data keys
  const finalDisplayDataKeys = displayDataKeys.length > 0 ? displayDataKeys : availableDataKeys;
  
  console.log('Display data keys:', finalDisplayDataKeys);

  // Get muscle names from mapping or use channel names as fallback
  const getMuscleName = (channelName: string | null): string => {
    if (!channelName) return '';
    
    try {
      // Extract the base channel name (CH1, CH2, etc.) without any suffix
      const baseChannelName = channelName.split(' ')[0];
      
      // Get the muscle name from the mapping, with null/undefined safety
      const muscleName = channel_muscle_mapping && typeof channel_muscle_mapping === 'object' && baseChannelName in channel_muscle_mapping
        ? channel_muscle_mapping[baseChannelName] 
        : baseChannelName;
      
      // Append the mode (Raw/Activated) to the muscle name
      return `${muscleName} ${plotMode === 'raw' ? 'Raw' : 'Activated'}`;
    } catch (error) {
      // If any error occurs, return the channel name or empty string as fallback
      return channelName || '';
    }
  };

  // Get channel-specific MVC thresholds
  const getChannelMVCThreshold = (channel: string): number | null => {
    // Extract base channel name (CH1, CH2, etc.)
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
    
    // Check if we have channel-specific MVC values
    if (sessionParams?.session_mvc_values && baseChannelName in sessionParams.session_mvc_values) {
      const channelMVC = sessionParams.session_mvc_values[baseChannelName];
      
      // If we have a channel-specific threshold percentage, use it
      if (sessionParams.session_mvc_threshold_percentages && baseChannelName in sessionParams.session_mvc_threshold_percentages) {
        const thresholdPercentage = sessionParams.session_mvc_threshold_percentages[baseChannelName];
        if (channelMVC !== null && thresholdPercentage !== null) {
          const threshold = channelMVC * (thresholdPercentage / 100);
          console.log(`Using channel-specific threshold for ${baseChannelName}: ${threshold} (${channelMVC} * ${thresholdPercentage}%)`);
          return threshold;
        }
      }
      
      // Fall back to global threshold percentage if available
      if (channelMVC !== null && sessionParams.session_mvc_threshold_percentage) {
        const threshold = channelMVC * (sessionParams.session_mvc_threshold_percentage / 100);
        console.log(`Using channel MVC with global percentage for ${baseChannelName}: ${threshold} (${channelMVC} * ${sessionParams.session_mvc_threshold_percentage}%)`);
        return threshold;
      }
    }
    
    // Fall back to global MVC value and threshold
    if (sessionParams?.session_mvc_value !== null && sessionParams?.session_mvc_value !== undefined && 
        sessionParams?.session_mvc_threshold_percentage !== null && sessionParams?.session_mvc_threshold_percentage !== undefined) {
      const threshold = sessionParams.session_mvc_value * (sessionParams.session_mvc_threshold_percentage / 100);
      console.log(`Using global MVC threshold for ${baseChannelName}: ${threshold} (${sessionParams.session_mvc_value} * ${sessionParams.session_mvc_threshold_percentage}%)`);
      return threshold;
    }
    
    // Last fallback to mvcThresholdForPlot
    if (mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined) {
      console.log(`Using mvcThresholdForPlot for ${baseChannelName}: ${mvcThresholdForPlot}`);
      return mvcThresholdForPlot;
    }
    
    console.log(`No MVC threshold available for ${baseChannelName}`);
    return null;
  };

  // Custom legend formatter to show MVC thresholds
  const renderLegend = (props: any) => {
    // Collect all unique MVC thresholds to display
    const thresholds: Array<{
      channel: string, 
      value: number, 
      color: string, 
      mvcValue?: number | null, 
      percentage?: number | null
    }> = [];
    
    // Add channel-specific thresholds
    finalDisplayDataKeys.forEach((key, index) => {
      const threshold = getChannelMVCThreshold(key);
      if (threshold !== null) {
        const baseChannelName = key.split(' ')[0];
        const muscleName = getMuscleName(baseChannelName);
        
        // Get the same color as the channel line
        const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
        
        // Get the original MVC value and percentage
        const mvcValue = sessionParams?.session_mvc_values?.[baseChannelName] || null;
        const percentage = sessionParams?.session_mvc_threshold_percentages?.[baseChannelName] || 
                           sessionParams?.session_mvc_threshold_percentage || null;
        
        thresholds.push({
          channel: muscleName,
          value: threshold,
          color: colorStyle.stroke,
          mvcValue,
          percentage
        });
      }
    });
    
    // If no channel-specific thresholds but global threshold exists
    if (thresholds.length === 0 && mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined) {
      thresholds.push({
        channel: 'Global',
        value: mvcThresholdForPlot,
        color: '#f97316', // Default to orange for global threshold
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
  };

  // Determine Y-axis domain based on data and MVC thresholds
  let yDomain: [number | 'auto', number | 'auto'] = ['auto', 'auto'];
  
  // Find min/max of actual data
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
  
  // Find max MVC threshold to ensure all thresholds are visible
  let maxThreshold = -Infinity;
  finalDisplayDataKeys.forEach(key => {
    const threshold = getChannelMVCThreshold(key);
    if (threshold !== null) {
      maxThreshold = Math.max(maxThreshold, threshold);
    }
  });
  
  // If no channel-specific thresholds but global threshold exists
  if (maxThreshold === -Infinity && mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined) {
    maxThreshold = mvcThresholdForPlot;
  }
  
  // Set domain to include both data range and thresholds
  if (dataMin !== Infinity && dataMax !== -Infinity && maxThreshold !== -Infinity) {
    yDomain = [
      Math.min(dataMin, maxThreshold * 0.8), // ensure threshold isn't at the very bottom
      Math.max(dataMax, maxThreshold * 1.2)  // ensure threshold isn't at the very top
    ];
  } else if (maxThreshold !== -Infinity) { // If only threshold exists
    yDomain = [maxThreshold * 0.8, maxThreshold * 1.2];
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
            domain={yDomain} // Apply dynamic domain
          />
          <Tooltip formatter={(value: number, name: string) => {
            try {
              return [`${value.toExponential(3)} mV`, name ? getMuscleName(name) : ''];
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
          
          {/* Render lines for each display channel */}
          {finalDisplayDataKeys.map((dataKey) => {
            // Find the base channel name (without activated/Raw suffix)
            const baseChannelName = displayChannels.find(ch => dataKey.startsWith(ch)) || dataKey.split(' ')[0];
            
            // Get color directly using getColorForChannel for consistency with ChannelSelection
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

          {/* MVC Threshold Lines - one per channel */}
          {finalDisplayDataKeys.map((dataKey, index) => {
            const threshold = getChannelMVCThreshold(dataKey);
            if (threshold !== null) {
              // Find the base channel name (without activated/Raw suffix)
              const baseChannelName = dataKey.split(' ')[0];
              
              // Get color directly using getColorForChannel for consistency
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

          {/* Fallback to global MVC threshold if no channel-specific thresholds */}
          {finalDisplayDataKeys.every(dataKey => getChannelMVCThreshold(dataKey) === null) && 
           mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
            <ReferenceLine 
              y={mvcThresholdForPlot} 
              stroke="#f97316" // Default to orange for global threshold
              strokeDasharray="3 3" 
              strokeWidth={2.5}
            />
          )}

          {/* Brush for zoom/selection - Placed at the bottom */}
          <Brush dataKey="time" height={30} stroke="#1abc9c" y={430} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default EMGChart; 