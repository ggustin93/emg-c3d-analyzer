/**
 * Test for updated color thresholds
 * Validates the new UX-improved scoring ranges
 */

import { describe, it, expect } from 'vitest';
import { getColorScheme } from '../unifiedColorSystem';

describe('Score Color Thresholds - UX Improvements', () => {
  describe('New threshold ranges', () => {
    it('should return Excellent (Emerald) for scores 85-100', () => {
      const testScores = [85, 90, 95, 100];
      testScores.forEach(score => {
        const colors = getColorScheme({ context: 'score', value: score });
        expect(colors.label).toBe('Excellent');
        expect(colors.hex).toBe('#10b981'); // Emerald
        expect(colors.text).toContain('emerald');
      });
    });

    it('should return Good (Cyan) for scores 70-84', () => {
      const testScores = [70, 75, 80, 84];
      testScores.forEach(score => {
        const colors = getColorScheme({ context: 'score', value: score });
        expect(colors.label).toBe('Good');
        expect(colors.hex).toBe('#06b6d4'); // Cyan
        expect(colors.text).toContain('cyan');
      });
    });

    it('should return Satisfactory (Amber) for scores 50-69', () => {
      const testScores = [50, 55, 60, 65, 69];
      testScores.forEach(score => {
        const colors = getColorScheme({ context: 'score', value: score });
        expect(colors.label).toBe('Satisfactory');
        expect(colors.hex).toBe('#fbbf24'); // Light Amber
        expect(colors.text).toContain('amber');
      });
    });

    it('should return Bad (Red) for scores below 50', () => {
      const testScores = [0, 10, 25, 40, 49];
      testScores.forEach(score => {
        const colors = getColorScheme({ context: 'score', value: score });
        expect(colors.label).toBe('Bad');
        expect(colors.hex).toBe('#ef4444'); // Red
        expect(colors.text).toContain('red');
      });
    });
  });

  describe('Threshold boundaries', () => {
    it('should handle exact threshold values correctly', () => {
      expect(getColorScheme({ context: 'score', value: 85 }).label).toBe('Excellent');
      expect(getColorScheme({ context: 'score', value: 84.99 }).label).toBe('Good');
      
      expect(getColorScheme({ context: 'score', value: 70 }).label).toBe('Good');
      expect(getColorScheme({ context: 'score', value: 69.99 }).label).toBe('Satisfactory');
      
      expect(getColorScheme({ context: 'score', value: 50 }).label).toBe('Satisfactory');
      expect(getColorScheme({ context: 'score', value: 49.99 }).label).toBe('Bad');
    });
  });

  describe('UX improvements validation', () => {
    it('should use intuitive color-meaning associations', () => {
      // Emerald = growth, success (85+)
      const excellent = getColorScheme({ context: 'score', value: 90 });
      expect(excellent.text).toContain('emerald');
      
      // Cyan = fresh, positive, competent (70-84)
      const good = getColorScheme({ context: 'score', value: 75 });
      expect(good.text).toContain('cyan');
      
      // Amber = caution, needs improvement (50-69)
      const satisfactory = getColorScheme({ context: 'score', value: 60 });
      expect(satisfactory.text).toContain('amber');
      
      // Red = alert, immediate attention (0-49)
      const bad = getColorScheme({ context: 'score', value: 30 });
      expect(bad.text).toContain('red');
    });
  });
});