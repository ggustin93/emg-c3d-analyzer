import React from 'react';
import { ChannelAnalyticsData, GameSessionParameters } from "@/types/emg";
import MuscleNameDisplay from '@/components/shared/MuscleNameDisplay';
import { formatMetricValue } from '@/lib/formatters';
import { getChannelColor, getMuscleColor } from '@/lib/unifiedColorSystem';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface MuscleComparisonTableProps {
  channelsData: Record<string, ChannelAnalyticsData | null>;
  availableChannels: string[];
  sessionParams?: GameSessionParameters;
  expertTooltips: Record<string, string>;
}

// Define metric type with optional standard deviation key
interface MetricDefinition {
  label: string;
  unit: string;
  precision: number;
  scientific?: boolean;
  avg: (data: ChannelAnalyticsData | null | undefined) => number | null | undefined;
  std?: (data: ChannelAnalyticsData | null | undefined) => number | null | undefined;
}

// Format value with appropriate units and scientific notation, handles std dev
const formatValue = (
  avg: number | null | undefined,
  std: number | null | undefined,
  unit: string,
  useScientific: boolean = false,
  precision: number = 1,
) => {
  if (avg === null || avg === undefined || isNaN(avg)) {
    return '—';
  }

  const formattedAvg = formatMetricValue(avg, {
    precision,
    useScientificNotation: useScientific || (avg !== 0 && Math.abs(avg) < 0.001),
  });

  if (std === null || std === undefined || isNaN(std)) {
    return `${formattedAvg} ${unit}`;
  }

  const formattedStd = formatMetricValue(std, {
    precision,
    useScientificNotation: useScientific || (std !== 0 && Math.abs(std) < 0.001),
  });

  return `${formattedAvg} ± ${formattedStd} ${unit}`;
};

