import { useState, useEffect, useCallback } from 'react';
import type { EMGChannelSignalData, StatsData, EMGAnalysisResult } from '../types/emg';
import { DownsamplingControls } from './useDataDownsampling';

export interface PlotDataProcessorControls {
  plotChannel1Data: EMGChannelSignalData | null;
  plotChannel2Data: EMGChannelSignalData | null;
  currentStats: StatsData | null;
  dataProcessingLoading: boolean;
  dataProcessingError: string | null;
  resetPlotDataAndStats: () => void;
}

const calculateStats = (data: EMGChannelSignalData): StatsData | null => {
  if (!data || !data.data || data.data.length === 0) return null;
  
  const values = data.data;
  let minVal = values[0];
  let maxVal = values[0];
  let sum = 0;
  for (const val of values) {
    minVal = Math.min(minVal, val);
    maxVal = Math.max(maxVal, val);
    sum += val;
  }
  return {
    min: minVal,
    max: maxVal,
    avg: sum / values.length,
    duration: data.time_axis[data.time_axis.length - 1]?.toFixed(2) || '0',
    samples: values.length,
  };
};

export const usePlotDataProcessor = (
  analysisResult: EMGAnalysisResult | null,
  plotChannel1Name: string | null,
  plotChannel2Name: string | null,
  selectedChannelForStats: string | null,
  downsamplingControls: DownsamplingControls
): PlotDataProcessorControls => {
  const [plotChannel1Data, setPlotChannel1Data] = useState<EMGChannelSignalData | null>(null);
  const [plotChannel2Data, setPlotChannel2Data] = useState<EMGChannelSignalData | null>(null);
  const [currentStats, setCurrentStats] = useState<StatsData | null>(null);
  const [dataProcessingLoading, setDataProcessingLoading] = useState<boolean>(false);
  const [dataProcessingError, setDataProcessingError] = useState<string | null>(null);

  const { dataPoints, downsampleData } = downsamplingControls;

  const processAndSetChannelData = useCallback((channelName: string | null, setter: React.Dispatch<React.SetStateAction<EMGChannelSignalData | null>>) => {
    if (analysisResult && analysisResult.emg_signals && channelName && analysisResult.emg_signals[channelName]) {
      const signalData = analysisResult.emg_signals[channelName];
      const { data: optimizedData, timeAxis: optimizedTimeAxis } = downsampleData(signalData.data, signalData.time_axis, dataPoints);
      
      setter({ 
        ...signalData,
        data: optimizedData, 
        time_axis: optimizedTimeAxis 
      });
    } else {
      setter(null);
    }
  }, [analysisResult, dataPoints, downsampleData]);
  
  // Effect to process data for plotChannel1
  useEffect(() => {
    setDataProcessingLoading(true);
    processAndSetChannelData(plotChannel1Name, setPlotChannel1Data);
    // Loading state will be turned off in the combined effect below
  }, [analysisResult, plotChannel1Name, processAndSetChannelData]);

  // Effect to process data for plotChannel2
  useEffect(() => {
    setDataProcessingLoading(true);
    processAndSetChannelData(plotChannel2Name, setPlotChannel2Data);
    // Loading state will be turned off in the combined effect below
  }, [analysisResult, plotChannel2Name, processAndSetChannelData]);

  // Effect to calculate stats for the selected channel
  useEffect(() => {
    if (analysisResult && analysisResult.emg_signals && selectedChannelForStats && analysisResult.emg_signals[selectedChannelForStats]) {
      const signalData = analysisResult.emg_signals[selectedChannelForStats];
      // Note: stats are calculated on the original, non-downsampled data which is what we have in emg_signals
      setCurrentStats(calculateStats(signalData));
    } else {
      setCurrentStats(null);
    }
  }, [analysisResult, selectedChannelForStats]);
  
  // Effect to manage loading and error states
  useEffect(() => {
    // If either channel is selected but its data is not yet processed, we are loading.
    const isLoading = (!!plotChannel1Name && !plotChannel1Data) || (!!plotChannel2Name && !plotChannel2Data);
    setDataProcessingLoading(isLoading);

    let error = null;
    if (plotChannel1Name && !plotChannel1Data && !isLoading) {
      error = `Data for channel "${plotChannel1Name}" not found in analysis result.`;
    }
    if (plotChannel2Name && !plotChannel2Data && !isLoading) {
      error = error ? `${error} Also, data for "${plotChannel2Name}" not found.` : `Data for channel "${plotChannel2Name}" not found in analysis result.`;
    }
    setDataProcessingError(error);
    
  }, [plotChannel1Data, plotChannel2Data, plotChannel1Name, plotChannel2Name]);
  
  const resetPlotDataAndStats = useCallback(() => {
    setPlotChannel1Data(null);
    setPlotChannel2Data(null);
    setCurrentStats(null);
    setDataProcessingLoading(false);
    setDataProcessingError(null);
  }, []);

  return {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataProcessingLoading,
    dataProcessingError,
    resetPlotDataAndStats,
  };
}; 