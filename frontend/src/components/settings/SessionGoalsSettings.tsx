import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { TargetIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import MuscleNameDisplay from '../MuscleNameDisplay';

interface SessionGoalsSettingsProps {
  muscleChannels: string[];
  disabled: boolean;
}

const SessionGoalsSettings: React.FC<SessionGoalsSettingsProps> = ({ muscleChannels, disabled }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isSessionGoalsOpen, setIsSessionGoalsOpen] = useState(false);
  
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
      title="Session Goals"
      description="Therapy session targets and contraction thresholds"
      isOpen={isSessionGoalsOpen}
      onOpenChange={setIsSessionGoalsOpen}
      icon={<TargetIcon className="h-5 w-5 text-green-500" />}
      accentColor="green-500"
    >
      <TooltipProvider>
        {/* Expected Contractions */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Target Contractions</h4>
          <div className="space-y-3">
            {/* Total Expected Contractions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="session_expected_contractions" className="text-sm font-medium flex-grow">
                  Total Target Count
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-[250px] text-xs">
                      Set the total target contractions for this session. This will auto-distribute between muscles (e.g., 24 total = 12 for each muscle).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                id="session_expected_contractions"
                value={sessionParams.session_expected_contractions ?? ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || null;
                  handleExpectedContractionsChange(value);
                }}
                placeholder="e.g., 24"
                min="0" step="1"
                disabled={disabled}
              />
            </div>

            {/* Channel-specific breakdown */}
            {muscleChannels2.length > 0 && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                {muscleChannels2.map((channel, index) => {
                  const expectedValue = index === 0 
                    ? sessionParams.session_expected_contractions_ch1
                    : sessionParams.session_expected_contractions_ch2;
                  
                  return (
                    <div key={channel} className="space-y-2">
                      <Label className="text-sm font-medium">
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
                        className="text-center"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Contraction Duration Threshold */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Quality Thresholds</h4>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Minimum Contraction Duration</Label>
              <div className="flex items-center space-x-4">
                <Slider
                  value={[sessionParams.contraction_duration_threshold || 2000]}
                  onValueChange={(value) => setSessionParams({ 
                    ...sessionParams,
                    contraction_duration_threshold: value[0] 
                  })}
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
                Focus on longest possible contractions for therapeutic benefit.
              </p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </UnifiedSettingsCard>
  );
};

export default SessionGoalsSettings; 