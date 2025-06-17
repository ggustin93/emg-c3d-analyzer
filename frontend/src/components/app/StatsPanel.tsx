import React, { memo, useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData, GameSessionParameters } from '../../types/emg';
import MetricCard from '../sessions/metric-card';
import MuscleNameDisplay from '../MuscleNameDisplay';
import MuscleComparisonTable from './MuscleComparisonTable';
import { Progress } from "../ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import ChannelFilter, { FilterMode } from './ChannelFilter';

// Combine props if StatsPanelProps from emg.ts is just for the 'stats' prop.
interface StatsPanelComponentProps extends ExternalStatsPanelProps {
  channelAnalytics?: ChannelAnalyticsData | null;
  selectedChannel?: string | null;
  availableChannels?: string[];
  onChannelSelect?: (channel: string | null) => void;
  sessionExpectedContractions?: number | null;
  isEMGAnalyticsTab?: boolean;
  contractionDurationThreshold?: number; // ms threshold to distinguish short vs long contractions
  sessionParams?: GameSessionParameters;
  allChannelsData?: Record<string, ChannelAnalyticsData | null>;
  viewMode: FilterMode;
  onFilterChange: (mode: FilterMode, channel?: string) => void;
  isInitializingComparison?: boolean;
}

// Function to calculate performance score based on good contractions vs expected
const calculatePerformanceScore = (goodCount: number, expectedCount: number | null): number => {
  if (!expectedCount || expectedCount <= 0) return 0;
  const ratio = goodCount / expectedCount;
  return Math.min(Math.round(ratio * 100), 100); // Cap at 100%
};

// Function to get score label based on percentage
const getScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: "Excellent", color: "text-green-600" };
  if (score >= 75) return { label: "Good", color: "text-emerald-500" };
  if (score >= 60) return { label: "Satisfactory", color: "text-amber-500" };
  if (score >= 40) return { label: "Needs Improvement", color: "text-orange-500" };
  return { label: "Insufficient", color: "text-red-500" };
};

// Expert tooltips for clinical metrics
const expertTooltips = {
  contractionQuantity: "Quantitative assessment of neuromuscular activation patterns. The total number of contractions indicates overall muscle recruitment frequency, which correlates with motor unit activation thresholds and neural drive efficiency.",
  
  goodContractions: "Contractions that exceed the minimum voluntary contraction (MVC) threshold, indicating sufficient recruitment of motor units to achieve functional movement patterns required for therapeutic goals.",
  
  durationMetrics: "Temporal parameters of muscle activation provide insight into motor control strategies. Duration metrics reflect the ability to sustain motor unit recruitment and are indicative of both neural drive sustainability and muscle fiber composition (Type I vs Type II).",
  
  amplitudeMetrics: "Signal amplitude correlates with force production capacity, reflecting the number of recruited motor units and their firing rates. Higher amplitudes typically indicate greater force generation capability and improved neuromuscular efficiency.",
  
  fatigueMetrics: "Spectral and temporal domain metrics that quantify neuromuscular fatigue. As fatigue develops, characteristic shifts occur in the EMG power spectrum toward lower frequencies due to decreased muscle fiber conduction velocity and synchronization of motor unit firing patterns.",
  
  rms: "Root Mean Square quantifies the mean power of the EMG signal. It correlates with the number of active motor units and their firing rates, providing a reliable measure of muscle activation intensity.",
  
  mav: "Mean Absolute Value represents the average rectified EMG amplitude, indicating the overall muscle activation level. It's particularly useful for assessing sustained contractions and comparing relative effort levels.",
  
  mpf: "Mean Power Frequency represents the average frequency of the power spectrum. Decreases in MPF during sustained contractions indicate fatigue due to reduced muscle fiber conduction velocity and altered motor unit recruitment patterns.",
  
  mdf: "Median Frequency divides the power spectrum into equal energy halves. More robust to noise than MPF, its decline rate during sustained contractions correlates with muscle fiber type composition and fatigue resistance.",
  
  fatigueIndex: "Dimitrov's Fatigue Index (FI_nsm5) is a sensitive spectral parameter that increases exponentially with fatigue development. It's calculated as the ratio of low to high frequency power and is particularly sensitive to early-stage fatigue."
};

