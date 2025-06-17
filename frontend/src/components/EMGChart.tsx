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

export interface CombinedChartDataPoint {
  time: number;
  [key: string]: number | undefined; // Allow undefined for dynamic channel data values
}

export interface MultiChannelEMGChartProps {
  chartData: CombinedChartDataPoint[];
  channel1Name: string | null;
  channel2Name: string | null;
  mvcThresholdForPlot?: number | null; // New prop for MVC threshold
  channel_muscle_mapping?: Record<string, string>; // Add muscle mapping prop
  plotMode?: 'raw' | 'activated'; // Add plot mode prop
}

const EMGChart: React.FC<MultiChannelEMGChartProps> = memo(({ 
  chartData, 
  channel1Name, 
  channel2Name,
  mvcThresholdForPlot,
  channel_muscle_mapping = {}, // Default to empty object
  plotMode = 'activated' // Default to activated
}) => {
  if (!chartData || chartData.length === 0) {
    return <p className="text-center text-gray-500 my-4">No data available for chart.</p>;
  }

  // Get muscle names from mapping or use channel names as fallback
  const getMuscleName = (channelName: string | null): string => {
    if (!channelName) return '';
    
    // Extract the base channel name (CH1, CH2, etc.) without any suffix
    const baseChannelName = channelName.split(' ')[0];
    
    // Get the muscle name from the mapping
    const muscleName = channel_muscle_mapping[baseChannelName] || baseChannelName;
    
    // Append the mode (Raw/Activated) to the muscle name
    return `${muscleName} ${plotMode === 'raw' ? 'Raw' : 'Activated'}`;
  };

  // Custom legend formatter to include MVC threshold
  const renderLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <div className="recharts-default-legend" style={{ padding: '0 10px' }}>
        <ul className="flex flex-wrap items-center gap-x-6">
          {payload.map((entry: any, index: number) => (
            <li key={`item-${index}`} className="flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-2" 
                style={{ backgroundColor: entry.color }}
              />
              <span>{getMuscleName(entry.value)}</span>
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
      if (channel1Name && point[channel1Name] !== undefined) {
        dataMin = Math.min(dataMin, point[channel1Name]!);
        dataMax = Math.max(dataMax, point[channel1Name]!);
      }
      if (channel2Name && point[channel2Name] !== undefined) {
        dataMin = Math.min(dataMin, point[channel2Name]!);
        dataMax = Math.max(dataMax, point[channel2Name]!);
      }
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
          <Tooltip formatter={(value: number, name: string) => [`${value.toExponential(3)} mV`, getMuscleName(name)]} labelFormatter={(label: number) => `Time: ${label.toFixed(3)}s`} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            wrapperStyle={{ top: -5, right: 0, backgroundColor: 'transparent' }} 
            content={renderLegend}
          />
          
          {channel1Name && (
            <Line type="monotone" dataKey={channel1Name} name={channel1Name} stroke="#8884d8" dot={false} isAnimationActive={false} strokeWidth={2.5}/>
          )}
          {channel2Name && (
            <Line type="monotone" dataKey={channel2Name} name={channel2Name} stroke="#82ca9d" dot={false} isAnimationActive={false} strokeWidth={2.5}/>
          )}

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