import React, { useState, useEffect } from 'react';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { GameSessionParameters } from '../types/emg';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Switch } from "./ui/switch";
import MuscleNameDisplay from "./MuscleNameDisplay";
import { useSessionStore } from '../store/sessionStore';
import { Slider } from "./ui/slider";

interface ScoringConfigPanelProps {
  onRecalculate?: () => void;
  disabled: boolean;
  availableChannels?: string[];
}

const ScoringConfigPanel: React.FC<ScoringConfigPanelProps> = ({ 
  onRecalculate,
  disabled,
  availableChannels = []
}) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  
  // Extract muscle channels (CH1, CH2, etc.) from available channels
  const muscleChannels = availableChannels
    .filter(ch => !ch.includes(' ')) // Filter out channels with spaces (like "CH1 Raw")
    .slice(0, 2); // Limit to 2 channels for now
  
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    channels?: string;
    types?: string;
  }>({});
  
  // Initialize channel-specific MVC values if not already set
  useEffect(() => {
    const updatedParams = { ...sessionParams };
    let hasChanges = false;
    
    // Initialize MVC values map if it doesn't exist
    if (!updatedParams.session_mvc_values) {
      updatedParams.session_mvc_values = {};
      hasChanges = true;
    }
    
    // Initialize MVC threshold percentages map if it doesn't exist
    if (!updatedParams.session_mvc_threshold_percentages) {
      updatedParams.session_mvc_threshold_percentages = {};
      hasChanges = true;
    }
    
    // Ensure all muscle channels have values
    muscleChannels.forEach(channel => {
      // Initialize MVC value if not set
      if (!updatedParams.session_mvc_values![channel]) {
        // Use global value as fallback if available
        updatedParams.session_mvc_values![channel] = updatedParams.session_mvc_value !== undefined ? 
          updatedParams.session_mvc_value : null;
        hasChanges = true;
      }
      
      // Initialize threshold percentage if not set
      if (!updatedParams.session_mvc_threshold_percentages![channel]) {
        updatedParams.session_mvc_threshold_percentages![channel] = 
          updatedParams.session_mvc_threshold_percentage || 75;
        hasChanges = true;
      }
    });
    
    // Only trigger update if changes were made
    if (hasChanges) {
      setSessionParams(updatedParams);
    }
  }, [sessionParams, muscleChannels, setSessionParams]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numValue: number | null = parseFloat(value);
    
    if (isNaN(numValue)) {
      numValue = null; // Allow clearing values
    }
    
    const updatedParams = {
      ...sessionParams,
      [name]: numValue
    };
    
    // Auto-distribute expected contractions between channels
    if (name === 'session_expected_contractions' && numValue !== null) {
      const halfExpected = numValue / 2;
      
      // Update channel values
      updatedParams.session_expected_contractions_ch1 = Math.ceil(halfExpected);
      updatedParams.session_expected_contractions_ch2 = Math.floor(halfExpected);
      
      // Update type values
      updatedParams.session_expected_short_left = Math.ceil(halfExpected / 2);
      updatedParams.session_expected_long_left = Math.floor(halfExpected / 2);
      updatedParams.session_expected_short_right = Math.ceil(halfExpected / 2);
      updatedParams.session_expected_long_right = Math.floor(halfExpected / 2);
    }

    setSessionParams(updatedParams);
  };

  // Handle channel-specific MVC value changes
  const handleChannelMVCChange = (channel: string, value: string) => {
    let numValue: number | null = parseFloat(value);
    if (isNaN(numValue)) {
      numValue = null; // Allow clearing MVC value
    } else if (numValue !== null) {
      numValue = parseFloat(numValue.toPrecision(5));
    }

    const updatedParams = {
      ...sessionParams,
      session_mvc_values: {
        ...(sessionParams.session_mvc_values || {}),
        [channel]: numValue
      }
    };

    setSessionParams(updatedParams);
  };

  // Handle channel-specific MVC threshold percentage changes
  const handleChannelThresholdChange = (channel: string, value: string) => {
    let numValue: number | null = parseFloat(value);
    if (isNaN(numValue)) {
      numValue = 75; // Default to 75% if invalid
    }

    const updatedParams = {
      ...sessionParams,
      session_mvc_threshold_percentages: {
        ...(sessionParams.session_mvc_threshold_percentages || {}),
        [channel]: numValue
      }
    };

    setSessionParams(updatedParams);
  };

  // Validate that the sum of channel contractions matches the total
  useEffect(() => {
    const errors: {
      channels?: string;
      types?: string;
    } = {};
    
    // Validate channels
    const ch1 = sessionParams.session_expected_contractions_ch1 || 0;
    const ch2 = sessionParams.session_expected_contractions_ch2 || 0;
    const total = sessionParams.session_expected_contractions || 0;
    
    if (ch1 + ch2 > 0 && ch1 + ch2 !== total) {
      errors.channels = `Channel sum (${ch1 + ch2}) doesn't match total (${total})`;
    }
    
    // Validate types
    const longLeft = sessionParams.session_expected_long_left || 0;
    const shortLeft = sessionParams.session_expected_short_left || 0;
    const longRight = sessionParams.session_expected_long_right || 0;
    const shortRight = sessionParams.session_expected_short_right || 0;
    const typeSum = longLeft + shortLeft + longRight + shortRight;
    
    if (typeSum > 0 && typeSum !== total) {
      errors.types = `Type sum (${typeSum}) doesn't match total (${total})`;
    }
    
    setValidationErrors(errors);
  }, [sessionParams]);

  // Get channel names for display
  const channel1Name = muscleChannels[0] || 'Channel 1';
  const channel2Name = muscleChannels[1] || 'Channel 2';
  
  // Get muscle names for display
  const muscle1Name = sessionParams.channel_muscle_mapping?.[channel1Name] || channel1Name;
  const muscle2Name = sessionParams.channel_muscle_mapping?.[channel2Name] || channel2Name;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Muscle-Specific MVC Values Section */}
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Muscle-Specific MVC Values</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-slate-400 hover:text-slate-600 cursor-help">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="w-[250px] text-xs">
                Each muscle requires its own specific MVC value due to anatomical differences in size, fiber composition, and electrode placement. This approach provides more accurate clinical assessment.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-4 border rounded-md p-3">

          <div className="flex items-center justify-between">
            
          </div>
          
          {/* Channel-specific MVC values */}
          {muscleChannels.map((channel, index) => {
            const muscleName = sessionParams.channel_muscle_mapping?.[channel] || channel;
            const mvcValue = sessionParams.session_mvc_values?.[channel] ?? '';
            const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 75;
            
            return (
              <div key={channel} className="space-y-3 pb-3 border-b last:border-b-0 last:pb-0">
                <h5 className="text-sm font-medium">{muscleName}</h5>
                
                {/* MVC Value for this channel */}
                <div className="space-y-1">
                  <div className="flex items-center">
                    <Label htmlFor={`mvc_${channel}`} className="text-xs font-medium flex-grow">MVC Value (mV)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-slate-400 hover:text-slate-600 cursor-help">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[250px] text-xs">
                          MVC value is automatically initialized to the maximum contraction amplitude detected in the signal. This is the highest peak value from all detected contractions. You can manually adjust this value if needed.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      id={`mvc_${channel}`}
                      value={mvcValue}
                      onChange={(e) => handleChannelMVCChange(channel, e.target.value)}
                      placeholder="e.g., 1.5"
                      min="0" step="0.0001"
                      disabled={disabled}
                      className="pr-10"
                    />
                  </div>
                </div>
                
                {/* MVC Threshold for this channel */}
                <div className="space-y-1">
                  <div className="flex items-center">
                    <Label htmlFor={`threshold_${channel}`} className="text-xs font-medium flex-grow">MVC Threshold (%)</Label>
                  </div>
                  <Input
                    type="number"
                    id={`threshold_${channel}`}
                    value={thresholdValue}
                    onChange={(e) => handleChannelThresholdChange(channel, e.target.value)}
                    placeholder="e.g., 75"
                    min="0" max="100" step="1"
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Analysis Thresholds Section */}
        <div className="flex items-center gap-2 pt-4">
          <h4 className="text-sm font-medium">Analysis Thresholds</h4>
        </div>
        <div className="space-y-4 border rounded-md p-3">
          <div className="space-y-2">
            <Label>Contraction Duration Threshold</Label>
            <div className="flex items-center space-x-4">
              <Slider
                value={[sessionParams.contraction_duration_threshold || 2000]}
                onValueChange={(value) => setSessionParams({ contraction_duration_threshold: value[0] })}
                min={100}
                max={5000}
                step={100}
                disabled={disabled}
              />
              <div className="w-24 text-right">
                <span>{(sessionParams.contraction_duration_threshold || 2000) / 1000}s</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Defines the boundary between a "short" and a "long" contraction.
            </p>
          </div>
        </div>

        {/* Expected Contractions Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="session_expected_contractions" className="text-sm font-medium flex-grow">
              Expected Contractions (Total)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 hover:text-slate-600 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[250px] text-xs">
                  Set the total number of expected muscle contractions for this session. This is used to calculate completion scores.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            id="session_expected_contractions"
            name="session_expected_contractions"
            value={sessionParams.session_expected_contractions ?? ''}
            onChange={handleChange}
            placeholder="e.g., 20"
            min="0" step="1"
            disabled={disabled}
          />
        </div>

        {/* Advanced Contraction Settings */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium cursor-pointer">
            Advanced Contraction Settings
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round" 
              strokeLinejoin="round" 
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Tabs defaultValue="channels">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="channels">By Channel</TabsTrigger>
                <TabsTrigger value="types">By Type</TabsTrigger>
              </TabsList>
              
              <TabsContent value="channels" className="space-y-4 pt-2">
                {validationErrors.channels && (
                  <Alert variant="destructive" className="py-2 text-sm">
                    <AlertDescription>{validationErrors.channels}</AlertDescription>
                  </Alert>
                )}
                
                {/* Channel 1 */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_contractions_ch1" className="text-sm font-medium flex-grow">
                      Expected for <MuscleNameDisplay channelName={channel1Name} sessionParams={sessionParams} />
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_contractions_ch1"
                    name="session_expected_contractions_ch1"
                    value={sessionParams.session_expected_contractions_ch1 ?? ''}
                    onChange={handleChange}
                    placeholder={`e.g., 10 for ${muscle1Name}`}
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
                
                {/* Channel 2 */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_contractions_ch2" className="text-sm font-medium flex-grow">
                      Expected for <MuscleNameDisplay channelName={channel2Name} sessionParams={sessionParams} />
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_contractions_ch2"
                    name="session_expected_contractions_ch2"
                    value={sessionParams.session_expected_contractions_ch2 ?? ''}
                    onChange={handleChange}
                    placeholder={`e.g., 10 for ${muscle2Name}`}
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="types" className="space-y-4 pt-2">
                {validationErrors.types && (
                  <Alert variant="destructive" className="py-2 text-sm">
                    <AlertDescription>{validationErrors.types}</AlertDescription>
                  </Alert>
                )}
                
                {/* Long Left */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_long_left" className="text-sm font-medium flex-grow">
                      Expected Long Left
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_long_left"
                    name="session_expected_long_left"
                    value={sessionParams.session_expected_long_left ?? ''}
                    onChange={handleChange}
                    placeholder="e.g., 5"
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
                
                {/* Short Left */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_short_left" className="text-sm font-medium flex-grow">
                      Expected Short Left
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_short_left"
                    name="session_expected_short_left"
                    value={sessionParams.session_expected_short_left ?? ''}
                    onChange={handleChange}
                    placeholder="e.g., 5"
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
                
                {/* Long Right */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_long_right" className="text-sm font-medium flex-grow">
                      Expected Long Right
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_long_right"
                    name="session_expected_long_right"
                    value={sessionParams.session_expected_long_right ?? ''}
                    onChange={handleChange}
                    placeholder="e.g., 5"
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
                
                {/* Short Right */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="session_expected_short_right" className="text-sm font-medium flex-grow">
                      Expected Short Right
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id="session_expected_short_right"
                    name="session_expected_short_right"
                    value={sessionParams.session_expected_short_right ?? ''}
                    onChange={handleChange}
                    placeholder="e.g., 5"
                    min="0" step="1"
                    disabled={disabled}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CollapsibleContent>
        </Collapsible>

        {onRecalculate && (
          <div className="pt-2 flex justify-end">
            <Button 
              onClick={onRecalculate} 
              disabled={disabled || !!validationErrors.channels || !!validationErrors.types}
              size="sm"
            >
              Re-calculate Scores
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ScoringConfigPanel;