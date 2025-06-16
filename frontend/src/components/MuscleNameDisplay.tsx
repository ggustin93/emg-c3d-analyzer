import React from 'react';
import { GameSessionParameters } from '../types/emg';

interface MuscleNameDisplayProps {
  channelName: string;
  sessionParams: GameSessionParameters;
  showChannelName?: boolean;
}

/**
 * Component that displays the muscle name for a channel if available,
 * or falls back to the channel name.
 */
const MuscleNameDisplay: React.FC<MuscleNameDisplayProps> = ({ 
  channelName, 
  sessionParams,
  showChannelName = false
}) => {
  // Get the base channel name without Raw or activated suffix
  const baseChannelName = channelName.replace(' Raw', '').replace(' activated', '');
  
  // Get the muscle name from the mapping if available
  const muscleName = sessionParams.channel_muscle_mapping?.[baseChannelName];
  
  if (muscleName) {
    if (showChannelName) {
      return <>{muscleName} ({baseChannelName})</>;
    }
    return <>{muscleName}</>;
  }
  
  // Fall back to the base channel name if no mapping exists
  return <>{baseChannelName}</>;
};

export default MuscleNameDisplay; 