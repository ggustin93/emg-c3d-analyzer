import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GameSessionParameters } from '@/types/emg';
import { cn } from '@/lib/utils';
import { getMuscleColor } from '@/lib/colorMappings';
import { BarChartIcon } from '@radix-ui/react-icons';
import { useSessionStore } from '@/store/sessionStore';

export type FilterMode = 'single' | 'comparison';

interface ChartControlHeaderProps {
  // Channel selection props
  availableChannels: string[];
  sessionParams: GameSessionParameters;
  activeFilter: {
    mode: FilterMode;
    channel?: string | null;
  };
  onFilterChange: (mode: FilterMode, channel?: string) => void;
  
  // Signal type props
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
  
  // Contraction visualization props
  showContractionHighlights: boolean;
  setShowContractionHighlights: (show: boolean) => void;
  
  // Optional props
  hasContractionData?: boolean;
  isLoading?: boolean;
}

const ChartControlHeader: React.FC<ChartControlHeaderProps> = ({
  availableChannels,
  sessionParams,
  activeFilter,
  onFilterChange,
  plotMode,
  setPlotMode,
  showContractionHighlights,
  setShowContractionHighlights,
  hasContractionData = false,
  isLoading = false
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
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm mb-2">
      {/* Left Side: Channel Selection (Most Important) */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-gray-700 mr-2">Channel:</div>
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
              disabled={isLoading}
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
            disabled={isLoading}
          >
            <BarChartIcon className="h-4 w-4" />
            Comparison
          </Button>
        )}
      </div>

      {/* Middle Section: Contraction Highlights Toggle */}
      {hasContractionData && (
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-gray-700">Highlights:</div>
          <Switch
            checked={showContractionHighlights}
            onCheckedChange={setShowContractionHighlights}
            disabled={isLoading}
          />
          <Label className="text-sm">{showContractionHighlights ? "On" : "Off"}</Label>
        </div>
      )}

      {/* Right Side: Signal Type Switch */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-gray-700">Signal Type:</div>
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
          disabled={isLoading}
        />
        <Label htmlFor="plot-mode-switch" className="text-sm">Activated</Label>
      </div>
    </div>
  );
};

export default ChartControlHeader;