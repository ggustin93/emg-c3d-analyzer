import React from 'react';
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface DebugModeSwitchProps {
  isDebugMode: boolean;
  setIsDebugMode: (value: boolean) => void;
  disabled: boolean;
}

const DebugModeSwitch: React.FC<DebugModeSwitchProps> = ({ isDebugMode, setIsDebugMode, disabled }) => {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Label htmlFor="debug-mode" className="text-sm font-medium">Debug Mode</Label>
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
                Enable debug mode to access clinical parameters that are normally computed automatically. This mode is intended for advanced users only.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Switch
          id="debug-mode"
          checked={isDebugMode}
          onCheckedChange={setIsDebugMode}
          disabled={disabled}
        />
      </div>
    </TooltipProvider>
  );
};

export default DebugModeSwitch; 