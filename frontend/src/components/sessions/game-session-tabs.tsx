import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '@/components/ui/progress';
import { GameSession, EMGMetrics as FrontendEMGMetrics } from '@/types/session';
import { EMGAnalysisResult, ChannelAnalyticsData, StatsData, EmgSignalData, GameSessionParameters } from '../../types/emg';
import { StarIcon, CodeIcon, LightningBoltIcon, ClockIcon, BarChartIcon, ActivityLogIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';
import EMGChart, { CombinedChartDataPoint } from '../EMGChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import MetadataDisplay from "@/components/app/MetadataDisplay";
import ChannelSelection from "@/components/app/ChannelSelection";
import DownsamplingControl from "@/components/app/DownsamplingControl";
import StatsPanel from '@/components/app/StatsPanel';
import { useEffect } from 'react';
import type { EMGMetrics } from '@/types/session';
import PerformanceCard from './performance-card';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import SessionConfigPanel from '../SessionConfigPanel';

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
  mvcThresholdForPlot?: number | null;
  sessionExpectedContractions?: number | null;
  
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
  appIsLoading: boolean;
}

export default function GameSessionTabs({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
  analysisResult,
  mvcThresholdForPlot,
  sessionExpectedContractions,
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
  appIsLoading,
}: GameSessionTabsProps) {

  const getPerformanceScore = (metrics?: EMGMetrics) => {
    if (!metrics) return 0;
    // ... existing code ...
  };

  if (!analysisResult) return null;

  return (
    <Tabs defaultValue={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="plots">Signal Plots</TabsTrigger>
        <TabsTrigger value="stats">Game Stats</TabsTrigger>
        <TabsTrigger value="analytics">EMG Analytics</TabsTrigger>
        <TabsTrigger value="raw">Raw API</TabsTrigger>
      </TabsList>

      <TabsContent value="plots">
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
              mvcThresholdForPlot={mvcThresholdForPlot}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="stats">
        <div className="space-y-6">
          <PerformanceCard 
            selectedGameSession={selectedGameSession}
            emgTimeSeriesData={emgTimeSeriesData}
            mvcPercentage={mvcPercentage}
            leftQuadChannelName={leftQuadChannelName}
            rightQuadChannelName={rightQuadChannelName}
            analysisResult={analysisResult}
          />
          <Card>
            <CardHeader>
              <CardTitle>Session Parameters</CardTitle>
              <CardDescription>Adjust MVC and other parameters for this session's analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <SessionConfigPanel
                sessionParams={sessionParams}
                onParamsChange={onSessionParamsChange}
                disabled={appIsLoading}
              />
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="analytics">
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
              sessionExpectedContractions={sessionExpectedContractions}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="raw">
        <Card>
          <CardHeader>
            <CardTitle>Raw API Response</CardTitle>
            <CardDescription>Raw JSON output from the analysis for debugging purposes.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-md bg-slate-950 text-white overflow-x-auto text-xs">
              {JSON.stringify(analysisResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
} 