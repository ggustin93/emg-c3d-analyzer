import React from 'react';
import { Label } from '@/components/ui/label';
import { GameSessionParameters } from '@/types/emg';

export type SignalDisplayType = 'raw' | 'activated' | 'processed' | 'raw_with_rms';

interface ThreeChannelSignalSelectorProps {
  selectedSignal: SignalDisplayType;
  onSignalChange: (signal: SignalDisplayType) => void;
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ThreeChannelSignalSelector: React.FC<ThreeChannelSignalSelectorProps> = ({
  selectedSignal,
  onSignalChange,
  sessionParams,
  onParamsChange,
  disabled = false,
  compact = false
}) => {
  const handleSignalChange = (signal: SignalDisplayType) => {
    onSignalChange(signal);
    
    // Update session params for backward compatibility
    onParamsChange({
      ...sessionParams,
      show_raw_signals: signal === 'raw'
    });
  };

  const getSignalLabel = (signal: SignalDisplayType): string => {
    switch (signal) {
      case 'raw':
        return 'Raw';
      case 'activated':
        return 'Activated (C3D)';
      case 'processed':
        return 'RMS (Backend)';
      case 'raw_with_rms':
        return 'Raw + RMS (Backend)';
      default:
        return 'Raw';
    }
  };

  const getSignalDescription = (signal: SignalDisplayType): string => {
    switch (signal) {
      case 'raw':
        return 'Original bipolar EMG signal from C3D file';
      case 'activated':
        return 'Activated signal provided within the C3D (device/app pre-processing)';
      case 'processed':
        return 'Backend-computed RMS envelope (filtered, rectified, ~50ms window)';
      case 'raw_with_rms':
        return 'Overlay of Raw (C3D) and RMS (Backend) for clinical comparison';
      default:
        return '';
    }
  };

  const signalTypes: SignalDisplayType[] = ['raw', 'activated', 'processed', 'raw_with_rms'];

  return (
    <div className={`flex items-center ${compact ? 'space-x-2' : 'space-x-3'}`}>
      <Label className={`font-medium ${compact ? 'text-sm' : ''}`}>Signal Type:</Label>
      
      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 max-w-full overflow-x-auto">
        {signalTypes.map((signal) => (
          <button
            key={signal}
            onClick={() => handleSignalChange(signal)}
            disabled={disabled}
            className={`
              px-3 py-1 rounded-md text-xs font-medium transition-all duration-200
              ${selectedSignal === signal
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-transparent text-gray-600 hover:bg-gray-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${compact ? 'px-2 py-0.5' : 'px-3 py-1'}
            `}
            title={getSignalDescription(signal)}
          >
            {getSignalLabel(signal)}
          </button>
        ))}
      </div>
      
      {/* Info indicator for current signal */}
      <div className={`text-xs text-gray-500 ${compact ? 'hidden' : 'max-w-xs'}`}>
        {getSignalDescription(selectedSignal)}
      </div>
      
      {/* Analysis indicator - show which signal is used for analysis */}
      <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-green-500 rounded-full" title="Analysis uses this signal type"></div>
        <span className="text-xs text-gray-600">
          {selectedSignal === 'processed' ? 'Analyzed' : 'Display only'}
        </span>
      </div>
    </div>
  );
};

export default ThreeChannelSignalSelector;