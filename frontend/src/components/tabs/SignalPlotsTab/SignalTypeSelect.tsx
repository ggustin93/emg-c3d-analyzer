import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { GameSessionParameters } from '@/types/emg';
import type { SignalDisplayType } from './ThreeChannelSignalSelector';

interface SignalTypeSelectProps {
  selectedSignal: SignalDisplayType;
  onSignalChange: (signal: SignalDisplayType) => void;
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  disabled?: boolean;
  compact?: boolean;
}

const LABELS: Record<SignalDisplayType, string> = {
  raw: 'Raw (C3D)',
  activated: 'Activated (C3D)',
  processed: 'RMS (Backend)',
  raw_with_rms: 'Raw + RMS (Backend)' // Keep for type compatibility, but not in OPTIONS
};

const DESCRIPTIONS: Record<SignalDisplayType, string> = {
  raw: 'Original bipolar EMG from C3D',
  activated: 'C3D embedded activated signal',
  processed: 'Backend-computed RMS envelope',
  raw_with_rms: 'Overlay of Raw (C3D) and RMS (Backend)' // Keep for type compatibility
};

const OPTIONS: SignalDisplayType[] = ['raw', 'activated', 'processed']; // Removed 'raw_with_rms'

const SignalTypeSelect: React.FC<SignalTypeSelectProps> = ({
  selectedSignal,
  onSignalChange,
  sessionParams,
  onParamsChange,
  disabled = false,
  compact = true,
}) => {
  const handleChange = (value: string) => {
    const next = value as SignalDisplayType;
    onSignalChange(next);
    // Back-compat with legacy flag
    onParamsChange({
      ...sessionParams,
      show_raw_signals: next === 'raw'
    });
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : ''}`}>
      <Label className={`text-xs text-gray-700 ${compact ? '' : 'mr-1'}`}>Signal:</Label>
      <Select disabled={disabled} value={selectedSignal} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[190px]">
          <SelectValue placeholder="Signal type" />
        </SelectTrigger>
        <SelectContent align="end">
          {OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} title={DESCRIPTIONS[opt]}>
              {LABELS[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SignalTypeSelect;

