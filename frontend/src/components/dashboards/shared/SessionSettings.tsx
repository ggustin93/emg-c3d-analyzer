import React, { useState, useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import DisplaySettings from '@/components/tabs/SettingsTab/components/DisplaySettings';
import TherapeuticParametersSettings from '@/components/tabs/SettingsTab/components/TherapeuticParametersSettings';
import PatientOutcomesSettings from '@/components/tabs/SettingsTab/components/PatientOutcomesSettings';
import BFRParametersSettings from '@/components/tabs/SettingsTab/components/BFRParametersSettings';
import ScoringWeightsSettings from '@/components/tabs/SettingsTab/components/ScoringWeightsSettings';
import ContractionDetectionSettings from '@/components/tabs/SettingsTab/components/ContractionDetectionSettings';

/**
 * Session Settings Component
 * Provides configuration options for EMG analysis sessions
 * Accessible from the sidebar navigation for both therapists and researchers
 */
export function SessionSettings() {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [dataPoints, setDataPoints] = useState(1000);
  
  // Initialize default muscle channels
  const muscleChannels = ['Channel 1', 'Channel 2'];
  
  // Initialize channel-muscle mapping
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Session Settings</h1>
        <p className="mt-2 text-lg text-gray-600">
          Configure analysis parameters and display options for EMG sessions
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Display & Visualization Settings */}
        <DisplaySettings
          muscleChannels={muscleChannels}
          disabled={false}
          dataPoints={dataPoints}
          setDataPoints={setDataPoints}
          plotChannel1Data={null}
          plotChannel2Data={null}
          showGoodContractions={true}
          showPoorContractions={true}
          showExcellentContractions={true}
          showAdequateForceContractions={true}
          showAdequateDurationContractions={true}
          showInsufficientContractions={true}
          showContractionAreas={true}
          showContractionDots={true}
          useEnhancedQuality={false}
        />
        
        {/* Clinical & Performance Settings */}
        <div className="space-y-4">
          {/* Performance Scoring System */}
          <ScoringWeightsSettings 
            muscleChannels={muscleChannels}
            disabled={false}
            isTherapistMode={false}
            analysisResult={null}
          />
          
          {/* Therapeutic Parameters */}
          <TherapeuticParametersSettings
            muscleChannels={muscleChannels}
            disabled={false}
            isTherapistMode={false}
            analytics={undefined}
            uploadedFileName={null}
          />
          
          {/* Patient Reported Outcomes */}
          <PatientOutcomesSettings
            disabled={false}
            isTherapistMode={false}
          />
          
          {/* BFR Parameters */}
          <BFRParametersSettings
            disabled={false}
            isTherapistMode={false}
          />
          
          {/* Contraction Detection Settings */}
          <ContractionDetectionSettings />
        </div>
      </div>
    </div>
  );
}