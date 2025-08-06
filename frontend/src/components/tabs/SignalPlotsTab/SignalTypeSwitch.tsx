import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GameSessionParameters } from '@/types/emg';

interface SignalTypeSwitchProps {
  plotMode: 'raw' | 'activated';
  setPlotMode: (mode: 'raw' | 'activated') => void;
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  disabled?: boolean;
  compact?: boolean; 
}

const SignalTypeSwitch: React.FC<SignalTypeSwitchProps> = ({
  plotMode,
  setPlotMode,
  sessionParams,
  onParamsChange,
  disabled = false,
  compact = false
}) => {
  return (
    <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
      <Label htmlFor="chart-plot-mode-switch" className={compact ? 'text-sm' : ''}>Raw</Label>
      <Switch
        id="chart-plot-mode-switch"
        checked={plotMode === 'activated'}
        onCheckedChange={(checked: boolean) => {
          const newMode = checked ? 'activated' : 'raw';
          setPlotMode(newMode);
          onParamsChange({
            ...sessionParams,
            show_raw_signals: newMode === 'raw'
          });
        }}
        disabled={disabled}
      />
      <Label htmlFor="chart-plot-mode-switch" className={compact ? 'text-sm' : ''}>Activated</Label>
    </div>
  );
};

export default SignalTypeSwitch; 