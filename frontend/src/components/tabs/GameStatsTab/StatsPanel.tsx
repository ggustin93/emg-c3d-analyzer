import React, { memo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData, GameSessionParameters } from "@/types/emg";
import MetricCard from '../shared/metric-card';
import MuscleNameDisplay from '@/components/shared/MuscleNameDisplay';
import MuscleComparisonTable from './MuscleComparisonTable';
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import ChannelFilter, { FilterMode } from '@/components/shared/ChannelFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMetricValue } from '@/lib/formatters';
import { computeAcceptanceRates } from '@/lib/acceptanceRates';
import RadialProgress from '@/components/ui/radial-progress';
import DonutGauge from '@/components/ui/donut-gauge';

// Visual constants for donut gauges
const DONUT_SIZE = 128;
const DONUT_THICKNESS = 7;
// Neutral color for Duration Metrics donuts (Tailwind gray-500)
const DURATION_DONUT_COLOR = '#6b7280';

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
  isLoading: boolean;
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
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
  
  goodContractions: "Contractions that exceed the muscle-specific Minimum Voluntary Contraction (MVC) threshold, indicating sufficient recruitment of motor units to achieve functional movement patterns. Each muscle can have its own MVC threshold to account for anatomical differences in muscle size, fiber composition, and electrode placement.",
  
  durationMetrics: "Temporal parameters of muscle activation provide insight into motor control strategies. Duration metrics reflect the ability to sustain motor unit recruitment and are indicative of both neural drive sustainability and muscle fiber composition (Type I vs Type II).",
  
  amplitudeMetrics: "Signal amplitude correlates with force production capacity, reflecting the number of recruited motor units and their firing rates. Higher amplitudes typically indicate greater force generation capability and improved neuromuscular efficiency.",
  
  fatigueMetrics: "Spectral and temporal domain metrics that quantify neuromuscular fatigue. As fatigue develops, characteristic shifts occur in the EMG power spectrum toward lower frequencies due to decreased muscle fiber conduction velocity and synchronization of motor unit firing patterns.",
  
  rms: "Root Mean Square quantifies the mean power of the EMG signal. It correlates with the number of active motor units and their firing rates, providing a reliable measure of muscle activation intensity.",
  
  mav: "Mean Absolute Value represents the average rectified EMG amplitude, indicating the overall muscle activation level. It's particularly useful for assessing sustained contractions and comparing relative effort levels.",
  
  mpf: "Mean Power Frequency represents the average frequency of the power spectrum. Decreases in MPF during sustained contractions indicate fatigue due to reduced muscle fiber conduction velocity and altered motor unit recruitment patterns.",
  
  mdf: "Median Frequency divides the power spectrum into equal energy halves. More robust to noise than MPF, its decline rate during sustained contractions correlates with muscle fiber type composition and fatigue resistance.",
  
  fatigueIndex: "Dimitrov's Fatigue Index (FI_nsm5) is a sensitive spectral parameter that increases exponentially with fatigue development. It's calculated as the ratio of low to high frequency power and is particularly sensitive to early-stage fatigue."
};

// removed local CircularProgress in favor of shared RadialProgress

