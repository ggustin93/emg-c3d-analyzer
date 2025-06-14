import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GameSession, EMGMetrics as FrontendEMGMetrics } from '@/types/session';
import { EMGAnalysisResult, ChannelAnalyticsData, StatsData, EmgSignalData, GameMetadata } from '@/types/emg';
import { StarIcon, CodeIcon, LightningBoltIcon, ClockIcon, BarChartIcon, ActivityLogIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';
import EMGChart, { CombinedChartDataPoint } from '@/components/EMGChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import MetadataDisplay from "@/components/app/MetadataDisplay";
import ChannelSelection from "@/components/app/ChannelSelection";
import DownsamplingControl from "@/components/app/DownsamplingControl";
import GeneratedPlotsDisplay from "@/components/app/GeneratedPlotsDisplay";
import StatsPanel from '@/components/app/StatsPanel';
import { useEffect } from 'react';
import type { EMGMetrics } from '@/types/session';
import PerformanceCard from './performance-card';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

declare module '@/types/session' {
  interface EMGMetrics {
    longContractionsLeft?: number;
    longContractionsRight?: number;
    shortContractionsLeft?: number;
    shortContractionsRight?: number;
  }
}

interface GameSessionTabsProps {
  selectedGameSession: GameSession;
  emgTimeSeriesData: CombinedChartDataPoint[];
  mvcPercentage: number;
  leftQuadChannelName: string | null;
  rightQuadChannelName: string | null;

  analysisResult: EMGAnalysisResult | null;
  
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
}

export default function GameSessionTabs({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
  analysisResult,
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
}: GameSessionTabsProps) {
  const frontendDerivedData = {
    note: "Data generated, defaulted, interpreted, or assumed by the frontend React components (primarily App.tsx unless otherwise specified).",
    emgMetricsPlaceholdersAndInterpretations: {
      description: "The following EMG-related metrics are currently frontend placeholders, interpretations of backend data, or simplified calculations. Specific items like RMS, MAV, Fatigue Index, and Force Estimation are awaiting full backend implementation or are currently simplified.",
      rms_mV: selectedGameSession.metrics?.rms,
      mav_mV: selectedGameSession.metrics?.mav,
      fatigueIndex: selectedGameSession.metrics?.fatigueIndex, 
      forceEstimation_N: selectedGameSession.metrics?.forceEstimation,
      longContractionsLeft: selectedGameSession.metrics?.longContractionsLeft,
      longContractionsRight: selectedGameSession.metrics?.longContractionsRight,
      shortContractionsLeft: selectedGameSession.metrics?.shortContractionsLeft,
      shortContractionsRight: selectedGameSession.metrics?.shortContractionsRight,
    },
    gameStatistics: {
      description: "Populated in App.tsx. Fields like 'duration', 'levelsCompleted', 'activationPoints' (from score) map to backend metadata. 'inactivityPeriods' is a frontend default (0).",
      data: selectedGameSession.statistics,
    },
    gameParameters: {
      description: "Static default values set in frontend (App.tsx). These are not from the C3D file analysis.",
      data: selectedGameSession.parameters,
    },
    sessionConstructionDetails: {
      description: "Session object fields constructed in App.tsx.",
      id: selectedGameSession.id,
      gameType: selectedGameSession.gameType,
      startTime: selectedGameSession.startTime,
      endTime: selectedGameSession.endTime,
    },
    uiDisplayRelatedMetrics: {
        description: "Metrics primarily used for UI display elements.",
        peakContraction_targetMVC_percent: mvcPercentage
    }
  };

  if (!analysisResult) return null;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="plots">Signal Plots</TabsTrigger>
        <TabsTrigger value="overview">Game Stats</TabsTrigger>
        <TabsTrigger value="analytics">EMG Analytics</TabsTrigger>
        <TabsTrigger value="raw">Raw API</TabsTrigger>
      </TabsList>

      {/* --- Overview Tab --- */}
      <TabsContent value="overview" className="space-y-4">
        <PerformanceCard 
          selectedGameSession={selectedGameSession}
          emgTimeSeriesData={emgTimeSeriesData}
          mvcPercentage={mvcPercentage}
          leftQuadChannelName={leftQuadChannelName}
          rightQuadChannelName={rightQuadChannelName}
        />
      </TabsContent>

      {/* --- Signal Plots Tab --- */}
      <TabsContent value="plots" className="space-y-4">
        <Card>
          <CardHeader>
             <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center space-x-2 text-sm text-primary hover:underline my-2">
                  <CodeIcon className="h-4 w-4" />
                  <span>Plot Configuration</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="plot-channel-1" className="block text-sm font-medium text-gray-700 mb-1">Plot Channel 1:</label>
                      <ChannelSelection
                          id="plot-channel-1-selection"
                          availableChannels={allAvailableChannels}
                          selectedChannel={plotChannel1Name}
                          setSelectedChannel={setPlotChannel1Name}
                          label="Select Channel 1"
                        />
                    </div>
                    <div>
                      <label htmlFor="plot-channel-2" className="block text-sm font-medium text-gray-700 mb-1">Plot Channel 2:</label>
                      <ChannelSelection
                          id="plot-channel-2-selection"
                          availableChannels={allAvailableChannels}
                          selectedChannel={plotChannel2Name}
                          setSelectedChannel={setPlotChannel2Name}
                          label="Select Channel 2"
                        />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="plot-mode-switch">Raw</Label>
                      <Switch
                        id="plot-mode-switch"
                        checked={plotMode === 'activated'}
                        onCheckedChange={(checked: boolean) => setPlotMode(checked ? 'activated' : 'raw')}
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
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
          <CardContent className="pt-2">
            <EMGChart 
              chartData={mainChartData} 
              channel1Name={plotChannel1Name}
              channel2Name={plotChannel2Name}
            />
          </CardContent>
        </Card>
        <GeneratedPlotsDisplay plots={analysisResult.plots} />
      </TabsContent>

       {/* --- EMG Analytics Tab --- */}
       <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>EMG Analytics</CardTitle>
                  <CardDescription>Detailed metrics for the selected muscle group.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StatsPanel 
                stats={currentStats}
                channelAnalytics={currentChannelAnalyticsData}
                selectedChannel={selectedChannelForStats}
                availableChannels={muscleChannels}
                onChannelSelect={setSelectedChannelForStats}
              />
            </CardContent>
          </Card>
      </TabsContent>

      <TabsContent value="raw">
        <Card>
          <CardHeader>
            <CardTitle>Raw API Data</CardTitle>
            <CardDescription>The raw JSON response from the backend analysis.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-md bg-slate-950 text-white overflow-x-auto text-xs">
              {JSON.stringify({ analysisResult, frontendDerivedData }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 