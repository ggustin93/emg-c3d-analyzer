import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ChannelSelectionProps {
  availableChannels: string[];
  selectedChannel: string | null;
  setSelectedChannel: (name: string | null) => void;
  label: string;
  id: string;
}

const ChannelSelection: React.FC<ChannelSelectionProps> = ({
  availableChannels,
  selectedChannel,
  setSelectedChannel,
  label,
  id
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
        <SelectValue placeholder={`-- ${label} --`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-- Select a Channel --</SelectItem>
        {availableChannels.map(channelName => (
          <SelectItem key={`${id}-${channelName}`} value={channelName}>
            {channelName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ChannelSelection; 