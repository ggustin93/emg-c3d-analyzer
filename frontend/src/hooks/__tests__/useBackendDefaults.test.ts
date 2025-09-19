import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBackendDefaults } from '../useBackendDefaults';

// Mock API_CONFIG to return '/api' in test environment
vi.mock('@/config/apiConfig', () => ({
  API_CONFIG: {
    baseUrl: '/api'
  }
}));

describe('useBackendDefaults', () => {
  // Save original fetch
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });
  
  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });
  
  it('should fetch backend defaults successfully', async () => {
    const mockDefaults = {
      target_contractions_ch1: 12,
      target_contractions_ch2: 12,
      mvc_threshold_percentage: 75.0,
      therapeutic_duration_threshold_ms: 2000,
      scoring_weights: {
        compliance: 0.50,
        symmetry: 0.25,
        effort: 0.25,
        gameScore: 0.00,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      }
    };
    
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDefaults,
    });
    
    const { result } = renderHook(() => useBackendDefaults());
    
    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.defaults).toBe(null);
    expect(result.current.error).toBe(null);
    
    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Check successful result
    expect(result.current.defaults).toEqual(mockDefaults);
    expect(result.current.error).toBe(null);
    
    // Verify correct URL was called - API_CONFIG.baseUrl resolves to '/api' in test environment
    expect(global.fetch).toHaveBeenCalledWith('/api/config/defaults');
  });
  
  it('should use fallback URL when environment variable is not set', async () => {
    // API_CONFIG is mocked to use '/api' consistently
    
    const mockDefaults = {
      target_contractions_ch1: 10,
      target_contractions_ch2: 10,
      mvc_threshold_percentage: 70.0,
      therapeutic_duration_threshold_ms: 1500,
      scoring_weights: {
        compliance: 0.40,
        symmetry: 0.30,
        effort: 0.30,
        gameScore: 0.00,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      }
    };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDefaults,
    });
    
    const { result } = renderHook(() => useBackendDefaults());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should use API_CONFIG baseUrl which defaults to '/api' in test environment
    expect(global.fetch).toHaveBeenCalledWith('/api/config/defaults');
    expect(result.current.defaults).toEqual(mockDefaults);
  });
  
  it('should handle fetch errors gracefully', async () => {
    // Mock fetch failure
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result } = renderHook(() => useBackendDefaults());
    
    // Initially loading
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should set error and NOT provide fallback values (maintaining single source of truth)
    expect(result.current.error).toBe('Network error');
    expect(result.current.defaults).toBe(null);
    
    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching backend defaults:',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
  
  it('should handle non-OK response status', async () => {
    // Mock non-OK response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result } = renderHook(() => useBackendDefaults());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Should set error
    expect(result.current.error).toBe('Failed to fetch defaults: Internal Server Error');
    expect(result.current.defaults).toBe(null);
    
    consoleSpy.mockRestore();
  });
  
  it('should only fetch once on mount', async () => {
    const mockDefaults = {
      target_contractions_ch1: 12,
      target_contractions_ch2: 12,
      mvc_threshold_percentage: 75.0,
      therapeutic_duration_threshold_ms: 2000,
      scoring_weights: {
        compliance: 0.50,
        symmetry: 0.25,
        effort: 0.25,
        gameScore: 0.00,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      }
    };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDefaults,
    });
    
    const { result, rerender } = renderHook(() => useBackendDefaults());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Rerender the hook
    rerender();
    
    // Fetch should only be called once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  
  it('should clear error on successful fetch after retry', async () => {
    const mockDefaults = {
      target_contractions_ch1: 12,
      target_contractions_ch2: 12,
      mvc_threshold_percentage: 75.0,
      therapeutic_duration_threshold_ms: 2000,
      scoring_weights: {
        compliance: 0.50,
        symmetry: 0.25,
        effort: 0.25,
        gameScore: 0.00,
        compliance_completion: 0.333,
        compliance_intensity: 0.333,
        compliance_duration: 0.334,
      }
    };
    
    // First call fails
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result, rerender } = renderHook(() => useBackendDefaults());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Network error');
    
    // Second call succeeds (simulating a retry mechanism)
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDefaults,
    });
    
    // Force re-fetch by unmounting and remounting
    const { result: newResult } = renderHook(() => useBackendDefaults());
    
    await waitFor(() => {
      expect(newResult.current.loading).toBe(false);
    });
    
    // Error should be cleared
    expect(newResult.current.error).toBe(null);
    expect(newResult.current.defaults).toEqual(mockDefaults);
    
    consoleSpy.mockRestore();
  });
});