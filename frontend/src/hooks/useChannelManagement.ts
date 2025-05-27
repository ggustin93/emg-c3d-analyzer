import { useState, useMemo, useCallback } from 'react';
import type { EMGAnalysisResult } from '../types/emg';

export interface ChannelManagementControls {
  plotChannel1Name: string | null;
  setPlotChannel1Name: React.Dispatch<React.SetStateAction<string | null>>;
  plotChannel2Name: string | null;
  setPlotChannel2Name: React.Dispatch<React.SetStateAction<string | null>>;
  availableChannels: string[];
  updateChannelsAfterUpload: (analysisResult: EMGAnalysisResult | null) => void;
  resetChannelSelections: () => void;
}

export const useChannelManagement = (analysisResult: EMGAnalysisResult | null): ChannelManagementControls => {
  const [plotChannel1Name, setPlotChannel1Name] = useState<string | null>(null);
  const [plotChannel2Name, setPlotChannel2Name] = useState<string | null>(null);

  const availableChannels = useMemo(() => {
    return analysisResult ? Object.keys(analysisResult.analytics) : [];
  }, [analysisResult]);

  const updateChannelsAfterUpload = useCallback((newAnalysisResult: EMGAnalysisResult | null) => {
    if (newAnalysisResult && newAnalysisResult.analytics) {
      const channelKeys = Object.keys(newAnalysisResult.analytics);
      const ch1 = channelKeys.length > 0 ? channelKeys[0] : null;
      const ch2 = channelKeys.length > 1 ? channelKeys[1] : null;
      setPlotChannel1Name(ch1);
      setPlotChannel2Name(ch2);
    } else {
      setPlotChannel1Name(null);
      setPlotChannel2Name(null);
    }
  }, []);
  
  const resetChannelSelections = useCallback(() => {
    setPlotChannel1Name(null);
    setPlotChannel2Name(null);
  }, []);

  return {
    plotChannel1Name,
    setPlotChannel1Name,
    plotChannel2Name,
    setPlotChannel2Name,
    availableChannels,
    updateChannelsAfterUpload,
    resetChannelSelections,
  };
}; 