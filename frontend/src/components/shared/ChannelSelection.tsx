import React, { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import MuscleNameDisplay from './MuscleNameDisplay';
import { GameSessionParameters } from '../../types/emg';
import { getChannelColor, getMuscleColor } from '../../lib/unifiedColorSystem';

// Helper function to get color for a channel
const getColorForChannel = (
  channelName: string,
  muscleMapping?: Record<string, string>,
  customColors?: Record<string, string>
) => {
  // Check if there's a muscle mapping for this channel
  const muscleName = muscleMapping?.[channelName];
  if (muscleName) {
    return getMuscleColor(muscleName, customColors);
  }
  
  // Otherwise use channel index color
  const channelIndex = parseInt(channelName.replace('CH', '')) - 1;
  return getChannelColor(channelIndex);
};

interface ChannelSelectionProps {
  availableChannels: string[];
  selectedChannel: string | null;
  setSelectedChannel: (name: string | null) => void;
  label: string;
  id: string;
  sessionParams?: GameSessionParameters;
  showChannelNames?: boolean;
  defaultToQuadriceps?: boolean;
}

const ChannelSelection: React.FC<ChannelSelectionProps> = ({
  availableChannels,
  selectedChannel,
  setSelectedChannel,
  label,
  id,
  sessionParams,
  showChannelNames = false,
  defaultToQuadriceps = true
}) => {
  // Auto-select Quadriceps when no channel is selected and defaultToQuadriceps is true
  useEffect(() => {
    if (!selectedChannel && defaultToQuadriceps && availableChannels.length > 0) {
      // Try to find a channel with "Quadriceps" in its muscle name
      const quadChannel = availableChannels.find(channel => {
        const muscleName = sessionParams?.channel_muscle_mapping?.[channel];
        return muscleName && muscleName.includes('Quadriceps');
      });
      
      // If found, select it
      if (quadChannel) {
        setSelectedChannel(quadChannel);
      }
      // Otherwise, select the first channel
      else if (availableChannels.length > 0) {
        setSelectedChannel(availableChannels[0]);
      }
    }
  }, [availableChannels, selectedChannel, setSelectedChannel, sessionParams, defaultToQuadriceps]);

  if (availableChannels.length === 0) {
    return null;
  }
  
  const selectedColorStyle = selectedChannel ? getColorForChannel(selectedChannel, sessionParams?.channel_muscle_mapping, sessionParams?.muscle_color_mapping) : null;

  return (
    <Select
      value={selectedChannel || ''}
      onValueChange={(value) => setSelectedChannel(value === 'none' ? null : value)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={`-- ${label} --`}>
          {selectedChannel && sessionParams ? (
            <div className="flex items-center">
              {selectedColorStyle && <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: selectedColorStyle.stroke }} />}
              <MuscleNameDisplay 
                channelName={selectedChannel} 
                sessionParams={sessionParams} 
                showChannelName={showChannelNames} 
              />
            </div>
          ) : (
            `-- ${label} --`
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-- Select a Channel --</SelectItem>
        {availableChannels.map(channelName => {
          const colorStyle = getColorForChannel(channelName, sessionParams?.channel_muscle_mapping, sessionParams?.muscle_color_mapping);
          return (
            <SelectItem key={`${id}-${channelName}`} value={channelName}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colorStyle.stroke }} />
                {sessionParams ? (
                  <MuscleNameDisplay 
                    channelName={channelName} 
                    sessionParams={sessionParams} 
                    showChannelName={showChannelNames} 
                  />
                ) : (
                  channelName
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default ChannelSelection; 