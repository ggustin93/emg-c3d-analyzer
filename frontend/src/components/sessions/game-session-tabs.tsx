import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { GameSession, EMGMetrics as FrontendEMGMetrics } from '../../types/session';
import { EMGAnalysisResult, ChannelAnalyticsData, StatsData, EmgSignalData, GameMetadata } from '../../types/emg';
import { Clock, Activity, Dumbbell, Award, Zap, ChevronsLeftRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';
import EMGChart, { CombinedChartDataPoint } from '../EMGChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

import MetadataDisplay from "../app/MetadataDisplay";
import ChannelSelection from "../app/ChannelSelection";
import DownsamplingControl from "../app/DownsamplingControl";
import GeneratedPlotsDisplay from "../app/GeneratedPlotsDisplay";
import StatsPanel from "../app/StatsPanel";
import { ChangeEvent, useEffect } from 'react';

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
  rawApiData: EMGAnalysisResult | null;

  analysisResult: EMGAnalysisResult | null;
  
  availableChannels: string[];
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
  handleDataPointsChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  mainPlotChannel1Data: EmgSignalData | null;
  mainPlotChannel2Data: EmgSignalData | null;
}

export default function GameSessionTabs({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
  rawApiData,

  analysisResult,
  availableChannels,
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
  handleDataPointsChange,
  mainPlotChannel1Data,
  mainPlotChannel2Data,
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

  return (
    
    <Tabs defaultValue="analysis" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="analysis">EMG Analysis</TabsTrigger>
        <TabsTrigger value="performance">Game Performance</TabsTrigger>
        <TabsTrigger value="rawc3d">RAW C3D data</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis" className="space-y-4">

        {analysisResult && (
          <>
            <div className="grid grid-cols-1 gap-4 mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <label htmlFor="channel-select-stats" className="text-sm font-medium text-muted-foreground">Analyze Muscle:</label>
                    <ChannelSelection 
                      availableChannels={availableChannels}
                      plotChannel1Name={plotChannel1Name}
                      setPlotChannel1Name={setPlotChannel1Name}
                      plotChannel2Name={plotChannel2Name}
                      setPlotChannel2Name={setPlotChannel2Name}
                      selectedChannelForStats={selectedChannelForStats}
                      setSelectedChannelForStats={setSelectedChannelForStats}
                      displayMode='statsOnly'
                    />
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center space-x-2 text-sm text-primary hover:underline">
                        <span>Plot Options</span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 pt-4 border-t">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Plot Channel Configuration</h4>
                          <ChannelSelection 
                            availableChannels={availableChannels}
                            plotChannel1Name={plotChannel1Name}
                            setPlotChannel1Name={setPlotChannel1Name}
                            plotChannel2Name={plotChannel2Name}
                            setPlotChannel2Name={setPlotChannel2Name}
                            selectedChannelForStats={selectedChannelForStats}
                            setSelectedChannelForStats={setSelectedChannelForStats}
                            displayMode='plotChannelsOnly'
                          />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-1">Options d'Affichage des Données</h4>
                          <DownsamplingControl 
                            dataPoints={dataPoints}
                            handleDataPointsChange={handleDataPointsChange}
                            plotChannel1Data={mainPlotChannel1Data}
                            plotChannel2Data={mainPlotChannel2Data}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base font-medium">Interactive EMG Plot</CardTitle></CardHeader>
                <CardContent>
                  <EMGChart 
                    chartData={mainChartData} 
                    channel1Name={plotChannel1Name}
                    channel2Name={plotChannel2Name}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-6">
              <div>
                <StatsPanel 
                  stats={currentStats} 
                  channelAnalytics={currentChannelAnalyticsData} 
                  selectedChannel={selectedChannelForStats} 
                />
              </div>
              <div>
                <GeneratedPlotsDisplay plots={analysisResult.plots} />
              </div>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center">
                <Award className="h-4 w-4 mr-2" /> Activation Points
              </CardTitle>
              <CardDescription>Total points earned and contraction breakdown for the game session.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col items-center">
              <div className="h-[250px] w-full flex items-center justify-center mb-3">
                {selectedGameSession.statistics && selectedGameSession.metrics && selectedGameSession.parameters ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Achieved', value: selectedGameSession.statistics.activationPoints || 0 },
                          { name: 'Remaining', value: 100 - (selectedGameSession.statistics.activationPoints || 0) }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={90}
                        innerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell key={`cell-achieved`} fill="hsl(var(--chart-1))" />
                        <Cell key={`cell-remaining`} fill="hsl(var(--muted))" />
                      </Pie>
                      <PieTooltip formatter={(value: number, name: string) => [`${value} pts`, name]} />
                      <text
                        x="50%"
                        y="48%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: '28px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }}
                      >
                        {selectedGameSession.statistics.activationPoints || 0}
                      </text>
                      <text
                        x="50%"
                        y="60%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: '12px', fill: 'hsl(var(--muted-foreground))' }}
                      >
                        points
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No performance data available
                  </div>
                )}
              </div>
              {selectedGameSession.metrics && (
                <div className="w-full px-2 sm:px-4">
                  <h4 className="text-sm font-medium mb-3 text-center text-muted-foreground">Contraction Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                    {[
                      { label: "Long (L)", value: selectedGameSession.metrics.longContractionsLeft || 0, icon: <ChevronsLeftRight className="h-4 w-4 text-blue-500" /> },
                      { label: "Long (R)", value: selectedGameSession.metrics.longContractionsRight || 0, icon: <ChevronsLeftRight className="h-4 w-4 text-green-500" /> },
                      { label: "Short (L)", value: selectedGameSession.metrics.shortContractionsLeft || 0, icon: <Zap className="h-4 w-4 text-yellow-500" /> },
                      { label: "Short (R)", value: selectedGameSession.metrics.shortContractionsRight || 0, icon: <Zap className="h-4 w-4 text-purple-500" /> },
                    ].map((item, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-card shadow-sm flex flex-col items-center justify-center">
                        <div className="mb-1">{item.icon}</div>
                        <div className="text-lg font-bold text-foreground">{item.value}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-1 space-y-4">
            <MetricCard
              title="Duration"
              value={selectedGameSession.statistics?.duration
                ? selectedGameSession.statistics.duration / 60
                : 0}
              unit="min"
              description="Total gameplay time"
              icon={<Clock className="h-4 w-4" />}
            />
            <MetricCard
              title="Level"
              value={selectedGameSession.statistics?.levelsCompleted || 0}
              unit=""
              description="Game progression"
              icon={<Dumbbell className="h-4 w-4" />}
              isInteger
            />
            <MetricCard
              title="Inactivity Periods"
              value={selectedGameSession.statistics?.inactivityPeriods || 0}
              unit=""
              description="Rest or disengagement"
              icon={<Clock className="h-4 w-4" />}
              isInteger
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rawc3d" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Direct Backend API Response</CardTitle>
            <CardDescription>
              The raw JSON response received from the C3D processing API (`/upload` endpoint).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 p-4 rounded-md overflow-x-auto text-sm">
              {rawApiData ? JSON.stringify(rawApiData, null, 2) : "No API data loaded."}
            </pre>
          </CardContent>
        </Card>
       {/*<!-- <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Frontend Derived / Assumed Data</CardTitle>
            <CardDescription>
              Data object constructed by the frontend (App.tsx) based on the API response, 
              frontend defaults, and UI-specific calculations. This primarily reflects the structure of the `selectedGameSession` object used by other UI components.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 p-4 rounded-md overflow-x-auto text-sm">
              {JSON.stringify(frontendDerivedData, null, 2)}
            </pre>
          </CardContent>
        </Card> */}
      </TabsContent>
    </Tabs>
  );
} 