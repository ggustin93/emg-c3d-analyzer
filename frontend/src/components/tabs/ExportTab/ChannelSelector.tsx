/**
 * Channel Selector Component
 * Handles EMG channel selection for export
 */

import React, { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { AvailableChannel, ChannelSelectionMap } from './types';
import { TOGGLE_STYLES } from './constants';
import { useSessionStore } from '@/store/sessionStore';

interface ChannelSelectorProps {
  availableChannels: AvailableChannel[];
  channelSelection: ChannelSelectionMap;
  onChannelSelectionChange: (channelName: string, field: 'includeRaw' | 'includeProcessed', value: boolean) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  availableChannels,
  channelSelection,
  onChannelSelectionChange,
}) => {
  const { sessionParams } = useSessionStore();
  
  // Function to get muscle name for channel (memoized)
  const getMuscleNameForChannel = useCallback((channelName: string): string => {
    return sessionParams.channel_muscle_mapping?.[channelName] || channelName;
  }, [sessionParams.channel_muscle_mapping]);

  // Function to get muscle color for channel (memoized)
  const getMuscleColorForChannel = useCallback((channelName: string): string => {
    const muscleName = getMuscleNameForChannel(channelName);
    return sessionParams.muscle_color_mapping?.[muscleName] || '#6b7280';
  }, [sessionParams.muscle_color_mapping, getMuscleNameForChannel]);

  // Memoize channel data processing
  const processedChannels = useMemo(() => {
    return availableChannels.map(channel => ({
      ...channel,
      muscleName: getMuscleNameForChannel(channel.baseName),
      muscleColor: getMuscleColorForChannel(channel.baseName),
      isSelected: channelSelection[channel.baseName]?.includeRaw || 
                  channelSelection[channel.baseName]?.includeProcessed
    }));
  }, [availableChannels, channelSelection, getMuscleNameForChannel, getMuscleColorForChannel]);
  
  if (availableChannels.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No EMG channels available in the analysis result.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium">EMG Channels</h3>
        <Tooltip>
          <TooltipTrigger>
            <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Select which EMG channels and processing types to include in your export.</p>
            <p className="mt-1 text-xs">Raw: Original signal data • Activated: Processed contraction data</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {processedChannels.map((channel) => {
        return (
          <Card 
            key={channel.baseName}
            className={`pt-4 transition-all duration-200 ${
              channel.isSelected ? TOGGLE_STYLES.active : TOGGLE_STYLES.inactive
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-3 h-3 rounded-full border" 
                  style={{ backgroundColor: channel.muscleColor }}
                />
                <div className="flex flex-row justify-between w-full">
                  <Label className="font-medium text-sm">
                    {channel.baseName}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {channel.muscleName}
                  </span>
                </div>
              </div>

              <div className="flex gap-6">
                {channel.hasRaw && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${channel.baseName}-raw`}
                      checked={channelSelection[channel.baseName]?.includeRaw || false}
                      onCheckedChange={(checked) => 
                        onChannelSelectionChange(channel.baseName, 'includeRaw', checked)
                      }
                    />
                    <div className="flex items-center space-x-1">
                      <Label 
                        htmlFor={`${channel.baseName}-raw`}
                        className="text-sm cursor-pointer font-medium"
                      >
                        Raw Signals
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircledIcon className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <p className="font-semibold text-xs mb-1">Original EMG Signal Data</p>
                          <p className="text-xs">Unprocessed electrical muscle activity as recorded from the C3D file. Includes full signal bandwidth with noise and artifacts.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {channel.hasProcessed && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${channel.baseName}-processed`}
                      checked={channelSelection[channel.baseName]?.includeProcessed || false}
                      onCheckedChange={(checked) => 
                        onChannelSelectionChange(channel.baseName, 'includeProcessed', checked)
                      }
                    />
                    <div className="flex items-center space-x-1">
                      <Label 
                        htmlFor={`${channel.baseName}-processed`}
                        className="text-sm cursor-pointer font-medium"
                      >
                        Activated Signals
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircledIcon className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <p className="font-semibold text-xs mb-1">Pre-processed Contraction Data</p>
                          <p className="text-xs">Muscle activity processed by GHOSTLY game engine. Filtered and optimized for contraction detection and therapeutic analysis.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};