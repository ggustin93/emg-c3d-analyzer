import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { ActivityLogIcon, InfoCircledIcon, TargetIcon, GearIcon } from '@radix-ui/react-icons';
import MuscleNameDisplay from '../MuscleNameDisplay';

interface TherapeuticParametersSettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  isDebugMode: boolean;
}

const TherapeuticParametersSettings: React.FC<TherapeuticParametersSettingsProps> = ({ muscleChannels, disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isClinicalParametersOpen, setIsClinicalParametersOpen] = useState(false);
  
  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  const handleExpectedContractionsChange = (value: number | null) => {
    const updatedParams = {
      ...sessionParams,
      session_expected_contractions: value
    };
    
    if (value !== null && value > 0) {
      const halfExpected = value / 2;
      updatedParams.session_expected_contractions_ch1 = Math.ceil(halfExpected);
      updatedParams.session_expected_contractions_ch2 = Math.floor(halfExpected);
    }
    
    setSessionParams(updatedParams);
  };

  return (
    <UnifiedSettingsCard
      title="Therapeutic Parameters"
      description="MVC analysis settings and therapeutic thresholds for score computation"
      isOpen={isClinicalParametersOpen}
      onOpenChange={setIsClinicalParametersOpen}
      icon={<ActivityLogIcon className="h-5 w-5 text-green-600" />}
      accentColor="green-600"
      badge={<Badge variant="outline" className="bg-green-100 text-green-800 text-xs">Clinical Parameters</Badge>}
    >
      <TooltipProvider>
        <div className="space-y-6">
          {/* Session Goals Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">Session Goals</h5>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Define therapeutic targets for this session. These goals are used to calculate completion rates and overall performance metrics.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Total Target Count</Label>
                  <Input
                    type="number"
                    value={sessionParams.session_expected_contractions ?? ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || null;
                      handleExpectedContractionsChange(value);
                    }}
                    placeholder="e.g., 24"
                    min="0" step="1"
                    disabled={disabled}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-gray-600">Total contractions for this session</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Distribution</Label>
                  <div className="h-9 px-3 py-2 bg-white border rounded-md text-sm text-slate-500">
                    Auto-split between muscles
                  </div>
                  <p className="text-xs text-gray-600">Automatically distributed equally</p>
                </div>
              </div>

              {/* Channel-specific breakdown */}
              {muscleChannels2.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-300">
                  <div className="grid grid-cols-2 gap-4">
                    {muscleChannels2.map((channel, index) => {
                      const expectedValue = index === 0 
                        ? sessionParams.session_expected_contractions_ch1
                        : sessionParams.session_expected_contractions_ch2;
                      
                      return (
                        <div key={channel} className="space-y-2">
                          <Label className="text-sm font-medium text-gray-700">
                            <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                          </Label>
                          <Input
                            type="number"
                            value={expectedValue ?? ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || null;
                              const fieldName = index === 0 
                                ? 'session_expected_contractions_ch1'
                                : 'session_expected_contractions_ch2';
                              
                              const updatedParams = {
                                ...sessionParams,
                                [fieldName]: value
                              };
                              
                              const ch1Value = index === 0 ? value : sessionParams.session_expected_contractions_ch1;
                              const ch2Value = index === 1 ? value : sessionParams.session_expected_contractions_ch2;
                              const newTotal = (ch1Value || 0) + (ch2Value || 0);
                              
                              if (ch1Value !== null && ch2Value !== null && newTotal > 0) {
                                updatedParams.session_expected_contractions = newTotal;
                              }
                              
                              setSessionParams(updatedParams);
                            }}
                            placeholder="e.g., 12"
                            min="0" step="1"
                            disabled={disabled}
                            className="h-9 text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MVC Analysis Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GearIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">MVC Analysis Settings</h5>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    MVC values are computed from initial assessment sessions or imported from mobile app. These values represent the maximum voluntary contraction capacity for each muscle and are used to assess contraction quality.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
              {muscleChannels2.map((channel) => {
                // Get channel-specific MVC value or fallback to global MVC value
                const mvcValue = sessionParams.session_mvc_values?.[channel] || sessionParams.session_mvc_value || null;
                const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 
                                      sessionParams.session_mvc_threshold_percentage ?? 75;
                
                return (
                  <div key={channel} className="space-y-3">
                    <h6 className="text-sm font-semibold text-gray-800">
                      <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                    </h6>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">MVC Value</Label>
                        {isDebugMode ? (
                          <Input
                            type="number"
                            value={mvcValue ?? ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || null;
                              setSessionParams({
                                ...sessionParams,
                                session_mvc_values: {
                                  ...(sessionParams.session_mvc_values || {}),
                                  [channel]: value
                                }
                              });
                            }}
                            placeholder="Auto"
                            step="0.0001"
                            disabled={disabled}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <div className="h-9 px-3 py-2 bg-white border rounded-md text-sm text-slate-500">
                            {mvcValue !== undefined && mvcValue !== null ? `${mvcValue.toExponential(3)} mV` : 'No data loaded'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Threshold %</Label>
                        <Input
                          type="number"
                          value={thresholdValue}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 75;
                            setSessionParams({
                              ...sessionParams,
                              session_mvc_threshold_percentages: {
                                ...(sessionParams.session_mvc_threshold_percentages || {}),
                                [channel]: value
                              }
                            });
                          }}
                          min="0" max="100"
                          disabled={disabled}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Alert>
              <InfoCircledIcon className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Note:</strong> MVC values are initialized from baseline game sessions and adapt via Dynamic Difficulty Algorithm (DDA) to maintain optimal therapeutic challenge. {isDebugMode && 'Values can be manually adjusted in debug mode for testing purposes.'}
              </AlertDescription>
            </Alert>
          </div>
          
          {/* Duration Thresholds Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GearIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">Duration Thresholds</h5>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Configure muscle-specific minimum duration thresholds for therapeutic effectiveness. These values determine what constitutes a valid contraction duration for scoring purposes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
              {muscleChannels2.map((channel) => {
                const durationValue = sessionParams.session_duration_thresholds_per_muscle?.[channel] ?? 
                  (sessionParams.contraction_duration_threshold_ms ? (sessionParams.contraction_duration_threshold_ms / 1000) : 2);
                
                return (
                  <div key={channel} className="space-y-3">
                    <h6 className="text-sm font-semibold text-gray-800">
                      <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                    </h6>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Minimum Duration (seconds)</Label>
                      <Input
                        type="number"
                        value={durationValue}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 2;
                          setSessionParams({
                            ...sessionParams,
                            session_duration_thresholds_per_muscle: {
                              ...(sessionParams.session_duration_thresholds_per_muscle || {}),
                              [channel]: value
                            },
                            // Update the global threshold for backward compatibility
                            contraction_duration_threshold_ms: value * 1000
                          });
                        }}
                        min="0.5" max="10" step="0.5"
                        disabled={disabled}
                        className="h-9 text-sm"
                      />
                      <p className="text-xs text-gray-600">Muscle-specific therapeutic duration</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Alert className="mt-3">
              <InfoCircledIcon className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Clinical Standards:</strong> Duration thresholds are now muscle-specific to optimize therapeutic outcomes. Default duration ≥2s adapts via Dynamic Difficulty Algorithm (3s→10s max). Different muscle groups may require different optimal durations based on fiber type composition and therapeutic goals. These parameters adapt dynamically based on GHOSTLY+ DDA clinical protocol.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </TooltipProvider>
    </UnifiedSettingsCard>
  );
};

export default TherapeuticParametersSettings; 