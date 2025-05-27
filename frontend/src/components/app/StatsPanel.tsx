import React, { memo } from 'react';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData } from '../../types/emg'; // Adjust path as needed
import MetricCard from '../sessions/metric-card'; // Added import

// Combine props if StatsPanelProps from emg.ts is just for the 'stats' prop.
interface StatsPanelComponentProps extends ExternalStatsPanelProps {
  channelAnalytics?: ChannelAnalyticsData | null;
  selectedChannel?: string | null;
}

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ stats, channelAnalytics, selectedChannel }) => {
  if (channelAnalytics) {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <h3 className="text-lg font-semibold mb-3 text-primary">Channel Analytics ({selectedChannel || 'N/A'})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </div>
      </div>
    );
  }
  if (!stats) return null;
  return (
    <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
      <h3 className="text-lg font-semibold mb-3 text-primary">Basic Stats ({selectedChannel || 'N/A'})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div className="flex justify-between"><span className="font-medium">Min Value:</span> <span className="text-right">{stats.min}</span></div>
        <div className="flex justify-between"><span className="font-medium">Max Value:</span> <span className="text-right">{stats.max}</span></div>
        <div className="flex justify-between"><span className="font-medium">Average:</span> <span className="text-right">{stats.avg}</span></div>
        <div className="flex justify-between"><span className="font-medium">Duration:</span> <span className="text-right">{stats.duration}s</span></div>
        <div className="flex justify-between"><span className="font-medium">Samples:</span> <span className="text-right">{stats.samples}</span></div>
      </div>
    </div>
  );
});

export default StatsPanel; 