import React, { useState } from 'react';
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Pencil1Icon, CheckIcon } from '@radix-ui/react-icons';
import { useSessionStore } from '../../store/sessionStore';
import { getMuscleColor } from '../../lib/colorMappings';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// Common muscle groups for therapists
const commonMuscleGroups = [
  "Quadriceps", "Hamstrings", "Gastrocnemius", "Tibialis Anterior",
  "Biceps", "Triceps", "Deltoid", "Trapezius",
  "Abdominals", "Erector Spinae"
];

// Sides for bilateral muscles
const sides = ["Left", "Right", "Center"];

// Color presets for muscles
const colorPresets = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Lime', value: '#65a30d' },
  { name: 'Rose', value: '#e11d48' },
];

// Helper to parse muscle name into parts
interface MuscleNameParts {
  side: string;
  muscle: string;
  custom?: string;
}

const parseMuscleNameParts = (fullName: string): MuscleNameParts => {
  if (!fullName) return { side: "Left", muscle: "Quadriceps" };
  
  // Try to match "Left Quadriceps" pattern
  for (const side of sides) {
    if (fullName.startsWith(side)) {
      const musclePart = fullName.substring(side.length).trim();
      return { side, muscle: musclePart };
    }
  }
  
  // If no side detected, assume it's just a muscle name
  return { side: "Center", muscle: fullName };
};

// Helper to combine parts into full name
const combineMuscleParts = (parts: MuscleNameParts): string => {
  if (parts.custom) {
    return `${parts.side} ${parts.muscle} (${parts.custom})`;
  }
  return `${parts.side} ${parts.muscle}`;
};

interface ChannelConfigurationProps {
  muscleChannels: string[];
  disabled: boolean;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}

