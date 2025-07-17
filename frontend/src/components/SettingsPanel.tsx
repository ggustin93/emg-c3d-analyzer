import React, { useState, useEffect } from 'react';
import { EMGChannelSignalData } from '../types/emg';
import { useSessionStore } from '../store/sessionStore';
import DebugModeSwitch from './settings/DebugModeSwitch';
import DisplaySettings from './settings/DisplaySettings';
import SessionGoalsSettings from './settings/SessionGoalsSettings';
import ClinicalParametersSettings from './settings/ClinicalParametersSettings';
import PatientOutcomesSettings from './settings/PatientOutcomesSettings';

interface SettingsPanelProps {
  muscleChannels: string[];
  disabled: boolean;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
  showGoodContractions?: boolean;
  setShowGoodContractions?: (show: boolean) => void;
  showPoorContractions?: boolean;
  setShowPoorContractions?: (show: boolean) => void;
  showContractionAreas?: boolean;
  setShowContractionAreas?: (show: boolean) => void;
  showContractionDots?: boolean;
  setShowContractionDots?: (show: boolean) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  muscleChannels,
  disabled,
  dataPoints,
  setDataPoints,
  plotChannel1Data,
  plotChannel2Data,
  showGoodContractions = true,
  setShowGoodContractions,
  showPoorContractions = true,
  setShowPoorContractions,
  showContractionAreas = true,
  setShowContractionAreas,
  showContractionDots = true,
  setShowContractionDots,
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
    <div className="space-y-4">
      <DebugModeSwitch
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
        disabled={disabled}
      />
      <DisplaySettings
        muscleChannels={muscleChannels}
        disabled={disabled}
        dataPoints={dataPoints}
        setDataPoints={setDataPoints}
        plotChannel1Data={plotChannel1Data}
        plotChannel2Data={plotChannel2Data}
        showGoodContractions={showGoodContractions}
        setShowGoodContractions={setShowGoodContractions}
        showPoorContractions={showPoorContractions}
        setShowPoorContractions={setShowPoorContractions}
        showContractionAreas={showContractionAreas}
        setShowContractionAreas={setShowContractionAreas}
        showContractionDots={showContractionDots}
        setShowContractionDots={setShowContractionDots}
      />
      <SessionGoalsSettings
        muscleChannels={muscleChannels}
        disabled={disabled}
      />
      <ClinicalParametersSettings
        muscleChannels={muscleChannels}
        disabled={disabled}
        isDebugMode={isDebugMode}
      />
      <PatientOutcomesSettings
        disabled={disabled}
        isDebugMode={isDebugMode}
      />
    </div>
  );
};

export default SettingsPanel;