import React, { useState, useEffect } from 'react';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { GameSessionParameters } from '../types/emg';
import { Pencil1Icon, CheckIcon } from '@radix-ui/react-icons';

interface SettingsPanelProps {
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  muscleChannels: string[];
  disabled: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  sessionParams,
  onParamsChange,
  muscleChannels,
  disabled
}) => {
  // State to track if we're in edit mode
  const [isEditing, setIsEditing] = useState(false);
  
  // Initialize mapping if it doesn't exist
  const channelMuscleMapping = sessionParams.channel_muscle_mapping || {};
  
  // Set default muscle names when component mounts if they aren't already set
  useEffect(() => {
    let needsUpdate = false;
    const updatedMapping = { ...channelMuscleMapping };
    
    if (muscleChannels.length > 0 && !channelMuscleMapping[muscleChannels[0]]) {
      updatedMapping[muscleChannels[0]] = "Left Quadriceps";
      needsUpdate = true;
    }
    
    if (muscleChannels.length > 1 && !channelMuscleMapping[muscleChannels[1]]) {
      updatedMapping[muscleChannels[1]] = "Right Quadriceps";
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      onParamsChange({
        ...sessionParams,
        channel_muscle_mapping: updatedMapping
      });
    }
  }, [muscleChannels, channelMuscleMapping, sessionParams, onParamsChange]);
  
  const handleMuscleNameChange = (channel: string, muscleName: string) => {
    const updatedMapping = {
      ...channelMuscleMapping,
      [channel]: muscleName
    };
    
    onParamsChange({
      ...sessionParams,
      channel_muscle_mapping: updatedMapping
    });
  };
  
  const resetToDefaults = () => {
    // Set default mappings
    const defaultMapping: Record<string, string> = {};
    
    if (muscleChannels.length > 0) {
      defaultMapping[muscleChannels[0]] = "Left Quadriceps";
    }
    
    if (muscleChannels.length > 1) {
      defaultMapping[muscleChannels[1]] = "Right Quadriceps";
    }
    
    onParamsChange({
      ...sessionParams,
      channel_muscle_mapping: defaultMapping
    });
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Channel to Muscle Mapping</CardTitle>
          <Button 
            onClick={toggleEditMode} 
            variant="outline" 
            size="sm"
            disabled={disabled}
            className="flex items-center gap-1"
          >
            {isEditing ? (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>Save</span>
              </>
            ) : (
              <>
                <Pencil1Icon className="h-4 w-4" />
                <span>Edit</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Rename EMG channels to match actual muscle names for better readability in reports and analytics.
          </p>
          
          {muscleChannels.length === 0 ? (
            <div className="p-4 bg-slate-100 rounded-md text-slate-500 text-center">
              No channels available. Please load a session first.
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {muscleChannels.map((channel) => (
                  <div key={channel} className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <Label htmlFor={`muscle-${channel}`} className="text-sm font-medium">
                        Channel {channel}
                      </Label>
                    </div>
                    <div>
                      <Input
                        id={`muscle-${channel}`}
                        value={channelMuscleMapping[channel] || ''}
                        onChange={(e) => handleMuscleNameChange(channel, e.target.value)}
                        placeholder={`e.g., Left Quadriceps`}
                        disabled={disabled || !isEditing}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={resetToDefaults}
                  variant="outline"
                  disabled={disabled || !isEditing}
                  className="w-full"
                >
                  Reset to Default Names
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsPanel; 