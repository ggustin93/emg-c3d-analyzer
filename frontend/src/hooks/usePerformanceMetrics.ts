import { useMemo } from 'react';
import { EMGAnalysisResult, Contraction, GameSessionParameters } from '../types/emg';
import { getScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { 
  calculateOverallPerformance, 
  PerformanceComponentScores, 
  PerformanceCalculationResult 
} from '@/lib/performanceUtils';
import { DEFAULT_SCORING_WEIGHTS } from './useEnhancedPerformanceMetrics';

// Helper functions for muscle-level compliance might remain here or be moved to a separate utility file in the future.
// For now, keeping them here to minimize file changes.

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
        overallPerformance: null, // Will hold the detailed performance object
        symmetryScore: undefined,
        durationThreshold: contractionDurationThreshold,
        // ... other aggregate data
      };
    }

    const weights = sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
    const muscleScores: { [channel: string]: number } = {};
    const muscleData: any[] = [];
    const channelNames = Object.keys(analysisResult.analytics).sort();
    
    // ... (rest of the data aggregation logic for contractions, etc.)
    let aggregateContractions = 0;
    let aggregateGoodContractions = 0;
    let aggregateExpectedContractions = 0;
    let allContractionDurations: number[] = [];


    channelNames.forEach((channelName, index) => {
      const channelData = analysisResult.analytics[channelName];
      if (!channelData) return;

      let expectedContractions: number | null = null;
      const params = sessionParams;

      if (params) {
        const perChannelKey = `session_expected_contractions_ch${index + 1}` as keyof typeof params;
        expectedContractions = (params[perChannelKey] as number | null) ?? params.session_expected_contractions ?? null;
      }
      
      const mvcThreshold = getMvcThresholdForChannel(sessionParams, channelName);
      
      let goodContractions = 0;
      let longContractions = 0;
      let muscleContractionDurations: number[] = [];
      const durationThreshold = sessionParams.contraction_duration_threshold ?? 2000;

      if (channelData.contractions && Array.isArray(channelData.contractions)) {
        channelData.contractions.forEach((c: Contraction) => {
          const meetsMvc = c.meets_mvc ?? (mvcThreshold !== null && c.max_amplitude >= mvcThreshold);
          const meetsDuration = c.meets_duration ?? (c.duration_ms >= durationThreshold);
          
          if (meetsMvc) goodContractions++;
          if (meetsDuration) longContractions++;
          
          if (c.duration_ms && c.duration_ms > 0) {
            allContractionDurations.push(c.duration_ms);
            muscleContractionDurations.push(c.duration_ms);
          }
        });
      } else {
        goodContractions = channelData.good_contraction_count || 0;
      }

      const totalContractions = channelData.contraction_count || 0;
      
      const completionScore = 
        !expectedContractions || expectedContractions <= 0 
          ? 100 
          : Math.min(Math.round((totalContractions / expectedContractions) * 100), 100);

      const intensityScore = totalContractions > 0 ? Math.round((goodContractions / totalContractions) * 100) : 0;
      const durationScore = totalContractions > 0 ? Math.round((longContractions / totalContractions) * 100) : 0;

      // This is the per-muscle therapeutic compliance score
      // CORRECTED: Use the correct weight keys for sub-components
      const complianceWeights = [
        weights.compliance_completion, 
        weights.compliance_intensity, 
        weights.compliance_duration
      ];
      const weightSum = complianceWeights.reduce((sum, w) => sum + w, 0);

      const complianceScore = weightSum > 0
        ? Math.round(
            (completionScore * complianceWeights[0] + 
             intensityScore * complianceWeights[1] + 
             durationScore * complianceWeights[2]) / 
            weightSum
          )
        : 0; // Avoid division by zero if all weights are 0

      muscleScores[channelName] = complianceScore;
      
      // --- Re-populate muscleData for UI cards ---
      const scoreColors = getScoreColors(complianceScore);
      muscleData.push({
        channelName,
        totalScore: complianceScore,
        scoreLabel: scoreColors.label,
        scoreTextColor: scoreColors.text,
        scoreBgColor: scoreColors.bg,
        scoreHexColor: scoreColors.hex,
        totalContractions,
        expectedContractions,
        contractionScore: completionScore, // <-- ADD THIS LINE
        goodContractions,
        longContractions,
        contractions: channelData.contractions,
        mvcThreshold,
        mvcValue: params.session_mvc_values?.[channelName] ?? params.session_mvc_value ?? null,
        componentScores: {
          completion: { score: completionScore, weight: complianceWeights[0] },
          intensity: { score: intensityScore, weight: complianceWeights[1] },
          duration: { score: durationScore, weight: complianceWeights[2] },
        },
      });
      // -----------------------------------------
      
      // Aggregate data across all channels
      aggregateContractions += totalContractions;
      aggregateGoodContractions += goodContractions;
      if (expectedContractions) {
        aggregateExpectedContractions += expectedContractions;
      }

      // ... muscleData push logic can be simplified or adjusted later
    });

    // --- Centralized Performance Calculation ---
    const leftChannel = channelNames[0];
    const rightChannel = channelNames[1];
    const leftMuscleScore = leftChannel ? muscleScores[leftChannel] : 0;
    const rightMuscleScore = rightChannel ? muscleScores[rightChannel] : 0;

    const therapeuticComplianceScore = channelNames.length > 0
      ? Object.values(muscleScores).reduce((a, b) => a + b, 0) / channelNames.length
      : 0;

    let symmetryScore: number | undefined;
    if (channelNames.length === 2) {
      const denominator = leftMuscleScore + rightMuscleScore;
      if (denominator > 0) {
        symmetryScore = Math.round((1 - Math.abs(leftMuscleScore - rightMuscleScore) / denominator) * 100);
      } else {
        // If both scores are 0, symmetry is perfect.
        symmetryScore = 100;
      }
    }

    const gameScore = analysisResult?.metadata?.score;

    const componentScores: PerformanceComponentScores = {
      compliance: therapeuticComplianceScore,
      symmetry: symmetryScore,
      // For demo purposes, if RPE is not set, default to 5 for a better visual.
      // In a real scenario, this would be null and result in a 0 effort score.
      effort: sessionParams.rpe_level ?? 5, // Pass the raw RPE 0-10, default to 5 for demo
      game: gameScore ?? undefined,
    };

    const currentDurationThreshold = sessionParams?.contraction_duration_threshold ?? contractionDurationThreshold;

    const overallPerformance: PerformanceCalculationResult = calculateOverallPerformance(componentScores, weights, currentDurationThreshold);
    const overallScoreLabel = getScoreColors(overallPerformance.totalScore);

    const averageContractionTime = allContractionDurations.length > 0 
      ? allContractionDurations.reduce((sum, duration) => sum + duration, 0) / allContractionDurations.length
      : undefined;

    return { 
      muscleData, // Now correctly populated
      overallPerformance,
      overallScoreLabel,
      symmetryScore, 
      therapeuticComplianceScore,
      leftMuscleScore,
      rightMuscleScore,
      averageContractionTime,
      totalContractions: aggregateContractions,
      totalGoodContractions: aggregateGoodContractions,
      totalExpectedContractions: aggregateExpectedContractions > 0 ? aggregateExpectedContractions : undefined
      // other data points as needed by UI
    };

  }, [analysisResult, contractionDurationThreshold, sessionParams]);

  return performanceData;
}; 