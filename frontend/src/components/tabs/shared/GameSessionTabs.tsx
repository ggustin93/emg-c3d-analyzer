/**
 * GameSessionTabs - EMG Analysis Dashboard Component
 * 
 * A comprehensive tabbed interface for EMG data analysis and visualization.
 * Provides five main views: EMG Analysis, Performance Analysis, BFR Monitoring,
 * Export functionality, and Settings configuration.
 * 
 * Key Features:
 * - Real-time EMG signal visualization with interactive charts
 * - Performance analytics with muscle score calculations
 * - BFR (Blood Flow Restriction) parameter monitoring
 * - Data export capabilities (CSV, JSON, PDF reports)
 * - Comprehensive settings for signal processing and visualization
 * 
 * State Management:
 * - Uses consolidated contraction controls for better performance
 * - Manages chart view modes (single vs comparison)
 * - Handles BFR parameter initialization and compliance checking
 * - Integrates with Zustand store for session persistence
 * 
 * Tab Structure:
 * - **plots**: EMG Analysis - Interactive charts with real-time signal visualization
 * - **game**: Performance Analysis - Muscle scores and analytics dashboard
 * - **bfr**: BFR Monitoring - Blood flow restriction parameter management
 * - **export**: Export - Data export functionality (CSV, JSON, PDF)
 * - **settings**: Settings - Configuration for signal processing and visualization
 * 
 */

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EMGAnalysisResult, StatsData, EMGChannelSignalData } from '@/types/emg';
import { BarChartIcon, ActivityLogIcon, Share1Icon, HeartIcon } from '@radix-ui/react-icons';
import { EMGChart, ChartControlHeader } from '../SignalPlotsTab';
import { CombinedChartDataPoint } from '../SignalPlotsTab/EMGChart';
import { SignalDisplayType } from '../SignalPlotsTab/ThreeChannelSignalSelector';
import { useState, useEffect } from 'react';
import { FilterMode } from '@/components/shared/ChannelFilter';
import { StatsPanel } from '../GameStatsTab';
import PerformanceCard from './performance-card';
import { useSessionStore } from '@/store/sessionStore';
import { useLiveAnalytics } from '@/hooks/useLiveAnalytics';
import { BFRMonitoringTab } from '../BFRMonitoringTab';
import ExportTab from '../ExportTab/ExportTab';
import { useAuth } from '@/contexts/AuthContext';

declare module '@/types/session' {
  interface EMGMetrics {
    longContractionsLeft?: number;
    longContractionsRight?: number;
    shortContractionsLeft?: number;
    shortContractionsRight?: number;
  }
}

/**
 * Props for the GameSessionTabs component
 */
interface GameSessionTabsProps {
  /** EMG analysis result containing all processed data and analytics */
  analysisResult: EMGAnalysisResult | null;
  
  /** MVC threshold value for chart visualization (optional) */
  mvcThresholdForPlot?: number | null;
  
  /** Array of muscle channel names for the current session */
  muscleChannels: string[];
  
  /** All available channels including different signal types (Raw, Processed, Activated) */
  allAvailableChannels: string[];
  
  /** Callback to set the primary plot channel for chart visualization */
  setPlotChannel1Name: (name: string | null) => void;
  
  /** Callback to set the secondary plot channel for comparison mode */
  setPlotChannel2Name: (name: string | null) => void;
  
  /** Currently selected channel for detailed statistics display */
  selectedChannelForStats: string | null;
  
  /** Callback to change the selected channel for statistics */
  setSelectedChannelForStats: (name: string | null) => void;
  
  /** Statistical data for the currently selected channel */
  currentStats: StatsData | null;
  
  /** Combined chart data points for EMG signal visualization */
  mainChartData: CombinedChartDataPoint[];

  /** Number of data points to display in charts (affects resolution) */
  dataPoints: number;
  
  /** Callback to update the number of data points */
  setDataPoints: (points: number) => void;
  
  /** EMG signal data for the primary plot channel */
  mainPlotChannel1Data: EMGChannelSignalData | null;
  
  /** EMG signal data for the secondary plot channel */
  mainPlotChannel2Data: EMGChannelSignalData | null;
  
  /** Currently active tab identifier */
  activeTab: string;
  
  /** Callback for tab change events */
  onTabChange: (value: string) => void;
  
  /** Current signal display type (raw, processed, or activated) */
  signalType: SignalDisplayType;
  
  /** Callback to change signal display type */
  setSignalType: (type: SignalDisplayType) => void;
  
  /** Loading state indicator for the entire application */
  appIsLoading: boolean;
  
  /** Name of the uploaded C3D file (optional, for display purposes) */
  uploadedFileName?: string | null;
}

