import React, { ChangeEvent } from 'react';
import type { EmgSignalData } from '../../types/emg'; // Adjust path as needed

interface DownsamplingControlProps {
  dataPoints: number;
  handleDataPointsChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  plotChannel1Data: EmgSignalData | null;
  plotChannel2Data: EmgSignalData | null;
}

const DownsamplingControl: React.FC<DownsamplingControlProps> = ({
  dataPoints,
  handleDataPointsChange,
  plotChannel1Data,
  plotChannel2Data,
}) => {
  if (!plotChannel1Data && !plotChannel2Data) {
    return null; // Don't show if there's no data to downsample
  }

  return (
    <div className="mt-4 flex items-center justify-center">
      <label className="flex items-center gap-2 text-sm">
        Chart Points (Downsampling): 
        <select 
          value={dataPoints} 
          onChange={handleDataPointsChange}
          className="ml-2 p-1 rounded border"
        >
          <option value={500}>500</option>
          <option value={1000}>1000</option>
          <option value={2000}>2000</option>
          <option value={5000}>5000</option>
          {(plotChannel1Data?.original_length || plotChannel2Data?.original_length) && 
              <option value={Math.max(plotChannel1Data?.original_length || 0, plotChannel2Data?.original_length || 0)}>
                  All (approx. {Math.max(plotChannel1Data?.original_length || 0, plotChannel2Data?.original_length || 0)})
              </option>}
        </select>
      </label>
    </div>
  );
};

export default DownsamplingControl; 