import React from 'react';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { GameSessionParameters } from '../types/emg';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface SessionConfigPanelProps {
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  disabled: boolean;
}

const SessionConfigPanel: React.FC<SessionConfigPanelProps> = ({ 
  sessionParams, 
  onParamsChange, 
  disabled 
}) => {
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center">
          <Label htmlFor="session_mvc_value" className="text-sm font-medium flex-grow">Patient MVC (mV)</Label>
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
                  Maximum Voluntary Contraction value in millivolts (mV). 
                  Typical values range from 0.2 to 2.0 mV depending on muscle size.
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
            placeholder="e.g., 0.8"
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
          <Label htmlFor="session_expected_contractions" className="text-sm font-medium flex-grow">Expected Contractions</Label>
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
    </div>
  );
};

export default SessionConfigPanel; 