/**
 * Tests for useScoringConfiguration Hook
 * 
 * Tests the single source of truth implementation for scoring weights
 * with database integration and fallback handling.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { useScoringConfiguration } from '../useScoringConfiguration';
import { ScoringWeights } from '@/types/emg';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('useScoringConfiguration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockConsoleInfo.mockClear();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockActiveConfigurationResponse = {
    id: 'config-123',
    configuration_name: 'Test Configuration',
    description: 'Test description',
    weight_compliance: 0.40,
    weight_symmetry: 0.25,
    weight_effort: 0.20,
    weight_game: 0.15,
    weight_completion: 0.333,
    weight_intensity: 0.333,
    weight_duration: 0.334,
    active: true,
    created_at: '2025-08-22T10:00:00Z',
    updated_at: '2025-08-22T10:00:00Z'
  };

  const expectedFallbackWeights: ScoringWeights = {
    compliance: 0.50,        // 50% - Therapeutic Compliance
    symmetry: 0.20,         // 20% - Muscle Symmetry  
    effort: 0.30,           // 30% - Subjective Effort (RPE)
    gameScore: 0.00,        // 0% - Game Performance (default to zero as requested)
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334,
  };

  describe('Database Integration (Global Configuration)', () => {
    it('should fetch active configuration from database successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveConfigurationResponse
      });

      const { result } = renderHook(() => useScoringConfiguration());

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.weights).toBe(null);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have loaded weights from database
      expect(result.current.weights).toEqual({
        compliance: 0.40,
        symmetry: 0.25,
        effort: 0.20,
        gameScore: 0.15,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      });

      expect(result.current.error).toBe(null);
      expect(mockFetch).toHaveBeenCalledWith('/api/scoring/configurations/active');
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Successfully loaded scoring configuration from database:',
        expect.objectContaining({
          configName: 'Test Configuration',
          configSource: 'global'
        })
      );
    });

    it('should use fallback weights when no active configuration found (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights).toEqual(expectedFallbackWeights);
      expect(result.current.error).toBe(null);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'No scoring configuration found in database, using fallback weights from metricsDefinitions.md'
      );
    });

    it('should use fallback weights on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights).toEqual(expectedFallbackWeights);
      expect(result.current.error).toBe('Network error');
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to fetch scoring configuration:',
        'Network error'
      );
    });
  });

  describe('Therapist/Patient Specific Configuration', () => {
    it('should fetch therapist-specific configuration', async () => {
      const therapistConfig = {
        ...mockActiveConfigurationResponse,
        id: 'therapist-config-123',
        configuration_name: 'Dr. Smith Custom Config',
        therapist_id: 'therapist-123',
        patient_id: null,
        weight_compliance: 0.45,
        weight_symmetry: 0.30,
        weight_effort: 0.15,
        weight_game: 0.10
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => therapistConfig
      });

      const { result } = renderHook(() => useScoringConfiguration('therapist-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights).toEqual({
        compliance: 0.45,
        symmetry: 0.30,
        effort: 0.15,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/scoring/configurations/custom?therapist_id=therapist-123'
      );
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Successfully loaded scoring configuration from database:',
        expect.objectContaining({
          configSource: 'therapist-specific'
        })
      );
    });

    it('should fetch therapist+patient specific configuration with priority', async () => {
      const patientConfig = {
        ...mockActiveConfigurationResponse,
        id: 'patient-config-123',
        configuration_name: 'Dr. Smith + Patient 456 Config',
        therapist_id: 'therapist-123',
        patient_id: 'patient-456',
        weight_compliance: 0.50,
        weight_symmetry: 0.20,
        weight_effort: 0.20,
        weight_game: 0.10
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => patientConfig
      });

      const { result } = renderHook(() => useScoringConfiguration('therapist-123', 'patient-456'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights).toEqual({
        compliance: 0.50,
        symmetry: 0.20,
        effort: 0.20,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/scoring/configurations/custom?therapist_id=therapist-123&patient_id=patient-456'
      );
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Successfully loaded scoring configuration from database:',
        expect.objectContaining({
          configSource: 'therapist-patient-specific'
        })
      );
    });

    it('should fallback from patient-specific to therapist-specific to global', async () => {
      // Mock the fallback chain: patient-specific fails, therapist-specific fails, global succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 }) // patient-specific fails
        .mockResolvedValueOnce({ ok: false, status: 404 }) // therapist-specific fails
        .mockResolvedValueOnce({ // global succeeds
          ok: true,
          json: async () => mockActiveConfigurationResponse
        });

      const { result } = renderHook(() => useScoringConfiguration('therapist-123', 'patient-456'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights?.compliance).toBe(0.40); // This test uses the global config mock, not fallback
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/scoring/configurations/custom?therapist_id=therapist-123&patient_id=patient-456');
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/scoring/configurations/custom?therapist_id=therapist-123');
      expect(mockFetch).toHaveBeenNthCalledWith(3, '/api/scoring/configurations/active');
    });
  });

  describe('Weight Validation', () => {
    it('should use fallback weights when database weights are invalid', async () => {
      const invalidConfig = {
        ...mockActiveConfigurationResponse,
        weight_compliance: 0.50,  // These sum to 1.10, not 1.0
        weight_symmetry: 0.30,
        weight_effort: 0.20,
        weight_game: 0.10
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidConfig
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use fallback weights due to validation failure
      expect(result.current.weights).toEqual(expectedFallbackWeights);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Database weights validation failed, using fallback',
        expect.objectContaining({
          mainSum: 1.1, // Invalid sum
        })
      );
    });

    it('should use fallback weights when compliance sub-weights are invalid', async () => {
      const invalidSubWeightsConfig = {
        ...mockActiveConfigurationResponse,
        weight_completion: 0.5,   // These sum to 1.1, not 1.0
        weight_intensity: 0.3,
        weight_duration: 0.3
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidSubWeightsConfig
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.weights).toEqual(expectedFallbackWeights);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Database weights validation failed, using fallback',
        expect.objectContaining({
          subSum: 1.1 // Invalid sub-weights sum
        })
      );
    });
  });

  describe('Custom Weight Management', () => {
    it('should save custom weights successfully', async () => {
      // Mock initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveConfigurationResponse
      });

      const { result } = renderHook(() => useScoringConfiguration('therapist-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock save request and refetch
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'saved-config' }) }) // Save request
        .mockResolvedValueOnce({ // Refetch after save
          ok: true,
          json: async () => ({
            ...mockActiveConfigurationResponse,
            weight_compliance: 0.45 // Updated value
          })
        });

      const customWeights: ScoringWeights = {
        compliance: 0.45,
        symmetry: 0.30,
        effort: 0.15,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      await result.current.saveCustomWeights(customWeights);

      // Verify save request was made
      expect(mockFetch).toHaveBeenCalledWith('/api/scoring/configurations/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configuration_name: 'Custom - therapist-123',
          description: 'Personnalisation des poids pour thérapeute therapist-123',
          weight_compliance: 0.45,
          weight_symmetry: 0.30,
          weight_effort: 0.15,
          weight_game: 0.10,
          weight_completion: 0.333,
          weight_intensity: 0.333,
          weight_duration: 0.334,
          therapist_id: 'therapist-123',
          patient_id: undefined
        })
      });

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Successfully saved custom scoring configuration:',
        expect.objectContaining({
          therapistId: 'therapist-123',
          weights: customWeights
        })
      );
    });

    it('should handle save error gracefully', async () => {
      // Mock initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockActiveConfigurationResponse
      });

      const { result } = renderHook(() => useScoringConfiguration('therapist-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock save error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      const customWeights: ScoringWeights = {
        compliance: 0.45,
        symmetry: 0.30,
        effort: 0.15,
        gameScore: 0.10,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      };

      await expect(result.current.saveCustomWeights(customWeights))
        .rejects.toThrow('Failed to save custom scoring configuration: Bad Request');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to save custom scoring configuration:',
        expect.any(String)
      );
    });
  });

  describe('React Hook Behavior', () => {
    it('should refetch configuration when therapist/patient IDs change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockActiveConfigurationResponse
      });

      const { result, rerender } = renderHook(
        ({ therapistId, patientId }) => useScoringConfiguration(therapistId, patientId),
        { initialProps: { therapistId: undefined, patientId: undefined } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Change therapist ID
      rerender({ therapistId: 'therapist-123' });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Should call therapist-specific endpoint
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/scoring/configurations/custom?therapist_id=therapist-123'
      );
    });

    it('should handle manual refetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockActiveConfigurationResponse
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Manual refetch
      await result.current.refetchConfiguration();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith('/api/scoring/configurations/active');
    });
  });

  describe('Single Source of Truth Validation', () => {
    it('should use fallback weights that match metricsDefinitions.md exactly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const weights = result.current.weights!;
      
      // Verify fallback weights match updated specification: 50% compliance, 30% effort, 20% symmetry, 0% game
      expect(weights.compliance).toBe(0.50);     // 50% - Therapeutic Compliance
      expect(weights.symmetry).toBe(0.20);       // 20% - Muscle Symmetry
      expect(weights.effort).toBe(0.30);         // 30% - Subjective Effort
      expect(weights.gameScore).toBe(0.00);      // 0% - Game Performance (default to zero)
      
      // Sub-component weights (must sum to 1.0)
      expect(weights.compliance_completion).toBe(0.333);  // ~33.3%
      expect(weights.compliance_intensity).toBe(0.333);   // ~33.3%
      expect(weights.compliance_duration).toBe(0.334);    // ~33.4%
      
      // Verify sums
      const mainSum = weights.compliance + weights.symmetry + weights.effort + weights.gameScore;
      const subSum = weights.compliance_completion + weights.compliance_intensity + weights.compliance_duration;
      
      expect(Math.abs(mainSum - 1.0)).toBeLessThan(0.001);
      expect(Math.abs(subSum - 1.0)).toBeLessThan(0.001);
    });
  });
});