import React, { memo } from 'react';
import { Badge } from '../ui/badge';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData } from '../../types/emg';
import MetricCard from '../sessions/metric-card';
import ChannelSelection from './ChannelSelection';

// Combine props if StatsPanelProps from emg.ts is just for the 'stats' prop.
interface StatsPanelComponentProps extends ExternalStatsPanelProps {
  channelAnalytics?: ChannelAnalyticsData | null;
  selectedChannel?: string | null;
  availableChannels?: string[];
  onChannelSelect?: (channel: string | null) => void;
}

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ stats, channelAnalytics, selectedChannel, availableChannels = [], onChannelSelect }) => {

  if (!channelAnalytics && !stats) {
    return null; // Return nothing if there is no data at all
  }

  // Use channelAnalytics if available, otherwise create a shell from stats
  const displayAnalytics = channelAnalytics || ({
    contraction_count: NaN,
    avg_duration_ms: NaN,
    total_time_under_tension_ms: NaN,
    max_duration_ms: NaN,
    min_duration_ms: NaN,
    avg_amplitude: NaN,
    max_amplitude: NaN,
    rms: NaN,
    mav: NaN,
    mpf: NaN,
    mdf: NaN,
    fatigue_index_fi_nsm5: NaN,
    errors: {},
  } as ChannelAnalyticsData);

  const minValue = stats ? stats.min : NaN;
  const maxValue = stats ? stats.max : NaN;

  return (
    <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-primary">Channel Analytics</h3>
        <div className="flex items-center space-x-2">
          <label htmlFor="channel-select-stats" className="text-sm font-medium text-muted-foreground">Analyze Muscle:</label>
          <ChannelSelection 
            id="stats-channel-select"
            availableChannels={availableChannels}
            selectedChannel={selectedChannel ?? null}
            setSelectedChannel={onChannelSelect ?? (() => {})}
            label="Select Channel for Stats"
          />
        </div>
      </div>
      
      {/* --- Contraction & Signal Metrics --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Contractions"
          value={displayAnalytics.contraction_count}
          unit=""
          isInteger={true}
          description="Total muscle contractions"
          error={displayAnalytics.errors?.contractions}
        />
        <MetricCard
          title="Avg Duration"
          value={displayAnalytics.avg_duration_ms}
          unit="ms"
          description="Average contraction length"
          precision={2}
          error={displayAnalytics.errors?.contractions}
        />
        <MetricCard
          title="Total Duration"
          value={displayAnalytics.total_time_under_tension_ms}
          unit="ms"
          description="Total time contracting"
          precision={2}
          error={displayAnalytics.errors?.contractions}
        />
         <MetricCard
          title="Max Duration"
          value={displayAnalytics.max_duration_ms}
          unit="ms"
          description="Longest contraction"
          precision={2}
          error={displayAnalytics.errors?.contractions}
        />
        <MetricCard
          title="Min Duration"
          value={displayAnalytics.min_duration_ms}
          unit="ms"
          description="Shortest contraction"
          precision={2}
          error={displayAnalytics.errors?.contractions}
        />
        <MetricCard
          title="Avg Amplitude"
          value={displayAnalytics.avg_amplitude}
          unit="mV"
          description="Average signal strength during contractions"
          precision={2}
          useScientificNotation
          error={displayAnalytics.errors?.contractions}
        />
        <MetricCard
          title="Max Amplitude"
          value={displayAnalytics.max_amplitude}
          unit="mV"
          description="Peak signal strength during contractions"
          precision={2}
          useScientificNotation
          error={displayAnalytics.errors?.contractions}
        />
      </div>

      {/* --- Muscle Fatigue Analysis --- */}
      <div className="p-4 border rounded-lg bg-slate-100/80">
          <div className="flex items-center gap-x-3 mb-4">
              <h4 className="text-md font-semibold text-teal-600">Muscle Fatigue Analysis</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               <MetricCard
                  title="RMS"
                  value={displayAnalytics.rms}
                  unit="mV"
                  description="Root Mean Square - indicator of signal power/amplitude."
                  precision={2}
                  useScientificNotation
                  error={displayAnalytics.errors?.rms}
              />
              <MetricCard
                  title="MAV"
                  value={displayAnalytics.mav}
                  unit="mV"
                  description="Mean Absolute Value - robust indicator of signal amplitude."
                  precision={2}
                  useScientificNotation
                  error={displayAnalytics.errors?.mav}
              />
              <MetricCard
                  title="MPF"
                  value={displayAnalytics.mpf ?? null}
                  unit="Hz"
                  description="Mean Power Frequency - decreases with fatigue."
                  precision={2}
                  error={displayAnalytics.errors?.mpf}
                  validationStatus="strong-assumption"
              />
              <MetricCard
                  title="MDF"
                  value={displayAnalytics.mdf ?? null}
                  unit="Hz"
                  description="Median Frequency - robust indicator, decreases with fatigue."
                  precision={2}
                  error={displayAnalytics.errors?.mdf}
                  validationStatus="strong-assumption"
              />
              <MetricCard
                  title="Fatigue Index (FI)"
                  value={displayAnalytics.fatigue_index_fi_nsm5 ?? null}
                  unit=""
                  description="Dimitrov's Index (FI_nsm5)"
                  precision={2}
                  useScientificNotation
                  error={displayAnalytics.errors?.fatigue_index_fi_nsm5}
                  validationStatus="strong-assumption"
              />
          </div>
      </div>

    </div>
  );
});

export default StatsPanel; 