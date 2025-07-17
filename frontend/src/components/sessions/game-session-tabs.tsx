import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GameSession, EMGMetrics as FrontendEMGMetrics } from '@/types/session';
import { EMGAnalysisResult, ChannelAnalyticsData, StatsData, EMGChannelSignalData, GameSessionParameters } from '../../types/emg';
import { StarIcon, CodeIcon, LightningBoltIcon, ClockIcon, BarChartIcon, ActivityLogIcon, GearIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';
import EMGChart, { CombinedChartDataPoint } from '../EMGChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useState, useEffect } from 'react';
import { FilterMode } from '../app/ChannelFilter';

import MetadataDisplay from "@/components/app/MetadataDisplay";
import ChannelSelection from "@/components/app/ChannelSelection";
import DownsamplingControl from "@/components/app/DownsamplingControl";
import StatsPanel from '@/components/app/StatsPanel';
import type { EMGMetrics } from '@/types/session';
import PerformanceCard from './performance-card';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import ScoringConfigPanel from '../SessionConfigPanel';
import SettingsPanel from '../SettingsPanel';
import ChartControlHeader from '../ChartControlHeader';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { useLiveAnalytics } from '@/hooks/useLiveAnalytics';

declare module '@/types/session' {
  interface EMGMetrics {
    longContractionsLeft?: number;
    longContractionsRight?: number;
    shortContractionsLeft?: number;
    shortContractionsRight?: number;
  }
}

interface GameSessionTabsProps {
  analysisResult: EMGAnalysisResult | null;
  mvcThresholdForPlot?: number | null;
  
  muscleChannels: string[];
  allAvailableChannels: string[];
  plotChannel1Name: string | null;
  setPlotChannel1Name: (name: string | null) => void;
  plotChannel2Name: string | null;
  setPlotChannel2Name: (name: string | null) => void;
  
  selectedChannelForStats: string | null;
  setSelectedChannelForStats: (name: string | null) => void;
  
  currentStats: StatsData | null;
  
  mainChartData: CombinedChartDataPoint[];

  dataPoints: number;
  setDataPoints: (points: number) => void;
  handleDataPointsChange: (value: number) => void;
  mainPlotChannel1Data: EMGChannelSignalData | null;
  mainPlotChannel2Data: EMGChannelSignalData | null;
  activeTab: string;
  onTabChange: (value: string) => void;
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
  onRecalculateScores?: () => void;
  appIsLoading: boolean;
}

export default function GameSessionTabs({
  analysisResult,
  mvcThresholdForPlot,
  muscleChannels,
  allAvailableChannels,
  plotChannel1Name,
  setPlotChannel1Name,
  plotChannel2Name,
  setPlotChannel2Name,
  selectedChannelForStats,
  setSelectedChannelForStats,
  currentStats,
  mainChartData,
  dataPoints,
  setDataPoints,
  handleDataPointsChange,
  mainPlotChannel1Data,
  mainPlotChannel2Data,
  activeTab,
  onTabChange,
  plotMode,
  setPlotMode,
  onRecalculateScores,
  appIsLoading,
}: GameSessionTabsProps) {
  const { sessionParams, setSessionParams } = useSessionStore();
  const liveAnalytics = useLiveAnalytics(analysisResult);

  // Add state to store analytics data for all channels
  const [viewMode, setViewMode] = useState<FilterMode>('comparison');
  
  const [isInitializingComparison, setIsInitializingComparison] = useState(false);
  
  // Contraction visualization state - simplified to one toggle
  const [showContractionHighlights, setShowContractionHighlights] = useState(true);
  
  // Individual contraction controls with defaults (both areas and dots shown by default)
  const [showGoodContractions, setShowGoodContractions] = useState(true);
  const [showPoorContractions, setShowPoorContractions] = useState(true);
  const [showContractionAreas, setShowContractionAreas] = useState(true);
  const [showContractionDots, setShowContractionDots] = useState(true);

  const allChannelsData = liveAnalytics;
  const currentChannelAnalyticsData = selectedChannelForStats && liveAnalytics
    ? liveAnalytics[selectedChannelForStats]
    : null;
  
  // This effect will run when the component mounts or when dependencies change.
  // It's responsible for pre-loading all channel data for comparison view.
  useEffect(() => {
    // Only run this logic if there are muscle channels to process.
    if (muscleChannels.length > 0 && liveAnalytics) {
      console.log('Pre-loading all channel analytics for comparison mode.');
      
      // Set the loading state to true.
      setIsInitializingComparison(true);
      
      
      // Set the loading state to false once data is ready.
      setIsInitializingComparison(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muscleChannels, liveAnalytics]); // Dependency on analytics object
  
  
  // This effect resets the data when the entire analysis result is cleared.
  useEffect(() => {
    if (!analysisResult) {
      setViewMode('comparison'); // Reset to default view
    }
  }, [analysisResult]);

  const handleFilterChange = (mode: FilterMode, channel?: string) => {
    setViewMode(mode);
    if (mode === 'single' && channel) {
      setSelectedChannelForStats(channel);
      // Automatically select the corresponding plot channel, respecting plotMode
      const desiredSuffix = plotMode === 'activated' ? ' activated' : ' Raw';
      let plotChannel = allAvailableChannels.find(c => c === channel + desiredSuffix);
      // Fallback if the specific mode doesn't exist for some reason
      if (!plotChannel) {
          plotChannel = allAvailableChannels.find(c => c.startsWith(channel));
      }
      setPlotChannel1Name(plotChannel || null);
      setPlotChannel2Name(null);

    } else if (mode === 'comparison') {
        setSelectedChannelForStats(null);
        const desiredSuffix = plotMode === 'activated' ? ' activated' : ' Raw';
        const baseChannels = allAvailableChannels
            .map(c => c.replace(/ (Raw|activated)$/, ''))
            .filter((v, i, a) => a.indexOf(v) === i);

        if (baseChannels.length > 0) {
            let firstPlotChannel = allAvailableChannels.find(c => c === baseChannels[0] + desiredSuffix);
            if (!firstPlotChannel) {
                firstPlotChannel = allAvailableChannels.find(c => c.startsWith(baseChannels[0]));
            }
            setPlotChannel1Name(firstPlotChannel || null);
        } else {
            setPlotChannel1Name(null);
        }
        
        if (baseChannels.length > 1) {
            let secondPlotChannel = allAvailableChannels.find(c => c === baseChannels[1] + desiredSuffix);
            if (!secondPlotChannel) {
                secondPlotChannel = allAvailableChannels.find(c => c.startsWith(baseChannels[1]));
            }
            setPlotChannel2Name(secondPlotChannel || null);
        } else {
            setPlotChannel2Name(null);
        }
    }
  };

  // Update chart view mode based on selected channels
  useEffect(() => {
    if (plotChannel1Name && plotChannel2Name) {
      // setChartViewMode('comparison'); // This is now controlled by handleFilterChange
    } else {
      // setChartViewMode('single'); // This is now controlled by handleFilterChange
    }
  }, [plotChannel1Name, plotChannel2Name]);
  
  // Keep plotMode and sessionParams.show_raw_signals in sync
  useEffect(() => {
    const rawSignalsEnabled = sessionParams.show_raw_signals === true;
    if ((rawSignalsEnabled && plotMode !== 'raw') || (!rawSignalsEnabled && plotMode !== 'activated')) {
      setPlotMode(rawSignalsEnabled ? 'raw' : 'activated');
    }
  }, [sessionParams.show_raw_signals, plotMode, setPlotMode]);

  // Helper function to calculate the total score for a muscle
  const calculateMuscleScore = (channelData: ChannelAnalyticsData, expectedContractions: number | null): number => {
    if (!channelData) return 0;
    
    const totalContractions = channelData.contraction_count || 0;
    const goodContractions = channelData.good_contraction_count || 0;
    
    // Calculate contraction score (completion)
    const contractionScore = expectedContractions ? 
      Math.min(Math.round((totalContractions / expectedContractions) * 100), 100) : 100;
    
    // Calculate good contraction score (quality)
    const goodContractionScore = totalContractions > 0 ? 
      Math.round((goodContractions / totalContractions) * 100) : 0;
    
    // Total score is the average of completion and quality
    const scores = [contractionScore, goodContractionScore].filter(s => s !== null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  };

  // Calculate individual muscle scores
  const muscleScores: number[] = [];
  
  if (analysisResult && analysisResult.analytics) {
    const channelNames = Object.keys(analysisResult.analytics).sort();
    
    channelNames.forEach((channelName, index) => {
      const channelData = analysisResult.analytics[channelName];
      if (!channelData) return;
      
      // Determine expected contractions for this channel
      let expectedContractions: number | null = null;
      const params = analysisResult.metadata?.session_parameters_used;
      
      if (params) {
        // Keys are 1-indexed (ch1, ch2), so we use `index + 1`
        const perChannelKey = `session_expected_contractions_ch${index + 1}`;
        if (params.hasOwnProperty(perChannelKey)) {
          expectedContractions = (params as any)[perChannelKey] ?? null;
        } else {
          // Fallback to the overall session value if per-channel is not defined
          expectedContractions = params.session_expected_contractions ?? null;
        }
      }
      
      const muscleScore = calculateMuscleScore(channelData, expectedContractions);
      muscleScores.push(muscleScore);
    });
  }
  
  // Calculate overall score as average of muscle scores
  const overallScore = muscleScores.length > 0 
    ? Math.round(muscleScores.reduce((sum, score) => sum + score, 0) / muscleScores.length)
    : (analysisResult?.overall_score ? Math.round(analysisResult.overall_score) : 0);
  
  // Calculate symmetry score
  let symmetryScore: number | undefined;
  
  if (muscleScores.length === 2) {
    const [score1, score2] = muscleScores;
    if (score1 > 0 || score2 > 0) {
      symmetryScore = Math.round((Math.min(score1, score2) / Math.max(score1, score2)) * 100);
    } else {
      symmetryScore = 100; // Both are 0, perfect symmetry
    }
  } else {
    // Fallback to the API-provided symmetry score if available
    symmetryScore = analysisResult?.symmetry_score ? Math.round(analysisResult.symmetry_score) : undefined;
  }
  
  // Use the hook at the component level (not in a callback)
  const scoreInfo = useScoreColors(overallScore);

  if (!analysisResult) return null;

  return (
    <Tabs defaultValue="plots" value={activeTab} onValueChange={onTabChange}>
      <div className="border-b mb-4">
        <TabsList className="w-full flex justify-between overflow-x-auto">
          <TabsTrigger value="plots" className="flex-1 flex-shrink-0">EMG Analysis</TabsTrigger>
          <TabsTrigger value="game" className="flex-1 flex-shrink-0">Performance Analysis</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 flex-shrink-0">Settings</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="plots">
        <Card>
          <CardContent className="pt-4">
            {sessionParams && muscleChannels.length > 0 && (
              <ChartControlHeader
                availableChannels={muscleChannels}
                sessionParams={sessionParams}
                activeFilter={{ mode: viewMode, channel: selectedChannelForStats }}
                onFilterChange={handleFilterChange}
                plotMode={plotMode}
                setPlotMode={setPlotMode}
                showContractionHighlights={showContractionHighlights}
                setShowContractionHighlights={setShowContractionHighlights}
                hasContractionData={!!(liveAnalytics && Object.keys(liveAnalytics).length > 0)}
                isLoading={appIsLoading}
              />
            )}
            <EMGChart 
              chartData={mainChartData}
              availableChannels={muscleChannels}
              selectedChannel={selectedChannelForStats}
              viewMode={viewMode}
              mvcThresholdForPlot={mvcThresholdForPlot}
              channel_muscle_mapping={sessionParams.channel_muscle_mapping}
              muscle_color_mapping={sessionParams.muscle_color_mapping}
              sessionParams={sessionParams}
              isLoading={appIsLoading}
              showSignalSwitch={false}
              plotMode={plotMode}
              setPlotMode={setPlotMode}
              analytics={liveAnalytics}
              showGoodContractions={showContractionHighlights && showGoodContractions}
              showPoorContractions={showContractionHighlights && showPoorContractions}
              showContractionAreas={showContractionHighlights && showContractionAreas}
              showContractionDots={showContractionHighlights && showContractionDots}
            />
            
            {/* Analytics Panel - Integrated from the EMG Analytics tab */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="mb-4">
                <h3 className="text-lg font-medium">EMG Analytics</h3>
                <p className="text-sm text-muted-foreground">Detailed metrics for the selected muscle group.</p>
              </div>
              
              <StatsPanel 
                stats={currentStats}
                channelAnalytics={currentChannelAnalyticsData}
                selectedChannel={selectedChannelForStats}
                availableChannels={muscleChannels}
                onChannelSelect={setSelectedChannelForStats}
                sessionExpectedContractions={sessionParams.session_expected_contractions ? parseInt(String(sessionParams.session_expected_contractions), 10) : null}
                isEMGAnalyticsTab={true}
                contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? 250}
                sessionParams={sessionParams}
                allChannelsData={allChannelsData ?? undefined}
                viewMode={viewMode}
                onFilterChange={handleFilterChange}
                isInitializingComparison={isInitializingComparison}
                plotMode={plotMode}
                setPlotMode={setPlotMode}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="game" className="bg-gray-50/50 p-4 rounded-b-lg">
       
        <PerformanceCard 
          analysisResult={analysisResult}
          sessionParams={sessionParams}
          contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? undefined}
        />
      </TabsContent>

      <TabsContent value="settings" className="p-4 bg-white rounded-lg shadow-sm">
        <SettingsPanel
          muscleChannels={muscleChannels}
          disabled={appIsLoading}
          dataPoints={dataPoints}
          setDataPoints={setDataPoints}
          plotChannel1Data={mainPlotChannel1Data}
          plotChannel2Data={mainPlotChannel2Data}
          showGoodContractions={showGoodContractions && showContractionHighlights}
          setShowGoodContractions={setShowGoodContractions}
          showPoorContractions={showPoorContractions && showContractionHighlights}
          setShowPoorContractions={setShowPoorContractions}
          showContractionAreas={showContractionAreas && showContractionHighlights}
          setShowContractionAreas={setShowContractionAreas}
          showContractionDots={showContractionDots && showContractionHighlights}
          setShowContractionDots={setShowContractionDots}
        />
      </TabsContent>
    </Tabs>
  );
} 