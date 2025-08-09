import React, { useState } from 'react';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import ChartDisplaySettings from './ChartDisplaySettings';
import ChannelConfiguration from './ChannelConfiguration';
import ContractionVisualizationSettings from './ContractionVisualizationSettings';
import { EMGChannelSignalData } from '@/types/emg';
import { EyeOpenIcon } from '@radix-ui/react-icons';

interface DisplaySettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
  
  // Legacy contraction props
  showGoodContractions: boolean;
  setShowGoodContractions: ((show: boolean) => void) | undefined;
  showPoorContractions: boolean;
  setShowPoorContractions: ((show: boolean) => void) | undefined;
  
  // Enhanced quality props
  showExcellentContractions?: boolean;
  setShowExcellentContractions?: ((show: boolean) => void) | undefined;
  showAdequateForceContractions?: boolean;
  setShowAdequateForceContractions?: ((show: boolean) => void) | undefined;
  showAdequateDurationContractions?: boolean;
  setShowAdequateDurationContractions?: ((show: boolean) => void) | undefined;
  showInsufficientContractions?: boolean;
  setShowInsufficientContractions?: ((show: boolean) => void) | undefined;
  
  // Display options
  showContractionAreas: boolean;
  setShowContractionAreas: ((show: boolean) => void) | undefined;
  showContractionDots: boolean;
  setShowContractionDots: ((show: boolean) => void) | undefined;
  
  // Enhanced mode toggle
  useEnhancedQuality?: boolean;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = (props) => {
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <UnifiedSettingsCard
      title="Display Settings"
      description="Chart visualization, channels, and contraction display"
      isOpen={isDisplaySettingsOpen}
      onOpenChange={setIsDisplaySettingsOpen}
      icon={<EyeOpenIcon className="h-5 w-5 text-purple-600" />}
      accentColor="purple-600"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Chart + Contraction (compact) */}
        <div className="space-y-6">
          <ChartDisplaySettings
            dataPoints={props.dataPoints}
            setDataPoints={props.setDataPoints}
            plotChannel1Data={props.plotChannel1Data}
            plotChannel2Data={props.plotChannel2Data}
          />
          <ContractionVisualizationSettings
            {...props}
            compact
          />
        </div>

        {/* Right column: Channel configuration */}
        <div className="space-y-6">
          <ChannelConfiguration
            muscleChannels={props.muscleChannels}
            disabled={props.disabled}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
          />
        </div>
      </div>
    </UnifiedSettingsCard>
  );
};

export default DisplaySettings; 