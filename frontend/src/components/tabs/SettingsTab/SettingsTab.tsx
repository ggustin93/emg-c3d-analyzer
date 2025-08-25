import React, { useState, useEffect } from 'react';
import { EMGChannelSignalData, EMGAnalysisResult } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import DebugModeSwitch from './components/DebugModeSwitch';
import TherapistModeSwitch from './components/TherapistModeSwitch';
import { Button } from '@/components/ui/button';
import DisplaySettings from './components/DisplaySettings';
import TherapeuticParametersSettings from './components/TherapeuticParametersSettings';
import PatientOutcomesSettings from './components/PatientOutcomesSettings';
import BFRParametersSettings from './components/BFRParametersSettings';
import ScoringWeightsSettings from './components/ScoringWeightsSettings';
import ContractionDetectionSettings from './components/ContractionDetectionSettings';
import ContractionColorDebugPanel from '../../debug/ContractionColorDebugPanel';

interface SettingsPanelProps {
  muscleChannels: string[];
  disabled: boolean;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
  
  // Legacy contraction props
  showGoodContractions?: boolean;
  setShowGoodContractions?: (show: boolean) => void;
  showPoorContractions?: boolean;
  setShowPoorContractions?: (show: boolean) => void;
  
  // Enhanced quality props
  showExcellentContractions?: boolean;
  setShowExcellentContractions?: (show: boolean) => void;
  showAdequateForceContractions?: boolean;
  setShowAdequateForceContractions?: (show: boolean) => void;
  showAdequateDurationContractions?: boolean;
  setShowAdequateDurationContractions?: (show: boolean) => void;
  showInsufficientContractions?: boolean;
  setShowInsufficientContractions?: (show: boolean) => void;
  
  // Display options
  showContractionAreas?: boolean;
  setShowContractionAreas?: (show: boolean) => void;
  showContractionDots?: boolean;
  setShowContractionDots?: (show: boolean) => void;
  
  // Enhanced mode
  useEnhancedQuality?: boolean;
  
  analysisResult?: EMGAnalysisResult | null;
  uploadedFileName?: string | null;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  muscleChannels,
  disabled,
  dataPoints,
  setDataPoints,
  plotChannel1Data,
  plotChannel2Data,
  
  // Legacy props
  showGoodContractions = true,
  setShowGoodContractions,
  showPoorContractions = true,
  setShowPoorContractions,
  
  // Enhanced quality props
  showExcellentContractions = true,
  setShowExcellentContractions,
  showAdequateForceContractions = true,
  setShowAdequateForceContractions,
  showAdequateDurationContractions = true,
  setShowAdequateDurationContractions,
  showInsufficientContractions = true,
  setShowInsufficientContractions,
  
  // Display options
  showContractionAreas = true,
  setShowContractionAreas,
  showContractionDots = true,
  setShowContractionDots,
  
  // Enhanced mode
  useEnhancedQuality = false,
  
