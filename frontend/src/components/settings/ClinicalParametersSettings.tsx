import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import CollapsibleSettingsCard from './CollapsibleSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import MuscleNameDisplay from '../MuscleNameDisplay';

interface ClinicalParametersSettingsProps {
  muscleChannels: string[];
  disabled: boolean;
  isDebugMode: boolean;
}

const ClinicalParametersSettings: React.FC<ClinicalParametersSettingsProps> = ({ muscleChannels, disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isClinicalParametersOpen, setIsClinicalParametersOpen] = useState(false);
  
  const muscleChannels2 = muscleChannels.filter(ch => !ch.includes(' ')).slice(0, 2);

  return (
    <CollapsibleSettingsCard
      title="Clinical Parameters"
      description={isDebugMode ? 'Clinical rehabilitation parameters (editable in debug mode)' : 'MVC values and therapeutic thresholds computed from initial assessment'}
      isOpen={isClinicalParametersOpen}
      onOpenChange={setIsClinicalParametersOpen}
    >
      <TooltipProvider>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-700">MVC Analysis</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 hover:text-slate-600 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[300px] text-xs">
                  MVC values are computed from initial assessment sessions or imported from mobile app. These values represent the maximum voluntary contraction capacity for each muscle and are used to assess contraction quality.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            {muscleChannels2.map((channel) => {
              const mvcValue = sessionParams.session_mvc_values?.[channel];
              const thresholdValue = sessionParams.session_mvc_threshold_percentages?.[channel] ?? 70;
              
              return (
                <div key={channel} className="space-y-2">
                  <h5 className="text-sm font-medium">
                    <MuscleNameDisplay channelName={channel} sessionParams={sessionParams} />
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-xs text-slate-600">MVC Value</Label>
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
                          className="h-8 text-xs"
                        />
                      ) : (
                        <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                          {mvcValue ? `${mvcValue.toExponential(3)} mV` : 'Auto-computed'}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Threshold</Label>
                      {isDebugMode ? (
                        <Input
                          type="number"
                          value={thresholdValue}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 70;
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
                          className="h-8 text-xs"
                        />
                      ) : (
                        <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                          {thresholdValue}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {!isDebugMode && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> MVC values are automatically computed from C3D files, mobile app data, or shared database. Enable Debug Mode to manually adjust these values.
              </p>
            </div>
          )}
        </div>
      </TooltipProvider>
    </CollapsibleSettingsCard>
  );
};

export default ClinicalParametersSettings; 