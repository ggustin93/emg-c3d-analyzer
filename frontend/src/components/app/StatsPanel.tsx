import React, { memo } from 'react';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData } from '../../types/emg'; // Adjust path as needed
import MetricCard from '../sessions/metric-card'; // Added import

// Combine props if StatsPanelProps from emg.ts is just for the 'stats' prop.
interface StatsPanelComponentProps extends ExternalStatsPanelProps {
  channelAnalytics?: ChannelAnalyticsData | null;
  selectedChannel?: string | null;
}

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ stats, channelAnalytics, selectedChannel }) => {

  // Section for Channel Specific Advanced Analytics (including placeholders)
  if (channelAnalytics) {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <h3 className="text-lg font-semibold mb-3 text-primary">Channel Analytics ({selectedChannel || 'N/A'})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Contractions"
            value={channelAnalytics.contraction_count}
            unit=""
            isInteger={true}
            description="Total muscle contractions"
          />
          <MetricCard
            title="Avg Duration"
            value={channelAnalytics.avg_duration_ms}
            unit="ms"
            isInteger={true}
            description="Average contraction length"
          />
          <MetricCard
            title="Total Duration"
            value={channelAnalytics.total_duration_ms}
            unit="ms"
            isInteger={true}
            description="Total time contracting"
          />
          <MetricCard
            title="Max Duration"
            value={channelAnalytics.max_duration_ms}
            unit="ms"
            isInteger={true}
            description="Longest contraction"
          />
          <MetricCard
            title="Min Duration"
            value={channelAnalytics.min_duration_ms}
            unit="ms"
            isInteger={true}
            description="Shortest contraction"
          />
          <MetricCard
            title="Avg Amplitude"
            value={channelAnalytics.avg_amplitude}
            unit="mV"
            isInteger={false}
            description="Average signal strength"
            precision={2}
            useScientificNotation={true}
          />
          <MetricCard
            title="Max Amplitude"
            value={channelAnalytics.max_amplitude}
            unit="mV"
            isInteger={false}
            description="Peak signal strength"
            precision={2}
            useScientificNotation={true}
          />
          {/* Placeholder Metrics */}
          <MetricCard
            title="RMS"
            value={NaN} // Placeholder value
            unit="mV"
            isInteger={false}
            description="Root Mean Square (incoming)"
            precision={3}
          />
          <MetricCard
            title="MAV"
            value={NaN} // Placeholder value
            unit="mV"
            isInteger={false}
            description="Mean Absolute Value (incoming)"
            precision={3}
          />
          <MetricCard
            title="MPF"
            value={NaN} // Placeholder value
            unit="Hz"
            isInteger={false}
            description="Mean Power Frequency (incoming)"
            precision={1}
          />
          <MetricCard
            title="MDF"
            value={NaN} // Placeholder value
            unit="Hz"
            isInteger={false}
            description="Median Frequency (incoming)"
            precision={1}
          />
          <MetricCard
            title="Fatigue Index (FI)"
            value={NaN} // Placeholder value
            unit="" // Or a specific ratio unit if applicable
            isInteger={false}
            description="Dimitrov's Index (FI_nsm5) (incoming)"
            precision={3}
          />
        </div>
      </div>
    );
  }

  // Section for Basic Raw Signal Stats (if no channelAnalytics)
  if (stats) {
    // Attempt to parse stats values, provide defaults if parsing fails or invalid
    const minValue = parseFloat(stats.min);
    const maxValue = parseFloat(stats.max);
    const avgValue = parseFloat(stats.avg);
    const durationValue = parseFloat(stats.duration);
    
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <h3 className="text-lg font-semibold mb-3 text-primary">Raw Signal Overview ({selectedChannel || 'N/A'})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Min Value"
            value={isNaN(minValue) ? 0 : minValue}
            unit="mV"
            description="Lowest signal point"
            precision={3}
            useScientificNotation={true}
          />
          <MetricCard
            title="Max Value"
            value={isNaN(maxValue) ? 0 : maxValue}
            unit="mV"
            description="Highest signal point"
            precision={3}
            useScientificNotation={true}
          />
          <MetricCard
            title="Average"
            value={isNaN(avgValue) ? 0 : avgValue}
            unit="mV"
            description="Average signal value"
            precision={3}
            useScientificNotation={true}
          />
          <MetricCard
            title="Duration"
            value={isNaN(durationValue) ? 0 : durationValue}
            unit="s"
            description="Total signal duration"
            precision={2}
          />
          <MetricCard
            title="Samples"
            value={stats.samples} // Assuming samples is always a number
            unit=""
            isInteger={true}
            description="Number of data points"
          />
        </div>
      </div>
    );
  }
  
  return null; // If neither stats nor channelAnalytics is available
});

export default StatsPanel; 