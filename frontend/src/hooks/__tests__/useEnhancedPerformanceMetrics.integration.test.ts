/**
 * Integration Tests for useEnhancedPerformanceMetrics with Single Source of Truth
 * 
 * Tests the integration between useEnhancedPerformanceMetrics and useScoringConfiguration
 * to ensure consistent scoring calculations using database weights.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { useEnhancedPerformanceMetrics } from '../useEnhancedPerformanceMetrics';
import { EMGAnalysisResult, ScoringWeights, GameSessionParameters } from '@/types/emg';

// Mock the scoring configuration hook
vi.mock('../useScoringConfiguration', () => ({
  useScoringConfiguration: vi.fn()
}));

// Mock the session store
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: vi.fn()
}));

// Mock the backend defaults hook
vi.mock('../useBackendDefaults', () => ({
  useBackendDefaults: vi.fn()
}));

// Mock effort score calculation
vi.mock('@/lib/effortScore', () => ({
  getEffortScoreFromRPE: vi.fn((rpe: number | null | undefined) => {
    if (rpe === null || rpe === undefined) return 50; // Default
    if ([4, 5, 6].includes(rpe)) return 100; // Optimal
    if ([3, 7].includes(rpe)) return 80;     // Acceptable
    if ([2, 8].includes(rpe)) return 60;     // Suboptimal
    return 20; // Poor
  })
}));

// Import the mocked functions after mocking
import { useScoringConfiguration } from '../useScoringConfiguration';
import { useSessionStore } from '@/store/sessionStore';
import { useBackendDefaults } from '../useBackendDefaults';

const mockUseScoringConfiguration = useScoringConfiguration as any;
const mockUseSessionStore = useSessionStore as any;
const mockUseBackendDefaults = useBackendDefaults as any;

describe('useEnhancedPerformanceMetrics - Single Source of Truth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for backend defaults (no scoring_weights anymore)
    mockUseBackendDefaults.mockReturnValue({
      defaults: {
        target_contractions_ch1: 3,
        target_contractions_ch2: 3,
        mvc_threshold_percentage: 75,
        therapeutic_duration_threshold_ms: 2000
      },
      loading: false,
      error: null
    });
  });

  const mockAnalysisResult: EMGAnalysisResult = {
    file_id: 'test-file-456',
    timestamp: '2024-01-01T12:00:00Z',
    source_filename: 'test-session.c3d',
    available_channels: ['CH1 - Left Muscle', 'CH2 - Right Muscle'],
    emg_signals: {
      'CH1 - Left Muscle': {
        sampling_rate: 1000,
        time_axis: [],
        data: []
      },
      'CH2 - Right Muscle': {
        sampling_rate: 1000,
        time_axis: [],
        data: []
      }
    },
    session_id: 'test-session-123',
    analytics: {
      'CH1 - Left Muscle': {
        contraction_count: 3,
        avg_duration_ms: 2166.67,
        min_duration_ms: 1800,
        max_duration_ms: 2500,
        total_time_under_tension_ms: 6500,
        avg_amplitude: 73.0,
        max_amplitude: 85.0,
        rms: 0.0,
        mav: 0.0,
        mpf: 0.0,
        mdf: 0.0,
        fatigue_index_fi_nsm5: 0.0,
        mvc75_threshold: 100.0,
        contractions: [
          {
            start_time_ms: 1000,
            end_time_ms: 3500,
            duration_ms: 2500,
            mean_amplitude: 80.0,
            max_amplitude: 85.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time_ms: 5000,
            end_time_ms: 7200,
            duration_ms: 2200,
            mean_amplitude: 74.0,
            max_amplitude: 78.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time_ms: 9000,
            end_time_ms: 10800,
            duration_ms: 1800,
            mean_amplitude: 60.0,
            max_amplitude: 65.0,
            meets_mvc: false,
            meets_duration: false
          }
        ]
      },
      'CH2 - Right Muscle': {
        contraction_count: 2,
        avg_duration_ms: 2300.0,
        min_duration_ms: 2000,
        max_duration_ms: 2600,
        total_time_under_tension_ms: 4600,
        avg_amplitude: 76.5,
        max_amplitude: 90.0,
        rms: 0.0,
        mav: 0.0,
        mpf: 0.0,
        mdf: 0.0,
        fatigue_index_fi_nsm5: 0.0,
        mvc75_threshold: 95.0,
        contractions: [
          {
            start_time_ms: 1200,
            end_time_ms: 3800,
            duration_ms: 2600,
            mean_amplitude: 85.0,
            max_amplitude: 90.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time_ms: 5500,
            end_time_ms: 7500,
            duration_ms: 2000,
            mean_amplitude: 68.0,
            max_amplitude: 72.0,
            meets_mvc: true,
            meets_duration: true
          }
        ]
      }
    },
    metadata: {
      game_title: 'GHOSTLY+',
      game_type: 'rehabilitation',
      game_version: '1.0',
      session_date: '2024-01-01',
      session_duration: 180,
      score: 85,
      level: "3",
      session_notes: 'Test session for integration testing'
    }
  };

  const mockSessionParams: GameSessionParameters = {
    channel_muscle_mapping: {
      'CH1': 'Left Quadriceps',
      'CH2': 'Right Quadriceps'
    },
    muscle_color_mapping: {
      'Left Quadriceps': '#3b82f6',
      'Right Quadriceps': '#ef4444'
    },
    session_expected_contractions: 6,
    session_expected_contractions_ch1: 3,
    session_expected_contractions_ch2: 3,
    session_mvc_threshold_percentage: 75,
    contraction_duration_threshold: 2000,
    post_session_rpe: 5,
    bfr_parameters: {
      left: {
        aop_measured: 180,
        applied_pressure: 90,
        percentage_aop: 50,
        is_compliant: true,
        therapeutic_range_min: 40,
        therapeutic_range_max: 60,
        application_time_minutes: 15
      },
      right: {
        aop_measured: 175,
        applied_pressure: 88,
        percentage_aop: 50,
        is_compliant: true,
        therapeutic_range_min: 40,
        therapeutic_range_max: 60,
        application_time_minutes: 15
      }
    }
  };

  const databaseWeights: ScoringWeights = {
    compliance: 0.40,
    symmetry: 0.25,
    effort: 0.20,
    gameScore: 0.15,
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334,
  };

  describe('Database Weights Integration', () => {
    it('should use database weights as primary source', async () => {
      // Mock scoring configuration hook to return database weights
      mockUseScoringConfiguration.mockReturnValue({
        weights: databaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Mock session store
      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      const performanceData = result.current!;

      // Verify that database weights are used
      expect(performanceData.weights).toEqual(databaseWeights);

      // Verify scoring calculations use database weights
      // Left muscle: 3 contractions, 3 expected, 2 good MVC, 2 good duration
      // Completion: 100% (3/3), Intensity: 67% (2/3), Duration: 67% (2/3)
      // Compliance = (0.333 * 1.0 + 0.333 * 0.67 + 0.334 * 0.67) = 0.779 ≈ 78%

      expect(performanceData.leftMuscle.components.completion.value).toBeCloseTo(100);
      expect(performanceData.leftMuscle.components.mvcQuality.value).toBeCloseTo(66.7, 1);
      expect(performanceData.leftMuscle.components.qualityThreshold.value).toBeCloseTo(66.7, 1);
    });

    it('should wait for weights loading before calculating metrics', async () => {
      // Use dynamic mock implementation that can change during test
      let mockWeights: ScoringWeights | null = null;
      let mockIsLoading = true;
      
      const mockRefetch = vi.fn();
      const mockSave = vi.fn();
      
      mockUseScoringConfiguration.mockImplementation(() => ({
        weights: mockWeights,
        isLoading: mockIsLoading,
        error: null,
        refetchConfiguration: mockRefetch,
        saveCustomWeights: mockSave
      }));

      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result, rerender } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      // Should return null while weights are loading
      expect(result.current).toBeNull();

      // Simulate weights loading completion
      mockWeights = databaseWeights;
      mockIsLoading = false;

      // Trigger re-render to pick up the new mock state
      rerender();

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      }, { timeout: 5000 });
    });

    it('should return null when database weights are unavailable (SSoT)', async () => {
      // Mock scoring configuration hook to return null weights (database unavailable)
      mockUseScoringConfiguration.mockReturnValue({
        weights: null,
        isLoading: false,
        error: 'Database unavailable',
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Mock session store with override weights (these won't be used due to SSoT)
      const sessionParamsWithOverride = {
        ...mockSessionParams,
        enhanced_scoring: {
          enabled: true,
          weights: {
            compliance: 0.45,
            symmetry: 0.30,
            effort: 0.25,
            gameScore: 0.00,
            compliance_completion: 0.333,
            compliance_intensity: 0.333,
            compliance_duration: 0.334,
          }
        }
      };

      mockUseSessionStore.mockReturnValue({
        sessionParams: sessionParamsWithOverride
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        // Should return null when database weights unavailable (Single Source of Truth)
        expect(result.current).toBeNull();
      });
    });
  });

  describe('Priority Order Validation', () => {
    it('should follow correct priority: database > defaults, with session for simulation', async () => {
      const customDatabaseWeights: ScoringWeights = {
        compliance: 0.35,
        symmetry: 0.35,
        effort: 0.20,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      // Mock database weights (highest priority for base values)
      mockUseScoringConfiguration.mockReturnValue({
        weights: customDatabaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Mock session with simulation weights (used for UI display only)
      const sessionParamsWithOverride = {
        ...mockSessionParams,
        enhanced_scoring: {
          enabled: true,
          weights: {
            compliance: 0.50, // Simulation weight for UI
            symmetry: 0.25,
            effort: 0.15,
            gameScore: 0.10,
            compliance_completion: 0.333,
            compliance_intensity: 0.333,
            compliance_duration: 0.334
          }
        }
      };

      mockUseSessionStore.mockReturnValue({
        sessionParams: sessionParamsWithOverride
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should use session weights for simulation (UI display)
      expect(result.current!.weights).toEqual(sessionParamsWithOverride.enhanced_scoring.weights);
    });

    it('should return null when database is unavailable (no fallback per SSoT)', async () => {
      // Mock no database weights
      mockUseScoringConfiguration.mockReturnValue({
        weights: null,
        isLoading: false,
        error: 'No configuration found',
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      const sessionOverrideWeights = {
        compliance: 0.50,
        symmetry: 0.25,
        effort: 0.15,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      const sessionParamsWithOverride = {
        ...mockSessionParams,
        enhanced_scoring: {
          enabled: true,
          weights: sessionOverrideWeights
        }
      };

      mockUseSessionStore.mockReturnValue({
        sessionParams: sessionParamsWithOverride
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        // Should return null when database unavailable (Single Source of Truth - no fallback)
        expect(result.current).toBeNull();
      });
    });
  });

  describe('Therapist/Patient Specific Weights', () => {
    it('should integrate with therapist-specific weights from database', async () => {
      const therapistWeights: ScoringWeights = {
        compliance: 0.50, // Therapist prefers higher compliance weight
        symmetry: 0.20,
        effort: 0.20,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      // Mock therapist-specific configuration
      mockUseScoringConfiguration.mockReturnValue({
        weights: therapistWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      const performanceData = result.current!;

      // Should use therapist-specific weights
      expect(performanceData.weights).toEqual(therapistWeights);

      // Overall score should reflect higher compliance weighting
      // With compliance having 50% weight instead of 40%, the overall score should be different
      expect(performanceData.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Consistency with Backend Calculations', () => {
    it('should produce results consistent with backend performance_scoring_service.py', async () => {
      // Use exact metricsDefinitions.md weights for consistency test
      const metricsDefinitionWeights: ScoringWeights = {
        compliance: 0.40,    // 40% - matches backend ScoringWeights default
        symmetry: 0.25,      // 25% - matches backend ScoringWeights default
        effort: 0.20,        // 20% - matches backend ScoringWeights default
        gameScore: 0.15,     // 15% - matches backend ScoringWeights default
        compliance_completion: 0.333,  // matches backend ScoringWeights default
        compliance_intensity: 0.333,   // matches backend ScoringWeights default
        compliance_duration: 0.334,    // matches backend ScoringWeights default
      };

      mockUseScoringConfiguration.mockReturnValue({
        weights: metricsDefinitionWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      const performanceData = result.current!;

      // Verify weight consistency
      expect(performanceData.weights).toEqual(metricsDefinitionWeights);

      // Verify calculation consistency with backend algorithm
      // Left muscle: 3 total, 3 expected, 2 MVC-compliant, 2 duration-compliant
      const leftMuscle = performanceData.leftMuscle;
      expect(leftMuscle.components.completion.value).toBeCloseTo(100); // 3/3 * 100 = 100%
      expect(leftMuscle.components.mvcQuality.value).toBeCloseTo(66.67, 0); // 2/3 * 100 ≈ 66.67%
      expect(leftMuscle.components.qualityThreshold.value).toBeCloseTo(66.67, 0); // 2/3 * 100 ≈ 66.67%

      // Right muscle: 2 total, 3 expected, 2 MVC-compliant, 2 duration-compliant
      const rightMuscle = performanceData.rightMuscle;
      expect(rightMuscle.components.completion.value).toBeCloseTo(66.67, 1); // 2/3 * 100 ≈ 66.67%
      expect(rightMuscle.components.mvcQuality.value).toBeCloseTo(100); // 2/2 * 100 = 100%
      expect(rightMuscle.components.qualityThreshold.value).toBeCloseTo(100); // 2/2 * 100 = 100%

      // Symmetry should be calculated as per backend algorithm
      // S_symmetry = (1 - |left - right| / (left + right)) × 100
      const leftScore = leftMuscle.totalScore;
      const rightScore = rightMuscle.totalScore;
      const expectedSymmetry = (1 - Math.abs(leftScore - rightScore) / (leftScore + rightScore)) * 100;
      expect(performanceData.symmetryScore).toBeCloseTo(expectedSymmetry, 0); // Allow for rounding differences between frontend/backend

      // Effort score should use RPE=5 → 100% (optimal range)
      expect(performanceData.effortScore).toBe(100);

      // BFR compliance should be 100 (compliant)
      expect(performanceData.complianceScore).toBe(100);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle scoring configuration errors gracefully (returns null per SSoT)', async () => {
      // Mock configuration hook with error
      mockUseScoringConfiguration.mockReturnValue({
        weights: null,
        isLoading: false,
        error: 'Database connection failed',
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // No session override available
      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      await waitFor(() => {
        // Should return null when configuration errors occur (Single Source of Truth - no fallback)
        expect(result.current).toBeNull();
      });
    });

    it('should handle missing session parameters', async () => {
      mockUseScoringConfiguration.mockReturnValue({
        weights: databaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Missing session params
      mockUseSessionStore.mockReturnValue({
        sessionParams: null
      });

      const { result } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      // Should return null when session params are missing
      expect(result.current).toBeNull();
    });
  });

  describe('Performance and Optimization', () => {
    it('should memoize results properly when inputs do not change', async () => {
      const mockRefetch = vi.fn();
      
      mockUseScoringConfiguration.mockReturnValue({
        weights: databaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: mockRefetch,
        saveCustomWeights: vi.fn()
      });

      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result, rerender } = renderHook(() => 
        useEnhancedPerformanceMetrics(mockAnalysisResult)
      );

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      const firstResult = result.current;

      // Re-render with same inputs
      rerender();

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should return same object reference (memoized)
      expect(result.current).toBe(firstResult);
    });
  });
});