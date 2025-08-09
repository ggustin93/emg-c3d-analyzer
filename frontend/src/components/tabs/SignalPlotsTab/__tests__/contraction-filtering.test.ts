/**
 * Unit Tests for Contraction Filtering Logic
 * Tests the core filtering logic that was causing yellow contractions to be hidden
 */

import { describe, it, expect } from 'vitest';

// Import the filtering logic types
interface ContractionArea {
  startTime: number;
  endTime: number;
  isGood: boolean;
  meetsMvc: boolean;
  meetsDuration: boolean;
  channel: string;
  maxAmplitude: number;
  peakTime: number;
}

// Extract the filtering logic into a pure function for testing
function filterContractions(
  areas: ContractionArea[], 
  showGoodContractions: boolean, 
  showPoorContractions: boolean
): ContractionArea[] {
  return areas.filter(area => {
    // Three quality categories: Good (green), Adequate (yellow), Poor (red)
    if (area.isGood) return showGoodContractions;
    
    // For non-good contractions, check if they're adequate (yellow) or poor (red)
    const isAdequate = (area.meetsMvc && !area.meetsDuration) || (!area.meetsMvc && area.meetsDuration);
    const isPoor = !area.meetsMvc && !area.meetsDuration;
    
    // Show adequate contractions when either good OR poor contractions are enabled
    // This ensures yellow contractions are visible in the legacy 2-toggle system
    if (isAdequate) return showGoodContractions || showPoorContractions;
    
    // Only show poor contractions when explicitly enabled
    if (isPoor) return showPoorContractions;
    
    return false;
  });
}

describe('Contraction Filtering Logic', () => {
  // Test data representing all quality categories
  const mockContractions: ContractionArea[] = [
    // Good contraction (green) - meets both criteria
    {
      startTime: 1.0,
      endTime: 2.5,
      isGood: true,
      meetsMvc: true,
      meetsDuration: true,
      channel: 'CH1',
      maxAmplitude: 0.8,
      peakTime: 1.75
    },
    // Adequate MVC-only contraction (yellow) - meets force, not duration
    {
      startTime: 3.0,
      endTime: 3.8,
      isGood: false,
      meetsMvc: true,
      meetsDuration: false,
      channel: 'CH1',
      maxAmplitude: 0.9,
      peakTime: 3.4
    },
    // Adequate duration-only contraction (yellow) - meets duration, not force
    {
      startTime: 5.0,
      endTime: 7.2,
      isGood: false,
      meetsMvc: false,
      meetsDuration: true,
      channel: 'CH1',
      maxAmplitude: 0.3,
      peakTime: 6.1
    },
    // Poor contraction (red) - meets neither criteria
    {
      startTime: 8.0,
      endTime: 8.5,
      isGood: false,
      meetsMvc: false,
      meetsDuration: false,
      channel: 'CH1',
      maxAmplitude: 0.2,
      peakTime: 8.25
    }
  ];

  describe('Toggle Combination Testing', () => {
    it('should show all contractions when both toggles are ON', () => {
      const result = filterContractions(mockContractions, true, true);
      expect(result).toHaveLength(4);
      expect(result.map(c => c.startTime)).toEqual([1.0, 3.0, 5.0, 8.0]);
    });

    it('should hide all contractions when both toggles are OFF', () => {
      const result = filterContractions(mockContractions, false, false);
      expect(result).toHaveLength(0);
    });

    it('should show good and adequate (yellow) contractions when only good toggle is ON', () => {
      const result = filterContractions(mockContractions, true, false);
      expect(result).toHaveLength(3); // Good + 2 Adequate (yellow)
      expect(result.map(c => c.startTime)).toEqual([1.0, 3.0, 5.0]);
      
      // Verify categories
      expect(result[0].isGood).toBe(true); // Green
      expect(result[1].isGood).toBe(false); // Yellow MVC-only
      expect(result[1].meetsMvc && !result[1].meetsDuration).toBe(true);
      expect(result[2].isGood).toBe(false); // Yellow duration-only
      expect(!result[2].meetsMvc && result[2].meetsDuration).toBe(true);
    });

    it('should show adequate (yellow) and poor contractions when only poor toggle is ON', () => {
      const result = filterContractions(mockContractions, false, true);
      expect(result).toHaveLength(3); // 2 Adequate (yellow) + Poor
      expect(result.map(c => c.startTime)).toEqual([3.0, 5.0, 8.0]);
      
      // Verify no good contractions shown
      expect(result.every(c => !c.isGood)).toBe(true);
    });
  });

  describe('Quality Category Validation', () => {
    it('should correctly identify adequate MVC-only contractions', () => {
      const mvcOnlyContractions = mockContractions.filter(c => 
        !c.isGood && c.meetsMvc && !c.meetsDuration
      );
      expect(mvcOnlyContractions).toHaveLength(1);
      expect(mvcOnlyContractions[0].startTime).toBe(3.0);
    });

    it('should correctly identify adequate duration-only contractions', () => {
      const durationOnlyContractions = mockContractions.filter(c => 
        !c.isGood && !c.meetsMvc && c.meetsDuration
      );
      expect(durationOnlyContractions).toHaveLength(1);
      expect(durationOnlyContractions[0].startTime).toBe(5.0);
    });

    it('should correctly identify poor contractions', () => {
      const poorContractions = mockContractions.filter(c => 
        !c.isGood && !c.meetsMvc && !c.meetsDuration
      );
      expect(poorContractions).toHaveLength(1);
      expect(poorContractions[0].startTime).toBe(8.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty contraction array', () => {
      const result = filterContractions([], true, true);
      expect(result).toHaveLength(0);
    });

    it('should handle contractions with unusual flag combinations', () => {
      const edgeCase: ContractionArea = {
        startTime: 10.0,
        endTime: 11.0,
        isGood: true, // Marked as good
        meetsMvc: false, // But doesn't meet MVC
        meetsDuration: false, // And doesn't meet duration
        channel: 'CH1',
        maxAmplitude: 0.1,
        peakTime: 10.5
      };

      const result = filterContractions([edgeCase], true, false);
      expect(result).toHaveLength(1); // Should still show because isGood=true takes precedence
    });
  });

  describe('Regression Tests for Original Bug', () => {
    it('CRITICAL: Yellow contractions should be visible when showPoorContractions=false', () => {
      // This was the original bug - yellow contractions were hidden
      const yellowContractions = mockContractions.filter(c => 
        !c.isGood && ((c.meetsMvc && !c.meetsDuration) || (!c.meetsMvc && c.meetsDuration))
      );
      
      const result = filterContractions(yellowContractions, true, false);
      expect(result).toHaveLength(2); // Both yellow contractions should be visible
      expect(result.every(c => !c.isGood)).toBe(true); // All should be non-good
      expect(result.some(c => c.meetsMvc && !c.meetsDuration)).toBe(true); // MVC-only present
      expect(result.some(c => !c.meetsMvc && c.meetsDuration)).toBe(true); // Duration-only present
    });

    it('CRITICAL: Yellow contractions should be visible when showGoodContractions=false', () => {
      const yellowContractions = mockContractions.filter(c => 
        !c.isGood && ((c.meetsMvc && !c.meetsDuration) || (!c.meetsMvc && c.meetsDuration))
      );
      
      const result = filterContractions(yellowContractions, false, true);
      expect(result).toHaveLength(2); // Both yellow contractions should be visible
    });
  });
});

// Export the filtering function for integration testing
export { filterContractions };
export type { ContractionArea };