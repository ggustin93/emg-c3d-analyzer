/**
 * Professional test suite for useUnifiedThresholds hook
 * Validates signal-agnostic threshold consolidation and MVC zero-value handling
 * 
 * Author: Senior Software Engineer (20+ years experience)
 * Created: 2025-01-18
 */

import { renderHook } from '@testing-library/react';
import { useUnifiedThresholds } from '../useUnifiedThresholds';
import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { describe, it, expect, vi } from 'vitest';

// Mock the logger import
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  LogCategory: {
    DATA_PROCESSING: 'data-processing',
    MVC_CALCULATION: 'mvc-calculation'
  }
}));

describe('useUnifiedThresholds Hook - Professional Implementation', () => {
  const mockGetColorForChannel = (baseChannel: string) => ({
    stroke: baseChannel === 'CH1' ? '#3b82f6' : '#ef4444'
  });

  const createSessionParams = (overrides: Partial<GameSessionParameters> = {}): GameSessionParameters => ({
    session_mvc_value: 0.00015,
    session_mvc_threshold_percentage: 75,
    contraction_duration_threshold: 2000,
    channel_muscle_mapping: {
      'CH1': 'Left Quadriceps',
      'CH2': 'Right Quadriceps'
    },
    muscle_color_mapping: {
      'Left Quadriceps': '#3b82f6',
      'Right Quadriceps': '#ef4444'
    },
    session_mvc_values: {},
    session_mvc_threshold_percentages: {},
    ...overrides
  });

  describe('Signal-Agnostic Threshold Consolidation', () => {
    it('should consolidate thresholds from multiple signal types into single entries', () => {
      const sessionParams = createSessionParams({
        session_mvc_values: {
          'CH1': 0.0002,
          'CH2': 0.0003
        }
      });

      const availableDataKeys = ['CH1 Raw', 'CH1 Activated', 'CH1 Processed', 'CH2 Raw', 'CH2 Activated'];

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys,
          getColorForChannel: mockGetColorForChannel
        })
      );

      // Should have only 2 threshold entries (one per base channel)
      expect(result.current.unifiedThresholds).toHaveLength(2);
      
      // Should contain correct base channels
      const channels = result.current.unifiedThresholds.map(t => t.channel);
      expect(channels).toContain('CH1');
      expect(channels).toContain('CH2');
      
      // Should not contain duplicates
      expect(new Set(channels).size).toBe(2);
    });

    it('should extract base channels correctly from signal suffixes', () => {
      const sessionParams = createSessionParams();
      const availableDataKeys = ['CH1 Raw (C3D)', 'CH1 Activated', 'CH2 Processed', 'CH3 RMS'];

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys,
          getColorForChannel: mockGetColorForChannel
        })
      );

      const channels = result.current.unifiedThresholds.map(t => t.channel);
      expect(channels).toContain('CH1');
      expect(channels).toContain('CH2');
      expect(channels).toContain('CH3');
    });
  });

  describe('MVC Zero-Value Fallback Hierarchy', () => {
    it('should use per-muscle session MVC when available and > clinical minimum', () => {
      const sessionParams = createSessionParams({
        session_mvc_values: {
          'CH1': 0.08, // Above clinical minimum
          'CH2': 0.001  // Below clinical minimum - should be ignored
        }
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw', 'CH2 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const ch1Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH1');
      const ch2Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH2');

      // CH1 should use per-muscle value
      expect(ch1Threshold?.mvcBaseValue).toBe(0.08);
      expect(ch1Threshold?.source).toBe('session_per_muscle');

      // CH2 should fall back to global (or no threshold if global not available)
      expect(ch2Threshold).toBeFalsy(); // No valid fallback in this case
    });

    it('should use analytics MVC threshold when available', () => {
      const sessionParams = createSessionParams();
      const analytics: Record<string, ChannelAnalyticsData> = {
        'CH1': {
          mvc_threshold_actual_value: 0.06, // Backend-calculated threshold
          contraction_count: 10,
          avg_duration_ms: 2500,
          min_duration_ms: 1000,
          max_duration_ms: 4000,
          total_time_under_tension_ms: 25000,
          avg_amplitude: 0.0005,
          max_amplitude: 0.001,
          rms: 0.0003,
          mav: 0.0004,
          mpf: 65,
          mdf: 80,
          fatigue_index_fi_nsm5: 0.15
        }
      };

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          analytics,
          availableDataKeys: ['CH1 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const ch1Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH1');
      
      expect(ch1Threshold?.mvcThreshold).toBe(0.06); // Direct from analytics
      expect(ch1Threshold?.mvcBaseValue).toBe(0.06 / 0.75); // Reverse-calculated base
      expect(ch1Threshold?.source).toBe('analytics');
      expect(ch1Threshold?.confidence).toBe(0.7);
    });

    it('should use global session MVC as fallback', () => {
      const sessionParams = createSessionParams({
        session_mvc_value: 0.00020, // Global MVC
        session_mvc_threshold_percentage: 80
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw', 'CH2 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const ch1Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH1');
      
      expect(ch1Threshold?.mvcBaseValue).toBe(0.00020);
      expect(ch1Threshold?.mvcThreshold).toBe(0.00020 * 0.8); // 80% threshold
      expect(ch1Threshold?.source).toBe('session_global');
      expect(ch1Threshold?.confidence).toBe(0.4); // Lower confidence for global values
    });

    it('should use external global threshold as final fallback', () => {
      const sessionParams = createSessionParams(); // No MVC values
      const globalMvcThreshold = 0.00012;

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          globalMvcThreshold,
          availableDataKeys: ['CH1 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const ch1Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH1');
      
      expect(ch1Threshold?.mvcThreshold).toBe(0.00012);
      expect(ch1Threshold?.source).toBe('global_fallback');
      expect(ch1Threshold?.confidence).toBe(0.2); // Lowest confidence for fallback
    });
  });

  describe('Getter Functions', () => {
    it('should return correct MVC threshold for signal-agnostic lookup', () => {
      const sessionParams = createSessionParams({
        session_mvc_values: {
          'CH1': 0.0002
        }
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw', 'CH1 Activated'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      // Should return same threshold regardless of signal type suffix
      const threshold1 = result.current.getMvcThreshold('CH1 Raw');
      const threshold2 = result.current.getMvcThreshold('CH1 Activated');
      const threshold3 = result.current.getMvcThreshold('CH1 Processed');

      expect(threshold1).toBe(threshold2);
      expect(threshold2).toBe(threshold3);
      expect(threshold1).toBe(0.0002 * 0.75); // 75% of base MVC
    });

    it('should return correct duration threshold with fallbacks', () => {
      const sessionParams = createSessionParams({
        contraction_duration_threshold: 2500
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const duration = result.current.getDurationThreshold('CH1 Raw');
      expect(duration).toBe(2500);
    });

    it('should return correct muscle name with mapping', () => {
      const sessionParams = createSessionParams();

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw'],
          channelMuscleMapping: { 'CH1': 'Left Quadriceps' },
          getColorForChannel: mockGetColorForChannel
        })
      );

      const muscleName = result.current.getMuscleName('CH1 Raw');
      expect(muscleName).toBe('Left Quadriceps');
    });
  });

  describe('Professional State Management', () => {
    it('should have stable references for memoized functions', () => {
      const sessionParams = createSessionParams();
      
      const { result, rerender } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      const initialGetMvcThreshold = result.current.getMvcThreshold;
      const initialGetDurationThreshold = result.current.getDurationThreshold;

      // Rerender with same props
      rerender();

      expect(result.current.getMvcThreshold).toBe(initialGetMvcThreshold);
      expect(result.current.getDurationThreshold).toBe(initialGetDurationThreshold);
    });

    it('should indicate when valid thresholds are available', () => {
      const sessionParamsWithMvc = createSessionParams({
        session_mvc_values: { 'CH1': 0.0002 }
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams: sessionParamsWithMvc,
          availableDataKeys: ['CH1 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      expect(result.current.hasValidThresholds).toBe(true);
    });

    it('should handle empty available data keys gracefully', () => {
      const sessionParams = createSessionParams();

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: [],
          getColorForChannel: mockGetColorForChannel
        })
      );

      expect(result.current.unifiedThresholds).toHaveLength(0);
      expect(result.current.hasValidThresholds).toBe(false);
    });
  });

  describe('Clinical Validation', () => {
    it('should respect clinical minimum thresholds (0.01V)', () => {
      const sessionParams = createSessionParams({
        session_mvc_values: {
          'CH1': 0.001, // Below clinical minimum
          'CH2': 0.05   // Above clinical minimum
        }
      });

      const { result } = renderHook(() =>
        useUnifiedThresholds({
          sessionParams,
          availableDataKeys: ['CH1 Raw', 'CH2 Raw'],
          getColorForChannel: mockGetColorForChannel
        })
      );

      // Only CH2 should have a valid threshold (CH1 below clinical minimum)
      expect(result.current.unifiedThresholds).toHaveLength(1);
      
      const ch2Threshold = result.current.unifiedThresholds.find(t => t.channel === 'CH2');
      expect(ch2Threshold?.mvcBaseValue).toBe(0.05);
    });
  });
});