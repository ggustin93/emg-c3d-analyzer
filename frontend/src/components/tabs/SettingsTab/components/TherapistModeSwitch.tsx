import React from 'react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TherapistModeSwitchProps {
  isTherapistMode: boolean;
  setIsTherapistMode: (value: boolean) => void;
  disabled: boolean;
}

const TherapistModeSwitch: React.FC<TherapistModeSwitchProps> = ({ 
  isTherapistMode, 
  setIsTherapistMode, 
  disabled 
}) => {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-center gap-2">
          <Label htmlFor="therapist-mode" className="text-sm font-medium text-amber-900">
            Admin (Demo/C3D)
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-amber-600 hover:text-amber-800 cursor-help">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="text-xs space-y-2">
                <p className="font-medium">Admin Demo Mode</p>
                <p>
                  Enable advanced parameters for C3D file demonstrations and admin testing. 
                  Unlocks all clinical settings, BFR parameters, and therapeutic configurations.
                </p>
                <p className="text-amber-600 font-medium">
                  Intended for demonstrations and administrative access only.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <Switch
          id="therapist-mode"
          checked={isTherapistMode}
          onCheckedChange={setIsTherapistMode}
          disabled={disabled}
        />
      </div>
    </TooltipProvider>
  );
};

export default TherapistModeSwitch;