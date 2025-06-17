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

import MetadataDisplay from "@/components/app/MetadataDisplay";
import ChannelSelection from "@/components/app/ChannelSelection";
import DownsamplingControl from "@/components/app/DownsamplingControl";
import StatsPanel from '@/components/app/StatsPanel';
import { useEffect } from 'react';
import type { EMGMetrics } from '@/types/session';
import PerformanceCard from './performance-card';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import ScoringConfigPanel from '../SessionConfigPanel';
import SettingsPanel from '../SettingsPanel';

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
          <TabsTrigger value="analytics" className="flex-1 flex-shrink-0">EMG Analytics</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 flex-shrink-0">Settings</TabsTrigger>
        </TabsList>
      </div>

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
              channel_muscle_mapping={sessionParams.channel_muscle_mapping}
              plotMode={plotMode}
            />
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
              sessionExpectedContractions={sessionParams.session_expected_contractions ? parseInt(String(sessionParams.session_expected_contractions), 10) : null}
              isEMGAnalyticsTab={true}
              contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? 250}
              sessionParams={sessionParams}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <div className="grid grid-cols-1 gap-4">
         
          
          <Card>
            <CardHeader>
              <CardTitle>Session Configuration</CardTitle>
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