const MuscleComparisonTable: React.FC<MuscleComparisonTableProps> = ({
  channelsData,
  availableChannels,
  sessionParams,
  expertTooltips
}) => {
  // Filter to only include channels that have data
  const channelsWithData = availableChannels.filter(channel => 
    channelsData && typeof channelsData === 'object' && 
    Object.keys(channelsData).includes(channel) && 
    channelsData[channel] !== null
  );
  
  // Show table even if we only have data for some channels
  if (availableChannels.length === 0 || channelsWithData.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No data available for comparison.
      </div>
    );
  }

  // Map metric groups to tooltip keys
  const groupTooltipKeys: Record<string, string> = {
    'Contraction Metrics': 'contractionQuantity',
    'Duration Metrics': 'durationMetrics',
    'Amplitude Metrics': 'amplitudeMetrics',
    'Fatigue Metrics': 'fatigueMetrics'
  };

  // Per-metric tooltips (full names and definitions)
  const metricTooltips: Record<string, string> = {
    'Total Contractions': 'Total number of detected contractions.',
    'Good Contractions': 'Contractions meeting BOTH MVC (intensity) and duration thresholds.',
    'Time Under Tension': 'Total time spent in contraction across all events (ms).',
    'Avg Duration': 'Average contraction duration (ms).',
    'Max Duration': 'Longest contraction duration (ms).',
    'Min Duration': 'Shortest contraction duration (ms).',
    'Avg Amplitude': 'Average rectified EMG amplitude over detected contractions (mV).',
    'Max Amplitude': 'Maximum EMG amplitude observed (mV).',
    'RMS': 'Root Mean Square (RMS): measure of EMG power; correlates with activation intensity.',
    'MAV': 'Mean Absolute Value (MAV): average rectified amplitude; robust intensity measure.',
    'MPF': 'Mean Power Frequency (MPF): average frequency of EMG spectrum; decreases with fatigue.',
    'MDF': 'Median Frequency (MDF): frequency dividing spectrum into equal power halves; robust fatigue marker.',
    'Fatigue Index': "Dimitrov's FI_nsm5: ratio of spectral moments; increases with fatigue.",
  };

  // Define the metrics we want to compare, now with std_keys
  const metricGroups = [
    {
      title: 'Contraction Metrics',
      metrics: [
        { label: 'Total Contractions', unit: '', precision: 0, scientific: false, avg: (d) => d?.contraction_count },
        { label: 'Good Contractions', unit: '', precision: 0, scientific: false, avg: (d) => d?.good_contraction_count ?? null },
        { label: 'Time Under Tension', unit: 'ms', precision: 0, scientific: false, avg: (d) => d?.total_time_under_tension_ms },
      ] as MetricDefinition[]
    },
    {
      title: 'Duration Metrics',
      metrics: [
        { label: 'Avg Duration', unit: 'ms', precision: 1, scientific: false, avg: (d) => d?.avg_duration_ms },
        { label: 'Max Duration', unit: 'ms', precision: 1, scientific: false, avg: (d) => d?.max_duration_ms },
        { label: 'Min Duration', unit: 'ms', precision: 1, scientific: false, avg: (d) => d?.min_duration_ms },
      ] as MetricDefinition[]
    },
    {
      title: 'Amplitude Metrics',
      metrics: [
        { label: 'Avg Amplitude', unit: 'mV', precision: 1, scientific: true, avg: (d) => d?.avg_amplitude },
        { label: 'Max Amplitude', unit: 'mV', precision: 1, scientific: true, avg: (d) => d?.max_amplitude },
        { label: 'RMS', unit: 'mV', precision: 1, scientific: true, avg: (d) => (d as any)?.rms_temporal_stats?.mean_value ?? d?.rms, std: (d) => (d as any)?.rms_temporal_stats?.std_value ?? null },
        { label: 'MAV', unit: 'mV', precision: 1, scientific: true, avg: (d) => (d as any)?.mav_temporal_stats?.mean_value ?? d?.mav, std: (d) => (d as any)?.mav_temporal_stats?.std_value ?? null },
      ] as MetricDefinition[]
    },
    {
      title: 'Fatigue Metrics',
      metrics: [
        { label: 'MPF', unit: 'Hz', precision: 1, scientific: false, avg: (d) => (d as any)?.mpf_temporal_stats?.mean_value ?? d?.mpf ?? null, std: (d) => (d as any)?.mpf_temporal_stats?.std_value ?? null },
        { label: 'MDF', unit: 'Hz', precision: 1, scientific: false, avg: (d) => (d as any)?.mdf_temporal_stats?.mean_value ?? d?.mdf ?? null, std: (d) => (d as any)?.mdf_temporal_stats?.std_value ?? null },
        { label: 'Fatigue Index', unit: '', precision: 2, scientific: true, avg: (d) => (d as any)?.fatigue_index_temporal_stats?.mean_value ?? d?.fatigue_index_fi_nsm5 ?? null, std: (d) => (d as any)?.fatigue_index_temporal_stats?.std_value ?? null },
      ] as MetricDefinition[]
    }
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Metric
            </th>
            {channelsWithData.map((channel) => {
              // Get color based on muscle mapping or channel index
              const baseChannelName = channel.replace(/ (Raw|activated|Processed)$/, '');
              const muscleName = sessionParams?.channel_muscle_mapping?.[baseChannelName];
              const colorStyle = muscleName 
                ? getMuscleColor(muscleName, sessionParams?.muscle_color_mapping)
                : getChannelColor(parseInt(baseChannelName.replace('CH', '')) - 1);
              return (
                <th 
                  key={channel} 
                  scope="col" 
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${colorStyle.text}`}
                >
                  {sessionParams ? (
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${colorStyle.border.replace('border', 'bg')}`}></div>
                      <MuscleNameDisplay 
                        channelName={channel} 
                        sessionParams={sessionParams} 
                        showChannelName={true} 
                      />
                    </div>
                  ) : (
                    channel
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {metricGroups.map((group) => (
            <React.Fragment key={group.title}>
              <tr className="bg-slate-100">
                <td 
                  colSpan={channelsWithData.length + 1} 
                  className="px-4 py-2 text-sm font-semibold text-slate-900 border-t-2 border-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span>{group.title}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="ml-1.5 text-teal-500 hover:text-teal-700 focus:outline-none">
                              <InfoCircledIcon className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                            <p>{expertTooltips[groupTooltipKeys[group.title]]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div />
                  </div>
                </td>
              </tr>
              {group.metrics.map((metric, idx) => (
                <tr key={`${group.title}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    <div className="flex items-center gap-1">
                      <span>{metric.label}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-slate-400 hover:text-slate-600 focus:outline-none">
                              <InfoCircledIcon className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs p-3 text-xs bg-amber-50 border border-amber-100 shadow-md rounded-md">
                            <p>{metricTooltips[metric.label] || 'Metric description'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {metric.std && <span className="text-xs text-muted-foreground ml-1">(avg ± std)</span>}
                    </div>
                  </td>
                  {channelsWithData.map((channel) => {
                    const data = channelsData[channel];
                    const avg_value = metric.avg(data);
                    const std_value = metric.std ? metric.std(data) : null;
                    // Get color based on muscle mapping or channel index
                    const baseChannelName = channel.replace(/ (Raw|activated|Processed)$/, '');
                    const muscleName = sessionParams?.channel_muscle_mapping?.[baseChannelName];
                    const colorStyle = muscleName 
                      ? getMuscleColor(muscleName, sessionParams?.muscle_color_mapping)
                      : getChannelColor(parseInt(baseChannelName.replace('CH', '')) - 1);
                    
                    return (
                      <td 
                        key={`${channel}-${group.title}-${idx}`} 
                        className={`px-4 py-3 text-sm ${colorStyle.text}`}
                      >
                        {formatValue(
                          avg_value as number | null | undefined,
                          std_value as number | null | undefined,
                          metric.unit, 
                          metric.scientific, 
                          metric.precision
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MuscleComparisonTable; 