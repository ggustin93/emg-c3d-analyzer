import { useMemo } from 'react';
import { EMGAnalysisResult, Contraction, GameSessionParameters } from '../types/emg';
import { getScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';

export const calculateContractionScore = (count: number, expected: number | null): number => {
  if (!expected || expected <= 0) return 100;
  const ratio = count / expected;
  return Math.min(Math.round(ratio * 100), 100);
};

export const calculateGoodContractionScore = (goodCount: number, totalCount: number): number | null => {
  if (totalCount <= 0) return null;
  return Math.round((goodCount / totalCount) * 100);
};

/**
 * Calculates the weighted average score from three subscores
 * @param subscore1 Completion score (contractions performed vs expected)
 * @param subscore2 Intensity score (contractions meeting MVC threshold)
 * @param subscore3 Duration score (contractions meeting duration threshold)
 * @param weights Optional weights for each subscore [completion, intensity, duration]
 * @returns Weighted average score rounded to nearest integer
 */
export const calculateTotalScore = (
  subscore1: number | null, 
  subscore2: number | null, 
  subscore3: number | null,
  weights: [number, number, number] = [1/3, 1/3, 1/3]
): number => {
  // Filter out null scores and their corresponding weights
  const scores: number[] = [];
  const activeWeights: number[] = [];
  
  if (subscore1 !== null) {
    scores.push(subscore1);
    activeWeights.push(weights[0]);
  }
  
  if (subscore2 !== null) {
    scores.push(subscore2);
    activeWeights.push(weights[1]);
  }
  
  if (subscore3 !== null) {
    scores.push(subscore3);
    activeWeights.push(weights[2]);
  }
  
  if (scores.length === 0) return 0;
  
  // Normalize weights to sum to 1
  const weightSum = activeWeights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = activeWeights.map(w => w / weightSum);
  
  // Calculate weighted average
  let weightedSum = 0;
  for (let i = 0; i < scores.length; i++) {
    weightedSum += scores[i] * normalizedWeights[i];
  }
  
  return Math.round(weightedSum);
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

export const usePerformanceMetrics = (analysisResult: EMGAnalysisResult | null, contractionDurationThreshold: number = 2000) => {
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

    // Get scoring weights from session parameters
    // Default to equal weights (arithmetic mean) if not configured
    const completionWeight = sessionParams?.enhanced_scoring?.weights?.completion ?? 1/3;
    const intensityWeight = sessionParams?.enhanced_scoring?.weights?.mvcQuality ?? 1/3;
    // Note: qualityThreshold is used for duration weight (naming inconsistency to be fixed)
    const durationWeight = sessionParams?.enhanced_scoring?.weights?.qualityThreshold ?? 1/3;
    
    // Pass raw weights - calculateTotalScore will normalize them internally
    const scoreWeights: [number, number, number] = [
      completionWeight, 
      intensityWeight, 
      durationWeight
    ];

    channelNames.forEach((channelName, index) => {
      const channelData = analysisResult.analytics[channelName];
      if (!channelData) return;

      let expectedContractions: number | null = null;
      const params = sessionParams;

      if (params) {
        const perChannelKey = `session_expected_contractions_ch${index + 1}` as keyof typeof params;
        expectedContractions = (params[perChannelKey] as number | null) ?? params.session_expected_contractions ?? null;
        
        // Removed type-specific expected counts (long/short) usage
      }
      
      const mvcThreshold = getMvcThresholdForChannel(sessionParams, channelName);
      
      let goodContractions = 0;
      let shortContractions = 0;
      let longContractions = 0;
      let shortGoodContractions = 0;
      let longGoodContractions = 0;
      let muscleContractionDurations: number[] = [];
      
     const durationThreshold = sessionParams.contraction_duration_threshold ?? 2000;

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
      const totalScore = calculateTotalScore(contractionScore, goodContractionScore, durationQualityScore, scoreWeights);
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
        // type-specific expectations removed
        averageContractionTime: muscleAverageContractionTime,
        mvcValue: sessionParams.session_mvc_values?.[channelName] ?? sessionParams.session_mvc_value ?? null,
        mvcThreshold,
        // Add component scores and weights for detailed display
        // Normalize weights for display (matching what calculateTotalScore does internally)
        componentScores: {
          completion: { score: contractionScore, weight: completionWeight / (completionWeight + intensityWeight + durationWeight) },
          intensity: { score: goodContractionScore, weight: intensityWeight / (completionWeight + intensityWeight + durationWeight) },
          duration: { score: durationQualityScore, weight: durationWeight / (completionWeight + intensityWeight + durationWeight) }
        }
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