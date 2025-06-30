import React, { useState, useMemo, useCallback, useEffect } from "react";
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
import { usePlotDataProcessor } from "./hooks/useEmgDataFetching";
import { useGameSessionData } from "./hooks/useGameSessionData";
import { useMvcInitialization } from "./hooks/useMvcInitialization";
import { useMuscleDefaults } from "./hooks/useMuscleDefaults";
import { CombinedChartDataPoint } from "./components/EMGChart"; // This type might move later
import SessionLoader from "./components/SessionLoader";
import { Button } from "./components/ui/button";
import { useSessionStore } from './store/sessionStore';

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
  
  // State for session parameters from Zustand store
  const { sessionParams, setSessionParams, resetSessionParams } = useSessionStore();
  
  // Save sessionParams to localStorage whenever they change
  useEffect(() => {
    // This is now handled by the persist middleware in Zustand
  }, [sessionParams]);
  
  // Initialize hooks
  const downsamplingControls = useDataDownsampling(2000);
  const { initializeMvcValues } = useMvcInitialization();
  const { ensureDefaultMuscleGroups } = useMuscleDefaults();
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

  // Ensure muscle mappings are initialized
  useEffect(() => {
    // Check if we need to initialize the mappings
    const hasChannelMuscleMapping = sessionParams.channel_muscle_mapping && 
                                   typeof sessionParams.channel_muscle_mapping === 'object';
    const hasMuscleColorMapping = sessionParams.muscle_color_mapping && 
                                 typeof sessionParams.muscle_color_mapping === 'object';
                                 
    const needsInitialization = !hasChannelMuscleMapping || !hasMuscleColorMapping ||
                               (hasChannelMuscleMapping && Object.keys(sessionParams.channel_muscle_mapping).length === 0) ||
                               (hasMuscleColorMapping && Object.keys(sessionParams.muscle_color_mapping).length === 0);
    
    if (needsInitialization) {
      setSessionParams(prev => ({
        ...prev,
        channel_muscle_mapping: {
          ...(prev.channel_muscle_mapping || {}),
          "CH1": "Left Quadriceps",
          "CH2": "Right Quadriceps"
        },
        muscle_color_mapping: {
          ...(prev.muscle_color_mapping || {}),
          "Left Quadriceps": "#3b82f6", // Blue
          "Right Quadriceps": "#ef4444"  // Red
        }
      }));
    }
  }, []);

  const {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataProcessingLoading,
    dataProcessingError,
    resetPlotDataAndStats,
  } = usePlotDataProcessor(
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
    plotChannel1Data,
    plotChannel2Data,
    plotChannel1Name,
    plotChannel2Name
  );

  const resetState = useCallback(() => {
    setAnalysisResult(null);
    setAppError(null);
    resetChannelSelections();
    resetPlotDataAndStats();
    resetGameSessionData();
    setSelectedChannelForStats(null);
    setActiveTab("plots"); // Set to the combined EMG Analysis tab
    resetSessionParams();
  }, [resetChannelSelections, resetPlotDataAndStats, resetGameSessionData, resetSessionParams]);

  const handleSuccess = useCallback((data: EMGAnalysisResult) => {
    resetState();
    setAnalysisResult(data);
    updateChannelsAfterUpload(data);
    determineChannelsForTabs(data);
    setActiveTab("plots"); // Keep default tab as "plots" which is now the combined EMG Analysis tab
    
    // Update sessionParams from the response if available
    if (data && data.metadata && data.metadata.session_parameters_used) {
      // Get the available channels from the data
      const availableChannels = data.analytics ? Object.keys(data.analytics) : [];
      
      // Step 1: Initialize session parameters with default muscle groups (Quadriceps)
      let updatedSessionParams = ensureDefaultMuscleGroups(
        availableChannels, 
        data.metadata.session_parameters_used || sessionParams
      );
      
      // Step 2: Initialize MVC values and thresholds
      updatedSessionParams = initializeMvcValues(data, updatedSessionParams);
      
      // Log the updated parameters
      console.log('Setting session params from upload:', {
        availableChannels,
        channel_muscle_mapping: updatedSessionParams.channel_muscle_mapping,
        session_mvc_values: updatedSessionParams.session_mvc_values,
        session_mvc_threshold_percentages: updatedSessionParams.session_mvc_threshold_percentages
      });
      
      // Step 3: Update the session parameters
      setSessionParams(updatedSessionParams);
    }
  }, [resetState, updateChannelsAfterUpload, determineChannelsForTabs, setActiveTab, sessionParams, initializeMvcValues, ensureDefaultMuscleGroups]);
  
  const handleError = useCallback((errorMsg: string) => {
    resetState();
    setAppError(errorMsg);
  }, [resetState]);

  // Function to handle recalculating scores with updated parameters
  // This is now handled client-side by updating sessionParams
  // The 'recalculate' button is now a 'refresh' of the analysis with new params
  const handleRecalculateScores = useCallback(async () => {
    // This is now a client-side only operation, we just need to trigger re-renders
    // The hooks should be designed to react to changes in sessionParams
    console.log("Re-evaluating with new session parameters.", sessionParams);
    // The actual recalculation will happen within the hooks that depend on sessionParams
  }, [sessionParams]);

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
      
      // Add all session parameters to the form data
      if (sessionParams) {
        Object.keys(sessionParams).forEach(key => {
          const value = sessionParams[key];
          if (value !== null && value !== undefined) {
            if (key === 'channel_muscle_mapping' || key === 'muscle_color_mapping' || 
                key === 'session_mvc_values' || key === 'session_mvc_threshold_percentages') {
              formData.append(key, JSON.stringify(value || {}));
            } else {
              formData.append(key, String(value));
            }
          }
        });
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
      
      // Add all session parameters to the form data
      if (sessionParams) {
        Object.keys(sessionParams).forEach(key => {
          const value = sessionParams[key];
          if (value !== null && value !== undefined) {
            if (key === 'channel_muscle_mapping' || key === 'muscle_color_mapping' || 
                key === 'session_mvc_values' || key === 'session_mvc_threshold_percentages') {
              formData.append(key, JSON.stringify(value || {}));
            } else {
              formData.append(key, String(value));
            }
          }
        });
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

    console.log('Chart data generation:', { name1, name2, series1Length: series1?.data?.length, series2Length: series2?.data?.length });

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
      
      // Only add points that have at least one data value
      if (Object.keys(point).length > 1) {
        newChartData.push(point);
      }
    }
    
    // If we have no data points but have series data, create a placeholder point
    if (newChartData.length === 0 && (series1 || series2)) {
      const placeholderPoint: CombinedChartDataPoint = { time: 0 };
      if (name1 && series1) {
        placeholderPoint[name1] = 0;
      }
      if (name2 && series2) {
        placeholderPoint[name2] = 0;
      }
      newChartData.push(placeholderPoint);
    }
    
    console.log('Generated chart data points:', newChartData.length);
    return newChartData;
  }, [plotChannel1Data, plotChannel2Data, plotChannel1Name, plotChannel2Name]);

  const appIsLoading = isLoading || dataProcessingLoading || tabsDataLoading;
  const combinedError = [appError, dataProcessingError, tabsDataError].filter(Boolean).join("; ");

  // Calculate actual MVC threshold for the plot if params are set
  const mvcThresholdForPlot = useMemo(() => {
    // We no longer use global MVC threshold - channel-specific thresholds are handled in EMGChart
    // This is kept as null for backward compatibility with components that might expect this prop
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
              mvcThresholdForPlot={null}
              muscleChannels={muscleChannels}
              allAvailableChannels={allAvailableChannels}
              plotChannel1Name={plotChannel1Name}
              setPlotChannel1Name={setPlotChannel1Name}
              plotChannel2Name={plotChannel2Name}
              setPlotChannel2Name={setPlotChannel2Name}
              selectedChannelForStats={selectedChannelForStats}
              setSelectedChannelForStats={setSelectedChannelForStats}
              currentStats={currentStats}
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