export default function GameSessionTabs({
  analysisResult,
  mvcThresholdForPlot,
  muscleChannels,
  allAvailableChannels,
  setPlotChannel1Name,
  setPlotChannel2Name,
  selectedChannelForStats,
  setSelectedChannelForStats,
  currentStats,
  mainChartData,
  dataPoints,
  setDataPoints,
  mainPlotChannel1Data,
  mainPlotChannel2Data,
  activeTab,
  onTabChange,
  signalType,
  setSignalType,
  appIsLoading,
  uploadedFileName,
}: GameSessionTabsProps) {
  const { sessionParams, setSessionParams } = useSessionStore();
  const liveAnalytics = useLiveAnalytics(analysisResult);
  const { userRole } = useAuth();

  // Initialize BFR parameters with default values on first load
  useEffect(() => {
    if (!sessionParams.bfr_parameters) {
      setSessionParams({
        ...sessionParams,
        bfr_parameters: {
          left: {
            aop_measured: 180,
            applied_pressure: 90,
            percentage_aop: 50,
            is_compliant: true,
            therapeutic_range_min: 40,
            therapeutic_range_max: 60,
            application_time_minutes: 15
          },
          right: {
            aop_measured: 180,
            applied_pressure: 90,
            percentage_aop: 50,
            is_compliant: true,
            therapeutic_range_min: 40,
            therapeutic_range_max: 60,
            application_time_minutes: 15
          }
        }
      });
    }
  }, [sessionParams, setSessionParams]);

  /**
   * Check if both left and right BFR parameters are compliant for tab indicator
   * @returns True if both sides compliant, false if either non-compliant, null if no params
   */
  const getBFRTabStatus = () => {
    const bfrParams = sessionParams.bfr_parameters;
    if (!bfrParams || !bfrParams.left || !bfrParams.right) return null;
    // Overall compliance requires both left and right to be compliant
    return bfrParams.left.is_compliant && bfrParams.right.is_compliant;
  };

  const bfrCompliant = getBFRTabStatus();

  // Chart state management
  const [viewMode, setViewMode] = useState<FilterMode>('comparison');
  const [isInitializingComparison, setIsInitializingComparison] = useState(false);
  
  // Chart channel selection is managed by parent component via props
  
  // Consolidated contraction visualization controls
  const [contractionControls, setContractionControls] = useState({
    showHighlights: true,
    showGoodContractions: true,
    showPoorContractions: true,
    showExcellentContractions: true,
    showAdequateForceContractions: true,
    showAdequateDurationContractions: true,
    showInsufficientContractions: true,
    useEnhancedQuality: false,
    showAreas: true,
    showDots: true
  });

  /**
   * Update helper for consolidated contraction controls
   * @param key - The control property to update
   * @param value - The boolean value to set
   */
  const updateContractionControl = (key: keyof typeof contractionControls, value: boolean) => {
    setContractionControls(prev => ({ ...prev, [key]: value }));
  };

  const allChannelsData = liveAnalytics;
  const currentChannelAnalyticsData = selectedChannelForStats && liveAnalytics
    ? liveAnalytics[selectedChannelForStats]
    : null;
  
  // Initialize comparison data when muscle channels and analytics are available
  useEffect(() => {
    if (muscleChannels.length > 0 && liveAnalytics) {
      setIsInitializingComparison(false);
    }
  }, [muscleChannels, liveAnalytics]);
  
  
  // This effect resets the data when the entire analysis result is cleared.
  useEffect(() => {
    if (!analysisResult) {
      setViewMode('comparison'); // Reset to default view
    }
  }, [analysisResult]);

  /**
   * Handle chart view mode changes and channel selection for analytics display
   * Automatically configures appropriate channels based on the selected mode and signal type
   * @param mode - The filter mode (single or comparison)
   * @param channel - Optional channel name for single mode
   */
  const handleFilterChange = (mode: FilterMode, channel?: string) => {
    setViewMode(mode);
    if (mode === 'single' && channel) {
      setSelectedChannelForStats(channel);
      // Automatically select the corresponding plot channel, respecting signalType
      const desiredSuffix = signalType === 'activated' ? ' activated' 
                           : signalType === 'processed' ? ' Processed' 
                           : ' Raw';
      let plotChannel = allAvailableChannels.find(c => c === channel + desiredSuffix);
      // Fallback if the specific mode doesn't exist for some reason
      if (!plotChannel) {
          plotChannel = allAvailableChannels.find(c => c.startsWith(channel));
      }
      setPlotChannel1Name(plotChannel || null);
      setPlotChannel2Name(null);

    } else if (mode === 'comparison') {
        setSelectedChannelForStats(null);
        const desiredSuffix = signalType === 'activated' ? ' activated' 
                                  : signalType === 'processed' ? ' Processed' 
                                  : ' Raw';
        const baseChannels = allAvailableChannels
            .map(c => c.replace(/ (Raw|activated|Processed)$/i, ''))
            .filter((v, i, a) => a.indexOf(v) === i);

        const resolve = (base?: string) => {
          if (!base) return null;
          return allAvailableChannels.find(c => c === base + desiredSuffix)
              || allAvailableChannels.find(c => c.startsWith(base))
              || null;
        };

        // Set both channels for comparison mode
        const channel1 = resolve(baseChannels[0]);
        const channel2 = resolve(baseChannels[1]);
        setPlotChannel1Name(channel1);
        setPlotChannel2Name(channel2);
    }
  };

  // Chart view mode is now controlled by handleFilterChange
  
  // Sync signal type with legacy show_raw_signals parameter for backward compatibility
  useEffect(() => {
    const rawSignalsEnabled = sessionParams.show_raw_signals === true;
    if (rawSignalsEnabled && signalType !== 'raw') {
      setSignalType('raw');
    } else if (!rawSignalsEnabled && signalType === 'raw') {
      setSignalType('activated');
    }
  }, [sessionParams.show_raw_signals, signalType, setSignalType]);


  if (!analysisResult) return null;

  return (
    <Tabs defaultValue="plots" value={activeTab} onValueChange={onTabChange} className="border-l border-r border-b border-blue-500 rounded-lg shadow-sm bg-white overflow-hidden">
      <div className="border-b mb-4 relative">
        <TabsList className="w-full flex justify-between border border-primary">
          <TabsTrigger value="plots" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <div className="flex items-center gap-2">
              <ActivityLogIcon className="w-4 h-4" />
              <span>EMG Analysis</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="game" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-4 h-4" />
              <span>Performance</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="bfr" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground group">
            <div className="flex items-center gap-2">
              <HeartIcon className="w-4 h-4" />
              <span>BFR Monitor</span>
              {bfrCompliant === true && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 group-data-[state=active]:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {bfrCompliant === false && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
          </TabsTrigger>
          {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && (
            <TabsTrigger value="export" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Share1Icon className="w-4 h-4" />
                <span>Export</span>
              </div>
            </TabsTrigger>
          )}
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
                signalType={signalType}
                setSignalType={setSignalType}
                showContractionHighlights={contractionControls.showHighlights}
                setShowContractionHighlights={(value) => updateContractionControl('showHighlights', value)}
                dataPoints={dataPoints}
                setDataPoints={setDataPoints}
                hasContractionData={!!(liveAnalytics && Object.keys(liveAnalytics).length > 0)}
                isLoading={appIsLoading}
              />
            )}
            <EMGChart 
              chartData={mainChartData}
              availableChannels={allAvailableChannels}
              selectedChannel={selectedChannelForStats}
              viewMode={viewMode}
              mvcThresholdForPlot={mvcThresholdForPlot}
              channel_muscle_mapping={sessionParams.channel_muscle_mapping}
              muscle_color_mapping={sessionParams.muscle_color_mapping}
              sessionParams={sessionParams}
              isLoading={appIsLoading}
              showSignalSwitch={false}
              externalPlotMode={signalType}
              analytics={liveAnalytics}
              showGoodContractions={contractionControls.showHighlights && contractionControls.showGoodContractions}
              showPoorContractions={contractionControls.showHighlights && contractionControls.showPoorContractions}
              showContractionAreas={contractionControls.showHighlights && contractionControls.showAreas}
              showContractionDots={contractionControls.showHighlights && contractionControls.showDots}
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
               contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? 2000}
                sessionParams={sessionParams}
                allChannelsData={allChannelsData ?? undefined}
                viewMode={viewMode}
                onFilterChange={handleFilterChange}
                isInitializingComparison={isInitializingComparison}
                isLoading={appIsLoading}
                plotMode={signalType === 'raw' ? 'raw' : 'activated'}
                setPlotMode={(mode: 'raw' | 'activated') => setSignalType(mode)}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="game" className="bg-gray-50/50 p-4 rounded-b-lg">
       
        <PerformanceCard 
          analysisResult={liveAnalytics ? { ...analysisResult!, analytics: liveAnalytics } : analysisResult}
          sessionParams={sessionParams}
          contractionDurationThreshold={sessionParams.contraction_duration_threshold ?? undefined}
        />
      </TabsContent>

      <TabsContent value="bfr" className="p-4 bg-white rounded-lg shadow-sm">
        <BFRMonitoringTab />
      </TabsContent>

      {(userRole === 'RESEARCHER' || userRole === 'ADMIN') && (
        <TabsContent value="export" className="p-4 bg-white rounded-lg shadow-sm">
          <ExportTab 
            analysisResult={analysisResult}
            uploadedFileName={uploadedFileName}
          />
        </TabsContent>
      )}
    </Tabs>
  );
} 