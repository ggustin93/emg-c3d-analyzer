// This file will contain all performance calculation logic for the frontend.
// It acts as the single source of truth for calculating the overall performance score
// based on various components and therapist-defined weights.

import { ScoringWeights } from '@/types/emg';
import { getEffortScoreFromRPE } from './effortScore';

// Define the structure for component scores input
export interface PerformanceComponentScores {
  compliance?: number;
  symmetry?: number;
  effort?: number;
  game?: number;
}

// Define the structure for the detailed performance calculation result
export interface PerformanceCalculationResult {
  totalScore: number;
  contributions: {
    compliance: number;
    symmetry: number;
    effort: number;
    game: number;
  };
  strongestDriver: string;
  weightedScores: {
    compliance: number;
    symmetry: number;
    effort: number;
    game: number;
  };
  durationThreshold: number;
}

/**
 * Calculates the overall performance score based on component scores and weights.
 * This is the single source of truth for performance calculation on the frontend.
 *
 * @param scores - An object containing the individual component scores (0-100).
 * @param weights - An object containing the weights for each component (0-1).
 * @returns A detailed performance calculation result.
 */
export const calculateOverallPerformance = (
  scores: PerformanceComponentScores,
  weights: ScoringWeights,
  durationThreshold: number
): PerformanceCalculationResult => {
  // Ensure scores are treated as 0 if they are null, undefined, or NaN
  const safeScores = {
    compliance: scores.compliance ?? 0,
    symmetry: scores.symmetry ?? 0,
    // CORRECTED: Use the clinical mapping for effort score
    effort: getEffortScoreFromRPE(scores.effort),
    game: scores.game ?? 0,
  };

  // Calculate the weighted contribution of each component
  const contributions = {
    compliance: safeScores.compliance * weights.compliance,
    symmetry: safeScores.symmetry * weights.symmetry,
    effort: safeScores.effort * weights.effort,
    game: safeScores.game * weights.gameScore,
  };
  
  const weightedScores = {
    compliance: safeScores.compliance,
    symmetry: safeScores.symmetry,
    effort: safeScores.effort,
    game: safeScores.game,
  }

  // Sum the contributions to get the final total score
  const totalScore = Object.values(contributions).reduce((sum, value) => sum + value, 0);

  // Determine the strongest driver of the score
  const contributionEntries = Object.entries(contributions);
  
  const strongestDriverEntry = contributionEntries.length > 0 
    ? contributionEntries.reduce((max, entry) => (entry[1] > max[1] ? entry : max))
    : ['None', 0];
  
  const driverLabels: { [key: string]: string } = {
    compliance: 'Compliance',
    symmetry: 'Symmetry',
    effort: 'Effort',
    game: 'Game',
    None: 'None'
  };

  const strongestDriver = driverLabels[strongestDriverEntry[0]];
  
  return {
    totalScore: Math.round(totalScore),
    contributions,
    strongestDriver,
    weightedScores,
    durationThreshold,
  };
};
