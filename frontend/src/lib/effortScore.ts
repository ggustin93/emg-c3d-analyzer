/**
 * This utility provides a centralized function to convert a subjective effort rating 
 * from the Borg CR10 scale (0-10) into a clinical performance score (0-100).
 * The mapping is based on the GHOSTLY+ TBM clinical trial specifications.
 * 
 * @file This file is the Single Source of Truth for effort score calculation.
 */

/**
 * Converts a post-session RPE (Rating of Perceived Exertion) value from the Borg CR10 scale 
 * into a performance score percentage.
 * 
 * @param rpe - The subjective effort level reported by the user (typically 0-10).
 * @returns The calculated performance score (0-100). Returns 0 if RPE is null/undefined.
 */
export const getEffortScoreFromRPE = (rpe: number | null | undefined): number => {
  if (rpe === null || rpe === undefined) {
    return 0; // No effort reported translates to 0 score.
  }

  switch (rpe) {
    // Optimal zone
    case 4:
    case 5:
    case 6:
      return 100;
    
    // Acceptable zone
    case 3:
    case 7:
      return 80;
      
    // Suboptimal zone
    case 2:
    case 8:
      return 60;
      
    // Poor zone (too low or too high)
    case 0:
    case 1:
    case 9:
    case 10:
      return 20;
      
    // Default for any unexpected values
    default:
      return 0;
  }
};


