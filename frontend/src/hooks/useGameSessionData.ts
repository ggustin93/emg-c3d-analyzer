import { useState, useEffect, useCallback } from 'react';
import type { GameSession, EMGDataPoint, EMGMetrics, GameParameters as AppGameParameters } from '@/types/session'; // Assuming path alias or correct relative path
import type { EMGAnalysisResult, EmgSignalData } from '../types/emg';
import { CombinedChartDataPoint } from '../components/EMGChart'; // Assuming path or adjust
import { EmgDataFetchingControls } from './useEmgDataFetching';

export interface GameSessionDataControls {
  currentGameSession: GameSession | null;
  currentEMGTimeSeriesDataForTabs: CombinedChartDataPoint[]; // For the tabs chart
  leftQuadChannelForTabs: string | null;
  rightQuadChannelForTabs: string | null;
  tabsDataLoading: boolean; // Specific loading state for tabs chart data
  tabsDataError: string | null;   // Specific error state for tabs chart data
  determineChannelsForTabs: (analysisResult: EMGAnalysisResult) => void;
  resetGameSessionData: () => void;
}

export const useGameSessionData = (
  analysisResult: EMGAnalysisResult | null,
  mainPlotChannel1Data: EmgSignalData | null, // From useEmgDataFetching
  mainPlotChannel2Data: EmgSignalData | null, // From useEmgDataFetching
  mainPlotChannel1Name: string | null,      // From useChannelManagement
  mainPlotChannel2Name: string | null,      // From useChannelManagement
  fetcherControls: Pick<EmgDataFetchingControls, 'fetchChannelRawData'>
): GameSessionDataControls => {
  const [currentGameSession, setCurrentGameSession] = useState<GameSession | null>(null);
  const [currentEMGTimeSeriesDataForTabs, setCurrentEMGTimeSeriesDataForTabs] = useState<CombinedChartDataPoint[]>([]);
  const [leftQuadChannelForTabs, setLeftQuadChannelForTabs] = useState<string | null>(null);
  const [rightQuadChannelForTabs, setRightQuadChannelForTabs] = useState<string | null>(null);
  const [tabsDataLoading, setTabsDataLoading] = useState<boolean>(false);
  const [tabsDataError, setTabsDataError] = useState<string | null>(null);

  const { fetchChannelRawData } = fetcherControls;

  const determineChannelsForTabs = useCallback((result: EMGAnalysisResult) => {
    const channelKeys = Object.keys(result.analytics);
    if (channelKeys.length === 0) {
        setLeftQuadChannelForTabs(null);
        setRightQuadChannelForTabs(null);
        return;
    }

    let finalLeftChannel: string | null = null;
    let finalRightChannel: string | null = null;

    const ch1Activated = channelKeys.find(key => key.toLowerCase() === "ch1 activated");
    const ch2Activated = channelKeys.find(key => key.toLowerCase() === "ch2 activated");

    // Determine Left Channel
    if (ch1Activated) {
      finalLeftChannel = ch1Activated;
    } else {
      const leftKeywordChannels = channelKeys.filter(key => 
        key.toLowerCase().includes('left') && 
        (key.toLowerCase().includes('quad') || key.toLowerCase().includes('vas'))
      );
      const suitableLeftKeyword = leftKeywordChannels.find(key => key !== ch2Activated);
      if (suitableLeftKeyword) {
        finalLeftChannel = suitableLeftKeyword;
      } else if (leftKeywordChannels.length > 0) {
        finalLeftChannel = leftKeywordChannels[0];
      }
    }
    if (!finalLeftChannel) {
      const firstOverallFallback = channelKeys.find(key => key !== ch2Activated);
      finalLeftChannel = firstOverallFallback || channelKeys[0];
    }
    
    // Determine Right Channel (must be different from Left Channel)
    if (ch2Activated && ch2Activated !== finalLeftChannel) {
      finalRightChannel = ch2Activated;
    } else {
      const rightKeywordChannels = channelKeys.filter(key => 
        key.toLowerCase().includes('right') && 
        (key.toLowerCase().includes('quad') || key.toLowerCase().includes('vas'))
      );
      const suitableRightKeyword = rightKeywordChannels.find(key => key !== finalLeftChannel);
      if (suitableRightKeyword) {
        finalRightChannel = suitableRightKeyword;
      }
    }
    if (!finalRightChannel) {
      const secondOverallFallback = channelKeys.find(key => key !== finalLeftChannel);
      finalRightChannel = secondOverallFallback || (channelKeys.length > 1 && channelKeys[1] !== finalLeftChannel ? channelKeys[1] : null);
    }
    
    setLeftQuadChannelForTabs(finalLeftChannel);
    setRightQuadChannelForTabs(finalRightChannel);
  }, []);

  // Effect to fetch data for GameSessionTabs chart
  useEffect(() => {
    if (!analysisResult?.file_id || (!leftQuadChannelForTabs && !rightQuadChannelForTabs)) {
      setCurrentEMGTimeSeriesDataForTabs([]);
      return;
    }

    const fetchData = async () => {
      setTabsDataLoading(true);
      setTabsDataError(null);
      let leftData: EmgSignalData | null = null;
      let rightData: EmgSignalData | null = null;
      let errorMessages: string[] = [];

      if (leftQuadChannelForTabs) {
        leftData = await fetchChannelRawData(analysisResult.file_id, leftQuadChannelForTabs);
        if (!leftData) errorMessages.push(`Failed to load data for ${leftQuadChannelForTabs}`);
      }
      if (rightQuadChannelForTabs) {
        rightData = await fetchChannelRawData(analysisResult.file_id, rightQuadChannelForTabs);
        if (!rightData) errorMessages.push(`Failed to load data for ${rightQuadChannelForTabs}`);
      }

      if (errorMessages.length > 0) {
        setTabsDataError(errorMessages.join(', '));
      }

      const newTimeSeries: CombinedChartDataPoint[] = [];
      const leftTime = leftData?.time_axis || [];
      const leftValues = leftData?.data || [];
      const rightTime = rightData?.time_axis || [];
      const rightValues = rightData?.data || [];
      
      let i = 0, j = 0;
      while (i < leftTime.length || j < rightTime.length) {
        const t1 = i < leftTime.length ? leftTime[i] : Infinity;
        const t2 = j < rightTime.length ? rightTime[j] : Infinity;
        const currentTime = Math.min(t1, t2);
        
        if (currentTime === Infinity) break;

        const point: CombinedChartDataPoint = { time: currentTime };

        if (t1 === currentTime && leftQuadChannelForTabs) {
          point[leftQuadChannelForTabs] = leftValues[i];
          i++;
        } else if (t1 === currentTime) { i++; }

        if (t2 === currentTime && rightQuadChannelForTabs) {
          point[rightQuadChannelForTabs] = rightValues[j];
          j++;
        } else if (t2 === currentTime) { j++; }
        
        if (Object.keys(point).length > 1) {
            newTimeSeries.push(point);
        }
      }
      setCurrentEMGTimeSeriesDataForTabs(newTimeSeries);
      setTabsDataLoading(false);
    };

    fetchData();
  }, [analysisResult?.file_id, leftQuadChannelForTabs, rightQuadChannelForTabs, fetchChannelRawData]);

  // Effect to derive GameSession object
  useEffect(() => {
    if (analysisResult && analysisResult.metadata && analysisResult.analytics) {
      const { metadata, analytics, file_id } = analysisResult;
      const channelKeys = Object.keys(analytics);

      const emgMetrics: EMGMetrics = {};
      let longContractionsL = 0, longContractionsR = 0;
      let shortContractionsL = 0, shortContractionsR = 0;
      
      const leftChannels = channelKeys.filter(ch => ch.toLowerCase().includes('left') || ch.toLowerCase().includes('l_') || ch.toLowerCase().includes('lt_'));
      const rightChannels = channelKeys.filter(ch => ch.toLowerCase().includes('right') || ch.toLowerCase().includes('r_') || ch.toLowerCase().includes('rt_'));

      if (leftChannels.length > 0 && analytics[leftChannels[0]]) {
          const totalLeftContractions = analytics[leftChannels[0]].contraction_count || 0;
          longContractionsL = Math.floor(totalLeftContractions / 2);
          shortContractionsL = totalLeftContractions - longContractionsL;
      }
      if (rightChannels.length > 0 && analytics[rightChannels[0]]) {
          const totalRightContractions = analytics[rightChannels[0]].contraction_count || 0;
          longContractionsR = Math.floor(totalRightContractions / 2);
          shortContractionsR = totalRightContractions - longContractionsR;
      }

      emgMetrics.longContractionsLeft = longContractionsL;
      emgMetrics.longContractionsRight = longContractionsR;
      emgMetrics.shortContractionsLeft = shortContractionsL;
      emgMetrics.shortContractionsRight = shortContractionsR;
      emgMetrics.rms = 0.3; 
      emgMetrics.mav = 0.25; 
      emgMetrics.fatigueIndex = 0.1; 
      emgMetrics.forceEstimation = metadata.score ? metadata.score * 2 : 100;

      const gameStats: GameSession['statistics'] = {
        duration: metadata.duration,
        levelsCompleted: metadata.level ? parseInt(metadata.level.toString(), 10) : 1,
        inactivityPeriods: 0, 
        activationPoints: metadata.score || 0,
      };

      const internalGameParams: AppGameParameters = { 
        difficulty: 5,
        targetMVC: 70, repetitions: 10, sets: 3, restIntervals: 30, ddaEnabled: true, 
        ddaParameters: { adaptiveContractionDetection: true, adaptiveLevelProgression: true },
      };

      const sessionParams: GameSession['parameters'] = {
        difficulty: internalGameParams.difficulty.toString(), targetMVC: internalGameParams.targetMVC,
        repetitions: internalGameParams.repetitions, restIntervals: internalGameParams.restIntervals,
        ddaEnabled: internalGameParams.ddaEnabled, ddaParameters: internalGameParams.ddaParameters,
      };

      const session: GameSession = {
        id: file_id,
        startTime: metadata.time || new Date().toISOString(),
        endTime: new Date(new Date(metadata.time || Date.now()).getTime() + (gameStats?.duration || 0) * 1000).toISOString(),
        gameType: metadata.game_name || "Unknown Game",
        muscleGroups: channelKeys, 
        metrics: emgMetrics,
        statistics: gameStats,
        parameters: sessionParams,
        bfrParameters: undefined, 
      };
      setCurrentGameSession(session);
      
      // This part for mainPlotData based time series seems redundant if tabs have their own specific series
      // If you need a general EMGDataPoint[] from main plots, it should be derived separately
      // For now, focusing on currentEMGTimeSeriesDataForTabs for the tabs

    } else {
      setCurrentGameSession(null);
    }
  }, [analysisResult, mainPlotChannel1Data, mainPlotChannel2Data, mainPlotChannel1Name, mainPlotChannel2Name ]);

  const resetGameSessionData = useCallback(() => {
    setCurrentGameSession(null);
    setCurrentEMGTimeSeriesDataForTabs([]);
    setLeftQuadChannelForTabs(null);
    setRightQuadChannelForTabs(null);
    setTabsDataLoading(false);
    setTabsDataError(null);
  }, []);

  return {
    currentGameSession,
    currentEMGTimeSeriesDataForTabs,
    leftQuadChannelForTabs,
    rightQuadChannelForTabs,
    tabsDataLoading,
    tabsDataError,
    determineChannelsForTabs,
    resetGameSessionData,
  };
}; 