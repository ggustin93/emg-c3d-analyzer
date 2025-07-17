import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import CollapsibleSettingsCard from './CollapsibleSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface PatientOutcomesSettingsProps {
  disabled: boolean;
  isDebugMode: boolean;
}

const PatientOutcomesSettings: React.FC<PatientOutcomesSettingsProps> = ({ disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isPatientOutcomesOpen, setIsPatientOutcomesOpen] = useState(false);

  return (
    <CollapsibleSettingsCard
      title="Patient Reported Outcomes"
      description={isDebugMode ? 'PRO data (editable in debug mode)' : 'Patient outcomes imported from GHOSTLY+ mobile app'}
      isOpen={isPatientOutcomesOpen}
      onOpenChange={setIsPatientOutcomesOpen}
    >
      <TooltipProvider>
        {/* Perceived Exertion */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-700">Perceived Exertion (Borg CR10)</h4>
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
                  Borg CR10 scale (0-10) for Rating of Perceived Exertion. Data collected through GHOSTLY+ mobile app during therapy sessions. Used to assess patient-reported exercise intensity and fatigue levels.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pre-Session RPE</Label>
              {isDebugMode ? (
                <Input
                  type="number"
                  value={(sessionParams.pre_session_rpe as number) ?? ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || null;
                    setSessionParams({
                      ...sessionParams,
                      pre_session_rpe: value
                    });
                  }}
                  placeholder="0-10"
                  min="0" max="10" step="0.5"
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                  {(sessionParams.pre_session_rpe as number) ? `${(sessionParams.pre_session_rpe as number)}/10` : 'From mobile app'}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Post-Session RPE</Label>
              {isDebugMode ? (
                <Input
                  type="number"
                  value={(sessionParams.post_session_rpe as number) ?? ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || null;
                    setSessionParams({
                      ...sessionParams,
                      post_session_rpe: value
                    });
                  }}
                  placeholder="0-10"
                  min="0" max="10" step="0.5"
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                  {(sessionParams.post_session_rpe as number) ? `${(sessionParams.post_session_rpe as number)}/10` : 'From mobile app'}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {!isDebugMode && (
          <div className="p-3 bg-green-50 rounded-md">
            <p className="text-xs text-green-800">
              <strong>Note:</strong> Patient Reported Outcomes are automatically imported from the GHOSTLY+ mobile application. These include validated questionnaire responses and app usage metrics collected during therapy sessions. Enable Debug Mode to manually adjust these values for testing purposes.
            </p>
          </div>
        )}
      </TooltipProvider>
    </CollapsibleSettingsCard>
  );
};

export default PatientOutcomesSettings; 