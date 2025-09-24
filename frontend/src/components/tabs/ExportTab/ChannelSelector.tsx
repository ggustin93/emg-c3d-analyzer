/**
 * Channel Selector Component
 * Handles EMG channel selection for export
 */

import React, { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuestionMarkCircledIcon, ExclamationTriangleIcon, DownloadIcon } from '@radix-ui/react-icons';
import { AvailableChannel, ChannelSelectionMap } from './types';
import { TOGGLE_STYLES } from './constants';
import { useSessionStore } from '@/store/sessionStore';

interface ChannelSelectorProps {
  availableChannels: AvailableChannel[];
  channelSelection: ChannelSelectionMap;
  onChannelSelectionChange: (channelName: string, field: 'includeRaw' | 'includeActivated' | 'includeProcessedRms', value: boolean) => void;
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
                  channelSelection[channel.baseName]?.includeActivated ||
                  channelSelection[channel.baseName]?.includeProcessedRms
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
    <div className="space-y-4">
      {/* Clean Recommendation */}
      <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <DownloadIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-900">
              💡 For research-grade EMG analysis
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Download the original C3D file and use{' '}
              <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono">ezc3d</code>{' '}
              Python library for direct access to raw signals with full sampling rates.
            </p>
          </div>
        </div>
      </div>

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
                    {channel.baseName} <span className="text-muted-foreground">Signals</span>
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
                        Raw
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

                {channel.hasActivated && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${channel.baseName}-processed`}
                      checked={channelSelection[channel.baseName]?.includeActivated || false}
                      onCheckedChange={(checked) => 
                        onChannelSelectionChange(channel.baseName, 'includeActivated', checked)
                      }
                    />
                    <div className="flex items-center space-x-1">
                      <Label 
                        htmlFor={`${channel.baseName}-processed`}
                        className="text-sm cursor-pointer font-medium"
                      >
                        Activated
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircledIcon className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <p className="font-semibold text-xs mb-1">Game Activated EMG</p>
                          <p className="text-xs">Muscle activity processed by the game engine (used historically). Our rigorous pipeline uses RAW as source of truth.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {channel.hasProcessedRms && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`${channel.baseName}-processed-rms`}
                      checked={channelSelection[channel.baseName]?.includeProcessedRms || false}
                      onCheckedChange={(checked) => 
                        onChannelSelectionChange(channel.baseName, 'includeProcessedRms', checked)
                      }
                    />
                    <div className="flex items-center space-x-1">
                      <Label 
                        htmlFor={`${channel.baseName}-processed-rms`}
                        className="text-sm cursor-pointer font-medium"
                      >
                        RMS Envelope
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <QuestionMarkCircledIcon className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs p-3">
                          <p className="font-semibold text-xs mb-1">Rigorous Pipeline</p>
                          <p className="text-xs">Our processed envelope built from RAW signals with documented filtering, rectification, and smoothing parameters. Includes detection thresholds and pipeline metadata in export.</p>
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