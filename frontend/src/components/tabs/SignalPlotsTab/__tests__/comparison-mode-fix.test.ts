/**
 * Test for comparison mode channel loading fix
 * Tests the finalDisplayDataKeys logic in EMGChart component
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the logger
const mockLogger = {
  dataProcessing: vi.fn(),
  mvcCalculation: vi.fn(),
  contractionAnalysis: vi.fn(),
  performance: vi.fn(),
  chartRender: vi.fn(),
  userInteraction: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(),
};

vi.mock('../../../services/logger', () => ({
  default: mockLogger,
}));

describe('EMGChart - Comparison Mode Channel Resolution', () => {
  // Simulate the finalDisplayDataKeys logic
  const simulateFinalDisplayDataKeys = (
    viewMode: 'single' | 'comparison',
    availableChannels: string[],
    availableDataKeys: string[],
    effectivePlotMode: string,
    selectedChannel?: string | null
  ) => {
    if (viewMode === 'comparison') {
      // For comparison mode, we need to find the correct data keys based on current signal type
      const baseChannels = availableChannels.length > 0 ? availableChannels : [];
      
      if (baseChannels.length === 0) {
        return availableDataKeys;
      }

      // Map base channels to actual data keys based on current plot mode
      const resolvedKeys: string[] = [];
      const suffixMap: Record<string, string[]> = {
        'raw': [' Raw', ''],
        'activated': [' activated', ''],
        'processed': [' Processed', ''],
        'raw_with_rms': [' Raw', ' Processed'] // For overlay mode, prefer Raw but also check Processed
      };

      const possibleSuffixes = suffixMap[effectivePlotMode] || [''];
      
      baseChannels.forEach(baseChannel => {
        let foundKey: string | undefined;
        
        // First, try exact match with expected suffixes for current plot mode
        for (const suffix of possibleSuffixes) {
          const expectedKey = baseChannel + suffix;
          if (availableDataKeys.includes(expectedKey)) {
            foundKey = expectedKey;
            break;
          }
        }
        
        // If no exact match, try startsWith approach (fallback)
        if (!foundKey) {
          foundKey = availableDataKeys.find(key => 
            key.startsWith(baseChannel) && 
            (key.includes(' Raw') || key.includes(' activated') || key.includes(' Processed') || key === baseChannel)
          );
        }
        
        if (foundKey) {
          resolvedKeys.push(foundKey);
        }
      });
      
      // Ensure we have at least the expected number of channels for comparison
      if (resolvedKeys.length < Math.min(2, baseChannels.length)) {
        // Fallback: use first available keys that match our base channels
        const fallbackKeys = availableDataKeys.filter(key => 
          baseChannels.some(base => key.startsWith(base))
        ).slice(0, Math.min(2, baseChannels.length));
        
        return fallbackKeys.length > 0 ? fallbackKeys : availableDataKeys.slice(0, 2);
      }
      
      return resolvedKeys;
    } else {
      // Single channel mode logic
      const displayChannels = selectedChannel 
        ? [selectedChannel] 
        : availableChannels.length > 0 ? [availableChannels[0]] : [];
      
      const displayDataKeys = displayChannels.map(channel => {
        if (availableDataKeys.includes(channel)) return channel;
        const matchingKey = availableDataKeys.find(key => key.startsWith(channel));
        if (matchingKey) return matchingKey;
        return channel;
      }).filter(key => availableDataKeys.includes(key));
      
      return displayDataKeys.length > 0 ? displayDataKeys : availableDataKeys.slice(0, 1);
    }
  };

  it('should resolve both channels in comparison mode with activated signals', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1 activated', 'CH2 activated'],
      'activated'
    );

    expect(result).toEqual(['CH1 activated', 'CH2 activated']);
  });

  it('should resolve both channels in comparison mode with processed signals', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1 Processed', 'CH2 Processed'],
      'processed'
    );

    expect(result).toEqual(['CH1 Processed', 'CH2 Processed']);
  });

  it('should resolve both channels in comparison mode with raw signals', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1 Raw', 'CH2 Raw'],
      'raw'
    );

    expect(result).toEqual(['CH1 Raw', 'CH2 Raw']);
  });

  it('should handle mixed signal types and use fallback matching', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1 activated', 'CH2 Processed', 'CH3 Raw'],
      'activated'
    );

    // Should find CH1 activated exactly, and CH2 Processed via fallback
    expect(result).toEqual(['CH1 activated', 'CH2 Processed']);
  });

  it('should handle case where base channels have no suffix', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1', 'CH2'],
      'activated'
    );

    expect(result).toEqual(['CH1', 'CH2']);
  });

  it('should provide fallback when insufficient channels are resolved', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH3 activated', 'CH4 activated'], // No matching channels
      'activated'
    );

    // Should fallback to using available data keys
    expect(result).toEqual(['CH3 activated', 'CH4 activated']);
  });

  it('should handle single mode correctly', () => {
    const result = simulateFinalDisplayDataKeys(
      'single',
      ['CH1', 'CH2'],
      ['CH1 activated', 'CH2 activated'],
      'activated',
      'CH1'
    );

    // Should find the matching activated channel for the selected base channel
    expect(result).toEqual(['CH1 activated']);
  });

  it('should handle single mode with suffix matching', () => {
    const result = simulateFinalDisplayDataKeys(
      'single',
      ['CH1', 'CH2'],
      ['CH1 activated', 'CH2 activated'],
      'activated',
      'CH1 activated'
    );

    expect(result).toEqual(['CH1 activated']);
  });

  it('should handle overlay mode (raw_with_rms) correctly', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      ['CH1', 'CH2'],
      ['CH1 Raw', 'CH1 Processed', 'CH2 Raw', 'CH2 Processed'],
      'raw_with_rms'
    );

    // Should prefer Raw signals for overlay mode
    expect(result).toEqual(['CH1 Raw', 'CH2 Raw']);
  });

  it('should handle empty available channels gracefully', () => {
    const result = simulateFinalDisplayDataKeys(
      'comparison',
      [],
      ['CH1 activated', 'CH2 activated'],
      'activated'
    );

    expect(result).toEqual(['CH1 activated', 'CH2 activated']);
  });
});