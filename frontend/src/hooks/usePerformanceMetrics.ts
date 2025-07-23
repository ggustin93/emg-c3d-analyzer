import { useMemo } from 'react';
import { EMGAnalysisResult, Contraction, GameSessionParameters } from '../types/emg';
import { getScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';

const calculateContractionScore = (count: number, expected: number | null): number => {
  if (!expected || expected <= 0) return 100;
  const ratio = count / expected;
  return Math.min(Math.round(ratio * 100), 100);
};

const calculateGoodContractionScore = (goodCount: number, totalCount: number): number | null => {
  if (totalCount <= 0) return null;
  return Math.round((goodCount / totalCount) * 100);
};

const calculateTotalScore = (subscore1: number | null, subscore2: number | null, subscore3: number | null): number => {
  const scores = [subscore1, subscore2, subscore3].filter(s => s !== null) as number[];
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
};

const calculateOverallScore = (muscleScores: number[]): number => {
  if (muscleScores.length === 0) return 0;
  const sum = muscleScores.reduce((a, b) => a + b, 0);
  return Math.round(sum / muscleScores.length);
};

const getMvcThresholdForChannel = (params: GameSessionParameters, channelName: string): number | null => {
  const mvcValue = params.session_mvc_values?.[channelName] ?? params.session_mvc_value ?? 0;
  const thresholdPercent = params.session_mvc_threshold_percentages?.[channelName] ?? params.session_mvc_threshold_percentage ?? 75;

  if (mvcValue === null || mvcValue === undefined) return null;

  return mvcValue * (thresholdPercent / 100);
};

export const usePerformanceMetrics = (analysisResult: EMGAnalysisResult | null, contractionDurationThreshold: number = 250) => {
  const { sessionParams } = useSessionStore();

  const performanceData = useMemo(() => {
    if (!analysisResult?.analytics) {
      return {
        muscleData: [],
        overallScore: 0,
        overallScoreLabel: getScoreColors(0),
        symmetryScore: undefined,
        durationThreshold: contractionDurationThreshold,
      };
    }

    const muscleScores: number[] = [];
    const muscleData: any[] = [];
    const channelNames = Object.keys(analysisResult.analytics).sort();
    
    // Aggregate contraction data across all channels
    let aggregateContractions = 0;
    let aggregateGoodContractions = 0;
    let aggregateExpectedContractions = 0;
    let allContractionDurations: number[] = [];

    channelNames.forEach((channelName, index) => {
      const channelData = analysisResult.analytics[channelName];
      if (!channelData) return;

      let expectedContractions: number | null = null;
      let expectedShortContractions: number | undefined;
      let expectedLongContractions: number | undefined;
      const params = sessionParams;

      if (params) {
        const perChannelKey = `session_expected_contractions_ch${index + 1}` as keyof typeof params;
        expectedContractions = (params[perChannelKey] as number | null) ?? params.session_expected_contractions ?? null;
        
        if (index === 0) {
          expectedShortContractions = typeof params.session_expected_short_left === 'number' ? params.session_expected_short_left : undefined;
          expectedLongContractions = typeof params.session_expected_long_left === 'number' ? params.session_expected_long_left : undefined;
        } else if (index === 1) {
          expectedShortContractions = typeof params.session_expected_short_right === 'number' ? params.session_expected_short_right : undefined;
          expectedLongContractions = typeof params.session_expected_long_right === 'number' ? params.session_expected_long_right : undefined;
        }
      }
      
      const mvcThreshold = getMvcThresholdForChannel(sessionParams, channelName);
      
      let goodContractions = 0;
      let shortContractions = 0;
      let longContractions = 0;
      let shortGoodContractions = 0;
      let longGoodContractions = 0;
      let muscleContractionDurations: number[] = [];
      
      const durationThreshold = sessionParams.contraction_duration_threshold ?? 250;

      if (channelData.contractions && Array.isArray(channelData.contractions)) {
        channelData.contractions.forEach((c: Contraction) => {
          const isGood = mvcThreshold !== null && c.max_amplitude >= mvcThreshold;
          
          if (isGood) goodContractions++;
          
          // Collect duration for overall average calculation
          if (c.duration_ms && c.duration_ms > 0) {
            allContractionDurations.push(c.duration_ms);
            muscleContractionDurations.push(c.duration_ms);
          }

          if (c.duration_ms < durationThreshold) {
            shortContractions++;
            if (isGood) shortGoodContractions++;
          } else {
            longContractions++;
            if (isGood) longGoodContractions++;
          }
        });
      } else {
        goodContractions = channelData.good_contraction_count || 0;
      }

      const totalContractions = channelData.contraction_count || 0;
      
      // Calculate muscle-specific average contraction time
      const muscleAverageContractionTime = muscleContractionDurations.length > 0 
        ? muscleContractionDurations.reduce((sum, duration) => sum + duration, 0) / muscleContractionDurations.length
        : undefined;
      
      const contractionScore = calculateContractionScore(totalContractions, expectedContractions);
      const goodContractionScore = calculateGoodContractionScore(goodContractions, totalContractions);
      const durationQualityScore = totalContractions > 0 ? Math.round((longContractions / totalContractions) * 100) : 0;
      const totalScore = calculateTotalScore(contractionScore, goodContractionScore, durationQualityScore);
      const scoreColors = getScoreColors(totalScore);
      
      muscleScores.push(totalScore);
      
      // Aggregate data across all channels
      aggregateContractions += channelData.contraction_count || 0;
      aggregateGoodContractions += goodContractions;
      if (expectedContractions) {
        aggregateExpectedContractions += expectedContractions;
      }

      muscleData.push({
        channelName,
        totalScore,
        scoreLabel: scoreColors.label,
        scoreTextColor: scoreColors.text,
        scoreBgColor: scoreColors.bg,
        scoreHexColor: scoreColors.hex,
        totalContractions,
        expectedContractions,
        contractionScore,
        goodContractions,
        goodContractionScore,
        shortContractions,
        shortGoodContractions,
        longContractions,
        longGoodContractions,
        expectedShortContractions,
        expectedLongContractions,
        averageContractionTime: muscleAverageContractionTime,
        mvcValue: sessionParams.session_mvc_values?.[channelName] ?? sessionParams.session_mvc_value ?? null,
        mvcThreshold,
      });
    });

    const overallScore = calculateOverallScore(muscleScores);
    const overallScoreLabel = getScoreColors(overallScore);

    let symmetryScore: number | undefined;
    if (muscleScores.length === 2) {
      const [score1, score2] = muscleScores;
      if (score1 > 0 || score2 > 0) {
        symmetryScore = Math.round((Math.min(score1, score2) / Math.max(score1, score2)) * 100);
      } else {
        symmetryScore = 100;
      }
    }

    const durationThreshold = sessionParams?.contraction_duration_threshold ?? contractionDurationThreshold;
    
    // Calculate average contraction time
    const averageContractionTime = allContractionDurations.length > 0 
      ? allContractionDurations.reduce((sum, duration) => sum + duration, 0) / allContractionDurations.length
      : undefined;

    return { 
      muscleData, 
      overallScore, 
      overallScoreLabel, 
      symmetryScore, 
      durationThreshold,
      averageContractionTime,
      totalContractions: aggregateContractions,
      totalGoodContractions: aggregateGoodContractions,
      totalExpectedContractions: aggregateExpectedContractions > 0 ? aggregateExpectedContractions : undefined
    };

  }, [analysisResult, contractionDurationThreshold, sessionParams]);

  return performanceData;
}; 