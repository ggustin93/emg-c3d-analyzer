import { useState, useCallback, useMemo, useEffect } from 'react';
import type { EMGAnalysisResult } from '../types/emg';

/**
 * Manages the state for channel selections within the UI.
 * This includes channels for plotting and for displaying detailed statistics.
 */
export interface ChannelManagementControls {
  // The two channels selected for plotting in the main chart.
  plotChannel1Name: string | null;
  setPlotChannel1Name: (name: string | null) => void;
  plotChannel2Name: string | null;
  setPlotChannel2Name: (name: string | null) => void;

  // The single channel/muscle selected for displaying detailed analytics (e.g., in the StatsPanel).
  selectedChannelForStats: string | null;
  setSelectedChannelForStats: (name: string | null) => void;

  // The list of "muscle" names derived from the analytics keys (e.g., ["CH1", "CH2"]).
  // This is used to populate dropdowns for muscle selection.
  muscleChannels: string[];

  // The full list of raw and activated channels available from the C3D file.
  // This is kept for reference and for components that might need the full list.
  allAvailableChannels: string[];

  // Function to initialize or update channel selections after a file upload.
  updateChannelsAfterUpload: (data: EMGAnalysisResult) => void;

  // Function to reset all selections to their initial state.
  resetChannelSelections: () => void;
}

export const useChannelManagement = (
  analysisResult: EMGAnalysisResult | null,
  plotMode: 'raw' | 'activated'
): ChannelManagementControls => {
  const [plotChannel1Name, setPlotChannel1Name] = useState<string | null>(null);
  const [plotChannel2Name, setPlotChannel2Name] = useState<string | null>(null);
  const [selectedChannelForStats, setSelectedChannelForStats] = useState<string | null>(null);

  // Derives the clean "muscle" channels (e.g., "CH1") from the analytics object keys.
  const muscleChannels = useMemo(() => {
    return analysisResult ? Object.keys(analysisResult.analytics) : [];
  }, [analysisResult]);

  // Retains the full list of all channels from the C3D file for any components that need it.
  const allAvailableChannels = useMemo(() => {
    return analysisResult?.available_channels || [];
  }, [analysisResult]);

  useEffect(() => {
    if (muscleChannels.length === 0) return;

    const suffix = plotMode === 'raw' ? ' Raw' : ' activated';
    
    const potentialPlot1 = `${muscleChannels[0]}${suffix}`;
    setPlotChannel1Name(allAvailableChannels.includes(potentialPlot1) ? potentialPlot1 : null);

    if (muscleChannels.length > 1) {
      const potentialPlot2 = `${muscleChannels[1]}${suffix}`;
      setPlotChannel2Name(allAvailableChannels.includes(potentialPlot2) ? potentialPlot2 : null);
    } else {
      setPlotChannel2Name(null);
    }
  }, [plotMode, muscleChannels, allAvailableChannels]);

  const updateChannelsAfterUpload = useCallback((data: EMGAnalysisResult) => {
    const analyticsChannels = Object.keys(data.analytics);
    if (analyticsChannels.length === 0) return;

    // Try to find a channel with "Quadriceps" in its name from the session parameters
    const quadricepsChannel = analyticsChannels.find(channel => {
      const muscleName = data.metadata?.session_parameters_used?.channel_muscle_mapping?.[channel];
      return muscleName && muscleName.includes('Quadriceps');
    });

    // If found, select the Quadriceps channel, otherwise select the first channel
    const defaultStatsChannel = quadricepsChannel || analyticsChannels[0];
    setSelectedChannelForStats(defaultStatsChannel);

    // Plot channels are now handled by the useEffect above.
  }, []);

  const resetChannelSelections = useCallback(() => {
    setPlotChannel1Name(null);
    setPlotChannel2Name(null);
    setSelectedChannelForStats(null);
  }, []);

  return {
    plotChannel1Name,
    setPlotChannel1Name,
    plotChannel2Name,
    setPlotChannel2Name,
    selectedChannelForStats,
    setSelectedChannelForStats,
    muscleChannels,
    allAvailableChannels,
    updateChannelsAfterUpload,
    resetChannelSelections,
  };
}; 