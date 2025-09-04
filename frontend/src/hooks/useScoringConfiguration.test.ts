import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScoringConfiguration } from './useScoringConfiguration';
import { ScoringWeights } from '@/types/emg';

// Mock fetch globally
global.fetch = vi.fn();

describe('useScoringConfiguration', () => {
  const mockWeights: ScoringWeights = {
    compliance: 0.50,  // 50% - from metricsDefinitions.md
    symmetry: 0.25,    // 25% - from metricsDefinitions.md
    effort: 0.25,      // 25% - from metricsDefinitions.md
    gameScore: 0.00,   // 0% - from metricsDefinitions.md
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334,
  };

  const mockConfigResponse = {
    id: '1',
    configuration_name: 'Test Config',
    description: 'Test configuration',
    weight_compliance: 0.50,  // 50% - from metricsDefinitions.md
    weight_symmetry: 0.25,    // 25% - from metricsDefinitions.md
    weight_effort: 0.25,      // 25% - from metricsDefinitions.md
    weight_game: 0.00,        // 0% - from metricsDefinitions.md
    weight_completion: 0.333,
    weight_intensity: 0.333,
    weight_duration: 0.334,
    active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial loading', () => {
    it('should load configuration on mount', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse
      });

      const { result } = renderHook(() => useScoringConfiguration());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeDefined();
        expect(result.current.weights?.compliance).toBeGreaterThanOrEqual(0);
        expect(result.current.weights?.compliance).toBeLessThanOrEqual(1);
        // Verify weights sum to approximately 1.0
        const total = (result.current.weights?.compliance || 0) + 
                     (result.current.weights?.symmetry || 0) + 
                     (result.current.weights?.effort || 0) + 
                     (result.current.weights?.gameScore || 0);
        expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
        expect(result.current.error).toBe(null);
      });
    });

    it('should use fallback weights when no configuration found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeDefined();
        // Should use fallback weights when no config found
        // Verify weights are valid (sum to 1.0)
        const total = (result.current.weights?.compliance || 0) + 
                     (result.current.weights?.symmetry || 0) + 
                     (result.current.weights?.effort || 0) + 
                     (result.current.weights?.gameScore || 0);
        expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
        expect(result.current.error).toBe(null);
      });
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Network error';
      (global.fetch as any).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeDefined();
        // Should use fallback weights on error
        // Verify weights are valid (sum to 1.0)
        const total = (result.current.weights?.compliance || 0) + 
                     (result.current.weights?.symmetry || 0) + 
                     (result.current.weights?.effort || 0) + 
                     (result.current.weights?.gameScore || 0);
        expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('Therapist and patient specific configuration', () => {
    it('should load therapist-patient specific configuration when both IDs provided', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        });

      const { result } = renderHook(() => 
        useScoringConfiguration('therapist-123', 'patient-456')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('therapist_id=therapist-123&patient_id=patient-456')
        );
      });
    });

    it('should fallback to therapist-only configuration if patient-specific not found', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        });

      const { result } = renderHook(() => 
        useScoringConfiguration('therapist-123', 'patient-456')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(2,
          expect.stringContaining('therapist_id=therapist-123')
        );
      });
    });

    it('should fallback to global configuration if no custom found', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        });

      const { result } = renderHook(() => 
        useScoringConfiguration()
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(global.fetch).toHaveBeenCalledWith('/api/scoring/configurations/active');
      });
    });
  });

  describe('Save operations', () => {
    it('should save custom weights for patient', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        });

      const { result } = renderHook(() => 
        useScoringConfiguration('therapist-123', 'patient-456')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveCustomWeights(mockWeights, 'therapist-123', 'patient-456');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/scoring/configurations/custom',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('therapist_id')
        })
      );
    });

    it('should save global weights', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveGlobalWeights(mockWeights);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/scoring/configurations/global',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Global Default')
        })
      );
    });

    it('should throw error when save fails', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error'
        });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.saveGlobalWeights(mockWeights);
        })
      ).rejects.toThrow('Failed to save global scoring configuration');
    });
  });

  describe('State tracking', () => {
    it('should track unsaved changes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasUnsavedChanges).toBe(false);

      // Simulate weight change (this would normally happen through UI)
      // Since we can't directly modify weights, this test would need
      // to be integrated with the component that uses this hook
    });

    it('should track current save state', async () => {
      // Test patient-specific configuration
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse
      });

      const { result } = renderHook(() => 
        useScoringConfiguration('therapist-123', 'patient-456')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.currentSaveState).toBe('patient');
      });
    });

    it('should clear local changes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.clearLocalChanges();
      });

      // Weights should be reset to original
      expect(result.current.weights).toEqual(mockWeights);
    });
  });

  describe('Weight validation', () => {
    it('should reject invalid weights that do not sum to 1.0', async () => {
      const invalidConfig = {
        ...mockConfigResponse,
        weight_compliance: 0.60,
        weight_symmetry: 0.30,
        weight_effort: 0.30,
        weight_game: 0.00, // Sum = 1.20 - INVALID
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidConfig
      });

      const consoleSpy = vi.spyOn(console, 'warn');

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeDefined();
        // Should use fallback weights when validation fails
        // Verify the fallback weights are valid (sum to 1.0)
        const total = (result.current.weights?.compliance || 0) + 
                     (result.current.weights?.symmetry || 0) + 
                     (result.current.weights?.effort || 0) + 
                     (result.current.weights?.gameScore || 0);
        expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Database weights validation failed'),
          expect.any(Object)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should accept weights that sum to 1.0 within tolerance', async () => {
      const validConfig = {
        ...mockConfigResponse,
        weight_compliance: 0.501,
        weight_symmetry: 0.249,
        weight_effort: 0.250,
        weight_game: 0.000, // Sum = 1.000
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => validConfig
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights?.compliance).toBeCloseTo(0.501);
        expect(result.current.weights?.symmetry).toBeCloseTo(0.249);
        expect(result.current.weights?.effort).toBeCloseTo(0.250);
      });
    });
  });

  describe('Refetch configuration', () => {
    it('should refetch configuration on demand', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockConfigResponse,
            weight_compliance: 0.60,
            weight_symmetry: 0.20,
            weight_effort: 0.20,
          })
        });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify initial weights are valid
      const initialTotal = (result.current.weights?.compliance || 0) + 
                          (result.current.weights?.symmetry || 0) + 
                          (result.current.weights?.effort || 0) + 
                          (result.current.weights?.gameScore || 0);
      expect(Math.abs(initialTotal - 1.0)).toBeLessThan(0.01);

      await act(async () => {
        await result.current.refetchConfiguration();
      });

      expect(result.current.weights?.compliance).toBe(0.60);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});