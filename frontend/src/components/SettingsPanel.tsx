import React, { useState, useEffect } from 'react';
import { EMGChannelSignalData, EMGAnalysisResult } from '../types/emg';
import { useSessionStore } from '../store/sessionStore';
import DebugModeSwitch from './settings/DebugModeSwitch';
import DisplaySettings from './settings/DisplaySettings';
import TherapeuticParametersSettings from './settings/TherapeuticParametersSettings';
import PatientOutcomesSettings from './settings/PatientOutcomesSettings';
import BFRParametersSettings from './settings/BFRParametersSettings';
import ScoringWeightsSettings from './settings/ScoringWeightsSettings';
import ContractionDetectionSettings from './settings/ContractionDetectionSettings';

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
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isDebugMode, setIsDebugMode] = useState(false);

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
      {/* Debug Mode Control - Always at top for easy access */}
      <DebugModeSwitch
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
        disabled={disabled}
      />
      
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
          isDebugMode={isDebugMode}
          analysisResult={analysisResult}
        />
        
        {/* Therapeutic Parameters - Unified session goals and clinical parameters */}
        <TherapeuticParametersSettings
          muscleChannels={muscleChannels}
          disabled={disabled}
          isDebugMode={isDebugMode}
        />
        
        {/* Patient Reported Outcomes - Always visible */}
        <PatientOutcomesSettings
          disabled={disabled}
          isDebugMode={isDebugMode}
        />
        
        {/* BFR Parameters - Always visible */}
        <BFRParametersSettings
          disabled={disabled}
          isDebugMode={isDebugMode}
        />
        
        {/* Contraction Detection Settings - Last component */}
        <ContractionDetectionSettings />
      </div>
    </div>
  );
};

export default SettingsPanel;