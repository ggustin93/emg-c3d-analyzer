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
} from 'recharts';

export interface CombinedChartDataPoint {
  time: number;
  [key: string]: number | undefined; // Allow undefined for dynamic channel data values
}

export interface MultiChannelEMGChartProps {
  chartData: CombinedChartDataPoint[];
  channel1Name: string | null;
  channel2Name: string | null;
  // Add any other specific props needed for styling or interactivity
}

const EMGChart: React.FC<MultiChannelEMGChartProps> = memo(({ chartData, channel1Name, channel2Name }) => {
  if (!chartData || chartData.length === 0) {
    return <p className="text-center text-gray-500 my-4">No data available for chart.</p>;
  }
  return (
    <div className="w-full h-[500px] border border-gray-200 rounded-lg p-4 box-border shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" label={{ value: "Time (s)", position: "bottom" }} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={{ value: "Amplitude", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }} />
          <Tooltip formatter={(value: number, name: string) => [value.toFixed(4), name]} labelFormatter={(label: number) => `Time: ${label.toFixed(3)}s`} />
          <Legend verticalAlign="bottom" layout="horizontal" wrapperStyle={{ paddingTop: '30px',backgroundColor: 'transparent' }} />
          {channel1Name && (
            <Line type="monotone" dataKey={channel1Name} name={channel1Name} stroke="#8884d8" dot={false} isAnimationActive={false}/>
          )}
          {channel2Name && (
            <Line type="monotone" dataKey={channel2Name} name={channel2Name} stroke="#82ca9d" dot={false} isAnimationActive={false}/>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default EMGChart; 