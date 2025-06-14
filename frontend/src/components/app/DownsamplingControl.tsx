import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EmgSignalData } from '@/types/emg'; // Adjust path as needed

interface DownsamplingControlProps {
  dataPoints: number;
  setDataPoints: (points: number) => void;
  plotChannel1Data: EmgSignalData | null;
  plotChannel2Data: EmgSignalData | null;
}

const DownsamplingControl: React.FC<DownsamplingControlProps> = ({
  dataPoints,
  setDataPoints,
  plotChannel1Data,
  plotChannel2Data,
}) => {
  const step = 500;

  if (!plotChannel1Data && !plotChannel2Data) {
    return null; // Don't show if there's no data to downsample
  }

  const handleIncrement = () => {
    setDataPoints(dataPoints + step);
  };

  const handleDecrement = () => {
    setDataPoints(Math.max(step, dataPoints - step)); // Prevent going below a reasonable limit
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setDataPoints(value);
    } else if (e.target.value === '') {
      setDataPoints(step); // Or some other default/minimum
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handleDecrement} className="h-8 w-8">
        -
      </Button>
      <Input
        type="number"
        value={dataPoints}
        onChange={handleChange}
        className="w-24 text-center"
        step={step}
        min={step}
      />
      <Button variant="outline" size="icon" onClick={handleIncrement} className="h-8 w-8">
        +
      </Button>
    </div>
  );
};

export default DownsamplingControl; 