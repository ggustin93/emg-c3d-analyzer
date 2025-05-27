import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { EmgSignalData, StatsData, EMGAnalysisResult } from '../types/emg';
import { DownsamplingControls } from './useDataDownsampling'; // Assuming useDataDownsampling exports this

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export interface EmgDataFetchingControls {
  plotChannel1Data: EmgSignalData | null;
  plotChannel2Data: EmgSignalData | null;
  currentStats: StatsData | null;
  dataFetchingLoading: boolean;
  dataFetchingError: string | null;
  fetchChannelRawData: (fileId: string, channelName: string) => Promise<EmgSignalData | null>;
  resetPlotDataAndStats: () => void;
}

const calculateStats = (values: number[], timeAxis: number[]): StatsData | null => {
  if (!values || values.length === 0) return null;
  let minVal = values[0];
  let maxVal = values[0];
  let sum = 0;
  for (const val of values) {
    minVal = Math.min(minVal, val);
    maxVal = Math.max(maxVal, val);
    sum += val;
  }
  return {
    min: minVal.toFixed(6),
    max: maxVal.toFixed(6),
    avg: (sum / values.length).toFixed(6),
    duration: timeAxis[timeAxis.length - 1]?.toFixed(2) || '0',
    samples: values.length,
  };
};

export const useEmgDataFetching = (
  analysisResult: EMGAnalysisResult | null,
  plotChannel1Name: string | null,
  plotChannel2Name: string | null,
  downsamplingControls: DownsamplingControls
): EmgDataFetchingControls => {
  const [plotChannel1Data, setPlotChannel1Data] = useState<EmgSignalData | null>(null);
  const [plotChannel2Data, setPlotChannel2Data] = useState<EmgSignalData | null>(null);
  const [currentStats, setCurrentStats] = useState<StatsData | null>(null);
  const [dataFetchingLoading, setDataFetchingLoading] = useState<boolean>(false);
  const [dataFetchingError, setDataFetchingError] = useState<string | null>(null);

  const { dataPoints, downsampleData } = downsamplingControls;

  const fetchChannelRawData = useCallback(async (fileId: string, channelName: string): Promise<EmgSignalData | null> => {
    if (!fileId || !channelName) return null;
    try {
      const response = await axios.get<EmgSignalData>(`${API_BASE_URL}/raw-data/${fileId}/${channelName}`);
      const fetchedData = response.data;
      if (!fetchedData.data || !Array.isArray(fetchedData.data)) {
        console.error(`Invalid raw data format for ${channelName}`);
        return null;
      }
      if (fetchedData.data.length === 0) {
        console.warn(`Raw data for channel ${channelName} is empty.`);
        return { ...fetchedData, data: [], time_axis: [] };
      }
      const { data: optimizedData, timeAxis: optimizedTimeAxis } = downsampleData(fetchedData.data, fetchedData.time_axis, dataPoints);
      return { ...fetchedData, channel_name: channelName, data: optimizedData, time_axis: optimizedTimeAxis };
    } catch (err: any) {
      console.error(`Error fetching raw EMG data for ${channelName}:`, err);
      return null;
    }
  }, [dataPoints, downsampleData]);

  // Effect to fetch data for plotChannel1
  useEffect(() => {
    if (analysisResult?.file_id && plotChannel1Name) {
      setDataFetchingLoading(true);
      setDataFetchingError(null);
      fetchChannelRawData(analysisResult.file_id, plotChannel1Name).then(data => {
        setPlotChannel1Data(data);
        if (!plotChannel2Name) setDataFetchingLoading(false); // Only stop loading if ch2 is not being fetched
        if (!data) setDataFetchingError(prevError => prevError ? `${prevError}, Failed to load ${plotChannel1Name}` : `Failed to load data for ${plotChannel1Name}`);
      });
    } else {
      setPlotChannel1Data(null);
      if (!plotChannel2Name) setDataFetchingLoading(false); // Stop loading if ch1 cleared and ch2 inactive
    }
  }, [analysisResult?.file_id, plotChannel1Name, fetchChannelRawData, plotChannel2Name]);

  // Effect to fetch data for plotChannel2
  useEffect(() => {
    if (analysisResult?.file_id && plotChannel2Name) {
      // If ch1 is also active, loading is already true. If not, set it.
      if (!plotChannel1Name || !plotChannel1Data) setDataFetchingLoading(true);
      setDataFetchingError(null); // Clear previous error before new fetch
      fetchChannelRawData(analysisResult.file_id, plotChannel2Name).then(data => {
        setPlotChannel2Data(data);
        setDataFetchingLoading(false); // Always stop loading after the second channel fetch completes
        if (!data) setDataFetchingError(prevError => prevError ? `${prevError}, Failed to load ${plotChannel2Name}` : `Failed to load data for ${plotChannel2Name}`);
      });
    } else {
      setPlotChannel2Data(null);
      // Only stop loading if ch1 is also inactive
      if (!plotChannel1Name) setDataFetchingLoading(false);
    }
  }, [analysisResult?.file_id, plotChannel2Name, fetchChannelRawData, plotChannel1Name, plotChannel1Data]);
  
  // Consolidate error messages
  useEffect(() => {
      let ch1Error = plotChannel1Name && !plotChannel1Data ? `Failed to load ${plotChannel1Name}` : null;
      let ch2Error = plotChannel2Name && !plotChannel2Data ? `Failed to load ${plotChannel2Name}` : null;

      // This effect runs after data fetching effects. Check if data is still null after trying to fetch.
      // This is a simplified error check. More robust would involve checking loading states too.
      if (analysisResult?.file_id) { // Only set errors if we expected to fetch
        if (plotChannel1Name && !plotChannel1Data && !dataFetchingLoading) {
            ch1Error = `Failed to load data for ${plotChannel1Name}`;
        }
        if (plotChannel2Name && !plotChannel2Data && !dataFetchingLoading) {
            ch2Error = `Failed to load data for ${plotChannel2Name}`;
        }
      }

      if (ch1Error && ch2Error) {
        setDataFetchingError(`${ch1Error}, ${ch2Error}`);
      } else if (ch1Error) {
        setDataFetchingError(ch1Error);
      } else if (ch2Error) {
        setDataFetchingError(ch2Error);
      } else if (!dataFetchingLoading) { // Clear error if no specific errors and not loading
        setDataFetchingError(null);
      }
  }, [plotChannel1Data, plotChannel2Data, plotChannel1Name, plotChannel2Name, analysisResult?.file_id, dataFetchingLoading]);

  // Effect to update currentStats from plotChannel1Data
  useEffect(() => {
    if (plotChannel1Data && plotChannel1Data.data && plotChannel1Data.data.length > 0) {
      setCurrentStats(calculateStats(plotChannel1Data.data, plotChannel1Data.time_axis));
    } else {
      setCurrentStats(null);
    }
  }, [plotChannel1Data]);

  const resetPlotDataAndStats = useCallback(() => {
    setPlotChannel1Data(null);
    setPlotChannel2Data(null);
    setCurrentStats(null);
    setDataFetchingLoading(false);
    setDataFetchingError(null);
  }, []);

  return {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataFetchingLoading,
    dataFetchingError,
    fetchChannelRawData, // Exposing this if it needs to be called directly elsewhere, e.g. for GameSessionTabs
    resetPlotDataAndStats,
  };
}; 