// New MetricTooltip component to fix the error
const MetricTooltip: React.FC<{ tooltip: string | undefined }> = ({ tooltip }) => {
  if (!tooltip) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="ml-1.5 text-teal-500 hover:text-teal-700 focus:outline-none">
            <InfoCircledIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const formatValue = (
  avg: number | null | undefined,
  std: number | null | undefined,
  unit: string = '',
  options: { precision?: number; useScientificNotation?: boolean } = {},
) => {
  if (avg === null || avg === undefined || isNaN(avg)) {
    return '—';
  }

  const formattedAvg = formatMetricValue(avg, {
    precision: options.precision ?? 2,
    useScientificNotation: options.useScientificNotation || (avg !== 0 && Math.abs(avg) < 0.001),
  });

  if (std === null || std === undefined || isNaN(std)) {
    return `${formattedAvg} ${unit}`;
  }

  const formattedStd = formatMetricValue(std, {
    precision: options.precision ?? 2,
    useScientificNotation: options.useScientificNotation || (std !== 0 && Math.abs(std) < 0.001),
  });

  return `${formattedAvg} ± ${formattedStd} ${unit}`;
};

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ 
  stats, 
  channelAnalytics, 
  selectedChannel = null, 
  availableChannels = [], 
  onChannelSelect, 
  sessionExpectedContractions,
  isEMGAnalyticsTab = false,
  contractionDurationThreshold = 2000, // Default 2000ms threshold (clinical standard)
  sessionParams,
  allChannelsData = {},
  viewMode,
  onFilterChange,
  isInitializingComparison = false,
  isLoading,
  plotMode,
  setPlotMode
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
  const displayAllChannelsData = allChannelsData && typeof allChannelsData === 'object' && Object.keys(allChannelsData).length > 0 
    ? allChannelsData 
    : localAllChannelsData;

  // SINGLE SOURCE OF TRUTH: Compute acceptance rates using backend analytics
  const acceptanceRates = React.useMemo(() => {
    let analyticsForSoT: Record<string, ChannelAnalyticsData> | null = null;
    
    if (viewMode === 'single' && channelAnalytics && selectedChannel) {
      analyticsForSoT = { [selectedChannel]: channelAnalytics };
    } else {
      // Filter out null values for the SoT calculation
      const filteredData: Record<string, ChannelAnalyticsData> = {};
      Object.entries(displayAllChannelsData).forEach(([key, value]) => {
        if (value !== null) {
          filteredData[key] = value;
        }
      });
      analyticsForSoT = Object.keys(filteredData).length > 0 ? filteredData : null;
    }
    
    return computeAcceptanceRates(analyticsForSoT);
  }, [channelAnalytics, selectedChannel, displayAllChannelsData, viewMode]);

  // Unified display value for duration threshold (Backend SoT > prop > default)
  const durationThresholdMs = (acceptanceRates.durationThreshold ?? contractionDurationThreshold ?? 2000);

  // Check if we have enough data to display in comparison mode
  const hasEnoughDataForComparison = viewMode === 'comparison' && 
    availableChannels.length > 0 &&
    availableChannels.every(channel => displayAllChannelsData[channel] !== undefined);

  if (isInitializingComparison || isLoading || (viewMode === 'comparison' && !hasEnoughDataForComparison)) {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <p className="text-center text-muted-foreground">
          {isLoading
            ? "Loading analytics data..."
            : isInitializingComparison || !hasEnoughDataForComparison
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
            plotMode={plotMode}
            setPlotMode={setPlotMode}
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
            plotMode={plotMode}
            setPlotMode={setPlotMode}
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

  // SINGLE SOURCE OF TRUTH: Use backend flags for contraction categorization
  let shortContractions = 0;
  let longContractions = 0;
  let shortGoodContractions = 0;
  let longGoodContractions = 0;

  if (displayAnalytics.contractions && Array.isArray(displayAnalytics.contractions)) {
    displayAnalytics.contractions.forEach(contraction => {
      if (contraction.duration_ms < contractionDurationThreshold) {
        shortContractions++;
        // TRUST backend is_good flag, never re-derive
        if (contraction.is_good === true) shortGoodContractions++;
      } else {
        longContractions++;
        // TRUST backend is_good flag, never re-derive
        if (contraction.is_good === true) longGoodContractions++;
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
              {/* WIP banner removed now that temporal stats are implemented */}

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
                  <h4 className="font-semibold text-md mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <span>Contraction Quantity & Quality</span>
                      <MetricTooltip tooltip={expertTooltips.contractionQuantity} />
                    </div>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      title="Total"
                      value={displayAnalytics.contraction_count}
                      unit=""
                      isInteger={true}
                      description="Total muscle contractions detected based on signal amplitude and duration criteria."
                      error={displayAnalytics.errors?.contractions}
                      variant="primary"
                    />
                    {/* SINGLE SOURCE OF TRUTH: Good Rate using backend flags */}
                    {acceptanceRates.total > 0 && (
                      (() => {
                        const rate = Math.round(acceptanceRates.goodPct);
                        const valueClass = rate >= 70
                          ? 'text-emerald-600'
                          : rate >= 40
                            ? 'text-amber-600'
                            : 'text-red-600';
                        return (
                          <Card className="relative flex flex-col justify-between h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center">
                                <CardTitle className="text-sm font-semibold">Good Rate</CardTitle>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                                      <InfoCircledIcon className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                                    <p>Percent of contractions meeting both MVC and duration criteria (backend SoT).</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center py-5">
                              <DonutGauge
                                percent={rate}
                                size={DONUT_SIZE}
                                thickness={DONUT_THICKNESS}
                                colorHex={valueClass.includes('emerald') ? '#059669' : valueClass.includes('amber') ? '#d97706' : '#dc2626'}
                                centerRender={(p) => (
                                  <div className="text-center">
                                    <div className={`text-2xl font-bold ${valueClass}`}>{p}%</div>
                                    <div className="text-xs text-muted-foreground">{`${acceptanceRates.good} of ${acceptanceRates.total}`}</div>
                                  </div>
                                )}
                              />
                            </CardContent>
                          </Card>
                        );
                      })()
                    )}

                    {/* NEW: MVC Acceptance Rate */}
                    {acceptanceRates.mvcTotal > 0 && (
                      (() => {
                        const rate = Math.round(acceptanceRates.mvcPct);
                        const valueClass = rate >= 70
                          ? 'text-emerald-600'
                          : rate >= 40
                            ? 'text-amber-600'
                            : 'text-red-600';
                        const thresholdText = acceptanceRates.mvcThreshold 
                          ? `≥${acceptanceRates.mvcThreshold.toFixed(3)}mV`
                          : 'threshold TBD';
                        return (
                          <Card className="relative flex flex-col justify-between h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center">
                                <CardTitle className="text-sm font-medium">MVC Acceptance</CardTitle>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                                      <InfoCircledIcon className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                                    <p>{`Contractions meeting the MVC amplitude threshold (${thresholdText}). Backend mvc75_threshold is authoritative.`}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {acceptanceRates.mvcThreshold != null ? `≥${(acceptanceRates.mvcThreshold * 1000).toFixed(3)}mV` : 'Threshold: TBD'}
                              </div>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center py-5">
                              <DonutGauge
                                percent={rate}
                                size={DONUT_SIZE}
                                thickness={DONUT_THICKNESS}
                                colorHex={valueClass.includes('emerald') ? '#059669' : valueClass.includes('amber') ? '#d97706' : '#dc2626'}
                                centerRender={(p) => (
                                  <div className="text-center">
                                    <div className={`text-2xl font-bold ${valueClass}`}>{p}%</div>
                                    <div className="text-xs text-muted-foreground">{`${acceptanceRates.mvc} of ${acceptanceRates.mvcTotal}`}</div>
                                  </div>
                                )}
                              />
                            </CardContent>
                          </Card>
                        );
                      })()
                    )}

                    {/* NEW: Duration Acceptance Rate */}
                    {acceptanceRates.durationTotal > 0 && (
                      (() => {
                        const rate = Math.round(acceptanceRates.durationPct);
                        const valueClass = rate >= 70
                          ? 'text-emerald-600'
                          : rate >= 40
                            ? 'text-amber-600'
                            : 'text-red-600';
                        const thresholdText = acceptanceRates.durationThreshold 
                          ? `≥${acceptanceRates.durationThreshold}ms`
                          : 'threshold TBD';
                        return (
                          <Card className="relative flex flex-col justify-between h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <div className="flex items-center">
                                <CardTitle className="text-sm font-medium">Duration Acceptance</CardTitle>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                                      <InfoCircledIcon className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                                    <p>{`Contractions meeting the duration threshold (${thresholdText}). Backend duration_threshold_actual_value is authoritative.`}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="text-xs text-muted-foreground">{`Duration ≥${Math.round(durationThresholdMs)} ms`}</div>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center py-5">
                              <DonutGauge
                                percent={rate}
                                size={DONUT_SIZE}
                                thickness={DONUT_THICKNESS}
                                colorHex={valueClass.includes('emerald') ? '#059669' : valueClass.includes('amber') ? '#d97706' : '#dc2626'}
                                centerRender={(p) => (
                                  <div className="text-center">
                                    <div className={`text-2xl font-bold ${valueClass}`}>{p}%</div>
                                    <div className="text-xs text-muted-foreground">{`${acceptanceRates.duration} of ${acceptanceRates.durationTotal}`}</div>
                                  </div>
                                )}
                              />
                            </CardContent>
                          </Card>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* --- Duration Metrics --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold text-md mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <span>Duration Metrics</span>
                      <MetricTooltip tooltip={expertTooltips.durationMetrics} />
                    </div>
                    {(() => {
                      const thrText = `${(Number(durationThresholdMs) / 1000).toFixed(1)} s`;
                      return <div className="text-xs text-muted-foreground">{`Duration threshold: ≥${thrText}`}</div>;
                    })()}
                  </h4>
                  {(() => {
                    // Use unified threshold value so gauge scaling and legend are based on duration threshold
                    const thresholdMs = durationThresholdMs;

                    const computePercents = (val: number) => {
                      if (!Number.isFinite(val) || !Number.isFinite(thresholdMs) || thresholdMs <= 0) {
                        return { raw: 0, clamped: 0 };
                      }
                      const raw = Math.round((val / thresholdMs) * 100);
                      const clamped = Math.max(0, Math.min(100, raw));
                      return { raw, clamped };
                    };

                    const renderProgressCard = (title: string, valueMs: number, precision: number = 1) => (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">{title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center py-5">
                          {(() => {
                            const { raw, clamped } = computePercents(valueMs);
                            const valueSecsText = `${(Number(valueMs) / 1000).toFixed(2)} s`;
                            const thrText = `${(Number(thresholdMs) / 1000).toFixed(1)} s`;
                            return (
                              <DonutGauge
                                percent={clamped}
                                size={DONUT_SIZE}
                                thickness={DONUT_THICKNESS}
                                colorHex={DURATION_DONUT_COLOR}
                                centerRender={() => (
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-slate-800">{valueSecsText}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">{raw}% of {thrText}</div>
                                  </div>
                                )}
                              />
                            );
                          })()}
                        </CardContent>
                      </Card>
                    );

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {renderProgressCard('Avg Duration', Number(displayAnalytics.avg_duration_ms), 1)}
                        {(() => {
                          const totalMs = Number(displayAnalytics.total_time_under_tension_ms);
                          const showSeconds = Number.isFinite(totalMs) && totalMs >= 1000;
                          const value = showSeconds ? totalMs / 1000 : totalMs;
                          const unit = showSeconds ? 's' : 'ms';
                          const precision = showSeconds ? 2 : 0;
                          return (
                            <MetricCard
                              title="Total Duration"
                              value={value}
                              unit={unit}
                              description="Total time muscle was contracting."
                              precision={precision}
                              error={displayAnalytics.errors?.contractions}
                            />
                          );
                        })()}
                        {renderProgressCard('Max Duration', Number(displayAnalytics.max_duration_ms), 1)}
                        {renderProgressCard('Min Duration', Number(displayAnalytics.min_duration_ms), 1)}
                      </div>
                    );
                  })()}
                </div>

                {/* --- Amplitude Analysis --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold text-md mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <span>Amplitude Analysis</span>
                      <MetricTooltip tooltip={expertTooltips.amplitudeMetrics} />
                    </div>
                    <div className="flex gap-2" />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      const rmsAvg = (displayAnalytics as any).rms_temporal_stats?.mean_value ?? displayAnalytics.rms
                      const rmsStd = (displayAnalytics as any).rms_temporal_stats?.std_value ?? undefined
                      const mavAvg = (displayAnalytics as any).mav_temporal_stats?.mean_value ?? displayAnalytics.mav
                      const mavStd = (displayAnalytics as any).mav_temporal_stats?.std_value ?? undefined

                      return (
                        <>
                          <MetricCard
                            title="RMS"
                            value={Number(rmsAvg)}
                            unit="mV"
                            description={expertTooltips.rms}
                            precision={2}
                            useScientificNotation
                            subtext={Number.isFinite(rmsStd) ? `± ${formatMetricValue(rmsStd as number, { precision: 2, useScientificNotation: true })} mV` : undefined}
                            variant="secondary"
                            compact
                            size="sm"
                          />
                          <MetricCard
                            title="MAV"
                            value={Number(mavAvg)}
                            unit="mV"
                            description={expertTooltips.mav}
                            precision={2}
                            useScientificNotation
                            subtext={Number.isFinite(mavStd) ? `± ${formatMetricValue(mavStd as number, { precision: 2, useScientificNotation: true })} mV` : undefined}
                            variant="secondary"
                            compact
                            size="sm"
                          />
                          <MetricCard
                            title="Max Amplitude"
                            value={Number(displayAnalytics.max_amplitude as number)}
                            unit="mV"
                            description="Peak signal amplitude during detected contractions."
                            precision={2}
                            useScientificNotation
                            variant="secondary"
                            compact
                            size="sm"
                          />
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* --- Fatigue Analysis --- */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold text-md mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <span>Fatigue Analysis</span>
                      <MetricTooltip tooltip={expertTooltips.fatigueMetrics} />
                    </div>
                    <div className="flex gap-2" />
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      const mpfAvg = (displayAnalytics as any).mpf_temporal_stats?.mean_value ?? displayAnalytics.mpf
                      const mpfStd = (displayAnalytics as any).mpf_temporal_stats?.std_value ?? undefined
                      const mdfAvg = (displayAnalytics as any).mdf_temporal_stats?.mean_value ?? displayAnalytics.mdf
                      const mdfStd = (displayAnalytics as any).mdf_temporal_stats?.std_value ?? undefined
                      const fiAvg = (displayAnalytics as any).fatigue_index_temporal_stats?.mean_value ?? displayAnalytics.fatigue_index_fi_nsm5
                      const fiStd = (displayAnalytics as any).fatigue_index_temporal_stats?.std_value ?? undefined

                      return (
                        <>
                          <MetricCard
                            title="MPF"
                            value={Number(mpfAvg)}
                            unit="Hz"
                            description={expertTooltips.mpf}
                            precision={2}
                            subtext={Number.isFinite(mpfStd) ? `± ${formatMetricValue(mpfStd as number, { precision: 2 })} Hz` : undefined}
                            variant="secondary"
                            compact
                            size="sm"
                          />
                          <MetricCard
                            title="MDF"
                            value={Number(mdfAvg)}
                            unit="Hz"
                            description={expertTooltips.mdf}
                            precision={2}
                            subtext={Number.isFinite(mdfStd) ? `± ${formatMetricValue(mdfStd as number, { precision: 2 })} Hz` : undefined}
                            variant="secondary"
                            compact
                            size="sm"
                          />
                          <MetricCard
                            title="Fatigue Index (FI)"
                            value={Number(fiAvg)}
                            unit=""
                            description={expertTooltips.fatigueIndex}
                            precision={2}
                            useScientificNotation
                            subtext={Number.isFinite(fiStd) ? `± ${formatMetricValue(fiStd as number, { precision: 2, useScientificNotation: true })}` : undefined}
                            variant="secondary"
                            compact
                            size="sm"
                          />
                        </>
                      )
                    })()}
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