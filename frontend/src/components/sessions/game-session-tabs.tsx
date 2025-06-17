import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GameSession, EMGMetrics as FrontendEMGMetrics } from '@/types/session';
import { EMGAnalysisResult, ChannelAnalyticsData, StatsData, EmgSignalData, GameSessionParameters } from '../../types/emg';
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
import ChannelFilter from '../app/ChannelFilter';

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
  currentChannelAnalyticsData: ChannelAnalyticsData | null;
  
  mainChartData: CombinedChartDataPoint[];

  dataPoints: number;
  setDataPoints: (points: number) => void;
  handleDataPointsChange: (value: number) => void;
  mainPlotChannel1Data: EmgSignalData | null;
  mainPlotChannel2Data: EmgSignalData | null;
  activeTab: string;
  onTabChange: (value: string) => void;
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
  sessionParams: GameSessionParameters;
  onSessionParamsChange: (params: GameSessionParameters) => void;
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
  currentChannelAnalyticsData,
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
  sessionParams,
  onSessionParamsChange,
  onRecalculateScores,
  appIsLoading,
}: GameSessionTabsProps) {

  // Add state to store analytics data for all channels
  const [allChannelsData, setAllChannelsData] = useState<Record<string, ChannelAnalyticsData | null>>({});
  const [viewMode, setViewMode] = useState<FilterMode>('comparison');
  const [isInitializingComparison, setIsInitializingComparison] = useState(false);
  
  // This effect will run when the component mounts or when dependencies change.
  // It's responsible for pre-loading all channel data for comparison view.
  useEffect(() => {
    // Only run this logic if there are muscle channels to process.
    if (muscleChannels.length > 0 && analysisResult?.analytics) {
      console.log('Pre-loading all channel analytics for comparison mode.');
      
      // Set the loading state to true.
      setIsInitializingComparison(true);
      
      // Create a new object to hold the analytics data for all channels.
      const allData: Record<string, ChannelAnalyticsData | null> = {};
      
      // Iterate over the muscle channels and populate the data object.
      muscleChannels.forEach(channel => {
        allData[channel] = analysisResult.analytics[channel] || null;
      });
      
      // Update the state with the complete data set.
      setAllChannelsData(allData);
      
      // Set the loading state to false once data is ready.
      setIsInitializingComparison(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muscleChannels, analysisResult?.analytics]); // Dependency on analytics object
  
  // This effect ensures that any updates to a single channel's analytics
  // (e.g., from recalculation) are merged into the main data set.
  useEffect(() => {
    if (currentChannelAnalyticsData && selectedChannelForStats) {
      setAllChannelsData(prev => ({
        ...prev,
        [selectedChannelForStats]: currentChannelAnalyticsData
      }));
    }
  }, [currentChannelAnalyticsData, selectedChannelForStats]);
  
  // This effect resets the data when the entire analysis result is cleared.
  useEffect(() => {
    if (!analysisResult) {
      setAllChannelsData({});
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

  const getPerformanceScore = (metrics?: EMGMetrics) => {
    if (!metrics) return 0;
    // ... existing code ...
  };

  if (!analysisResult) return null;

  return (
    <Tabs defaultValue="plots" value={activeTab} onValueChange={onTabChange}>
      <div className="border-b mb-4">
        <TabsList className="w-full flex justify-between overflow-x-auto">
          <TabsTrigger value="plots" className="flex-1 flex-shrink-0">EMG Analysis</TabsTrigger>
          <TabsTrigger value="game-stats" className="flex-1 flex-shrink-0">Game Stats</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 flex-shrink-0">Settings</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="plots">
        <Card>
          <CardHeader>
          </CardHeader>
          <CardContent className="pt-2">
            {sessionParams && muscleChannels.length > 0 && (
              <ChannelFilter
                availableChannels={muscleChannels}
                sessionParams={sessionParams}
                activeFilter={{ mode: viewMode, channel: selectedChannelForStats }}
                onFilterChange={handleFilterChange}
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
            />
            
            {/* Analytics Panel - Integrated from the EMG Analytics tab */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium">EMG Analytics</h3>
                  <p className="text-sm text-muted-foreground">Detailed metrics for the selected muscle group.</p>
                </div>
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
                allChannelsData={allChannelsData}
                viewMode={viewMode}
                onFilterChange={handleFilterChange}
                isInitializingComparison={isInitializingComparison}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="game-stats" className="bg-gray-50/50 p-4 rounded-b-lg">
        <PerformanceCard 
          analysisResult={analysisResult}
          contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? 250}
          sessionParams={sessionParams}
        />
      </TabsContent>

      <TabsContent value="settings">
        <div className="grid grid-cols-1 gap-4">
          

          <Card>
            <CardHeader>
              <CardTitle className="text-lg"> Session Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoringConfigPanel
                sessionParams={sessionParams}
                onParamsChange={onSessionParamsChange}
                onRecalculate={onRecalculateScores}
                disabled={appIsLoading}
                availableChannels={muscleChannels}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plot Configuration</CardTitle>
              <CardDescription>Configure EMG plot display options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="plot-mode-switch">Raw</Label>
                    <Switch
                      id="plot-mode-switch"
                      checked={plotMode === 'activated'}
                      onCheckedChange={(checked: boolean) => {
                        const newMode = checked ? 'activated' : 'raw';
                        setPlotMode(newMode);
                        // Sync with session params
                        onSessionParamsChange({
                          ...sessionParams,
                          show_raw_signals: newMode === 'raw'
                        });
                      }}
                    />
                    <Label htmlFor="plot-mode-switch">Activated</Label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Display Options:</label>
                    <DownsamplingControl 
                      dataPoints={dataPoints}
                      setDataPoints={setDataPoints}
                      plotChannel1Data={mainPlotChannel1Data}
                      plotChannel2Data={mainPlotChannel2Data}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <SettingsPanel 
            sessionParams={sessionParams}
            onParamsChange={onSessionParamsChange}
            muscleChannels={muscleChannels}
            disabled={appIsLoading}
          />
          
          <Collapsible>
            <CollapsibleTrigger className="w-full text-left group flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border hover:bg-slate-50 transition-colors">
              <div className="flex items-center">
                <CodeIcon className="h-5 w-5 mr-3 text-slate-600" />
                <div>
                  <h4 className="font-semibold text-slate-800">Raw API Response</h4>
                  <p className="text-xs text-slate-500">Click to view the raw JSON output for debugging</p>
                </div>
              </div>
              <ChevronDownIcon className="h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Card>
                <CardContent className="p-0">
                  <pre className="p-4 rounded-md bg-slate-950 text-white overflow-x-auto text-xs">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </TabsContent>
    </Tabs>
  );
} 