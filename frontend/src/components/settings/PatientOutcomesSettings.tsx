import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { PersonIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

interface PatientOutcomesSettingsProps {
  disabled: boolean;
  isDebugMode: boolean;
}

const PatientOutcomesSettings: React.FC<PatientOutcomesSettingsProps> = ({ disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isPatientOutcomesOpen, setIsPatientOutcomesOpen] = useState(true); // Always expanded in debug mode

  return (
    <UnifiedSettingsCard
      title="Patient Reported Outcomes (ePRO)"
      description="Patient-reported effort assessment, clinical questionnaires, and mobile app integration"
      isOpen={isPatientOutcomesOpen}
      onOpenChange={setIsPatientOutcomesOpen}
      icon={<PersonIcon className="h-5 w-5 text-indigo-600" />}
      accentColor="indigo-600"
      badge={isDebugMode ? <Badge variant="outline" className="bg-indigo-100 text-indigo-800">Debug Mode</Badge> : undefined}
    >
      <TooltipProvider>
        {/* Subjective Effort Assessment */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-base font-semibold text-gray-800">Subjective Effort Assessment</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="w-[350px] text-sm space-y-2">
                  <p><strong>Borg CR10 Scale (0-10)</strong> for Rating of Perceived Exertion</p>
                  <p>Only <strong>post-session RPE</strong> is used for the Subjective Effort Score (20% weight in overall performance).</p>
                  <div className="text-xs space-y-1 mt-2 p-2 bg-gray-50 rounded">
                    <div><strong>Scoring:</strong></div>
                    <div>• RPE 4-6: 100% (optimal therapeutic stimulus)</div>
                    <div>• RPE 3,7: 80% (acceptable range)</div>
                    <div>• RPE 2,8: 60% (suboptimal stimulus)</div>
                    <div>• RPE 0,1,9,10: 20% (poor - too easy/hard)</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            {/* Post-Session RPE - Primary scoring input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-800">Post-Session RPE</Label>
                <Badge variant="outline" className="bg-indigo-100 text-indigo-800 text-xs">Scoring Input</Badge>
              </div>
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
                className="h-9 text-sm border-indigo-300 focus:border-indigo-500"
              />
              <p className="text-xs text-indigo-700">
                ✓ Primary input for Subjective Effort Score (20% weight). Target: RPE 4-6 for optimal therapeutic stimulus.
              </p>
            </div>
          </div>
        </div>
        
        {/* Mobile App Integration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h4 className="text-base font-semibold text-gray-800">Mobile App Integration</h4>
          </div>
          
          <Alert className="border-indigo-200 bg-indigo-50">
            <InfoCircledIcon className="h-4 w-4 text-indigo-600" />
            <AlertDescription className="text-sm text-indigo-800">
              <strong>Production Mode:</strong> Patient Reported Outcomes are automatically imported from the GHOSTLY+ mobile application, including validated questionnaire responses and app usage metrics. Debug mode allows manual adjustment for testing purposes.
            </AlertDescription>
          </Alert>
        </div>
      </TooltipProvider>
    </UnifiedSettingsCard>
  );
};

export default PatientOutcomesSettings; 