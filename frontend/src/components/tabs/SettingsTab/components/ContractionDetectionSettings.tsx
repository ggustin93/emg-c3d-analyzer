import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon, GearIcon } from '@radix-ui/react-icons';
import { ContractionDetectionParameters } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_DETECTION_PARAMS } from '@/hooks/useEnhancedPerformanceMetrics';
import UnifiedSettingsCard from './UnifiedSettingsCard';

interface ParamRowProps {
  name: string;
  value: string | number;
  tooltip: string;
}

const ParamRow: React.FC<ParamRowProps> = ({ name, value, tooltip }) => (
  <div className="flex justify-between items-center py-2 border-b last:border-b-0">
    <Label className="flex items-center gap-2 text-sm">
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
    <span className="text-sm font-medium text-slate-800">
      {value}
    </span>
  </div>
);

const ContractionDetectionSettings: React.FC = () => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const params = sessionParams.contraction_detection || DEFAULT_DETECTION_PARAMS;
  
  // Read-only: parameters cannot be modified


  return (
    <TooltipProvider>
      <UnifiedSettingsCard
        title="Signal Processing & Contraction Detection"
        description="Backend-optimized parameters. Read-only for transparency."
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
            
          {/* Read-only parameter list */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-700">Contraction Detection Parameters</h4>
            <div className="text-xs text-blue-600 mb-2 font-medium">
              ↳ Applied to RMS envelope (derived from processed EMG signals below)
            </div>
            <div className="rounded-md border bg-white">
              <div className="p-3">
                <ParamRow
                  name="Detection Threshold"
                  value="10%"
                  tooltip="Research-based 2024-2025: 10% of maximum RMS envelope amplitude triggers contraction detection. Applied after full signal processing pipeline (high-pass → rectify → low-pass → RMS envelope). Range: 5-8% (high sensitivity), 10-12% (balanced), 15-20% (high selectivity)."
                />
                <ParamRow
                  name="Minimum Duration"
                  value="100ms"
                  tooltip="Minimum duration for a detected event to be considered a valid contraction. Optimized for physiologically relevant muscle activation patterns."
                />
                <ParamRow
                  name="Merge Threshold"
                  value="200ms"
                  tooltip="Maximum time gap between contractions to merge them. Research-based: 200ms based on motor unit firing rates and muscle response times for better temporal resolution."
                />
                <ParamRow
                  name="Smoothing Window"
                  value="100ms"
                  tooltip="Smoothing window size in samples. Applied to the rectified signal before threshold detection for noise reduction while preserving physiological features."
                />
                <ParamRow
                  name="Refractory Period"
                  value="50ms"
                  tooltip="Minimum time after contraction before detecting new one. Research indicates brief refractory periods improve specificity by preventing closely spaced artifacts."
                />
              </div>
            </div>
          </div>

          {/* RMS Envelope Processing (Backend) */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-700">RMS Envelope Processing (Backend)</h4>
            <div className="rounded-md border bg-white">
              <div className="p-3">
                <ParamRow
                  name="Rectification"
                  value={"Full-wave"}
                  tooltip="Raw EMG is rectified (absolute value) to create a unipolar amplitude signal for envelope analysis."
                />
                <ParamRow
                  name="High‑pass Filter"
                  value={`20 Hz (order 4)`}
                  tooltip="Removes DC offset and baseline/motion artifacts below ~20 Hz per clinical EMG practice."
                />
                <ParamRow
                  name="Low‑pass (Envelope)"
                  value={`10 Hz (order 4)`}
                  tooltip="Produces a smooth linear/RMS envelope suitable for amplitude tracking in rehabilitation contexts."
                />
                <ParamRow
                  name="RMS Window"
                  value={`50 ms`}
                  tooltip="50 ms is a common clinical choice for EMG linear envelope/RMS smoothing."
                />
              </div>
            </div>
          </div>

          {/* Legacy Activated Signal Processing (Reference) */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-700">Legacy Activated Signal Processing (Reference)</h4>
            <div className="rounded-md border bg-slate-50">
              <div className="p-3">
                <ParamRow
                  name="Sampling Rate"
                  value="1000 Hz"
                  tooltip="Legacy GHOSTLY system sampling rate for real-time EMG acquisition from Trigno sensors."
                />
                <ParamRow
                  name="Band-pass Filter"
                  value="5-25 Hz (order 6)"
                  tooltip="Legacy activation detection filter. Narrower bandwidth compared to current 20 Hz high-pass for different activation detection approach."
                />
                <ParamRow
                  name="Moving Window"
                  value="100 ms (calculated)"
                  tooltip="Legacy moving average window: Math.Floor(samplingRate/10) = 100ms for 1000Hz. Used for real-time muscle activation detection."
                />
                <ParamRow
                  name="Baseline Training"
                  value="2 seconds"
                  tooltip="Legacy calibration period: 2 seconds of resting data for baseline mean and standard deviation calculation."
                />
                <ParamRow
                  name="Activation Threshold"
                  value="Mean + 3×StdDev"
                  tooltip="Legacy statistical threshold: baseline mean + 3 standard deviations for muscle activation detection. Adaptive per-user calibration."
                />
              </div>
            </div>
            <div className="text-xs text-slate-600 italic mt-2">
              <strong>Note:</strong> These parameters are from the original GHOSTLY real-time activation system (C#/Unity). 
              Current backend uses different parameters optimized for offline C3D post-processing analysis workflows.
            </div>
          </div>
          
        </div>
      </UnifiedSettingsCard>
    </TooltipProvider>
  );
};

export default ContractionDetectionSettings;