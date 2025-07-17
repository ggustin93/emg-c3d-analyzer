import React, { useState } from 'react';
import CollapsibleSettingsCard from './CollapsibleSettingsCard';
import ChartDisplaySettings from './ChartDisplaySettings';
import ChannelConfiguration from './ChannelConfiguration';
import ContractionVisualizationSettings from './ContractionVisualizationSettings';
import { EMGChannelSignalData } from '../../types/emg';

interface DisplaySettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
  showGoodContractions: boolean;
  setShowGoodContractions: ((show: boolean) => void) | undefined;
  showPoorContractions: boolean;
  setShowPoorContractions: ((show: boolean) => void) | undefined;
  showContractionAreas: boolean;
  setShowContractionAreas: ((show: boolean) => void) | undefined;
  showContractionDots: boolean;
  setShowContractionDots: ((show: boolean) => void) | undefined;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = (props) => {
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <CollapsibleSettingsCard
      title="Display Settings"
      description="Chart visualization, channel configuration and contraction display preferences."
      isOpen={isDisplaySettingsOpen}
      onOpenChange={setIsDisplaySettingsOpen}
    >
      <ChartDisplaySettings
        dataPoints={props.dataPoints}
        setDataPoints={props.setDataPoints}
        plotChannel1Data={props.plotChannel1Data}
        plotChannel2Data={props.plotChannel2Data}
      />
      <ChannelConfiguration
        muscleChannels={props.muscleChannels}
        disabled={props.disabled}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
      />
      <ContractionVisualizationSettings
        {...props}
      />
    </CollapsibleSettingsCard>
  );
};

export default DisplaySettings; 