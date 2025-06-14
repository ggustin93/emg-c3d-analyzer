import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { EmgSignalData, StatsData, EMGAnalysisResult } from '../types/emg';
import { DownsamplingControls } from './useDataDownsampling';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// The async function that fetches the data
const fetchChannelRawData = async (
  fileId: string, 
  channelName: string, 
  downsampleFn: (data: number[], time: number[], points: number) => { data: number[], timeAxis: number[] },
  dataPoints: number
): Promise<EmgSignalData> => {
  const { data: fetchedData } = await axios.get<EmgSignalData>(`${API_BASE_URL}/raw-data/${fileId}/${channelName}`);
  
  if (!fetchedData.data || !Array.isArray(fetchedData.data)) {
    throw new Error(`Invalid raw data format for ${channelName}`);
  }
  if (fetchedData.data.length === 0) {
    console.warn(`Raw data for channel ${channelName} is empty.`);
    return { ...fetchedData, data: [], time_axis: [] };
  }
  
  const { data: optimizedData, timeAxis: optimizedTimeAxis } = downsampleFn(fetchedData.data, fetchedData.time_axis, dataPoints);
  return { ...fetchedData, channel_name: channelName, data: optimizedData, time_axis: optimizedTimeAxis };
};

// Simplified stats calculation
const calculateStats = (values: number[] | undefined, timeAxis: number[] | undefined): StatsData | null => {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      duration: timeAxis?.[timeAxis.length - 1]?.toFixed(2) || '0',
      samples: values.length,
    };
  };

export const useEmgDataFetching = (
  analysisResult: EMGAnalysisResult | null,
  plotChannel1Name: string | null,
  plotChannel2Name: string | null,
  selectedChannelForStats: string | null,
  downsamplingControls: DownsamplingControls
) => {
  const { dataPoints, downsampleData } = downsamplingControls;

  const fileId = analysisResult?.file_id;

  // --- useQuery for Plot Channel 1 ---
  const { 
    data: plotChannel1Data, 
    isLoading: isLoading1,
    error: error1 
  } = useQuery({
    queryKey: ['emgData', fileId, plotChannel1Name, dataPoints],
    queryFn: () => fetchChannelRawData(fileId!, plotChannel1Name!, downsampleData, dataPoints),
    enabled: !!fileId && !!plotChannel1Name, // Only run query if fileId and channelName are available
  });

  // --- useQuery for Plot Channel 2 ---
  const { 
    data: plotChannel2Data,
    isLoading: isLoading2,
    error: error2
  } = useQuery({
    queryKey: ['emgData', fileId, plotChannel2Name, dataPoints],
    queryFn: () => fetchChannelRawData(fileId!, plotChannel2Name!, downsampleData, dataPoints),
    enabled: !!fileId && !!plotChannel2Name,
  });

  // --- useQuery for Stats Channel (no downsampling) ---
  const statsChannelName = selectedChannelForStats ? `${selectedChannelForStats} Raw` : null;
  const { 
    data: statsDataFull, 
    // We don't need loading/error for stats as it's a background-like task
  } = useQuery({
    queryKey: ['emgData', fileId, statsChannelName, 'full'], // 'full' indicates no downsampling
    queryFn: async () => {
        const { data } = await axios.get<EmgSignalData>(`${API_BASE_URL}/raw-data/${fileId!}/${statsChannelName!}`);
        return data;
    },
    enabled: !!fileId && !!statsChannelName,
  });

  const currentStats = calculateStats(statsDataFull?.data, statsDataFull?.time_axis);

  const dataFetchingLoading = isLoading1 || isLoading2;

  // Combine errors from both queries
  const getErrorMessage = (error: any): string | null => {
    if (!error) return null;
    if (axios.isAxiosError(error)) {
        return error.response?.data?.detail || error.message;
    }
    return error.message;
  }
  const dataFetchingError = [getErrorMessage(error1), getErrorMessage(error2)].filter(Boolean).join('; ');
  
  // The fetcher function can now be simplified or removed if only used by this hook.
  // For now, we'll keep a compatible version for external use if needed (e.g., in GameSessionTabs).
  const externalFetchChannelRawData = useCallback(async (fileId: string, channelName: string): Promise<EmgSignalData | null> => {
    try {
      // This fetch won't be cached by default unless we manually interact with the query client.
      // For simplicity, we just fetch it directly.
      return fetchChannelRawData(fileId, channelName, downsampleData, dataPoints);
    } catch (err) {
      console.error(`External fetch failed for ${channelName}:`, err);
      return null;
    }
  }, [downsampleData, dataPoints]);

  const resetPlotDataAndStats = useCallback(() => {
    // With React Query, cache invalidation is the way to "reset".
    // For now, a simple reset is not directly needed as queries refetch automatically on param change.
    // If a manual reset button is desired, we would use queryClient.invalidateQueries(...).
  }, []);

  return {
    plotChannel1Data: plotChannel1Data ?? null,
    plotChannel2Data: plotChannel2Data ?? null,
    currentStats,
    dataFetchingLoading,
    dataFetchingError: dataFetchingError || null,
    fetchChannelRawData: externalFetchChannelRawData,
    resetPlotDataAndStats,
  };
};
