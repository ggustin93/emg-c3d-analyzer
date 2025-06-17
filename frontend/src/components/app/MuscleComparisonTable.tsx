import React from 'react';
import { ChannelAnalyticsData, GameSessionParameters } from '../../types/emg';
import MuscleNameDisplay from '../MuscleNameDisplay';
import { formatMetricValue } from '../../utils/formatters';
import { getColorForChannel } from '../../lib/colorMappings';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface MuscleComparisonTableProps {
  channelsData: Record<string, ChannelAnalyticsData | null>;
  availableChannels: string[];
  sessionParams?: GameSessionParameters;
  expertTooltips: Record<string, string>;
}

// Define metric type
interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  precision: number;
  scientific?: boolean;
}

// Format value with appropriate units and scientific notation if needed
const formatValue = (value: number | null | undefined, unit: string, useScientific: boolean = false, precision: number = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  const formattedValue = formatMetricValue(value, {
    precision,
    useScientificNotation: useScientific || Math.abs(value) < 0.001
  });
  
  return `${formattedValue} ${unit}`;
};

const MuscleComparisonTable: React.FC<MuscleComparisonTableProps> = ({
  channelsData,
  availableChannels,
  sessionParams,
  expertTooltips
}) => {
  // Filter to only include channels that have data
  const channelsWithData = availableChannels.filter(channel => 
    Object.keys(channelsData).includes(channel) && channelsData[channel] !== null
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

  // Define the metrics we want to compare
  const metricGroups = [
    {
      title: 'Contraction Metrics',
      metrics: [
        { key: 'contraction_count', label: 'Total Contractions', unit: '', precision: 0, scientific: false },
        { key: 'good_contraction_count', label: 'Good Contractions', unit: '', precision: 0, scientific: false },
        { key: 'total_time_under_tension_ms', label: 'Time Under Tension', unit: 'ms', precision: 0, scientific: false },
      ] as MetricDefinition[]
    },
    {
      title: 'Duration Metrics',
      metrics: [
        { key: 'avg_duration_ms', label: 'Avg Duration', unit: 'ms', precision: 1, scientific: false },
        { key: 'max_duration_ms', label: 'Max Duration', unit: 'ms', precision: 1, scientific: false },
        { key: 'min_duration_ms', label: 'Min Duration', unit: 'ms', precision: 1, scientific: false },
      ] as MetricDefinition[]
    },
    {
      title: 'Amplitude Metrics',
      metrics: [
        { key: 'avg_amplitude', label: 'Avg Amplitude', unit: 'mV', precision: 1, scientific: true },
        { key: 'max_amplitude', label: 'Max Amplitude', unit: 'mV', precision: 1, scientific: true },
        { key: 'rms', label: 'RMS', unit: 'mV', precision: 1, scientific: true },
        { key: 'mav', label: 'MAV', unit: 'mV', precision: 1, scientific: true },
      ] as MetricDefinition[]
    },
    {
      title: 'Fatigue Metrics',
      metrics: [
        { key: 'mpf', label: 'Mean Power Freq.', unit: 'Hz', precision: 1, scientific: false },
        { key: 'mdf', label: 'Median Power Freq.', unit: 'Hz', precision: 1, scientific: false },
        { key: 'fatigue_index_fi_nsm5', label: 'Fatigue Index', unit: '', precision: 2, scientific: false },
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
              const colorStyle = getColorForChannel(channel, sessionParams?.channel_muscle_mapping, sessionParams?.muscle_color_mapping);
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
                  <div className="flex items-center">
                    <span>{group.title}</span>
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
                  </div>
                </td>
              </tr>
              {group.metrics.map((metric) => (
                <tr key={metric.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {metric.label}
                  </td>
                  {channelsWithData.map((channel) => {
                    const data = channelsData[channel];
                    const value = data ? data[metric.key as keyof ChannelAnalyticsData] : null;
                    const colorStyle = getColorForChannel(channel, sessionParams?.channel_muscle_mapping, sessionParams?.muscle_color_mapping);
                    
                    return (
                      <td 
                        key={`${channel}-${metric.key}`} 
                        className={`px-4 py-3 text-sm ${colorStyle.text}`}
                      >
                        {formatValue(
                          value as number | null | undefined, 
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