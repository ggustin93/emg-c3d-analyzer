import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScoringConfiguration } from './useScoringConfiguration';
import { ScoringWeights } from '@/types/emg';

// Mock fetch globally
global.fetch = vi.fn();

describe('useScoringConfiguration', () => {
  // Helper: Create flexible weights that always sum to 1.0 - KISS principle
  const createValidWeights = (overrides: Partial<ScoringWeights> = {}): ScoringWeights => ({
    compliance: 0.40,
    symmetry: 0.25,
    effort: 0.25,
    gameScore: 0.10, // Sum: 1.0
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334, // Sum: 1.0
    ...overrides
  });

  // Helper: Create mock config from weights - DRY principle
  const createMockConfig = (weights: ScoringWeights) => ({
    id: 'test-config-id',
    configuration_name: 'GHOSTLY-TRIAL-DEFAULT',
    description: 'Test configuration',
    weight_compliance: weights.compliance,
    weight_symmetry: weights.symmetry,
    weight_effort: weights.effort,
    weight_game: weights.gameScore,
    weight_completion: weights.compliance_completion,
    weight_intensity: weights.compliance_intensity,
    weight_duration: weights.compliance_duration,
    active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  });

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
        json: async () => createMockConfig(createValidWeights())
      });

      const { result } = renderHook(() => useScoringConfiguration());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeDefined();
        expect(result.current.weights?.compliance).toBe(0.40);
        expect(result.current.weights?.symmetry).toBe(0.25);
        expect(result.current.weights?.effort).toBe(0.25);
        expect(result.current.weights?.gameScore).toBe(0.10);
        // Verify weights sum to exactly 1.0
        const total = (result.current.weights?.compliance || 0) + 
                     (result.current.weights?.symmetry || 0) + 
                     (result.current.weights?.effort || 0) + 
                     (result.current.weights?.gameScore || 0);
        expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
        expect(result.current.error).toBe(null);
      });
    });

    it('should handle missing configuration as error state', async () => {
      // Create a spy to suppress console.error during this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights).toBeNull();
        // Should show error when no config found (no fallbacks)
        expect(result.current.error).toBe('No scoring configuration found. Please contact support.');
      });

      consoleSpy.mockRestore();
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Network error';
      (global.fetch as any).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        // Should show error state when fetch fails (no fallbacks)
        expect(result.current.weights).toBeNull();
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('Therapist and patient specific configuration', () => {
    it('should load therapist-patient specific configuration when both IDs provided', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockConfig(createValidWeights())
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
          json: async () => createMockConfig(createValidWeights())
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
          json: async () => createMockConfig(createValidWeights())
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
          json: async () => createMockConfig(createValidWeights())
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockConfig(createValidWeights())
        });

      const { result } = renderHook(() => 
        useScoringConfiguration('therapist-123', 'patient-456')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveCustomWeights(createValidWeights(), 'therapist-123', 'patient-456');
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
          json: async () => createMockConfig(createValidWeights())
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockConfig(createValidWeights())
        });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.saveGlobalWeights(createValidWeights());
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/scoring/configurations/default',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('GHOSTLY-TRIAL-DEFAULT')
        })
      );
    });

    it('should throw error when save fails', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockConfig(createValidWeights())
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
          await result.current.saveGlobalWeights(createValidWeights());
        })
      ).rejects.toThrow('Failed to update default scoring configuration');
    });
  });

  describe('State tracking', () => {
    it('should track unsaved changes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockConfig(createValidWeights())
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
        json: async () => createMockConfig(createValidWeights())
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
        json: async () => createMockConfig(createValidWeights())
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.clearLocalChanges();
      });

      // Weights should be reset to original
      expect(result.current.weights).toEqual(createValidWeights());
    });
  });

  describe('Weight validation', () => {
    it('should reject invalid weights that do not sum to 1.0', async () => {
      // KISS: Create invalid weights using helper - simpler and flexible
      const invalidWeights = createValidWeights({
        compliance: 0.60,  // Too high - will cause validation failure
        symmetry: 0.30     // 0.60 + 0.30 + 0.25 + 0.10 = 1.25 > 1.0
      });
      const invalidConfig = createMockConfig(invalidWeights);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidConfig
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        // Should show error state when validation fails (no fallbacks)
        expect(result.current.weights).toBeNull();
        expect(result.current.error).toBe('Invalid scoring configuration. Please contact support.');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Database weights validation failed',
          expect.any(Object)
        );
      });

      consoleSpy.mockRestore();
    });

    it('should accept weights that sum to 1.0 within tolerance', async () => {
      const validConfig = {
        ...createMockConfig(createValidWeights()),
        weight_compliance: 0.401,  // 40.1%
        weight_symmetry: 0.249,    // 24.9%
        weight_effort: 0.250,      // 25.0%
        weight_game: 0.100,        // 10.0% = Total: 1.000 (VALID)
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => validConfig
      });

      const { result } = renderHook(() => useScoringConfiguration());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.weights?.compliance).toBeCloseTo(0.401);
        expect(result.current.weights?.symmetry).toBeCloseTo(0.249);
        expect(result.current.weights?.effort).toBeCloseTo(0.250);
        expect(result.current.weights?.gameScore).toBeCloseTo(0.100);
      });
    });
  });

  describe('Refetch configuration', () => {
    it('should refetch configuration on demand', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createMockConfig(createValidWeights())
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...createMockConfig(createValidWeights()),
            weight_compliance: 0.50,
            weight_symmetry: 0.20,
            weight_effort: 0.20,
            weight_game: 0.10, // Still sums to 1.0
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

      expect(result.current.weights?.compliance).toBe(0.50);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});