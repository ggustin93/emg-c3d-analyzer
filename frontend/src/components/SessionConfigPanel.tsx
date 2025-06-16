import React, { useState, useEffect } from 'react';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { GameSessionParameters } from '../types/emg';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription } from "../components/ui/alert";
import MuscleNameDisplay from "./MuscleNameDisplay";

interface ScoringConfigPanelProps {
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  onRecalculate?: () => void;
  disabled: boolean;
  availableChannels?: string[];
}

const ScoringConfigPanel: React.FC<ScoringConfigPanelProps> = ({ 
  sessionParams, 
  onParamsChange, 
  onRecalculate,
  disabled,
  availableChannels = []
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    channels?: string;
    types?: string;
  }>({});
  
  // Set default values when component mounts
  useEffect(() => {
    // Skip if already initialized or disabled
    if (
      sessionParams.session_mvc_threshold_percentage !== undefined ||
      sessionParams.session_expected_contractions !== undefined ||
      disabled
    ) {
      return;
    }
    
    // Only set defaults if values are not already set
    const updatedParams = { ...sessionParams };
    let hasUpdates = false;

    // Set default MVC threshold if not set
    if (updatedParams.session_mvc_threshold_percentage === undefined) {
      updatedParams.session_mvc_threshold_percentage = 70;
      hasUpdates = true;
    }

    // Set default expected contractions if not set
    if (updatedParams.session_expected_contractions === undefined) {
      updatedParams.session_expected_contractions = 10;
      hasUpdates = true;
    }

    // Set default expected contractions per channel if not set
    if (updatedParams.session_expected_contractions_ch1 === undefined) {
      updatedParams.session_expected_contractions_ch1 = 5;
      hasUpdates = true;
    }

    if (updatedParams.session_expected_contractions_ch2 === undefined) {
      updatedParams.session_expected_contractions_ch2 = 5;
      hasUpdates = true;
    }

    // Set default expected contractions by type if not set
    if (updatedParams.session_expected_short_left === undefined) {
      updatedParams.session_expected_short_left = 3;
      hasUpdates = true;
    }

    if (updatedParams.session_expected_long_left === undefined) {
      updatedParams.session_expected_long_left = 2;
      hasUpdates = true;
    }

    if (updatedParams.session_expected_short_right === undefined) {
      updatedParams.session_expected_short_right = 3;
      hasUpdates = true;
    }

    if (updatedParams.session_expected_long_right === undefined) {
      updatedParams.session_expected_long_right = 2;
      hasUpdates = true;
    }

    // Set default contraction duration threshold if not set
    if (updatedParams.contraction_duration_threshold === undefined) {
      updatedParams.contraction_duration_threshold = 250;
      hasUpdates = true;
    }

    // Apply updates if any defaults were set
    if (hasUpdates) {
      onParamsChange(updatedParams);
    }
  }, [sessionParams, onParamsChange]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numValue: number | undefined | null = parseFloat(value);
    if (isNaN(numValue)) {
        numValue = name === 'session_mvc_value' ? null : undefined; // Allow clearing MVC value
    }

    onParamsChange({
      ...sessionParams,
      [name]: numValue,
    });
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

  // Filter channels to only include muscle channels (not raw/activated variants)
  const muscleChannels = availableChannels.filter(channel => 
    !channel.includes(' Raw') && !channel.includes(' activated')
  );

  // Get channel names for display
  const channel1Name = muscleChannels[0] || 'Channel 1';
  const channel2Name = muscleChannels[1] || 'Channel 2';
  
  // Get muscle names for display
  const muscle1Name = sessionParams.channel_muscle_mapping?.[channel1Name] || channel1Name;
  const muscle2Name = sessionParams.channel_muscle_mapping?.[channel2Name] || channel2Name;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center">
          <Label htmlFor="session_mvc_value" className="text-sm font-medium flex-grow">MVC Value (mV)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 hover:text-slate-600 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[200px] text-xs">
                  Maximum Voluntary Contraction value in millivolts. 
                  Leave empty to use the maximum value from the recording.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Input
            type="number"
            id="session_mvc_value"
            name="session_mvc_value"
            value={sessionParams.session_mvc_value ?? ''}
            onChange={handleChange}
            placeholder="e.g., 1.5"
            min="0" step="0.01"
            className="pr-8"
            disabled={disabled}
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">mV</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <Label htmlFor="session_mvc_threshold_percentage" className="text-sm font-medium flex-grow">MVC Threshold (%)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 hover:text-slate-600 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[200px] text-xs">
                  Percentage of MVC that defines a "good" contraction. 
                  Typically between 60-80% for rehabilitation exercises.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Input
            type="number"
            id="session_mvc_threshold_percentage"
            name="session_mvc_threshold_percentage"
            value={sessionParams.session_mvc_threshold_percentage ?? ''}
            onChange={handleChange}
            placeholder="e.g., 75"
            min="0" max="100" step="1"
            className="pr-8"
            disabled={disabled}
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">%</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <Label htmlFor="session_expected_contractions" className="text-sm font-medium flex-grow">Expected Contractions (Total)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 hover:text-slate-600 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[200px] text-xs">
                  Total number of contractions expected in this session.
                  Used to calculate performance score.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

      <Collapsible 
        open={isAdvancedOpen} 
        onOpenChange={setIsAdvancedOpen}
        className="border rounded-md p-2"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between p-2 hover:bg-slate-50 rounded">
          <span className="text-sm font-medium">Advanced Scoring Parameters</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={`transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Tabs defaultValue="channels">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="channels">By Channel</TabsTrigger>
              <TabsTrigger value="types">By Type</TabsTrigger>
              <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
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

            <TabsContent value="thresholds" className="space-y-4 pt-2">
              {/* Contraction Duration Threshold */}
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="contraction_duration_threshold" className="text-sm font-medium flex-grow">
                    Short/Long Threshold
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-slate-400 hover:text-slate-600 cursor-help">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">
                          Duration threshold in milliseconds to distinguish between short and long contractions. 
                          Contractions shorter than this value are considered "short".
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    id="contraction_duration_threshold"
                    name="contraction_duration_threshold"
                    value={sessionParams.contraction_duration_threshold ?? 250}
                    onChange={handleChange}
                    placeholder="e.g., 250"
                    min="100" step="50"
                    className="pr-8"
                    disabled={disabled}
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-400">ms</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>

      {onRecalculate && (
        <div className="pt-2">
          <Button 
            onClick={onRecalculate} 
            disabled={disabled || !!validationErrors.channels || !!validationErrors.types}
            className="w-full"
          >
            Re-calculate Scores
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScoringConfigPanel; 