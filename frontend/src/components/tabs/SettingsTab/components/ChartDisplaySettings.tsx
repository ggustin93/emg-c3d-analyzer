import React from 'react';
import { Label } from "@/components/ui/label";
import DownsamplingControl from '@/components/shared/DownsamplingControl';
import { EMGChannelSignalData } from '@/types/emg';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";

interface ChartDisplaySettingsProps {
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
}

const ChartDisplaySettings: React.FC<ChartDisplaySettingsProps> = ({
  dataPoints,
  setDataPoints,
  plotChannel1Data,
  plotChannel2Data,
}) => {
  return (
    <TooltipProvider>
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Chart Display</h4>
      <div className="space-y-3">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="downsampling-points">Data Points for Plot</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-3.5 w-3.5 text-slate-500 cursor-help hover:text-slate-700" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Higher values improve visual fidelity but can slow charts; lower values are faster but may hide brief events and slightly diverge
                  from backend-calculated statistics. Choose a balanced range (e.g., 2k–8k) based on device performance and clinical needs.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <DownsamplingControl
            dataPoints={dataPoints}
            setDataPoints={setDataPoints}
            plotChannel1Data={plotChannel1Data}
            plotChannel2Data={plotChannel2Data}
          />
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default ChartDisplaySettings; 