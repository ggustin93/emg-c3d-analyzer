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
  const dataKeys = Object.keys(chartData[0]).filter(key => key !== 'time');
  console.log('Chart data keys:', dataKeys);

  // Map available channels to actual data keys in the chart data
  const availableDataKeys = dataKeys.length > 0 ? dataKeys : [];
  console.log('Available data keys:', availableDataKeys);

  // Determine which channels to display - use dataKeys if availableChannels is empty
  const displayChannels = viewMode === 'comparison' || availableChannels.length > 1
    ? availableChannels 
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

  // Create a map of unique muscle names to their colors
  const uniqueMuscleColors = new Map<string, string>();
  finalDisplayDataKeys.forEach((dataKey, index) => {
    // Find the base channel name (without activated/Raw suffix)
    const baseChannelName = displayChannels.find(ch => dataKey.startsWith(ch)) || dataKey.split(' ')[0];
    const muscleName = channel_muscle_mapping[baseChannelName] || baseChannelName;
    
    // Get color from mapping or use default colors
    const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
    
    // If no custom color is set, use distinct default colors for the first two channels
    let color = colorStyle.stroke;
    if (!muscle_color_mapping[muscleName] && index < 2) {
      const defaultColors = ['#3b82f6', '#ef4444']; // Blue for first, Red for second
      color = defaultColors[index];
    }
    
    uniqueMuscleColors.set(muscleName, color);
  });

  // Custom legend formatter to include MVC threshold and deduplicate muscle entries
  const renderLegend = (props: any) => {
    // Instead of using the payload directly, we'll create our own based on unique muscles
    const uniqueLegendItems = Array.from(uniqueMuscleColors.entries()).map(([muscleName, color]) => ({
      value: muscleName,
      color: color,
      type: 'line'
    }));
    
    return (
      <div className="recharts-default-legend" style={{ padding: '0 10px' }}>
        <ul className="flex flex-wrap items-center gap-x-6">
          {uniqueLegendItems.map((entry, index) => (
            <li key={`item-${index}`} className="flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-2" 
                style={{ backgroundColor: entry.color }}
              />
              <span>{`${entry.value} ${plotMode === 'raw' ? 'Raw' : 'Activated'}`}</span>
            </li>
          ))}
          {mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
            <li className="flex items-center">
              <span 
                className="inline-block w-6 h-0 mr-2 border-t-2 border-dashed" 
                style={{ borderColor: '#dc2626' }}
              />
              <span style={{ color: '#dc2626' }}>MVC Threshold ({mvcThresholdForPlot.toExponential(3)} mV)</span>
            </li>
          )}
        </ul>
      </div>
    );
  };

  // Determine Y-axis domain if MVC threshold is present to ensure it's visible
  let yDomain: [number | 'auto', number | 'auto'] = ['auto', 'auto'];
  if (mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined) {
    // Find min/max of actual data to ensure threshold is within reasonable view
    let dataMin = Infinity;
    let dataMax = -Infinity;
    chartData.forEach(point => {
      displayChannels.forEach(channel => {
        if (point[channel] !== undefined) {
          dataMin = Math.min(dataMin, point[channel]!);
          dataMax = Math.max(dataMax, point[channel]!);
        }
      });
    });
    if (dataMin !== Infinity && dataMax !== -Infinity) {
      yDomain = [
        Math.min(dataMin, mvcThresholdForPlot * 0.8), // ensure threshold isn't at the very bottom
        Math.max(dataMax, mvcThresholdForPlot * 1.2)  // ensure threshold isn't at the very top
      ];
    } else { // If no data, but threshold exists
      yDomain = [mvcThresholdForPlot * 0.8, mvcThresholdForPlot * 1.2];
    }
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
          {finalDisplayDataKeys.map((dataKey, index) => {
            // Find the base channel name (without activated/Raw suffix)
            const baseChannelName = displayChannels.find(ch => dataKey.startsWith(ch)) || dataKey;
            const muscleName = channel_muscle_mapping[baseChannelName] || baseChannelName;
            const colorStyle = getColorForChannel(baseChannelName, channel_muscle_mapping, muscle_color_mapping);
            
            // Use the same color logic as above for consistency
            let color = colorStyle.stroke;
            if (!muscle_color_mapping[muscleName] && index < 2) {
              const defaultColors = ['#3b82f6', '#ef4444']; // Blue for first, Red for second
              color = defaultColors[index];
            }
            
            return (
              <Line 
                key={dataKey}
                type="monotone" 
                dataKey={dataKey} 
                name={dataKey} 
                stroke={color} 
                dot={false} 
                isAnimationActive={false} 
                strokeWidth={2.5}
              />
            );
          })}

          {/* MVC Threshold Line */}
          {mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
            <ReferenceLine 
              y={mvcThresholdForPlot} 
              stroke="#dc2626" // Red color for threshold
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