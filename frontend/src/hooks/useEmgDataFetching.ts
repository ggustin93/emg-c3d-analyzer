import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import type { EmgSignalData, StatsData, EMGAnalysisResult } from '../types/emg';
import { DownsamplingControls } from './useDataDownsampling';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Simple cache implementation
type CacheEntry = {
  data: EmgSignalData;
  timestamp: number;
};

const cache: Record<string, CacheEntry> = {};

// Define a type for the API error response
interface ApiError {
  detail: string;
}

// The async function that fetches the data
const fetchChannelRawData = async (
  fileId: string, 
  channelName: string, 
  downsampleFn: (data: number[], time: number[], points: number) => { data: number[], timeAxis: number[] },
  dataPoints: number
): Promise<EmgSignalData> => {
  // Generate cache key
  const cacheKey = `${fileId}-${channelName}-${dataPoints}`;
  
  // Check if data is in cache and not expired (5 minutes)
  const cachedData = cache[cacheKey];
  if (cachedData && (Date.now() - cachedData.timestamp) < 5 * 60 * 1000) {
    console.log(`Cache hit for ${channelName}`);
    return cachedData.data;
  }
  
  // If not in cache or expired, fetch from API
  console.log(`Cache miss for ${channelName}, fetching from API`);
  const { data: fetchedData } = await axios.get<EmgSignalData>(`${API_BASE_URL}/raw-data/${fileId}/${channelName}`);
  
  if (!fetchedData.data || !Array.isArray(fetchedData.data)) {
    throw new Error(`Invalid raw data format for ${channelName}`);
  }
  if (fetchedData.data.length === 0) {
    console.warn(`Raw data for channel ${channelName} is empty.`);
    return { ...fetchedData, data: [], time_axis: [] };
  }
  
  const { data: optimizedData, timeAxis: optimizedTimeAxis } = downsampleFn(fetchedData.data, fetchedData.time_axis, dataPoints);
  const result = { ...fetchedData, channel_name: channelName, data: optimizedData, time_axis: optimizedTimeAxis };
  
  // Store in cache
  cache[cacheKey] = {
    data: result,
    timestamp: Date.now()
  };
  
  return result;
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
  
  // State for data
  const [plotChannel1Data, setPlotChannel1Data] = useState<EmgSignalData | null>(null);
  const [plotChannel2Data, setPlotChannel2Data] = useState<EmgSignalData | null>(null);
  const [statsDataFull, setStatsDataFull] = useState<EmgSignalData | null>(null);
  
  // State for loading and errors
  const [isLoading1, setIsLoading1] = useState<boolean>(false);
  const [isLoading2, setIsLoading2] = useState<boolean>(false);
  const [error1, setError1] = useState<string | null>(null);
  const [error2, setError2] = useState<string | null>(null);
  
  // Fetch data for channel 1
  useEffect(() => {
    if (!fileId || !plotChannel1Name) {
      setPlotChannel1Data(null);
      setIsLoading1(false);
      setError1(null);
      return;
    }
    
    setIsLoading1(true);
    setError1(null);
    
    fetchChannelRawData(fileId, plotChannel1Name, downsampleData, dataPoints)
      .then(data => {
        setPlotChannel1Data(data);
        setIsLoading1(false);
      })
      .catch(err => {
        console.error(`Error fetching channel 1 data:`, err);
        setError1(err.message || 'Failed to fetch data');
        setIsLoading1(false);
      });
  }, [fileId, plotChannel1Name, dataPoints, downsampleData]);
  
  // Fetch data for channel 2
  useEffect(() => {
    if (!fileId || !plotChannel2Name) {
      setPlotChannel2Data(null);
      setIsLoading2(false);
      setError2(null);
      return;
    }
    
    setIsLoading2(true);
    setError2(null);
    
    fetchChannelRawData(fileId, plotChannel2Name, downsampleData, dataPoints)
      .then(data => {
        setPlotChannel2Data(data);
        setIsLoading2(false);
      })
      .catch(err => {
        console.error(`Error fetching channel 2 data:`, err);
        setError2(err.message || 'Failed to fetch data');
        setIsLoading2(false);
      });
  }, [fileId, plotChannel2Name, dataPoints, downsampleData]);
  
  // Fetch data for stats
  useEffect(() => {
    if (!fileId || !selectedChannelForStats) {
      setStatsDataFull(null);
      return;
    }
    
    const statsChannelName = `${selectedChannelForStats} Raw`;
    
    // For stats, we fetch without downsampling
    axios.get<EmgSignalData>(`${API_BASE_URL}/raw-data/${fileId}/${statsChannelName}`)
      .then(response => {
        setStatsDataFull(response.data);
      })
      .catch(err => {
        console.error(`Error fetching stats data:`, err);
        setStatsDataFull(null);
      });
  }, [fileId, selectedChannelForStats]);
  
  // Calculate stats from full data
  const currentStats = calculateStats(statsDataFull?.data, statsDataFull?.time_axis);
  
  // Combined loading state
  const dataFetchingLoading = isLoading1 || isLoading2;
  
  // Combined error state
  const dataFetchingError = [error1, error2].filter(Boolean).join('; ') || null;
  
  // External fetch function for other hooks
  const externalFetchChannelRawData = useCallback(async (fileId: string, channelName: string): Promise<EmgSignalData | null> => {
    try {
      return await fetchChannelRawData(fileId, channelName, downsampleData, dataPoints);
    } catch (err) {
      console.error(`External fetch failed for ${channelName}:`, err);
      return null;
    }
  }, [downsampleData, dataPoints]);
  
  // Reset function
  const resetPlotDataAndStats = useCallback(() => {
    // Clear state
    setPlotChannel1Data(null);
    setPlotChannel2Data(null);
    setStatsDataFull(null);
    setIsLoading1(false);
    setIsLoading2(false);
    setError1(null);
    setError2(null);
    
    // Optionally clear cache for the current file if needed
    if (fileId) {
      Object.keys(cache).forEach(key => {
        if (key.startsWith(`${fileId}-`)) {
          delete cache[key];
        }
      });
      console.log("Cache cleared for file:", fileId);
    }
  }, [fileId]);
  
  return {
    plotChannel1Data,
    plotChannel2Data,
    currentStats,
    dataFetchingLoading,
    dataFetchingError,
    fetchChannelRawData: externalFetchChannelRawData,
    resetPlotDataAndStats,
  };
};
