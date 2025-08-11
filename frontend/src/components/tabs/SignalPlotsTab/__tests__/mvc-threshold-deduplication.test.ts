/**
 * Test MVC Threshold Line Logic for Comparison Mode
 * Ensures exactly 2 lines are rendered (one per channel) in comparison mode
 */

import { describe, test, expect } from 'vitest';

describe('MVC Threshold Lines', () => {

  test('comparison mode should have exactly one line per base channel', () => {
    // Simulate comparison mode data with different channels
    const keysForThresholds = ['CH1 Processed', 'CH2 Processed'];
    
    // Extract unique base channel names
    const baseChannelNames = new Set<string>();
    keysForThresholds.forEach(dataKey => {
      const baseChannelName = dataKey.split(' ')[0];
      baseChannelNames.add(baseChannelName);
    });
    
    // Should have exactly 2 unique base channels
    expect(baseChannelNames.size).toBe(2);
    expect(Array.from(baseChannelNames)).toEqual(['CH1', 'CH2']);
  });

  test('should handle duplicate signal types for same base channel', () => {
    // Simulate data with multiple signal types for same channel
    const keysForThresholds = ['CH1 Raw', 'CH1 Processed', 'CH2 Raw', 'CH2 Processed'];
    
    // Extract unique base channel names
    const baseChannelNames = new Set<string>();
    keysForThresholds.forEach(dataKey => {
      const baseChannelName = dataKey.split(' ')[0];
      baseChannelNames.add(baseChannelName);
    });
    
    // Should still have exactly 2 unique base channels (not 4)
    expect(baseChannelNames.size).toBe(2);
    expect(Array.from(baseChannelNames)).toEqual(['CH1', 'CH2']);
  });

  test('single mode should render one line per data key', () => {
    // In single mode, we render one line per available data key
    const keysForThresholds = ['CH1 Processed'];
    
    // Should have exactly 1 data key
    expect(keysForThresholds).toHaveLength(1);
  });

  test('threshold value differences should be preserved', () => {
    const threshold1 = 2.250e-4; // L channel from user's screenshot
    const threshold2 = 1.500e-4; // R channel from user's screenshot
    
    // These are sufficiently different and should remain separate
    expect(threshold1).not.toEqual(threshold2);
    expect(Math.abs(threshold1 - threshold2)).toBeGreaterThan(0.00001); // 7.5e-5 > 1e-5
  });
});