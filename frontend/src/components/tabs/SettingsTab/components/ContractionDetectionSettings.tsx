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
            <div className="rounded-md border bg-white">
              <div className="p-3">
                <ParamRow
                  name="Detection Threshold"
                  value={`${(params.threshold_factor * 100).toFixed(0)}%`}
                  tooltip="Percentage of maximum smoothed signal amplitude to trigger contraction detection. Applied to RAW EMG signals for scientific accuracy."
                />
                <ParamRow
                  name="Minimum Duration"
                  value={`${params.min_duration_ms}ms`}
                  tooltip="Minimum duration for a detected event to be considered a valid contraction."
                />
                <ParamRow
                  name="Merge Threshold"
                  value={`${params.merge_threshold_ms}ms`}
                  tooltip="Maximum time gap between detected contractions to merge them into a single physiological event."
                />
                <ParamRow
                  name="Smoothing Window"
                  value={`${params.smoothing_window_ms}ms`}
                  tooltip="Moving average window size applied to the rectified signal before threshold detection."
                />
                <ParamRow
                  name="Refractory Period"
                  value={`${params.refractory_period_ms}ms`}
                  tooltip="Minimum time after a contraction ends before a new contraction can be detected."
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
          
          
        </div>
      </UnifiedSettingsCard>
    </TooltipProvider>
  );
};

export default ContractionDetectionSettings;