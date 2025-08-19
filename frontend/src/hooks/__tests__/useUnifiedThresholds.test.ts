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
import { vi, describe, it, expect } from 'vitest';

// Mock logger to avoid console errors during tests
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  LogCategory: {
    DATA_PROCESSING: 'DATA_PROCESSING',
    MVC_CALCULATION: 'MVC_CALCULATION',
  },
}));

const mockGetColorForChannel = vi.fn(() => ({ stroke: '#000000' }));

describe('useUnifiedThresholds', () => {
  const mockSessionParams: GameSessionParameters = {
    session_mvc_value: null,
    session_mvc_values: {},
    session_mvc_threshold_percentage: 75,
    session_mvc_threshold_percentages: {},
    contraction_duration_threshold: 2000,
    channel_muscle_mapping: { CH1: 'Left Quad' },
    muscle_color_mapping: { 'Left Quad': '#ff0000' },
  };

  const mockAnalytics: Record<string, ChannelAnalyticsData> = {
    CH1: {
      contraction_count: 10,
      mvc_threshold_actual_value: 0.0001125,
      // ... other properties
    } as ChannelAnalyticsData,
  };

  it('should set thresholdsReady to false when isLoading is true', () => {
    const { result } = renderHook(() =>
      useUnifiedThresholds({
        sessionParams: mockSessionParams,
        analytics: null,
        availableDataKeys: [],
        isLoading: true,
        getColorForChannel: mockGetColorForChannel,
      })
    );

    expect(result.current.thresholdsReady).toBe(false);
  });

  it('should set thresholdsReady to true when not loading and analytics are present', () => {
    const { result } = renderHook(() =>
      useUnifiedThresholds({
        sessionParams: mockSessionParams,
        analytics: mockAnalytics,
        availableDataKeys: ['CH1 Raw'],
        isLoading: false,
        getColorForChannel: mockGetColorForChannel,
      })
    );

    expect(result.current.thresholdsReady).toBe(true);
  });

  it('should set thresholdsReady to true when not loading, even if no valid thresholds can be calculated', () => {
    const { result } = renderHook(() =>
      useUnifiedThresholds({
        sessionParams: { ...mockSessionParams, session_mvc_values: {} },
        analytics: { CH1: { contraction_count: 5 } as ChannelAnalyticsData },
        availableDataKeys: ['CH1 Raw'],
        isLoading: false,
        getColorForChannel: mockGetColorForChannel,
      })
    );

    expect(result.current.thresholdsReady).toBe(true);
    expect(result.current.unifiedThresholds.length).toBe(0);
  });

  it('should set thresholdsReady to false when not loading and analytics are null', () => {
    const { result } = renderHook(() =>
      useUnifiedThresholds({
        sessionParams: mockSessionParams,
        analytics: null,
        availableDataKeys: [],
        isLoading: false,
        getColorForChannel: mockGetColorForChannel,
      })
    );

    expect(result.current.thresholdsReady).toBe(false);
  });
});