const ChannelConfiguration: React.FC<ChannelConfigurationProps> = ({
  muscleChannels,
  disabled,
  isEditing,
  setIsEditing,
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [activeTab, setActiveTab] = useState<string>("muscles");

  const channelMuscleMapping = sessionParams.channel_muscle_mapping || {};
  const muscleColorMapping = sessionParams.muscle_color_mapping || {};

  const handleMuscleNameChange = (channel: string, muscleName: string) => {
    const updatedMapping = {
      ...channelMuscleMapping,
      [channel]: muscleName
    };
    
    setSessionParams({
      ...sessionParams,
      channel_muscle_mapping: updatedMapping
    });
  };

  const handleMuscleSideChange = (channel: string, side: string) => {
    const currentName = channelMuscleMapping[channel] || '';
    const parts = parseMuscleNameParts(currentName);
    parts.side = side;
    
    handleMuscleNameChange(channel, combineMuscleParts(parts));
  };

  const handleMuscleGroupChange = (channel: string, muscle: string) => {
    const currentName = channelMuscleMapping[channel] || '';
    const parts = parseMuscleNameParts(currentName);
    parts.muscle = muscle;
    
    handleMuscleNameChange(channel, combineMuscleParts(parts));
  };

  const handleCustomNameChange = (channel: string, custom: string) => {
    const currentName = channelMuscleMapping[channel] || '';
    const parts = parseMuscleNameParts(currentName);
    parts.custom = custom || undefined;
    
    handleMuscleNameChange(channel, combineMuscleParts(parts));
  };
  
  const handleMuscleColorChange = (muscleName: string, colorValue: string) => {
    const currentColorMapping = sessionParams.muscle_color_mapping || {};
    
    const updatedColorMapping = {
      ...currentColorMapping,
      [muscleName]: colorValue
    };
    
    setSessionParams({
      ...sessionParams,
      muscle_color_mapping: updatedColorMapping
    });
  };
  
  const resetToDefaults = () => {
    const defaultMapping: Record<string, string> = {};
    const defaultColorMapping: Record<string, string> = {};
    
    if (muscleChannels.length > 0) {
      const leftQuadName = "Left Quadriceps";
      defaultMapping[muscleChannels[0]] = leftQuadName;
      defaultColorMapping[leftQuadName] = '#3b82f6';
    }
    
    if (muscleChannels.length > 1) {
      const rightQuadName = "Right Quadriceps";
      defaultMapping[muscleChannels[1]] = rightQuadName;
      defaultColorMapping[rightQuadName] = '#ef4444';
    }
    
    setSessionParams({
      ...sessionParams,
      channel_muscle_mapping: defaultMapping,
      muscle_color_mapping: defaultColorMapping
    });
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
  };
  
  const uniqueMuscleNames = Object.values(channelMuscleMapping).filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Channel Configuration</h4>
      <div className="space-y-3">
        <Tabs defaultValue="muscles" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="muscles">Muscle Names</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
          </TabsList>
        
          <TabsContent value="muscles" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Configure muscle names for EMG channels.
              </p>
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
            
            {muscleChannels.length === 0 ? (
              <div className="p-4 bg-slate-100 rounded-md text-slate-500 text-center">
                No channels available. Please load a session first.
              </div>
            ) : (
              <div className="grid gap-4">
                {muscleChannels.map((channel) => {
                  const currentName = channelMuscleMapping[channel] || '';
                  const parts = parseMuscleNameParts(currentName);
                  const muscleColor = getMuscleColor(currentName, muscleColorMapping);
                  
                  return (
                    <div key={channel} className="grid grid-cols-4 gap-4 items-center">
                      <div>
                        <Label htmlFor={`muscle-${channel}`} className="text-sm font-medium flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border-2" 
                            style={{ backgroundColor: muscleColor.stroke, borderColor: muscleColor.stroke }}
                          />
                          Channel {channel}
                        </Label>
                      </div>
                      <div>
                        <Label htmlFor={`muscle-side-${channel}`} className="text-xs text-slate-500 mb-1 block">
                          Side
                        </Label>
                        <Select
                          value={parts.side}
                          onValueChange={(value) => handleMuscleSideChange(channel, value)}
                          disabled={disabled || !isEditing}
                        >
                          <SelectTrigger id={`muscle-side-${channel}`} className="w-full">
                            <SelectValue placeholder="Select side" />
                          </SelectTrigger>
                          <SelectContent>
                            {sides.map((side) => (
                              <SelectItem key={side} value={side}>
                                {side}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`muscle-group-${channel}`} className="text-xs text-slate-500 mb-1 block">
                          Muscle Group
                        </Label>
                        <Select
                          value={parts.muscle}
                          onValueChange={(value) => handleMuscleGroupChange(channel, value)}
                          disabled={disabled || !isEditing}
                        >
                          <SelectTrigger 
                            id={`muscle-group-${channel}`} 
                            className="w-full"
                          >
                            <SelectValue placeholder="Select muscle" />
                          </SelectTrigger>
                          <SelectContent>
                            {commonMuscleGroups.map((muscle) => (
                              <SelectItem key={muscle} value={muscle}>
                                {muscle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`muscle-custom-${channel}`} className="text-xs text-slate-500 mb-1 block">
                          Custom (Optional)
                        </Label>
                        <Input
                          id={`muscle-custom-${channel}`}
                          value={parts.custom || ''}
                          onChange={(e) => handleCustomNameChange(channel, e.target.value)}
                          placeholder="e.g., Lateral head"
                          disabled={disabled || !isEditing}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="colors" className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Customize colors for each muscle to improve visualization.
            </p>
            
            {uniqueMuscleNames.length === 0 ? (
              <div className="p-4 bg-slate-100 rounded-md text-slate-500 text-center">
                No muscles configured. Please set up muscle names first.
              </div>
            ) : (
              <div className="grid gap-4">
                {uniqueMuscleNames.map((muscleName) => {
                  const muscleColor = getMuscleColor(muscleName, muscleColorMapping);
                  const customColor = muscleColorMapping[muscleName] || muscleColor.stroke;
                  
                  return (
                    <div key={muscleName} className="grid grid-cols-3 gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full border-2" 
                          style={{ backgroundColor: customColor, borderColor: customColor }}
                        />
                        <span className="text-sm font-medium">{muscleName}</span>
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={customColor}
                          onValueChange={(value) => handleMuscleColorChange(muscleName, value)}
                          disabled={disabled || !isEditing}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                          <SelectContent>
                            {colorPresets.map((color) => (
                              <SelectItem key={color.value} value={color.value}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded-full" 
                                    style={{ backgroundColor: color.value }}
                                  />
                                  <span>{color.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end">
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            disabled={disabled || !isEditing}
            size="sm"
          >
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChannelConfiguration; 