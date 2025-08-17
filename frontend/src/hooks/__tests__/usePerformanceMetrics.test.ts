import { describe, it, expect } from 'vitest';
import { calculateContractionScore, calculateGoodContractionScore, calculateTotalScore } from '../usePerformanceMetrics';

describe('Performance Metrics Calculation Helpers', () => {

  describe('calculateContractionScore (Completion Rate)', () => {
    it('should score 100% if contractions meet expectations', () => {
      expect(calculateContractionScore(10, 10)).toBe(100);
    });

    it('should score 50% if half the contractions are done', () => {
      expect(calculateContractionScore(5, 10)).toBe(50);
    });

    it('should score 0% if no contractions are done but were expected', () => {
      expect(calculateContractionScore(0, 10)).toBe(0);
    });

    it('should score 100% if no contractions were expected', () => {
      expect(calculateContractionScore(0, 0)).toBe(100);
      expect(calculateContractionScore(5, 0)).toBe(100);
      expect(calculateContractionScore(0, null)).toBe(100);
    });

    it('should cap the score at 100% if more contractions are done than expected', () => {
      expect(calculateContractionScore(12, 10)).toBe(100);
    });
  });

  describe('calculateGoodContractionScore (Intensity/Quality Rate)', () => {
    it('should return null if there are no contractions', () => {
      expect(calculateGoodContractionScore(5, 0)).toBe(null);
    });

    it('should return 100% if all contractions are good', () => {
      expect(calculateGoodContractionScore(10, 10)).toBe(100);
    });
    
    it('should return 50% if half of the contractions are good', () => {
      expect(calculateGoodContractionScore(5, 10)).toBe(50);
    });

    it('should return 0% if no contractions are good', () => {
      expect(calculateGoodContractionScore(0, 10)).toBe(0);
    });
  });

  // Basic tests for calculateTotalScore, assuming equal weights for simplicity
  describe('calculateTotalScore (Weighted Average)', () => {
    it('should return 0 if all scores are null', () => {
      expect(calculateTotalScore(null, null, null)).toBe(0);
    });

    it('should correctly average the scores that are not null', () => {
      expect(calculateTotalScore(100, 50, null)).toBe(75); // Averages 100 and 50
    });

    it('should return the correct score if all are present', () => {
      expect(calculateTotalScore(100, 80, 60)).toBe(80); // (100+80+60)/3
    });

    it('should handle a single score correctly', () => {
      expect(calculateTotalScore(90, null, null)).toBe(90);
    });
  });
});