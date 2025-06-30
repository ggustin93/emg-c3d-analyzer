import React, { useState, useEffect } from 'react';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { GameSessionParameters, EMGChannelSignalData } from '../types/emg';
import { Pencil1Icon, CheckIcon } from '@radix-ui/react-icons';
import { getMuscleColor } from '../lib/colorMappings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import DownsamplingControl from './app/DownsamplingControl';
import { Slider } from "./ui/slider";
import { useSessionStore } from '../store/sessionStore';

interface SettingsPanelProps {
  muscleChannels: string[];
  disabled: boolean;
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
}

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

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  muscleChannels,
  disabled,
  plotMode,
  setPlotMode,
  dataPoints,
  setDataPoints,
  plotChannel1Data,
  plotChannel2Data,
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  // State to track if we're in edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("muscles");
  
  // Initialize mapping if it doesn't exist
  const channelMuscleMapping = sessionParams.channel_muscle_mapping || {};
  
  // Initialize color mapping if it doesn't exist
  const muscleColorMapping = sessionParams.muscle_color_mapping || {};
  
  // Set default muscle names when component mounts if they aren't already set
  useEffect(() => {
    let needsUpdate = false;
    const updatedMapping = { ...channelMuscleMapping };
    const updatedColorMapping = { ...muscleColorMapping };
    
    // Set default muscle name and color for first channel
    if (muscleChannels.length > 0 && !channelMuscleMapping[muscleChannels[0]]) {
      const leftQuadName = "Left Quadriceps";
      updatedMapping[muscleChannels[0]] = leftQuadName;
      
      // Set blue color for Left Quadriceps if not already set
      if (!updatedColorMapping[leftQuadName]) {
        updatedColorMapping[leftQuadName] = '#3b82f6'; // Blue
      }
      
      needsUpdate = true;
    }
    
    // Set default muscle name and color for second channel
    if (muscleChannels.length > 1 && !channelMuscleMapping[muscleChannels[1]]) {
      const rightQuadName = "Right Quadriceps";
      updatedMapping[muscleChannels[1]] = rightQuadName;
      
      // Set red color for Right Quadriceps if not already set
      if (!updatedColorMapping[rightQuadName]) {
        updatedColorMapping[rightQuadName] = '#ef4444'; // Red
      }
      
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      setSessionParams({
        ...sessionParams,
        channel_muscle_mapping: updatedMapping,
        muscle_color_mapping: updatedColorMapping
      });
    }
  }, [muscleChannels, channelMuscleMapping, muscleColorMapping, sessionParams, setSessionParams]);
  
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
    // Ensure muscle_color_mapping is initialized
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
    // Set default mappings
    const defaultMapping: Record<string, string> = {};
    const defaultColorMapping: Record<string, string> = {};
    
    if (muscleChannels.length > 0) {
      const leftQuadName = "Left Quadriceps";
      defaultMapping[muscleChannels[0]] = leftQuadName;
      defaultColorMapping[leftQuadName] = '#3b82f6'; // Blue
    }
    
    if (muscleChannels.length > 1) {
      const rightQuadName = "Right Quadriceps";
      defaultMapping[muscleChannels[1]] = rightQuadName;
      defaultColorMapping[rightQuadName] = '#ef4444'; // Red
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

  // Get all unique muscle names from the mapping
  const uniqueMuscleNames = Object.values(channelMuscleMapping).filter(Boolean) as string[];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Display & Channel Settings</CardTitle>
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
        <CardDescription>
          Configure muscle names, colors, and plot display options.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="muscles" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="muscles">Muscle Names</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="plot">Plot</TabsTrigger>
          </TabsList>
          
          <TabsContent value="muscles" className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Rename EMG channels to match actual muscle names for better readability in reports and analytics. Each muscle is assigned a unique color for consistency across all charts and tables.
            </p>
            
            {muscleChannels.length === 0 ? (
              <div className="p-4 bg-slate-100 rounded-md text-slate-500 text-center">
                No channels available. Please load a session first.
              </div>
            ) : (
              <>
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
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`muscle-group-${channel}`} className="text-xs text-slate-500 mb-1 block">
                              Muscle Group
                            </Label>
                          </div>
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
              </>
            )}
          </TabsContent>
          
          <TabsContent value="colors" className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Customize colors for each muscle to improve visualization and match your preferences. Colors will be consistent across all charts and tables.
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
          
          <TabsContent value="plot" className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Configure how EMG signals are displayed in charts and visualizations.
            </p>

            <div className="flex items-center justify-between space-x-2 p-2 rounded-md border">
              <Label htmlFor="plot-mode-switch" className="flex flex-col space-y-1">
                <span>Signal Type</span>
                <span className="font-normal text-sm text-slate-500">
                  Switch between Raw and Activated signals.
                </span>
              </Label>
              <div className="flex items-center space-x-2">
                <Label htmlFor="plot-mode-switch">Raw</Label>
                <Switch
                  id="plot-mode-switch"
                  checked={plotMode === 'activated'}
                  onCheckedChange={(checked: boolean) => {
                    const newMode = checked ? 'activated' : 'raw';
                    setPlotMode(newMode);
                    // Sync with session params
                    setSessionParams({
                      ...sessionParams,
                      show_raw_signals: newMode === 'raw'
                    });
                  }}
                  disabled={disabled}
                />
                <Label htmlFor="plot-mode-switch">Activated</Label>
              </div>
            </div>

            <div className="space-y-2 p-2 rounded-md border">
              <Label>Data Display Options</Label>
              <div className="flex flex-col space-y-3">
                <Label htmlFor="downsampling-points">Data Points for Plot</Label>
                <DownsamplingControl
                  dataPoints={dataPoints}
                  setDataPoints={setDataPoints}
                  plotChannel1Data={plotChannel1Data}
                  plotChannel2Data={plotChannel2Data}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="pt-4 flex justify-end">
          <Button 
            onClick={resetToDefaults}
            variant="outline"
            disabled={disabled || !isEditing}
            size="sm"
          >
            Reset to Default Names & Colors
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsPanel; 