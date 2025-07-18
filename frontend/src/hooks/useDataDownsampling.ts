import { useState, useCallback } from "react";

export interface DownsamplingControls {
  dataPoints: number;
  setDataPoints: (points: number) => void;
  handleDataPointsChange: (value: number) => void;
  downsampleData: (data: number[], timeAxis: number[], maxPoints: number) => { data: number[], timeAxis: number[] };
}

export const useDataDownsampling = (initialDataPoints: number = 2000): DownsamplingControls => {
  const [dataPoints, setDataPoints] = useState<number>(initialDataPoints);

  const handleDataPointsChange = useCallback((value: number) => {
    // Basic validation
    if (!isNaN(value) && value > 0) {
      setDataPoints(value);
    }
  }, []);

  const downsampleData = useCallback((data: number[], timeAxis: number[], maxPoints: number): { data: number[], timeAxis: number[] } => {
    if (!data || data.length <= maxPoints) return { data, timeAxis };
    const factor = Math.ceil(data.length / maxPoints);
    const newData: number[] = [];
    const newTimeAxis: number[] = [];
    for (let i = 0; i < data.length; i += factor) {
      let sum = 0;
      let minVal = Infinity;
      let maxVal = -Infinity;
      let count = 0;
      for (let j = 0; j < factor && i + j < data.length; j++) {
        const value = data[i + j];
        sum += value;
        minVal = Math.min(minVal, value);
        maxVal = Math.max(maxVal, value);
        count++;
      }
      // Use the value (min or max) that is furthest from the average in the window
      const avg = sum / count;
      const absMin = Math.abs(minVal - avg);
      const absMax = Math.abs(maxVal - avg);
      newData.push(absMax > absMin ? maxVal : minVal);
      newTimeAxis.push(timeAxis[i]);
    }
    return { data: newData, timeAxis: newTimeAxis };
  }, []);

  return { dataPoints, setDataPoints, handleDataPointsChange, downsampleData };
}; 