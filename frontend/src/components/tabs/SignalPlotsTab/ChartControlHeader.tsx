import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GameSessionParameters } from '@/types/emg';
import { cn } from '@/lib/utils';
import { getMuscleColor } from '@/lib/colorMappings';
import { BarChartIcon, PlusIcon, MinusIcon } from '@radix-ui/react-icons';
import { useSessionStore } from '@/store/sessionStore';
import { SignalDisplayType } from './ThreeChannelSignalSelector';
import SignalTypeSelect from './SignalTypeSelect';

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
  
  // Signal type props - now supports 3 types
  signalType: SignalDisplayType;
  setSignalType: (type: SignalDisplayType) => void;
  
  // Contraction visualization props
  showContractionHighlights: boolean;
  setShowContractionHighlights: (show: boolean) => void;
  
  // Chart resolution props
  dataPoints?: number;
  setDataPoints?: (points: number) => void;
  
  // Optional props
  hasContractionData?: boolean;
  isLoading?: boolean;
}

const ChartControlHeader: React.FC<ChartControlHeaderProps> = ({
  availableChannels,
  sessionParams,
  activeFilter,
  onFilterChange,
  signalType,
  setSignalType,
  showContractionHighlights,
  setShowContractionHighlights,
  dataPoints,
  setDataPoints,
  hasContractionData = false,
  isLoading = false
}) => {
  const { setSessionParams } = useSessionStore();

  const getMuscleName = (channelName: string) => {
    const baseChannelName = channelName.replace(/ (Raw|activated|Processed)$/, '');
    return sessionParams.channel_muscle_mapping?.[baseChannelName] || baseChannelName;
  };

  const baseChannels = availableChannels
    .map(c => c.replace(/ (Raw|activated|Processed)$/, ''))
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm mb-2">
      {/* Left Side: Channel Selection (Most Important) */}
      <div className="flex items-center gap-2 flex-shrink min-w-0">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs font-medium text-gray-700">Highlights:</div>
          <Switch
            checked={showContractionHighlights}
            onCheckedChange={setShowContractionHighlights}
            disabled={isLoading}
          />
          <Label className="text-sm">{showContractionHighlights ? "On" : "Off"}</Label>
        </div>
      )}

      {/* Chart Resolution Controls */}
      {dataPoints !== undefined && setDataPoints && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-xs font-medium text-gray-700">Resolution:</div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDataPoints(Math.max(500, dataPoints - 500))}
            className="h-6 w-6"
            disabled={isLoading}
            title="Decrease chart resolution (fewer data points)"
          >
            <MinusIcon className="h-3 w-3" />
          </Button>
          <div className="text-xs text-gray-600 font-mono min-w-[4rem] text-center">
            {dataPoints.toLocaleString()}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDataPoints(dataPoints + 500)}
            className="h-6 w-6"
            disabled={isLoading}
            title="Increase chart resolution (more data points)"
          >
            <PlusIcon className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Right Side: Signal Type Dropdown */}
      <div className="flex items-center max-w-full whitespace-nowrap flex-1 justify-end">
        <SignalTypeSelect
          selectedSignal={signalType}
          onSignalChange={setSignalType}
          sessionParams={sessionParams}
          onParamsChange={setSessionParams}
          disabled={isLoading}
          compact
        />
      </div>
    </div>
  );
};

export default ChartControlHeader;