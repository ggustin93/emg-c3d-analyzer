import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon, GearIcon } from '@radix-ui/react-icons';
import { ContractionDetectionParameters } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_DETECTION_PARAMS } from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';

interface ParameterSliderProps {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  tooltip: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}


const ParameterSlider: React.FC<ParameterSliderProps> = ({
  name,
  value,
  min,
  max,
  step,
  format,
  tooltip,
  onChange,
  disabled = false
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <Label className="flex items-center gap-2">
        {name}
        <Tooltip>
          <TooltipTrigger>
            <InfoCircledIcon className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </Label>
      <span className="text-sm font-medium min-w-16 text-right">
        {format(value)}
      </span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
      className="w-full"
      disabled={disabled}
    />
  </div>
);

const ContractionDetectionSettings: React.FC = () => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const params = sessionParams.contraction_detection || DEFAULT_DETECTION_PARAMS;
  
  // Parameters are read-only for display purposes
  const updateParam = (key: keyof ContractionDetectionParameters, value: number) => {
    // No-op: parameters are not modifiable
  };


  return (
    <TooltipProvider>
      <UnifiedSettingsCard
        title="Contraction Detection Parameters"
        description="Configure signal processing algorithms for contraction detection"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        icon={<GearIcon className="h-5 w-5 text-slate-600" />}
        accentColor="slate-600"
      >
        <div className="space-y-6">
          {/* Informational Header */}
          <Alert className="border-slate-200 bg-slate-50">
            <InfoCircledIcon className="h-4 w-4 text-slate-600" />
            <AlertDescription className="text-sm text-slate-800">
              <strong>Information Only:</strong> These signal processing parameters are applied to <strong>RAW EMG signals</strong> (preferred) for scientific rigor and algorithm optimization. Parameters are optimized by the backend and cannot be modified. They are displayed here for transparency and technical reference.
            </AlertDescription>
          </Alert>
            
          {/* All Detection Parameters - Always Visible */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-700">Signal Detection Parameters</h4>
            
            <ParameterSlider
              name="Detection Threshold"
              value={params.threshold_factor}
              min={0.1}
              max={0.5}
              step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              tooltip="Percentage of maximum smoothed signal amplitude to trigger contraction detection. Applied to RAW EMG signals for scientific accuracy. Optimized value: 15% (reduced from 30%) based on 2024 biomedical research for improved sensitivity. Algorithm: rectifies signal, applies moving average smoothing, then detects activity above this threshold."
              onChange={(v) => updateParam('threshold_factor', v)}
              disabled={true}
            />
            
            <ParameterSlider
              name="Minimum Duration"
              value={params.min_duration_ms}
              min={10}
              max={200}
              step={10}
              format={(v) => `${v}ms`}
              tooltip="Minimum duration for a detected event to be considered a valid contraction. Optimized value: 100ms (increased from 50ms) for clinical relevance and noise reduction. Filters out brief spikes and artifacts while preserving meaningful contractions."
              onChange={(v) => updateParam('min_duration_ms', v)}
              disabled={true}
            />
            
            <ParameterSlider
              name="Merge Threshold"
              value={params.merge_threshold_ms}
              min={100}
              max={1000}
              step={100}
              format={(v) => `${v}ms`}
              tooltip="Maximum time gap between detected contractions to merge them into a single physiological event. Optimized value: 200ms (reduced from 500ms) based on motor unit firing rates for better temporal resolution while maintaining physiological accuracy."
              onChange={(v) => updateParam('merge_threshold_ms', v)}
              disabled={true}
            />
            
            <ParameterSlider
              name="Smoothing Window"
              value={params.smoothing_window_ms}
              min={10}
              max={200}
              step={5}
              format={(v) => `${v}ms`}
              tooltip="Moving average window size applied to the rectified signal before threshold detection. Optimized value: 100ms (increased from 25ms) for improved stability. Research indicates 100-160ms windows provide optimal balance between noise reduction and temporal resolution."
              onChange={(v) => updateParam('smoothing_window_ms', v)}
              disabled={true}
            />
            
            <ParameterSlider
              name="Refractory Period"
              value={params.refractory_period_ms}
              min={0}
              max={500}
              step={50}
              format={(v) => `${v}ms`}
              tooltip="Minimum time after a contraction ends before a new contraction can be detected. Optimized value: 50ms (increased from 0ms) to prevent detection of closely spaced artifacts while maintaining sensitivity for rapid contractions."
              onChange={(v) => updateParam('refractory_period_ms', v)}
              disabled={true}
            />
          </div>
          
          
        </div>
      </UnifiedSettingsCard>
    </TooltipProvider>
  );
};

export default ContractionDetectionSettings;