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
import ScoringConfigPanel from "./components/SessionConfigPanel"; // Import the new component
// GameSession, EMGDataPoint, EMGMetrics, GameParameters, BFRParameters are used by hooks or GameSessionTabs

// Import hooks
import { useDataDownsampling } from "./hooks/useDataDownsampling";
import { useChannelManagement } from "./hooks/useChannelManagement";
import { useEmgDataFetching } from "./hooks/useEmgDataFetching";
import { useGameSessionData } from "./hooks/useGameSessionData";
import { CombinedChartDataPoint } from "./components/EMGChart"; // This type might move later
import SessionLoader from "./components/SessionLoader";
import { Button } from "./components/ui/button";

// Import Stagewise components
import { StagewiseToolbar } from "@stagewise/toolbar-react";
import { ReactPlugin } from "@stagewise-plugins/react";

// Define Stagewise configuration
const stagewiseConfig = {
  plugins: [ReactPlugin],
};

function App() {
  const [analysisResult, setAnalysisResult] = useState<EMGAnalysisResult | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("plots");
  const [plotMode, setPlotMode] = useState<'raw' | 'activated'>('activated');
  
  // State for session parameters
  const [sessionParams, setSessionParams] = useState<GameSessionParameters>({
    session_mvc_value: 0.00015,
    session_mvc_threshold_percentage: 75,
    session_expected_contractions: 12,
    session_expected_contractions_ch1: null,
    session_expected_contractions_ch2: null,
    channel_muscle_mapping: {
      "CH1": "Left Quadriceps",
      "CH2": "Right Quadriceps"
    }
  });
  
  // Initialize hooks
  const downsamplingControls = useDataDownsampling(2000);
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
      setSessionParams({
        ...sessionParams,
        ...data.metadata.session_parameters_used
      });
    }
  }, [resetState, updateChannelsAfterUpload, determineChannelsForTabs, sessionParams]);
  
  const handleError = useCallback((errorMsg: string) => {
    resetState();
    setAppError(errorMsg);
  }, [resetState]);

  // Function to handle recalculating scores with updated parameters
  const handleRecalculateScores = useCallback(async () => {
    if (!analysisResult) return;
    
    setIsLoading(true);
    setAppError(null);
    
    try {
      // Create FormData for the recalculation request
      const formData = new FormData();
      formData.append('result_id', analysisResult.file_id);
      
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
      if (sessionParams.session_expected_contractions_ch1 !== null && sessionParams.session_expected_contractions_ch1 !== undefined) {
        formData.append('session_expected_contractions_ch1', String(sessionParams.session_expected_contractions_ch1));
      }
      if (sessionParams.session_expected_contractions_ch2 !== null && sessionParams.session_expected_contractions_ch2 !== undefined) {
        formData.append('session_expected_contractions_ch2', String(sessionParams.session_expected_contractions_ch2));
      }
      if (sessionParams.session_expected_long_left !== null && sessionParams.session_expected_long_left !== undefined) {
        formData.append('session_expected_long_left', String(sessionParams.session_expected_long_left));
      }
      if (sessionParams.session_expected_short_left !== null && sessionParams.session_expected_short_left !== undefined) {
        formData.append('session_expected_short_left', String(sessionParams.session_expected_short_left));
      }
      if (sessionParams.session_expected_long_right !== null && sessionParams.session_expected_long_right !== undefined) {
        formData.append('session_expected_long_right', String(sessionParams.session_expected_long_right));
      }
      if (sessionParams.session_expected_short_right !== null && sessionParams.session_expected_short_right !== undefined) {
        formData.append('session_expected_short_right', String(sessionParams.session_expected_short_right));
      }
      if (sessionParams.contraction_duration_threshold !== null && sessionParams.contraction_duration_threshold !== undefined) {
        formData.append('contraction_duration_threshold', String(sessionParams.contraction_duration_threshold));
      }
      if (sessionParams.channel_muscle_mapping) {
        formData.append('channel_muscle_mapping', JSON.stringify(sessionParams.channel_muscle_mapping));
      }

      // Send the request to recalculate scores
      const recalculateResponse = await fetch((process.env.REACT_APP_API_URL || 'http://localhost:8080') + '/recalculate-scores', {
        method: 'POST',
        body: formData,
      });

      if (!recalculateResponse.ok) {
        const errorData = await recalculateResponse.json();
        throw new Error(errorData.detail || 'Score recalculation failed.');
      }

      const resultData = await recalculateResponse.json();
      handleSuccess(resultData);
      
      // Switch to the Game Stats tab after recalculation
      setActiveTab("game-stats");
      
    } catch (error: any) {
      handleError(error.message || 'An unknown error occurred while recalculating scores.');
    } finally {
      setIsLoading(false);
    }
  }, [analysisResult, sessionParams, handleSuccess, handleError]);

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
      if (sessionParams.session_expected_contractions_ch1 !== null && sessionParams.session_expected_contractions_ch1 !== undefined) {
        formData.append('session_expected_contractions_ch1', String(sessionParams.session_expected_contractions_ch1));
      }
      if (sessionParams.session_expected_contractions_ch2 !== null && sessionParams.session_expected_contractions_ch2 !== undefined) {
        formData.append('session_expected_contractions_ch2', String(sessionParams.session_expected_contractions_ch2));
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

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setAppError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      Object.keys(sessionParams).forEach(key => {
        const value = sessionParams[key];
        if (value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });

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
      handleError(error.message || 'An unknown error occurred during upload.');
    } finally {
      setIsLoading(false);
    }
  };

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
    <>
      {/* Stagewise Toolbar - only renders in development mode */}
      <StagewiseToolbar config={stagewiseConfig} />
      
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center space-x-3 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h1 className="text-3xl font-light text-slate-800 tracking-tight">EMG C3D Analyzer</h1>
              </div>
              {analysisResult && (
                <div className="flex items-center mt-4 space-x-4">
                  <p className="text-sm text-slate-500">
                    File: <span className="font-medium text-slate-700">{analysisResult.source_filename}</span>
                  </p>
                  <Button variant="outline" size="sm" onClick={resetState} className="ml-4">
                    Load Another File
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {!analysisResult ? (
            <SessionLoader
              onUploadSuccess={handleSuccess}
              onUploadError={handleError}
              setIsLoading={setIsLoading}
              onQuickSelect={handleQuickSelect}
              isLoading={isLoading}
              sessionParams={sessionParams}
            />
          ) : (
            <GameSessionTabs
              analysisResult={analysisResult}
              mvcThresholdForPlot={
                plotMode === 'activated'
                  ? (sessionParams.session_mvc_value ?? 0) * (sessionParams.session_mvc_threshold_percentage ?? 0) / 100
                  : null
              }
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
              onRecalculateScores={handleRecalculateScores}
              appIsLoading={isLoading}
            />
          )}

          {appError && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-md">
              <p><span className="font-medium">Error:</span> {appError}</p>
            </div>
          )}

          {isLoading && !analysisResult && (
             <div className="mt-6 flex flex-col items-center justify-center">
               <Spinner />
               <p className="text-teal-500 mt-2">Analyzing data, please wait...</p>
             </div>
          )}
        </main>
        
        <footer className="bg-white border-t border-slate-100 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-500">
                GHOSTLY+ EMG C3D Analyzer | Research Project
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Developed for rehabilitation research and therapy assessment
              </p>
              <p className="text-xs text-slate-400 mt-1">
                © {new Date().getFullYear()} | Academic Research Tool
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;