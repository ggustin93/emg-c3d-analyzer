import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import MuscleNameDisplay from '../MuscleNameDisplay';
import { GameSessionParameters } from '../../types/emg';

interface ChannelSelectionProps {
  availableChannels: string[];
  selectedChannel: string | null;
  setSelectedChannel: (name: string | null) => void;
  label: string;
  id: string;
  sessionParams?: GameSessionParameters;
  showChannelNames?: boolean;
}

const ChannelSelection: React.FC<ChannelSelectionProps> = ({
  availableChannels,
  selectedChannel,
  setSelectedChannel,
  label,
  id,
  sessionParams,
  showChannelNames = false
}) => {
  if (availableChannels.length === 0) {
    return null;
  }
  
  return (
    <Select
      value={selectedChannel || ''}
      onValueChange={(value) => setSelectedChannel(value === 'none' ? null : value)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={`-- ${label} --`}>
          {selectedChannel && sessionParams ? (
            <MuscleNameDisplay 
              channelName={selectedChannel} 
              sessionParams={sessionParams} 
              showChannelName={showChannelNames} 
            />
          ) : (
            `-- ${label} --`
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-- Select a Channel --</SelectItem>
        {availableChannels.map(channelName => (
          <SelectItem key={`${id}-${channelName}`} value={channelName}>
            {sessionParams ? (
              <MuscleNameDisplay 
                channelName={channelName} 
                sessionParams={sessionParams} 
                showChannelName={showChannelNames} 
              />
            ) : (
              channelName
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ChannelSelection; 