  analysisResult,
  uploadedFileName,
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isTherapistMode, setIsTherapistMode] = useState(false);

  const handleRecalculate = () => {
    // Force a backend recalc by changing the sessionParams object identity
    setSessionParams((prev) => ({ ...prev }));
  };

  useEffect(() => {
    const channelMuscleMapping = sessionParams.channel_muscle_mapping || {};
    const muscleColorMapping = sessionParams.muscle_color_mapping || {};
    let needsUpdate = false;
    const updatedMapping = { ...channelMuscleMapping };
    const updatedColorMapping = { ...muscleColorMapping };

    if (muscleChannels.length > 0 && !channelMuscleMapping[muscleChannels[0]]) {
      const leftQuadName = "Left Quadriceps";
      updatedMapping[muscleChannels[0]] = leftQuadName;
      if (!updatedColorMapping[leftQuadName]) {
        updatedColorMapping[leftQuadName] = '#3b82f6'; // Blue
      }
      needsUpdate = true;
    }

    if (muscleChannels.length > 1 && !channelMuscleMapping[muscleChannels[1]]) {
      const rightQuadName = "Right Quadriceps";
      updatedMapping[muscleChannels[1]] = rightQuadName;
      if (!updatedColorMapping[rightQuadName]) {
        updatedColorMapping[rightQuadName] = '#ef4444'; // Red
      }
      needsUpdate = true;
    }

    if (needsUpdate) {
      setSessionParams({
        ...sessionParams,
        channel_muscle_mapping: updatedMapping,
        muscle_color_mapping: updatedColorMapping
      });
    }
  }, [muscleChannels, sessionParams.channel_muscle_mapping, sessionParams.muscle_color_mapping, setSessionParams]);

  return (
    <div className="space-y-6">
      {/* Dual Mode Controls - Clinical and Development separated */}
      <TherapistModeSwitch
        isTherapistMode={isTherapistMode}
        setIsTherapistMode={setIsTherapistMode}
        disabled={disabled}
      />
      
      <DebugModeSwitch
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
        disabled={disabled}
      />
      
      {/* Quick Actions removed (auto-recalc enabled). Force recalc available in Debug within Therapeutic Parameters. */}

      {/* Standard Settings - Always visible */}
      <div className="space-y-4">
        {/* Display & Visualization Settings */}
        <DisplaySettings
          muscleChannels={muscleChannels}
          disabled={disabled}
          dataPoints={dataPoints}
          setDataPoints={setDataPoints}
          plotChannel1Data={plotChannel1Data}
          plotChannel2Data={plotChannel2Data}
          
          // Legacy props
          showGoodContractions={showGoodContractions}
          setShowGoodContractions={setShowGoodContractions}
          showPoorContractions={showPoorContractions}
          setShowPoorContractions={setShowPoorContractions}
          
          // Enhanced quality props
          showExcellentContractions={showExcellentContractions}
          setShowExcellentContractions={setShowExcellentContractions}
          showAdequateForceContractions={showAdequateForceContractions}
          setShowAdequateForceContractions={setShowAdequateForceContractions}
          showAdequateDurationContractions={showAdequateDurationContractions}
          setShowAdequateDurationContractions={setShowAdequateDurationContractions}
          showInsufficientContractions={showInsufficientContractions}
          setShowInsufficientContractions={setShowInsufficientContractions}
          
          // Display options
          showContractionAreas={showContractionAreas}
          setShowContractionAreas={setShowContractionAreas}
          showContractionDots={showContractionDots}
          setShowContractionDots={setShowContractionDots}
          
          // Enhanced mode
          useEnhancedQuality={useEnhancedQuality}
        />
        
      </div>
      
      {/* Clinical & Performance Settings - Always visible but collapsible */}
      <div className="space-y-4">
        {/* Performance Scoring System */}
        <ScoringWeightsSettings 
          muscleChannels={muscleChannels}
          disabled={disabled}
          isTherapistMode={isTherapistMode}
          analysisResult={analysisResult}
        />
        
        {/* Therapeutic Parameters - Unified session goals and clinical parameters */}
        <TherapeuticParametersSettings
          muscleChannels={muscleChannels}
          disabled={disabled}
          isTherapistMode={isTherapistMode}
          analytics={analysisResult?.analytics}
          uploadedFileName={uploadedFileName}
        />
        
        {/* Patient Reported Outcomes - Always visible */}
        <PatientOutcomesSettings
          disabled={disabled}
          isTherapistMode={isTherapistMode}
        />
        
        {/* BFR Parameters - Always visible */}
        <BFRParametersSettings
          disabled={disabled}
          isTherapistMode={isTherapistMode}
        />
        
        {/* Contraction Detection Settings - Last component */}
        <ContractionDetectionSettings />
      </div>

      {/* Debug Panel - Only visible in debug mode */}
      {isDebugMode && (
        <div className="mt-8 border-t-2 border-red-200 pt-6">
          <ContractionColorDebugPanel
            analytics={analysisResult?.analytics || null}
            sessionParams={sessionParams}
          />
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;