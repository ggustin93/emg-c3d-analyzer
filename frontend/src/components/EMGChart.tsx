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
}

const EMGChart: React.FC<MultiChannelEMGChartProps> = memo(({ 
  chartData, 
  channel1Name, 
  channel2Name,
  mvcThresholdForPlot 
}) => {
  if (!chartData || chartData.length === 0) {
    return <p className="text-center text-gray-500 my-4">No data available for chart.</p>;
  }

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
            label={{ value: "Amplitude", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
            domain={yDomain} // Apply dynamic domain
          />
          <Tooltip formatter={(value: number, name: string) => [value.toFixed(4), name]} labelFormatter={(label: number) => `Time: ${label.toFixed(3)}s`} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ top: -5, right: 0, backgroundColor: 'transparent' }} />
          
          {channel1Name && (
            <Line type="monotone" dataKey={channel1Name} name={channel1Name} stroke="#8884d8" dot={false} isAnimationActive={false} strokeWidth={1.5}/>
          )}
          {channel2Name && (
            <Line type="monotone" dataKey={channel2Name} name={channel2Name} stroke="#82ca9d" dot={false} isAnimationActive={false} strokeWidth={1.5}/>
          )}

          {/* MVC Threshold Line */}
          {mvcThresholdForPlot !== null && mvcThresholdForPlot !== undefined && (
            <ReferenceLine 
              y={mvcThresholdForPlot} 
              label={{ value: `MVC Threshold (${mvcThresholdForPlot.toFixed(3)})`, position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} 
              stroke="#dc2626" // Red color for threshold
              strokeDasharray="3 3" 
              strokeWidth={1.5}
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