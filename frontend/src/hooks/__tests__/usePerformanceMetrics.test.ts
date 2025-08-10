import { describe, it, expect } from 'vitest';
import { calculateTotalScore, calculateContractionScore, calculateGoodContractionScore } from '../usePerformanceMetrics';

describe('usePerformanceMetrics', () => {
  describe('calculateTotalScore', () => {
    it('should return arithmetic mean when weights are equal (1/3 each)', () => {
      // Test case 1: All equal scores
      const score1 = calculateTotalScore(60, 60, 60, [1/3, 1/3, 1/3]);
      expect(score1).toBe(60);

      // Test case 2: Different scores - should return average
      const score2 = calculateTotalScore(90, 60, 30, [1/3, 1/3, 1/3]);
      expect(score2).toBe(60); // (90 + 60 + 30) / 3 = 60

      // Test case 3: Another set of different scores
      const score3 = calculateTotalScore(100, 80, 40, [1/3, 1/3, 1/3]);
      expect(score3).toBe(73); // (100 + 80 + 40) / 3 = 73.33 → 73 (rounded)

      // Test case 4: Edge case with 0 scores
      const score4 = calculateTotalScore(100, 50, 0, [1/3, 1/3, 1/3]);
      expect(score4).toBe(50); // (100 + 50 + 0) / 3 = 50
    });

    it('should handle null scores correctly', () => {
      // When one score is null, average only the non-null scores
      const score1 = calculateTotalScore(90, 60, null, [1/3, 1/3, 1/3]);
      expect(score1).toBe(75); // (90 + 60) / 2 = 75

      // When two scores are null
      const score2 = calculateTotalScore(80, null, null, [1/3, 1/3, 1/3]);
      expect(score2).toBe(80); // Only one score, so returns that score

      // When all scores are null
      const score3 = calculateTotalScore(null, null, null, [1/3, 1/3, 1/3]);
      expect(score3).toBe(0);
    });

    it('should apply custom weights correctly', () => {
      // Test with custom weights (50%, 30%, 20%)
      const score = calculateTotalScore(100, 80, 60, [0.5, 0.3, 0.2]);
      expect(score).toBe(86); // (100*0.5 + 80*0.3 + 60*0.2) = 50 + 24 + 12 = 86
    });

    it('should normalize weights when some scores are null', () => {
      // If one score is null with weights [0.5, 0.3, 0.2], 
      // the remaining weights should be normalized to sum to 1
      const score = calculateTotalScore(100, 80, null, [0.5, 0.3, 0.2]);
      // Normalized weights: [0.5/0.8, 0.3/0.8] = [0.625, 0.375]
      // Score: 100*0.625 + 80*0.375 = 62.5 + 30 = 92.5 → 93 (rounded)
      expect(score).toBe(93);
    });
  });

  describe('Compliance Score Averaging Verification', () => {
    it('should ensure overall compliance equals arithmetic mean of subscores with equal weights', () => {
      // Mock the three subscores
      const completionScore = 80;  // Completion Rate
      const intensityScore = 70;   // Intensity (MVC Quality)
      const durationScore = 60;    // Duration Quality

      // Calculate with equal weights (1/3 each)
      const overallScore = calculateTotalScore(
        completionScore,
        intensityScore,
        durationScore,
        [1/3, 1/3, 1/3]
      );

      // Verify it equals the arithmetic mean
      const expectedMean = Math.round((completionScore + intensityScore + durationScore) / 3);
      expect(overallScore).toBe(expectedMean);
      expect(overallScore).toBe(70); // (80 + 70 + 60) / 3 = 70
    });

    it('should show compliance score as average in real-world scenario', () => {
      // Simulate a real muscle performance scenario
      const totalContractions = 10;
      const expectedContractions = 12;
      const goodContractions = 7;
      const longContractions = 6;

      // Calculate individual subscores as per the actual implementation
      const completionScore = Math.round((totalContractions / expectedContractions) * 100); // 83%
      const intensityScore = Math.round((goodContractions / totalContractions) * 100); // 70%
      const durationScore = Math.round((longContractions / totalContractions) * 100); // 60%

      // Calculate overall score with equal weights
      const overallScore = calculateTotalScore(
        completionScore,
        intensityScore,
        durationScore,
        [1/3, 1/3, 1/3]
      );

      // Verify the arithmetic mean
      const expectedMean = Math.round((83 + 70 + 60) / 3);
      expect(overallScore).toBe(expectedMean);
      expect(overallScore).toBe(71); // (83 + 70 + 60) / 3 = 71
    });
  });
});