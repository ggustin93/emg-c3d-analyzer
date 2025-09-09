import React from 'react';
import { Button } from '../ui/button';
import { GameSessionParameters } from '../../types/emg';
import { cn } from '@/lib/utils';
import { getMuscleColor } from '@/lib/unifiedColorSystem';
import { BarChartIcon } from '@radix-ui/react-icons';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { useSessionStore } from '@/store/sessionStore';

export type FilterMode = 'single' | 'comparison';

interface ChannelFilterProps {
  availableChannels: string[];
  sessionParams: GameSessionParameters;
  activeFilter: {
    mode: FilterMode;
    channel?: string | null;
  };
  onFilterChange: (mode: FilterMode, channel?: string) => void;
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
}

const ChannelFilter: React.FC<ChannelFilterProps> = ({
  availableChannels,
  sessionParams,
  activeFilter,
  onFilterChange,
  plotMode,
  setPlotMode,
}) => {
  const { setSessionParams } = useSessionStore();

  const getMuscleName = (channelName: string) => {
    const baseChannelName = channelName.replace(/ (Raw|activated)$/, '');
    return sessionParams.channel_muscle_mapping?.[baseChannelName] || baseChannelName;
  };

  const baseChannels = availableChannels
    .map(c => c.replace(/ (Raw|activated)$/, ''))
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex justify-between items-center my-4">
      <div className="flex items-center gap-2">
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

      <div className="flex items-center space-x-2">
        <Label htmlFor="plot-mode-switch" className="text-sm">Raw</Label>
        <Switch
          id="plot-mode-switch"
          checked={plotMode === 'activated'}
          onCheckedChange={(checked: boolean) => {
            const newMode = checked ? 'activated' : 'raw';
            setPlotMode(newMode);
            setSessionParams({
              show_raw_signals: newMode === 'raw'
            });
          }}
        />
        <Label htmlFor="plot-mode-switch" className="text-sm">Activated</Label>
      </div>
    </div>
  );
};

export default ChannelFilter; 