import React from 'react';
import { Button } from '../ui/button';
import { GameSessionParameters } from '../../types/emg';
import { cn } from '@/lib/utils';
import { getMuscleColor } from '@/lib/colorMappings';
import { BarChartIcon } from '@radix-ui/react-icons';

export type FilterMode = 'single' | 'comparison';

interface ChannelFilterProps {
  availableChannels: string[];
  sessionParams: GameSessionParameters;
  activeFilter: {
    mode: FilterMode;
    channel?: string | null;
  };
  onFilterChange: (mode: FilterMode, channel?: string) => void;
}

const ChannelFilter: React.FC<ChannelFilterProps> = ({
  availableChannels,
  sessionParams,
  activeFilter,
  onFilterChange,
}) => {
  const getMuscleName = (channelName: string) => {
    const baseChannelName = channelName.replace(/ (Raw|activated)$/, '');
    return sessionParams.channel_muscle_mapping?.[baseChannelName] || baseChannelName;
  };

  const baseChannels = availableChannels
    .map(c => c.replace(/ (Raw|activated)$/, ''))
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex justify-center items-center gap-2 my-4">
      {baseChannels.map(channel => {
        const muscleName = getMuscleName(channel);
        const muscleColor = getMuscleColor(muscleName, sessionParams.muscle_color_mapping);
        const isActive = activeFilter.mode === 'single' && activeFilter.channel === channel;
        
        return (
          <Button
            key={channel}
            variant={isActive ? 'default' : 'outline'}
            onClick={() => onFilterChange('single', channel)}
            className={cn(
              'transition-all duration-200 ease-in-out flex items-center gap-2',
              isActive
                ? 'text-white'
                : 'bg-white hover:bg-gray-100 text-gray-800'
            )}
            style={isActive ? { backgroundColor: muscleColor.stroke } : {}}
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: isActive ? 'white' : muscleColor.stroke }}
            />
            {muscleName}
          </Button>
        );
      })}
      {baseChannels.length > 1 && (
        <Button
          variant={activeFilter.mode === 'comparison' ? 'outline' : 'outline'}
          onClick={() => onFilterChange('comparison')}
          className={cn(
            'transition-all duration-200 ease-in-out flex items-center gap-2',
            activeFilter.mode === 'comparison'
              ? 'border-teal-600 text-teal-600'
              : 'bg-white hover:bg-gray-100 text-gray-800'
          )}
        >
          <BarChartIcon className="h-4 w-4" />
          Comparison
        </Button>
      )}
    </div>
  );
};

export default ChannelFilter; 