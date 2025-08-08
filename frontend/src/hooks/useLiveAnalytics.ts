import { useMemo } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { EMGAnalysisResult, GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';

const getMvcThresholdForChannel = (params: GameSessionParameters, channelName: string): number | null => {
  if (!params) return null;
  
  const mvcValue = (params.session_mvc_values || {})[channelName] ?? params.session_mvc_value ?? 0;
  const thresholdPercent = (params.session_mvc_threshold_percentages || {})[channelName] ?? params.session_mvc_threshold_percentage ?? 75;

  if (mvcValue === null || mvcValue === undefined) return null;

  return mvcValue * (thresholdPercent / 100);
};

export const useLiveAnalytics = (analysisResult: EMGAnalysisResult | null) => {
  const { sessionParams } = useSessionStore();

  const liveAnalytics = useMemo(() => {
    if (!analysisResult?.analytics || !sessionParams) {
      return null;
    }

    const updatedAnalytics: { [key: string]: ChannelAnalyticsData } = {};
    const channelNames = Object.keys(analysisResult.analytics);

    for (const channelName of channelNames) {
      const originalChannelData = analysisResult.analytics[channelName];
      const mvcThreshold = getMvcThresholdForChannel(sessionParams, channelName);
      const durationThreshold = sessionParams.contraction_duration_threshold ?? 2000;

      let goodContractions = 0;
      let longContractionCount = 0;
      let shortContractionCount = 0;
      let goodLongContractionCount = 0;
      let goodShortContractionCount = 0;

      let updatedContractions = originalChannelData.contractions;
      
      if (originalChannelData.contractions && Array.isArray(originalChannelData.contractions)) {
        // Update contractions with is_good property
        updatedContractions = originalChannelData.contractions.map(c => {
          const isGood = mvcThreshold !== null && c.max_amplitude >= mvcThreshold;
          if (isGood) {
            goodContractions++;
          }
          if (c.duration_ms < durationThreshold) {
            shortContractionCount++;
            if (isGood) goodShortContractionCount++;
          } else {
            longContractionCount++;
            if (isGood) goodLongContractionCount++;
          }
          
          return {
            ...c,
            is_good: isGood,
            is_long: c.duration_ms >= durationThreshold
          };
        });
      } else {
        goodContractions = originalChannelData.good_contraction_count ?? 0;
        longContractionCount = originalChannelData.long_contraction_count ?? 0;
        shortContractionCount = originalChannelData.short_contraction_count ?? 0;
        goodLongContractionCount = originalChannelData.good_long_contraction_count ?? 0;
        goodShortContractionCount = originalChannelData.good_short_contraction_count ?? 0;
      }
      
      updatedAnalytics[channelName] = {
        ...originalChannelData,
        contractions: updatedContractions,
        good_contraction_count: goodContractions,
        mvc_threshold_actual_value: mvcThreshold,
        long_contraction_count: longContractionCount,
        short_contraction_count: shortContractionCount,
        good_long_contraction_count: goodLongContractionCount,
        good_short_contraction_count: goodShortContractionCount,
      };
    }

    return updatedAnalytics;

  }, [analysisResult, sessionParams]);

  return liveAnalytics;
}; 