import React from 'react';
import { Label } from "@/components/ui/label";
import DownsamplingControl from '@/components/shared/DownsamplingControl';
import { EMGChannelSignalData } from '@/types/emg';

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
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Chart Display</h4>
      <div className="space-y-3">
        <div className="flex flex-col space-y-2">
          <Label htmlFor="downsampling-points">Data Points for Plot</Label>
          <DownsamplingControl
            dataPoints={dataPoints}
            setDataPoints={setDataPoints}
            plotChannel1Data={plotChannel1Data}
            plotChannel2Data={plotChannel2Data}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartDisplaySettings; 