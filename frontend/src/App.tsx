import React, { useState, useMemo, useCallback } from "react";
// Removed unused Recharts imports, EMGChart import is now only for its types if needed elsewhere, actual component used in GameSessionTabs
import type {
  EMGAnalysisResult,
  ChannelAnalyticsData
} from './types/emg'; // EmgSignalData, StatsData might be handled by hooks
import FileUpload from "./components/FileUpload";
import GameSessionTabs from "./components/sessions/game-session-tabs";
// GameSession, EMGDataPoint, EMGMetrics, GameParameters, BFRParameters are used by hooks or GameSessionTabs

// Import hooks
import { useDataDownsampling } from "./hooks/useDataDownsampling";
import { useChannelManagement } from "./hooks/useChannelManagement";
import { useEmgDataFetching } from "./hooks/useEmgDataFetching";
import { useGameSessionData } from "./hooks/useGameSessionData";
import { CombinedChartDataPoint } from "./components/EMGChart"; // This type might move later

function App() {
  const [analysisResult, setAnalysisResult] = useState<EMGAnalysisResult | null>(null);
  const [appOverallError, setAppOverallError] = useState<string | null>(null); // For errors not from data fetching hooks
  const [isUploading, setIsUploading] = useState<boolean>(false); // For FileUpload loading state

  // Initialize hooks
  const downsamplingControls = useDataDownsampling(1000);
  const {
    plotChannel1Name,
    setPlotChannel1Name,
    plotChannel2Name,
    setPlotChannel2Name,
    availableChannels,
    updateChannelsAfterUpload,
    resetChannelSelections,
  } = useChannelManagement(analysisResult);

  const {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataFetchingLoading,
    dataFetchingError,
    fetchChannelRawData,
    resetPlotDataAndStats,
  } = useEmgDataFetching(analysisResult, plotChannel1Name, plotChannel2Name, downsamplingControls);

  const {
    currentGameSession,
    currentEMGTimeSeriesDataForTabs,
    leftQuadChannelForTabs,
    rightQuadChannelForTabs,
    tabsDataLoading,
    tabsDataError,
    determineChannelsForTabs,
    resetGameSessionData,
  } = useGameSessionData(
    analysisResult,
    plotChannel1Data, // Pass main plot data for context if needed by session logic
    plotChannel2Data,
    plotChannel1Name,
    plotChannel2Name,
    { fetchChannelRawData } // Pass the fetcher for tab-specific data
  );

  const handleUploadSuccess = useCallback((data: EMGAnalysisResult) => {
    setAnalysisResult(data);
    setAppOverallError(null);
    updateChannelsAfterUpload(data); // Update available channels and set initial plot channels
    determineChannelsForTabs(data); // Determine channels for the session tabs muscle chart
    // Data for plots and session will be fetched/derived by hooks based on new analysisResult and channel names
  }, [updateChannelsAfterUpload, determineChannelsForTabs]);

  const handleUploadError = useCallback((errorMsg: string) => {
    setAppOverallError(errorMsg); 
    setAnalysisResult(null); 
    resetChannelSelections();
    resetPlotDataAndStats();
    resetGameSessionData();
  }, [resetChannelSelections, resetPlotDataAndStats, resetGameSessionData]);

  // Combined chart data for the main EMG Chart (primarily for the EMG Analysis tab)
  const mainCombinedChartData = useMemo<CombinedChartDataPoint[]>(() => {
    const series1 = plotChannel1Data;
    const series2 = plotChannel2Data;
    const name1 = plotChannel1Name;
    const name2 = plotChannel2Name;

    if (!series1 && !series2) return [];

    const maxLength = Math.max(series1?.data.length || 0, series2?.data.length || 0);
    const newChartData: CombinedChartDataPoint[] = [];

    for (let i = 0; i < maxLength; i++) {
      const time = series1?.time_axis[i] ?? series2?.time_axis[i] ?? 0;
      const point: CombinedChartDataPoint = { time };

      if (name1 && series1 && i < series1.data.length) {
        point[name1] = series1.data[i];
      }
      if (name2 && series2 && i < series2.data.length) {
        point[name2] = series2.data[i];
      }
      if (Object.keys(point).length > 1) {
          newChartData.push(point);
      }
    }
    return newChartData;
  }, [plotChannel1Data, plotChannel2Data, plotChannel1Name, plotChannel2Name]);

  const currentChannelAnalytics: ChannelAnalyticsData | null = 
    analysisResult && plotChannel1Name ? analysisResult.analytics[plotChannel1Name] : null;

  // Overall loading state considers FileUpload, main data fetching, and tabs data fetching
  const appLoading = isUploading || dataFetchingLoading || tabsDataLoading;
  // Combine error messages from different sources
  const combinedError = [appOverallError, dataFetchingError, tabsDataError].filter(Boolean).join("; ");

  return (
    <div className="App p-5 font-sans max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold border-b-2 border-primary pb-3 mb-4 text-slate-700">
        EMG C3D Analyzer
      </h1>

      <FileUpload 
        onUploadSuccess={handleUploadSuccess} 
        onUploadError={handleUploadError}
        setIsLoading={setIsUploading} // FileUpload manages its own loading state for the upload process
      />

      {appLoading && <div className="text-center my-4">Loading data...</div>}
      {combinedError && <div className="text-center my-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">Error: {combinedError}</div>}
      
      {analysisResult && currentGameSession && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3 text-slate-600">Session Analysis</h2>
          
          <GameSessionTabs
            selectedGameSession={currentGameSession}
            emgTimeSeriesData={currentEMGTimeSeriesDataForTabs} // Specifically for tabs
            mvcPercentage={currentGameSession?.parameters?.targetMVC || 70} 
            leftQuadChannelName={leftQuadChannelForTabs}
            rightQuadChannelName={rightQuadChannelForTabs}
            rawApiData={analysisResult} // Keep passing this for any direct needs in tabs

            // Props for the "EMG Analysis" tab section (main chart and controls)
            analysisResult={analysisResult} // For metadata, etc.
            availableChannels={availableChannels}
            plotChannel1Name={plotChannel1Name}
            setPlotChannel1Name={setPlotChannel1Name}
            plotChannel2Name={plotChannel2Name}
            setPlotChannel2Name={setPlotChannel2Name}
            selectedChannelForStats={plotChannel1Name} // Stats are based on plotChannel1Name
            setSelectedChannelForStats={setPlotChannel1Name} // Setter for stats channel is tied to plotChannel1Name setter
            currentStats={currentStats}
            currentChannelAnalyticsData={currentChannelAnalytics}
            mainChartData={mainCombinedChartData} // Data for the main EMG chart in the tab
            dataPoints={downsamplingControls.dataPoints}
            handleDataPointsChange={downsamplingControls.handleDataPointsChange}
            mainPlotChannel1Data={plotChannel1Data} // Raw data for potential direct use or checks in tabs
            mainPlotChannel2Data={plotChannel2Data}
          />
        </div>
      )}
    </div>
  );
}

export default App;