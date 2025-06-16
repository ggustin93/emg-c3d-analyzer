import React, { useState, useMemo, useCallback } from "react";
// Removed unused Recharts imports, EMGChart import is now only for its types if needed elsewhere, actual component used in GameSessionTabs
import type {
  EMGAnalysisResult,
  ChannelAnalyticsData,
  GameSessionParameters
} from './types/emg'; // EmgSignalData, StatsData might be handled by hooks
import FileUpload from "./components/FileUpload";
import GameSessionTabs from "./components/sessions/game-session-tabs";
import QuickSelect from "./components/QuickSelect"; // Import QuickSelect
import Spinner from "./components/ui/Spinner"; // Using the new CSS spinner
import SessionConfigPanel from "./components/SessionConfigPanel"; // Import the new component
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
  
  // State for session parameters
  const [sessionParams, setSessionParams] = useState<GameSessionParameters>({
    session_mvc_value: 0.00015,
    session_mvc_threshold_percentage: 75,
    session_expected_contractions: 12
  });
  
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
    // Don't reset sessionParams here, therapist might want to keep them for next upload
  }, [resetChannelSelections, resetPlotDataAndStats, resetGameSessionData]);

  const handleSuccess = useCallback((data: EMGAnalysisResult) => {
    resetState();
    setAnalysisResult(data);
    updateChannelsAfterUpload(data);
    determineChannelsForTabs(data);
    setActiveTab("plots");
    
    // Update sessionParams from the response if available
    if (data.metadata.session_parameters_used) {
      setSessionParams(data.metadata.session_parameters_used);
    }
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
      
      // Add session parameters to the form data
      if (sessionParams.session_mvc_value !== null && sessionParams.session_mvc_value !== undefined) {
        formData.append('session_mvc_value', String(sessionParams.session_mvc_value));
      }
      if (sessionParams.session_mvc_threshold_percentage !== null && sessionParams.session_mvc_threshold_percentage !== undefined) {
        formData.append('session_mvc_threshold_percentage', String(sessionParams.session_mvc_threshold_percentage));
      }
      if (sessionParams.session_expected_contractions !== null && sessionParams.session_expected_contractions !== undefined) {
        formData.append('session_expected_contractions', String(sessionParams.session_expected_contractions));
      }

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
  }, [handleSuccess, handleError, resetState, sessionParams]);

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

  // Calculate actual MVC threshold for the plot if params are set
  const mvcThresholdForPlot = useMemo(() => {
    if (analysisResult?.metadata.session_parameters_used?.session_mvc_value &&
        analysisResult?.metadata.session_parameters_used?.session_mvc_threshold_percentage) {
      return (analysisResult.metadata.session_parameters_used.session_mvc_value * 
              analysisResult.metadata.session_parameters_used.session_mvc_threshold_percentage) / 100;
    }
    return null;
  }, [analysisResult]);

  return (
    <div className="App min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto p-5">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <span className="text-teal-600 mr-2">EMG</span> C3D Analyzer
            <span className="ml-3 text-xs font-normal px-2 py-1 bg-teal-100 text-teal-800 rounded-full">v1.0</span>
          </h1>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload C3D File
            </h2>
            <FileUpload 
              onUploadSuccess={handleSuccess}
              onUploadError={handleError}
              setIsLoading={setIsLoading}
              currentSessionParams={sessionParams}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Session Parameters
            </h2>
            <SessionConfigPanel 
              sessionParams={sessionParams}
              onParamsChange={setSessionParams}
              disabled={appIsLoading}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Quick Samples
            </h2>
            <QuickSelect onSelect={handleQuickSelect} disabled={appIsLoading} />
          </div>
        </div>

        {appIsLoading && (
          <div className="flex flex-col items-center justify-center my-8 p-8 bg-white rounded-xl shadow-sm border border-slate-200">
            <Spinner />
            <p className="mt-4 text-lg font-medium text-slate-700">Analyzing EMG Data...</p>
            <p className="text-sm text-slate-500">Please wait, this may take a moment.</p>
          </div>
        )}

        {combinedError && !appIsLoading && (
            <div className="my-8 p-5 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{combinedError}</p>
              </div>
            </div>
        )}
        
        {!appIsLoading && !combinedError && analysisResult && currentGameSession && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Session Analysis
              </h2>
              <div className="px-3 py-1 bg-slate-100 rounded-lg text-sm font-mono text-slate-600 truncate max-w-[300px]">
                {analysisResult.source_filename}
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <GameSessionTabs
                selectedGameSession={currentGameSession}
                emgTimeSeriesData={currentEMGTimeSeriesDataForTabs} 
                mvcPercentage={currentGameSession?.parameters?.targetMVC || 70} 
                leftQuadChannelName={leftQuadChannelForTabs}
                rightQuadChannelName={rightQuadChannelForTabs}
                
                analysisResult={analysisResult}
                mvcThresholdForPlot={mvcThresholdForPlot}
                sessionExpectedContractions={analysisResult.metadata.session_parameters_used?.session_expected_contractions ?? null}
                
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
                sessionParams={sessionParams}
                onSessionParamsChange={setSessionParams}
                appIsLoading={appIsLoading}
              />
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-5 text-center text-sm text-slate-500">
          <p>EMG C3D Analyzer - A tool for analyzing electromyography data from C3D files</p>
          <p className="mt-1">© {new Date().getFullYear()} GHOSTLY+ Research Team</p>
        </div>
      </footer>
    </div>
  );
}

export default App;