import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { EMGAnalysisResult } from './types/emg';
import { GameSessionTabs } from "./components/tabs/shared";
import Spinner from "./components/ui/Spinner";

// Import hooks
import { useDataDownsampling } from "./hooks/useDataDownsampling";
import { useChannelManagement } from "./hooks/useChannelManagement";
import { usePlotDataProcessor } from "./hooks/useEmgDataFetching";
import { useGameSessionData } from "./hooks/useGameSessionData";
import { initializeMvcValuesFromAnalysis } from "@/lib/mvcUtils";
import { useMuscleDefaults } from "./hooks/useMuscleDefaults";
import { CombinedChartDataPoint } from "./components/tabs/SignalPlotsTab/EMGChart";
import { SignalDisplayType } from "./components/tabs/SignalPlotsTab/ThreeChannelSignalSelector";
import AuthGuard from "./components/auth/AuthGuard";
import { useSessionStore } from './store/sessionStore';
import { useAuth } from "./contexts/AuthContext";
import SupabaseStorageService from "./services/supabaseStorage";
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { logger, LogCategory } from './services/logger';
import FileMetadataBar from './components/layout/FileMetadataBar';

// Import dashboard components
// Lazy load dashboard components for better performance
const AdminDashboard = React.lazy(() => import('./components/dashboards/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const TherapistDashboard = React.lazy(() => import('./components/dashboards/therapist/TherapistDashboard').then(module => ({ default: module.TherapistDashboard })));
const ResearcherDashboard = React.lazy(() => import('./components/dashboards/researcher/ResearcherDashboard').then(module => ({ default: module.ResearcherDashboard })));

// Development tools



export function AppContent() {
  const [searchParams] = useSearchParams();
  const [analysisResult, setAnalysisResult] = useState<EMGAnalysisResult | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("plots");
  const [signalType, setSignalType] = useState<SignalDisplayType>('processed');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  // Authentication state
  const { user, userRole } = useAuth();
  const isAuthenticated = !!user;
  
  // Loading overlay component (KISS: Simple, focused component)
  const AnalysisLoadingOverlay = () => (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md mx-4 border border-gray-100">
        <div className="mb-6">
          <div className="relative flex justify-center">
            <div className="w-16 h-16">
              <Spinner />
            </div>
            <div className="absolute inset-0 animate-ping">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-200"></div>
            </div>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          Processing EMG Analysis
        </h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Analyzing C3D file and extracting EMG signals...<br />
          <span className="text-xs text-gray-500">This may take a few moments</span>
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full animate-pulse transition-all duration-1000" 
               style={{width: '75%'}}></div>
        </div>
      </div>
    </div>
  );
  
  // State for session parameters from Zustand store
  const { sessionParams, setSessionParams, resetSessionParams, uploadDate, setUploadDate, selectedFileData } = useSessionStore();
  
  // Save sessionParams to localStorage whenever they change
  useEffect(() => {
    // This is now handled by the persist middleware in Zustand
  }, [sessionParams]);

  // Initialize hooks
  const downsamplingControls = useDataDownsampling(2500);
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
  } = useChannelManagement(analysisResult, signalType);

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
  }, [sessionParams.channel_muscle_mapping, sessionParams.muscle_color_mapping, setSessionParams]);

  const {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    resetPlotDataAndStats,
  } = usePlotDataProcessor(
    analysisResult, 
    plotChannel1Name, 
    plotChannel2Name, 
    selectedChannelForStats, 
    downsamplingControls
  );

  const {
    determineChannelsForTabs,
    resetGameSessionData,
  } = useGameSessionData(
    analysisResult,
    plotChannel1Data,
    plotChannel2Data,
    plotChannel1Name,
    plotChannel2Name
  );

  // Reset all state when user wants to load a new file
  const resetState = useCallback(() => {
    logger.debug(LogCategory.LIFECYCLE, '🔄 resetState called - clearing upload date');
    setAnalysisResult(null);
    setAppError(null);
    setUploadedFileName(null);
    resetPlotDataAndStats();
    resetChannelSelections();
    resetGameSessionData();
    setSelectedChannelForStats(null);
    setActiveTab("plots"); // Set to the combined EMG Analysis tab
    setUploadDate(null); // Clear the upload date before resetting session params
    resetSessionParams();
    setIsLoading(false); // Ensure loading state is reset
  }, [resetChannelSelections, resetPlotDataAndStats, resetGameSessionData, resetSessionParams, setSelectedChannelForStats, setUploadDate]);

  const handleSuccess = useCallback((data: EMGAnalysisResult, filename?: string) => {
    // BUNDLED DATA PATTERN:
    // The backend now returns all necessary data in a single response, implementing a stateless
    // architecture. This includes complete EMG signals, analytics, and metadata in one payload,
    // eliminating the need for additional API calls and enabling immediate visualization.
    // The emg_signals field contains all signal data (raw, activated, RMS envelopes) needed
    // for client-side plotting and analysis.
    
    // Store the current upload date before resetting state
    const currentUploadDate = uploadDate;
    
    logger.debug(LogCategory.LIFECYCLE, '🔄 handleSuccess - Setting analysis result:', {
      currentUploadDate,
      uploadDateType: typeof currentUploadDate,
      uploadDateFromStore: uploadDate,
      hasAnalysisData: !!data
    });
    
    // Reset individual state components without affecting analysisResult
    setAppError(null);
    resetPlotDataAndStats();
    resetChannelSelections();
    resetGameSessionData();
    setSelectedChannelForStats(null);
    setIsLoading(false);
    
    // Set the analysis result BEFORE any other operations to trigger navigation
    setAnalysisResult(data);
    updateChannelsAfterUpload(data);
    determineChannelsForTabs(data);
    setActiveTab("plots"); // Keep default tab as "plots" which is now the combined EMG Analysis tab
    
    // Store the filename if provided (from direct upload)
    if (filename) {
      setUploadedFileName(filename);
    }
    
    // Update sessionParams from the response if available
    if (data && data.metadata && data.metadata.session_parameters_used) {
      const availableChannels = data.analytics ? Object.keys(data.analytics) : [];
      
      let updatedSessionParams = ensureDefaultMuscleGroups(
        availableChannels, 
        data.metadata.session_parameters_used || sessionParams
      );
      
      updatedSessionParams = initializeMvcValuesFromAnalysis(data, updatedSessionParams);
      
      if (data.metadata.score !== undefined) {
        updatedSessionParams.game_score = data.metadata.score;
      }
      if (data.metadata.level !== undefined) {
        updatedSessionParams.game_level = Number(data.metadata.level);
      }
      
      // Log the updated parameters
      logger.debug(LogCategory.DATA_PROCESSING, 'Setting session params from upload:', {
        availableChannels,
        channel_muscle_mapping: updatedSessionParams.channel_muscle_mapping,
        session_mvc_values: updatedSessionParams.session_mvc_values,
        session_mvc_threshold_percentages: updatedSessionParams.session_mvc_threshold_percentages,
        game_score: updatedSessionParams.game_score,
        game_level: updatedSessionParams.game_level
      });
      
      // Step 4: Update the session parameters
      setSessionParams(updatedSessionParams);
    }
  }, [updateChannelsAfterUpload, determineChannelsForTabs, sessionParams, ensureDefaultMuscleGroups, initializeMvcValuesFromAnalysis, setSessionParams, uploadDate, resetPlotDataAndStats, resetChannelSelections, resetGameSessionData]);
  
  const handleError = useCallback((errorMsg: string) => {
    resetState();
    setAppError(errorMsg);
  }, [resetState]);


  // Handle quick select from the file browser
  const handleQuickSelect = useCallback(async (filename: string, uploadDateFromBrowser?: string) => {
    try {
      logger.info(LogCategory.API, '🚀 handleQuickSelect starting', { 
        filename, 
        uploadDateFromBrowser,
        apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080' 
      });
      
      setIsLoading(true);
      setAppError(null);
      
      // Use upload date passed directly from browser (best practice: avoid state race conditions)
      logger.debug(LogCategory.API, '🔍 Upload date from browser:', uploadDateFromBrowser);
      
      // Pre-set the upload date before processing (will be preserved by handleSuccess)
      if (uploadDateFromBrowser) {
        setUploadDate(uploadDateFromBrowser);
        logger.debug(LogCategory.API, '✅ Upload date set before processing:', uploadDateFromBrowser);
      }
      
      // ONLY use Supabase storage - no local samples fallback
      if (!SupabaseStorageService.isConfigured()) {
        const bucketName = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';
        throw new Error(`Supabase not configured. Cannot access ${bucketName} bucket.`);
      }

      const bucketName = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';
      logger.info(LogCategory.API, `📥 Downloading from Supabase ${bucketName} bucket:`, filename);
      
      // Check if the file exists in Supabase
      const fileExists = await SupabaseStorageService.fileExists(filename);
      if (!fileExists) {
        const bucketName = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples';
        throw new Error(`File '${filename}' not found in ${bucketName} bucket.`);
      }

      // Get file metadata to extract upload date
      const fileMetadata = await SupabaseStorageService.getFileMetadata(filename);
      logger.debug(LogCategory.API, '🔍 handleQuickSelect - File metadata:', {
        filename,
        fileMetadata: fileMetadata ? {
          ...fileMetadata,
          created_at_type: typeof fileMetadata.created_at
        } : null,
        willSetUploadDate: !!(fileMetadata && fileMetadata.created_at)
      });
      
      if (fileMetadata && fileMetadata.created_at) {
        setUploadDate(fileMetadata.created_at);
        logger.debug(LogCategory.API, '✅ handleQuickSelect - Upload date set to:', fileMetadata.created_at);
      } else {
        logger.warn(LogCategory.API, '❌ handleQuickSelect - No upload date in metadata');
      }

      // Download file from Supabase storage
      const blob = await SupabaseStorageService.downloadFile(filename);
      logger.info(LogCategory.API, `✅ Successfully downloaded from Supabase: ${filename}, size: ${blob.size} bytes`);
      
      const file = new File([blob], filename, { type: 'application/octet-stream' });
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Add source metadata
      formData.append('file_source', 'supabase_storage');
      
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

      const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/upload';
      logger.info(LogCategory.API, '📡 Sending file to backend for processing', { 
        filename, 
        apiUrl,
        formDataKeys: Array.from(formData.keys()),
        contentLength: file.size
      });

      const uploadResponse = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
      });

      logger.info(LogCategory.API, '📨 Upload response received', {
        filename,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        headers: Object.fromEntries(uploadResponse.headers.entries()),
        ok: uploadResponse.ok
      });

      if (!uploadResponse.ok) {
          let errorData: any;
          try {
            errorData = await uploadResponse.json();
            logger.error(LogCategory.API, '❌ Upload failed - structured error', {
              filename,
              status: uploadResponse.status,
              errorData
            });
          } catch (parseError) {
            const errorText = await uploadResponse.text();
            logger.error(LogCategory.API, '❌ Upload failed - raw response', {
              filename,
              status: uploadResponse.status,
              errorText,
              parseError: parseError instanceof Error ? parseError.message : String(parseError)
            });
            errorData = { detail: `Server error: ${uploadResponse.status} ${uploadResponse.statusText}` };
          }
          throw new Error(errorData.detail || 'File processing failed.');
      }

      const resultData = await uploadResponse.json();
      logger.info(LogCategory.API, '✅ File processing completed successfully', { 
        filename,
        hasAnalysisData: !!resultData,
        resultKeys: Object.keys(resultData || {}),
        analyticsChannels: resultData?.analytics ? Object.keys(resultData.analytics) : []
      });
      
      // handleSuccess will preserve the upload date that was set earlier
      handleSuccess(resultData);

    } catch (error: any) {
      logger.error(LogCategory.API, '💥 Error in handleQuickSelect', {
        filename,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        errorType: typeof error,
        networkError: error instanceof TypeError && error.message.includes('fetch'),
        apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080'
      });
      
      // Enhanced error message based on error type
      let userFriendlyMessage = error.message || 'An unknown error occurred while processing the file.';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        userFriendlyMessage = `Network connection failed. Please check:\n• Backend server is running on port 8080\n• No firewall blocking connections\n• API URL: ${import.meta.env.VITE_API_URL || 'http://localhost:8080'}`;
      } else if (error.message.includes('Failed to fetch')) {
        userFriendlyMessage = 'Failed to connect to backend server. Please ensure the server is running on http://localhost:8080';
      }
      
      handleError(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  }, [handleSuccess, handleError, sessionParams, setUploadDate]);

  // Track if we've already loaded the file from URL to prevent infinite loops
  const [hasLoadedFromUrl, setHasLoadedFromUrl] = useState(false);

  // Auto-load file from URL parameters when navigating to analysis page
  // NOTE: This useEffect is placed after handleQuickSelect definition to avoid hoisting issues
  useEffect(() => {
    const fileParam = searchParams.get('file');
    const dateParam = searchParams.get('date');
    
    // Only auto-load if we have URL parameters, no current analysis, not already loading,
    // and haven't already loaded from URL
    if (fileParam && dateParam && !analysisResult && !isLoading && isAuthenticated && !hasLoadedFromUrl) {
      logger.info(LogCategory.LIFECYCLE, '🔗 Auto-loading file from URL parameters', { 
        file: fileParam, 
        date: dateParam 
      });
      
      // Mark that we've loaded from URL to prevent repeated calls
      setHasLoadedFromUrl(true);
      
      // Decode the file parameter (it's URL encoded)
      const decodedFilename = decodeURIComponent(fileParam);
      handleQuickSelect(decodedFilename, dateParam);
    }
    
    // Reset the flag when URL params change or are removed
    if (!fileParam || !dateParam) {
      setHasLoadedFromUrl(false);
    }
  }, [searchParams, analysisResult, isLoading, isAuthenticated, hasLoadedFromUrl, handleQuickSelect]);

  // Combined chart data for the main EMG Chart (primarily for the EMG Analysis tab)
  const mainCombinedChartData = useMemo<CombinedChartDataPoint[]>(() => {
    const series1 = plotChannel1Data;
    const series2 = plotChannel2Data;
    const name1 = plotChannel1Name;
    const name2 = plotChannel2Name;

    if (import.meta.env.DEV && analysisResult) {
      logger.debug(LogCategory.CHART_RENDER, 'Chart data generation:', { name1, name2, series1Length: series1?.data?.length, series2Length: series2?.data?.length });
    }

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
    
    logger.debug(LogCategory.CHART_RENDER, 'Generated chart data points:', newChartData.length);
    return newChartData;
  }, [plotChannel1Data, plotChannel2Data, plotChannel1Name, plotChannel2Name]);

  // Handle file selection from dashboard
  const handleAnalysisNavigation = useCallback((filename?: string, uploadDate?: string) => {
    if (filename && uploadDate) {
      // If we have file data, trigger the quick select to load it
      handleQuickSelect(filename, uploadDate);
    }
  }, [handleQuickSelect]);

  // Dashboard loading effect - moved outside renderDashboard function to follow Rules of Hooks
  useEffect(() => {
    if (userRole) {
      console.debug(`[Dashboard] Starting to load ${userRole} dashboard`);
    }
  }, [userRole]);

  // Render the appropriate dashboard based on user role with lazy loading and performance monitoring
  const renderDashboard = () => {
    const DashboardLoadingFallback = (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <Spinner />
          <p className="text-slate-600 mt-2">Loading dashboard...</p>
        </div>
      </div>
    );

    switch (userRole) {
      case 'ADMIN':
        return (
          <React.Suspense fallback={DashboardLoadingFallback}>
            <AdminDashboard />
          </React.Suspense>
        );
      case 'THERAPIST':
        return (
          <React.Suspense fallback={DashboardLoadingFallback}>
            <TherapistDashboard />
          </React.Suspense>
        );
      case 'RESEARCHER':
        return (
          <React.Suspense fallback={DashboardLoadingFallback}>
            <ResearcherDashboard onQuickSelect={handleAnalysisNavigation} />
          </React.Suspense>
        );
      default:
        return (
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h2 className="text-lg font-semibold text-yellow-800">No Role Assigned</h2>
              <p className="text-yellow-700">Please contact an administrator to assign you a role.</p>
            </div>
          </div>
        );
    }
  };


  return (
    <>
      {/* Loading overlay - shown during EMG processing (DRY: Reusable component) */}
      {isLoading && <AnalysisLoadingOverlay />}
      
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
        {/* Header removed - now provided by DashboardLayout in router */}

        <main className={`flex-grow w-full ${isAuthenticated ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' : ''}`}>
          <AuthGuard>
            {!analysisResult ? (
              // Show dashboard when no file is loaded
              renderDashboard()
            ) : (
              <>
                {/* File metadata bar for analysis view */}
                <FileMetadataBar
                  analysisResult={analysisResult}
                  uploadDate={uploadDate}
                  onReset={resetState}
                  patientName={selectedFileData?.patientName}
                  therapistDisplay={selectedFileData?.therapistDisplay}
                  fileSize={selectedFileData?.fileSize}
                  clinicalNotesCount={selectedFileData?.clinicalNotesCount}
                  userRole={userRole}
                />
                
                {/* Show EMG analysis tabs when file is loaded */}
                <GameSessionTabs
                  analysisResult={analysisResult}
                  mvcThresholdForPlot={null}
                  muscleChannels={muscleChannels}
                  allAvailableChannels={allAvailableChannels}
                  setPlotChannel1Name={setPlotChannel1Name}
                  setPlotChannel2Name={setPlotChannel2Name}
                  selectedChannelForStats={selectedChannelForStats}
                  setSelectedChannelForStats={setSelectedChannelForStats}
                  currentStats={currentStats}
                  mainChartData={mainCombinedChartData}
                  dataPoints={downsamplingControls.dataPoints}
                  setDataPoints={downsamplingControls.setDataPoints}
                  mainPlotChannel1Data={plotChannel1Data}
                  mainPlotChannel2Data={plotChannel2Data}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  signalType={signalType}
                  setSignalType={setSignalType}
                  appIsLoading={isLoading}
                  uploadedFileName={uploadedFileName}
                />
              </>
            )}
          </AuthGuard>

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
      </div>
    </>
  );
}

// Export for use in React Router setup
export default AppContent;