const CircularProgress: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => {
  // Calculate the circle's circumference and stroke-dasharray
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        {/* Background circle */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r={radius} 
            fill="transparent" 
            stroke="#e5e7eb" 
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle 
            cx="50" cy="50" r={radius} 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="8" 
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={color}
            transform="rotate(-90 50 50)"
          />
          {/* Percentage text */}
          <text 
            x="50" y="45" 
            textAnchor="middle" 
            fontSize="18" 
            fontWeight="bold"
            fill="currentColor"
          >
            {value}%
          </text>
          <text 
            x="50" y="65" 
            textAnchor="middle" 
            fontSize="12"
            className={color}
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
};

// Section header with tooltip component
const SectionHeader: React.FC<{ title: string; tooltipContent: string }> = ({ title, tooltipContent }) => (
  <div className="flex items-center mb-2">
    <h4 className="text-md font-semibold text-teal-600">{title}</h4>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="ml-1.5 text-teal-500 hover:text-teal-700 focus:outline-none">
          <InfoCircledIcon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  </div>
);

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ 
  stats, 
  channelAnalytics, 
  selectedChannel = null, 
  availableChannels = [], 
  onChannelSelect, 
  sessionExpectedContractions,
  isEMGAnalyticsTab = false,
  contractionDurationThreshold = 250, // Default 250ms threshold
  sessionParams,
  allChannelsData = {},
  viewMode,
  onFilterChange,
  isInitializingComparison = false
}) => {
  // const [viewMode, setViewMode] = useState<FilterMode>('single'); // State is now lifted
  
  // Initialize allChannelsData if not provided
  const [localAllChannelsData, setLocalAllChannelsData] = useState<Record<string, ChannelAnalyticsData | null>>({});
  
  // Update local data by merging incoming props
  useEffect(() => {
    setLocalAllChannelsData(prev => {
      const updatedData = { ...prev };
      
      // Merge data from allChannelsData prop
      if (allChannelsData) {
        Object.assign(updatedData, allChannelsData);
      }
      
      // Merge data for the currently selected single channel
      if (channelAnalytics && selectedChannel) {
        updatedData[selectedChannel] = channelAnalytics;
      }
      
      return updatedData;
    });
  }, [channelAnalytics, selectedChannel, allChannelsData]);
  
  // Use provided allChannelsData if available, otherwise use local state
  const displayAllChannelsData = Object.keys(allChannelsData).length > 0 
    ? allChannelsData 
    : localAllChannelsData;

  // Check if we have enough data to display in comparison mode
  const hasEnoughDataForComparison = viewMode === 'comparison' && 
    availableChannels.length > 0 &&
    availableChannels.every(channel => displayAllChannelsData[channel] !== undefined);

  if (isInitializingComparison || (viewMode === 'comparison' && !hasEnoughDataForComparison)) {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <p className="text-center text-muted-foreground">
          {isInitializingComparison || !hasEnoughDataForComparison
            ? "Initializing comparison data..."
            : "Select channels to compare their analytics."}
        </p>
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
        <div className="mt-4">
          <ChannelFilter 
            availableChannels={availableChannels}
            sessionParams={sessionParams || { channel_muscle_mapping: {}, muscle_color_mapping: {} }}
            activeFilter={{ mode: viewMode, channel: selectedChannel }}
            onFilterChange={onFilterChange}
          />
        </div>
      </div>
    );
  }

  if (!channelAnalytics && !stats && viewMode === 'single') {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <p className="text-center text-muted-foreground">
          Select a muscle to view its detailed analytics.
        </p>
        <div className="mt-4">
          <ChannelFilter 
            availableChannels={availableChannels}
            sessionParams={sessionParams || { channel_muscle_mapping: {}, muscle_color_mapping: {} }}
            activeFilter={{ mode: viewMode, channel: selectedChannel }}
            onFilterChange={onFilterChange}
          />
        </div>
      </div>
    );
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

  // Calculate performance score if we have good contractions and expected contractions
  const hasPerformanceData = 
    displayAnalytics.good_contraction_count !== null && 
    displayAnalytics.good_contraction_count !== undefined && 
    sessionExpectedContractions !== null && 
    sessionExpectedContractions !== undefined;
  
  const performanceScore = hasPerformanceData 
    ? calculatePerformanceScore(displayAnalytics.good_contraction_count!, sessionExpectedContractions!)
    : 0; // Default to 0 instead of null
  
  const scoreDetails = performanceScore > 0 ? getScoreLabel(performanceScore) : getScoreLabel(0);

  /* This handler is now lifted up to the parent
  const handleFilterChange = (mode: FilterMode, channel?: string) => {
    setViewMode(mode);
    if (mode === 'single' && channel && onChannelSelect) {
      onChannelSelect(channel);
    } else if (mode === 'comparison' && onChannelSelect) {
      onChannelSelect(null); // Deselect channel in comparison mode
    }
  };
  */

  const minValue = stats ? stats.min : NaN;
  const maxValue = stats ? stats.max : NaN;

  // Categorize contractions as short or long if available
  let shortContractions = 0;
  let longContractions = 0;
  let shortGoodContractions = 0;
  let longGoodContractions = 0;

  if (displayAnalytics.contractions && Array.isArray(displayAnalytics.contractions)) {
    displayAnalytics.contractions.forEach(contraction => {
      if (contraction.duration_ms < contractionDurationThreshold) {
        shortContractions++;
        if (contraction.is_good) shortGoodContractions++;
      } else {
        longContractions++;
        if (contraction.is_good) longGoodContractions++;
      }
    });
  }

  const hasContractionTypeData = shortContractions > 0 || longContractions > 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div className={viewMode === 'comparison' ? "my-4" : "my-4 p-4 border rounded-lg shadow-sm bg-slate-50"}>
        <div className="flex flex-col mb-4">
          {viewMode === 'comparison' ? (
            <MuscleComparisonTable 
              channelsData={displayAllChannelsData} 
              sessionParams={sessionParams} 
              availableChannels={availableChannels} 
              expertTooltips={expertTooltips}
            />
          ) : (
            <>
              {hasPerformanceData && !isEMGAnalyticsTab && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white rounded-lg shadow">
                  <div className="p-3 bg-slate-50 rounded-md">
                    <h5 className="text-sm font-medium mb-1">Performance Score</h5>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Score: {performanceScore}%</span>
                    </div>
                  </div>
                  {/* Contraction type breakdown if available */}
                  {hasContractionTypeData && (
                    <div className="p-3 bg-slate-50 rounded-md">
                      <h5 className="text-sm font-medium mb-1">Contraction Type Breakdown</h5>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Short Contractions (&lt;{contractionDurationThreshold}ms)</span>
                        <span className="text-sm text-muted-foreground">{shortContractions} ({shortGoodContractions} good)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Long Contractions (≥{contractionDurationThreshold}ms)</span>
                        <span className="text-sm text-muted-foreground">{longContractions} ({longGoodContractions} good)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Reorganized metrics by clinical categories */}
              <div className="space-y-6">
                {/* --- Contraction Quantity & Quality --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <SectionHeader 
                    title="Contraction Quantity & Quality" 
                    tooltipContent={expertTooltips.contractionQuantity} 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MetricCard
                      title="Total Contractions"
                      value={displayAnalytics.contraction_count}
                      unit=""
                      isInteger={true}
                      description="Total muscle contractions detected based on signal amplitude and duration criteria."
                      error={displayAnalytics.errors?.contractions}
                    />
                    {/* Only show Good Contractions in Game Stats tab, not EMG Analytics */}
                    {displayAnalytics.good_contraction_count !== null && 
                     displayAnalytics.good_contraction_count !== undefined && 
                     !isEMGAnalyticsTab && (
                      <MetricCard
                        title="Good Contractions"
                        value={displayAnalytics.good_contraction_count}
                        unit={sessionExpectedContractions !== null ? `/ ${sessionExpectedContractions}` : ""}
                        isInteger={true}
                        description={`Contractions meeting MVC threshold (${(displayAnalytics.mvc_threshold_actual_value ?? 0).toFixed(1)}). Expected: ${sessionExpectedContractions ?? 'N/A'}`}
                        error={displayAnalytics.errors?.contractions}
                        tooltipContent={expertTooltips.goodContractions}
                      />
                    )}
                    {hasContractionTypeData && (
                      <>
                        <MetricCard
                          title={`Short (<${contractionDurationThreshold}ms)`}
                          value={shortContractions}
                          unit={`(${shortGoodContractions} good)`}
                          isInteger
                          description={`Contractions shorter than ${contractionDurationThreshold}ms.`}
                          tooltipContent={`Contractions with a duration less than ${contractionDurationThreshold}ms. These are often brief, phasic muscle activations.`}
                        />
                        <MetricCard
                          title={`Long (≥${contractionDurationThreshold}ms)`}
                          value={longContractions}
                          unit={`(${longGoodContractions} good)`}
                          isInteger
                          description={`Contractions longer than ${contractionDurationThreshold}ms.`}
                          tooltipContent={`Contractions with a duration of ${contractionDurationThreshold}ms or more. These are sustained, tonic muscle activations.`}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* --- Duration Metrics --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <SectionHeader 
                    title="Duration Metrics" 
                    tooltipContent={expertTooltips.durationMetrics} 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      title="Avg Duration"
                      value={displayAnalytics.avg_duration_ms}
                      unit="ms"
                      description="Average contraction length."
                      precision={1} // Limit to 1 decimal place
                      error={displayAnalytics.errors?.contractions}
                    />
                    <MetricCard
                      title="Total Duration"
                      value={displayAnalytics.total_time_under_tension_ms}
                      unit="ms"
                      description="Total time muscle was contracting."
                      precision={0} // No decimal places for total duration
                      error={displayAnalytics.errors?.contractions}
                    />
                    <MetricCard
                      title="Max Duration"
                      value={displayAnalytics.max_duration_ms}
                      unit="ms"
                      description="Longest contraction detected."
                      precision={1} // Limit to 1 decimal place
                      error={displayAnalytics.errors?.contractions}
                    />
                    <MetricCard
                      title="Min Duration"
                      value={displayAnalytics.min_duration_ms}
                      unit="ms"
                      description="Shortest contraction detected."
                      precision={1} // Limit to 1 decimal place
                      error={displayAnalytics.errors?.contractions}
                    />
                  </div>
                </div>

                {/* --- Amplitude & Signal Intensity --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <SectionHeader 
                    title="Amplitude & Signal Intensity" 
                    tooltipContent={expertTooltips.amplitudeMetrics} 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      title="Avg Amplitude"
                      value={displayAnalytics.avg_amplitude}
                      unit="mV"
                      description="Average signal strength during contractions."
                      precision={1} // Limit to 1 decimal place
                      useScientificNotation={Math.abs(displayAnalytics.avg_amplitude ?? 0) < 0.001}
                      error={displayAnalytics.errors?.contractions}
                    />
                    <MetricCard
                      title="Max Amplitude"
                      value={displayAnalytics.max_amplitude}
                      unit="mV"
                      description="Peak signal strength during contractions."
                      precision={1} // Limit to 1 decimal place
                      useScientificNotation={Math.abs(displayAnalytics.max_amplitude ?? 0) < 0.001}
                      error={displayAnalytics.errors?.contractions}
                    />
                    <MetricCard
                      title="RMS"
                      value={displayAnalytics.rms}
                      unit="mV"
                      description="Root Mean Square of the raw signal."
                      precision={1} // Limit to 1 decimal place
                      useScientificNotation={Math.abs(displayAnalytics.rms ?? 0) < 0.001}
                      error={displayAnalytics.errors?.rms}
                      tooltipContent={expertTooltips.rms}
                    />
                    <MetricCard
                      title="MAV"
                      value={displayAnalytics.mav}
                      unit="mV"
                      description="Mean Absolute Value of the raw signal."
                      precision={1} // Limit to 1 decimal place
                      useScientificNotation={Math.abs(displayAnalytics.mav ?? 0) < 0.001}
                      error={displayAnalytics.errors?.mav}
                      tooltipContent={expertTooltips.mav}
                    />
                  </div>
                </div>

                {/* --- Fatigue Analysis --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <SectionHeader 
                    title="Fatigue Analysis" 
                    tooltipContent={expertTooltips.fatigueMetrics} 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MetricCard
                      title="MPF"
                      value={displayAnalytics.mpf ?? null}
                      unit="Hz"
                      description="Mean Power Frequency - decreases with fatigue."
                      precision={1} // Limit to 1 decimal place
                      error={displayAnalytics.errors?.mpf}
                      validationStatus="strong-assumption"
                      tooltipContent={expertTooltips.mpf}
                    />
                    <MetricCard
                      title="MDF"
                      value={displayAnalytics.mdf ?? null}
                      unit="Hz"
                      description="Median Frequency - robust indicator, decreases with fatigue."
                      precision={1} // Limit to 1 decimal place
                      error={displayAnalytics.errors?.mdf}
                      validationStatus="strong-assumption"
                      tooltipContent={expertTooltips.mdf}
                    />
                    <MetricCard
                      title="Fatigue Index (FI)"
                      value={displayAnalytics.fatigue_index_fi_nsm5 ?? null}
                      unit=""
                      description="Dimitrov's Index (FI_nsm5) - increases with fatigue."
                      precision={1} // Limit to 1 decimal place
                      useScientificNotation
                      error={displayAnalytics.errors?.fatigue_index_fi_nsm5}
                      validationStatus="strong-assumption"
                      tooltipContent={expertTooltips.fatigueIndex}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});

export default StatsPanel; 