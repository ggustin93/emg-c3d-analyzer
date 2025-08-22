/**
 * Integration Tests for useEnhancedPerformanceMetrics with Single Source of Truth
 * 
 * Tests the integration between useEnhancedPerformanceMetrics and useScoringConfiguration
 * to ensure consistent scoring calculations using database weights.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { useEnhancedPerformanceMetrics } from '../useEnhancedPerformanceMetrics';
import { EMGAnalysisResult, ScoringWeights, SessionParameters } from '@/types/emg';

// Mock the scoring configuration hook
vi.mock('../useScoringConfiguration', () => ({
  useScoringConfiguration: vi.fn()
}));

// Mock the session store
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: vi.fn()
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

const mockUseScoringConfiguration = useScoringConfiguration as any;
const mockUseSessionStore = useSessionStore as any;

describe('useEnhancedPerformanceMetrics - Single Source of Truth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAnalysisResult: EMGAnalysisResult = {
    session_id: 'test-session-123',
    analytics: {
      'CH1 - Left Muscle': {
        mvc_threshold_actual_value: 100.0,
        contractions: [
          {
            start_time: 1.0,
            end_time: 3.5,
            duration_ms: 2500,
            max_amplitude: 85.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time: 5.0,
            end_time: 7.2,
            duration_ms: 2200,
            max_amplitude: 78.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time: 9.0,
            end_time: 10.8,
            duration_ms: 1800,
            max_amplitude: 65.0,
            meets_mvc: false,
            meets_duration: false
          }
        ]
      },
      'CH2 - Right Muscle': {
        mvc_threshold_actual_value: 95.0,
        contractions: [
          {
            start_time: 1.2,
            end_time: 3.8,
            duration_ms: 2600,
            max_amplitude: 90.0,
            meets_mvc: true,
            meets_duration: true
          },
          {
            start_time: 5.5,
            end_time: 7.5,
            duration_ms: 2000,
            max_amplitude: 72.0,
            meets_mvc: true,
            meets_duration: true
          }
        ]
      }
    },
    metadata: {
      score: 85,
      level: 3
    }
  };

  const mockSessionParams: SessionParameters = {
    session_expected_contractions: 6,
    session_expected_contractions_ch1: 3,
    session_expected_contractions_ch2: 3,
    session_mvc_threshold_percentage: 75,
    contraction_duration_threshold: 2000,
    post_session_rpe: 5,
    bfr_parameters: {
      is_compliant: true,
      left: { is_compliant: true },
      right: { is_compliant: true }
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
      // Mock scoring configuration hook as loading
      mockUseScoringConfiguration.mockReturnValue({
        weights: null,
        isLoading: true,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      mockUseSessionStore.mockReturnValue({
        sessionParams: mockSessionParams
      });

      const { result, rerender } = renderHook(() => useEnhancedPerformanceMetrics(mockAnalysisResult));

      // Should return null while weights are loading
      expect(result.current).toBeNull();

      // Update to loaded state
      mockUseScoringConfiguration.mockReturnValue({
        weights: databaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Trigger re-render to pick up the new mock values
      rerender();

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });
    });

    it('should fallback gracefully when database weights are unavailable', async () => {
      // Mock scoring configuration hook to return null weights (fallback scenario)
      mockUseScoringConfiguration.mockReturnValue({
        weights: null,
        isLoading: false,
        error: 'Database unavailable',
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Mock session store with override weights
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
        expect(result.current).not.toBeNull();
      });

      const performanceData = result.current!;

      // Should use session override weights when database unavailable
      expect(performanceData.weights.compliance).toBe(0.45);
      expect(performanceData.weights.symmetry).toBe(0.30);
    });
  });

  describe('Priority Order Validation', () => {
    it('should follow correct priority: database > session override > defaults', async () => {
      const customDatabaseWeights: ScoringWeights = {
        compliance: 0.35,
        symmetry: 0.35,
        effort: 0.20,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      // Mock database weights (highest priority)
      mockUseScoringConfiguration.mockReturnValue({
        weights: customDatabaseWeights,
        isLoading: false,
        error: null,
        refetchConfiguration: vi.fn(),
        saveCustomWeights: vi.fn()
      });

      // Mock session with different override weights (should be ignored)
      const sessionParamsWithOverride = {
        ...mockSessionParams,
        enhanced_scoring: {
          enabled: true,
          weights: {
            compliance: 0.50, // Different from database
            symmetry: 0.25,
            effort: 0.15,
            gameScore: 0.10
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

      // Should use database weights (priority 1), not session override (priority 2)
      expect(result.current!.weights).toEqual(customDatabaseWeights);
    });

    it('should use session override when database is unavailable', async () => {
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
        expect(result.current).not.toBeNull();
      });

      // Should use session override weights (priority 2)
      expect(result.current!.weights).toEqual(sessionOverrideWeights);
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
      expect(rightMuscle.components.completion.value).toBeCloseTo(66.7); // 2/3 * 100 ≈ 66.7%
      expect(rightMuscle.components.mvcQuality.value).toBeCloseTo(100); // 2/2 * 100 = 100%
      expect(rightMuscle.components.qualityThreshold.value).toBeCloseTo(100); // 2/2 * 100 = 100%

      // Symmetry should be calculated as per backend algorithm
      // S_symmetry = (1 - |left - right| / (left + right)) × 100
      const leftScore = leftMuscle.totalScore;
      const rightScore = rightMuscle.totalScore;
      const expectedSymmetry = (1 - Math.abs(leftScore - rightScore) / (leftScore + rightScore)) * 100;
      expect(performanceData.symmetryScore).toBeCloseTo(expectedSymmetry, 1);

      // Effort score should use RPE=5 → 100% (optimal range)
      expect(performanceData.effortScore).toBe(100);

      // BFR compliance should be 100 (compliant)
      expect(performanceData.complianceScore).toBe(100);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle scoring configuration errors gracefully', async () => {
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
        expect(result.current).not.toBeNull();
      });

      const performanceData = result.current!;

      // Should fall back to DEFAULT_SCORING_WEIGHTS (hardcoded in hook)
      expect(performanceData.weights.compliance).toBe(0.40);
      expect(performanceData.weights.symmetry).toBe(0.25);
      expect(performanceData.weights.effort).toBe(0.20);
      expect(performanceData.weights.gameScore).toBe(0.15);
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