import React, { memo } from 'react';
import { Badge } from '../ui/badge';
import type { StatsPanelProps as ExternalStatsPanelProps, ChannelAnalyticsData, StatsData, GameSessionParameters } from '../../types/emg';
import MetricCard from '../sessions/metric-card';
import ChannelSelection from './ChannelSelection';
import MuscleNameDisplay from '../MuscleNameDisplay';
import { Progress } from "../ui/progress";

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

const StatsPanel: React.FC<StatsPanelComponentProps> = memo(({ 
  stats, 
  channelAnalytics, 
  selectedChannel, 
  availableChannels = [], 
  onChannelSelect, 
  sessionExpectedContractions,
  isEMGAnalyticsTab = false,
  contractionDurationThreshold = 250, // Default 250ms threshold
  sessionParams
}) => {

  if (!channelAnalytics && !stats) {
    return (
      <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <p className="text-center text-muted-foreground">Select a muscle to view its detailed analytics.</p>
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
    <div className="my-4 p-4 border rounded-lg shadow-sm bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h3 className="text-lg font-semibold text-primary mb-2 sm:mb-0">
          Channel Analytics: {selectedChannel && sessionParams ? (
            <MuscleNameDisplay channelName={selectedChannel} sessionParams={sessionParams} />
          ) : (
            selectedChannel || "Overview"
          )}
        </h3>
        <div className="flex items-center space-x-2">
          <label htmlFor="stats-channel-select" className="text-sm font-medium text-muted-foreground">Analyze Muscle:</label>
          <ChannelSelection 
            id="stats-channel-select"
            availableChannels={availableChannels}
            selectedChannel={selectedChannel ?? null}
            setSelectedChannel={onChannelSelect ?? (() => {})}
            label="Select Channel for Stats"
            sessionParams={sessionParams}
            showChannelNames={true}
          />
        </div>
      </div>
      
      {/* Performance Score Card - Only show in Game Stats tab, not EMG Analytics */}
      {hasPerformanceData && !isEMGAnalyticsTab && (
        <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-3 md:mb-0">
              <h4 className="text-lg font-semibold">Performance Score</h4>
              <p className="text-sm text-muted-foreground">
                Based on {displayAnalytics.good_contraction_count} good contractions out of {sessionExpectedContractions} expected
              </p>
            </div>
            
            {/* Circular progress indicator */}
            <CircularProgress 
              value={performanceScore} 
              label={scoreDetails.label}
              color={scoreDetails.color}
            />
          </div>
          
          {/* Contraction type breakdown if available */}
          {hasContractionTypeData && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-md">
                <h5 className="text-sm font-medium mb-1">Short Contractions (&lt;{contractionDurationThreshold}ms)</h5>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total: {shortContractions}</span>
                  <span className="text-sm text-muted-foreground">Good: {shortGoodContractions}</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md">
                <h5 className="text-sm font-medium mb-1">Long Contractions (≥{contractionDurationThreshold}ms)</h5>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total: {longContractions}</span>
                  <span className="text-sm text-muted-foreground">Good: {longGoodContractions}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* --- Contraction & Signal Metrics --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
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
          />
        )}
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
      </div>

      {/* --- Muscle Fatigue Analysis --- */}
      <div className="p-4 border rounded-lg bg-slate-100/80">
          <h4 className="text-md font-semibold text-teal-600 mb-4">Muscle Fatigue & Signal Characteristics</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               <MetricCard
                  title="RMS"
                  value={displayAnalytics.rms}
                  unit="mV"
                  description="Root Mean Square of the raw signal."
                  precision={1} // Limit to 1 decimal place
                  useScientificNotation={Math.abs(displayAnalytics.rms ?? 0) < 0.001}
                  error={displayAnalytics.errors?.rms}
              />
              <MetricCard
                  title="MAV"
                  value={displayAnalytics.mav}
                  unit="mV"
                  description="Mean Absolute Value of the raw signal."
                  precision={1} // Limit to 1 decimal place
                  useScientificNotation={Math.abs(displayAnalytics.mav ?? 0) < 0.001}
                  error={displayAnalytics.errors?.mav}
              />
              <MetricCard
                  title="MPF"
                  value={displayAnalytics.mpf ?? null}
                  unit="Hz"
                  description="Mean Power Frequency - decreases with fatigue."
                  precision={1} // Limit to 1 decimal place
                  error={displayAnalytics.errors?.mpf}
                  validationStatus="strong-assumption"
              />
              <MetricCard
                  title="MDF"
                  value={displayAnalytics.mdf ?? null}
                  unit="Hz"
                  description="Median Frequency - robust indicator, decreases with fatigue."
                  precision={1} // Limit to 1 decimal place
                  error={displayAnalytics.errors?.mdf}
                  validationStatus="strong-assumption"
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
              />
          </div>
      </div>

    </div>
  );
});

export default StatsPanel; 