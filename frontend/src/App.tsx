import React, { useState, useMemo, useCallback } from "react";
// Removed unused Recharts imports, EMGChart import is now only for its types if needed elsewhere, actual component used in GameSessionTabs
import type {
  EMGAnalysisResult,
  ChannelAnalyticsData
} from './types/emg'; // EmgSignalData, StatsData might be handled by hooks
import FileUpload from "./components/FileUpload";
import GameSessionTabs from "./components/sessions/game-session-tabs";
import QuickSelect from "./components/QuickSelect"; // Import QuickSelect
import Spinner from "./components/ui/Spinner"; // Using the new CSS spinner
// GameSession, EMGDataPoint, EMGMetrics, GameParameters, BFRParameters are used by hooks or GameSessionTabs

// Import hooks
import { useDataDownsampling } from "./hooks/useDataDownsampling";
import { useChannelManagement } from "./hooks/useChannelManagement";
import { useEmgDataFetching } from "./hooks/useEmgDataFetching";
import { useGameSessionData } from "./hooks/useGameSessionData";
import { CombinedChartDataPoint } from "./components/EMGChart"; // This type might move later

function App() {
  const [analysisResult, setAnalysisResult] = useState<EMGAnalysisResult | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("plots");
  const [plotMode, setPlotMode] = useState<'raw' | 'activated'>('raw');
  
  // Initialize hooks
  const downsamplingControls = useDataDownsampling(1000);
  const {
    plotChannel1Name,
    setPlotChannel1Name,
    plotChannel2Name,
    setPlotChannel2Name,
    selectedChannelForStats, 
    setSelectedChannelForStats,
    muscleChannels,
    allAvailableChannels,
    updateChannelsAfterUpload,
    resetChannelSelections,
  } = useChannelManagement(analysisResult, plotMode);

  const {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataFetchingLoading,
    dataFetchingError,
    fetchChannelRawData,
    resetPlotDataAndStats,
  } = useEmgDataFetching(
    analysisResult, 
    plotChannel1Name, 
    plotChannel2Name, 
    selectedChannelForStats, 
    downsamplingControls
  );

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

  const resetState = useCallback(() => {
    setAnalysisResult(null);
    setAppError(null);
    resetChannelSelections();
    resetPlotDataAndStats();
    resetGameSessionData();
    setSelectedChannelForStats(null);
    setActiveTab("plots");
  }, [resetChannelSelections, resetPlotDataAndStats, resetGameSessionData]);

  const handleSuccess = useCallback((data: EMGAnalysisResult) => {
    resetState();
    setAnalysisResult(data);
    updateChannelsAfterUpload(data);
    determineChannelsForTabs(data);
    setActiveTab("plots");
  }, [resetState, updateChannelsAfterUpload, determineChannelsForTabs]);
  
  const handleError = useCallback((errorMsg: string) => {
    resetState();
    setAppError(errorMsg);
  }, [resetState]);

  const handleQuickSelect = useCallback(async (filename: string) => {
    setIsLoading(true);
    setAppError(null);
    resetState();

    try {
      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) throw new Error(`Could not fetch test file.`);
      
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch((process.env.REACT_APP_API_URL || 'http://localhost:8080') + '/upload', {
          method: 'POST',
          body: formData,
      });

      if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.detail || 'File processing failed.');
      }

      const resultData = await uploadResponse.json();
      handleSuccess(resultData);

    } catch (error: any) {
      handleError(error.message || 'An unknown error occurred while processing the test file.');
    } finally {
      setIsLoading(false);
    }
  }, [handleSuccess, handleError, resetState]);

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
    analysisResult && selectedChannelForStats ? analysisResult.analytics[selectedChannelForStats] : null;

  const appIsLoading = isLoading || dataFetchingLoading || tabsDataLoading;
  const combinedError = [appError, dataFetchingError, tabsDataError].filter(Boolean).join("; ");

  return (
    <div className="App p-5 font-sans max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold border-b-2 border-primary pb-3 mb-4 text-slate-700">
        EMG C3D Analyzer
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 p-4 border rounded-lg bg-slate-50">
        <FileUpload 
          onUploadSuccess={handleSuccess}
          onUploadError={handleError}
          setIsLoading={setIsLoading}
        />
        <QuickSelect onSelect={handleQuickSelect} disabled={appIsLoading} />
      </div>

      {appIsLoading && (
        <div className="flex flex-col items-center justify-center my-8 p-6 bg-slate-100 rounded-lg">
          <Spinner />
          <p className="mt-4 text-lg font-medium text-slate-600">Analyzing EMG Data...</p>
          <p className="text-sm text-slate-500">Please wait, this may take a moment.</p>
        </div>
      )}

      {combinedError && !appIsLoading && (
          <div className="text-center my-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
            Error: {combinedError}
          </div>
      )}
      
      {!appIsLoading && !combinedError && analysisResult && currentGameSession && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3 text-slate-600">
            Session Analysis: <span className="font-mono text-base bg-slate-200 px-2 py-1 rounded-md">{analysisResult.source_filename}</span>
          </h2>
          
          <GameSessionTabs
            selectedGameSession={currentGameSession}
            emgTimeSeriesData={currentEMGTimeSeriesDataForTabs} // Specifically for tabs
            mvcPercentage={currentGameSession?.parameters?.targetMVC || 70} 
            leftQuadChannelName={leftQuadChannelForTabs}
            rightQuadChannelName={rightQuadChannelForTabs}
            
            analysisResult={analysisResult}

            muscleChannels={muscleChannels}
            allAvailableChannels={allAvailableChannels}
            plotChannel1Name={plotChannel1Name}
            setPlotChannel1Name={setPlotChannel1Name}
            plotChannel2Name={plotChannel2Name}
            setPlotChannel2Name={setPlotChannel2Name}
            
            selectedChannelForStats={selectedChannelForStats}
            setSelectedChannelForStats={setSelectedChannelForStats}

            currentStats={currentStats}
            currentChannelAnalyticsData={currentChannelAnalytics}

            mainChartData={mainCombinedChartData}
            
            dataPoints={downsamplingControls.dataPoints}
            setDataPoints={downsamplingControls.setDataPoints}
            handleDataPointsChange={downsamplingControls.handleDataPointsChange}
            mainPlotChannel1Data={plotChannel1Data}
            mainPlotChannel2Data={plotChannel2Data}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            plotMode={plotMode}
            setPlotMode={setPlotMode}
          />
        </div>
      )}
    </div>
  );
}

export default App;