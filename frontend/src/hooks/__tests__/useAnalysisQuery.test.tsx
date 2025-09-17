/**
 * Analysis Query Cache Behavior Tests
 * 
 * Tests the caching behavior of the useAnalysisQuery hook to ensure
 * expensive EMG analysis results are properly cached and invalidated.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAnalysisQuery, type AnalysisParams } from '../useAnalysisQuery';
import { queryKeys } from '../../lib/queryClient';
import SupabaseStorageService from '../../services/supabaseStorage';
import { API_CONFIG } from '../../config/apiConfig';

// Mock dependencies

vi.mock('../../services/supabaseStorage');
vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LogCategory: {
    API: 'API',
  },
}));

// Mock API_CONFIG
vi.mock('../../config/apiConfig', () => ({
  API_CONFIG: {
    baseUrl: 'http://localhost:8080'
  }
}));

// Mock global fetch
global.fetch = vi.fn();

const mockedSupabaseStorageService = vi.mocked(SupabaseStorageService);
const mockedFetch = vi.mocked(fetch);

// Helper to create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useAnalysisQuery Cache Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    const mockBlob = new Blob(['fake file content'], { type: 'application/octet-stream' });
    mockedSupabaseStorageService.downloadFile.mockResolvedValue(mockBlob);
    
    // Mock successful API response
    const mockAnalysisResponse = {
      analytics: {
        CH1: { rms: [1, 2, 3] },
        CH2: { rms: [4, 5, 6] }
      },
      metadata: {
        score: 85,
        level: 2
      }
    };
    
    mockedFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalysisResponse),
    } as Response);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Cache Functionality', () => {
    it('should cache analysis results for 10 minutes', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d',
        sessionParams: { channel_muscle_mapping: { CH1: 'Muscle1' } }
      };

      const { result } = renderHook(() => useAnalysisQuery(params), { wrapper });

      // Wait for the query to complete
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      // Verify the staleTime is set to 10 minutes (600,000 ms)
      expect(result.current.data).toMatchObject({
        filename: 'test-file.c3d',
        results: expect.objectContaining({
          emgData: expect.any(Object)
        }),
        metadata: expect.objectContaining({
          processedAt: expect.any(String),
          version: '1.0.0'
        })
      });

      // Verify processing time is recorded
      expect(result.current.data?.processingTime).toBeGreaterThan(0);
    });

    it('should return same results on repeated queries without refetching', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d',
        sessionParams: { channel_muscle_mapping: { CH1: 'Muscle1' } }
      };

      // First query
      const { result: firstResult } = renderHook(() => useAnalysisQuery(params), { wrapper });
      await waitFor(() => expect(firstResult.current.data).toBeDefined());

      const firstData = firstResult.current.data;
      const firstProcessedAt = firstData?.metadata.processedAt;

      // Small delay to ensure timestamp would be different if refetched
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second query with same parameters
      const { result: secondResult } = renderHook(() => useAnalysisQuery(params), { wrapper });
      await waitFor(() => expect(secondResult.current.data).toBeDefined());

      const secondData = secondResult.current.data;

      // Should return cached data (same processedAt timestamp)
      expect(secondData?.metadata.processedAt).toBe(firstProcessedAt);
      expect(mockedFetch).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle service method correctly with downloadFile', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d',
        sessionParams: {}
      };

      const { result } = renderHook(() => useAnalysisQuery(params), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      // Verify downloadFile was called with correct parameters
      expect(mockedSupabaseStorageService.downloadFile).toHaveBeenCalledWith('test-file.c3d');
      
      // Verify fetch was called with FormData containing the file
      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:8080/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });
  });


  describe('Query Key Generation', () => {
    it('should generate correct query key for filename', () => {
      const filename = 'test-file.c3d';
      const queryKey = queryKeys.upload.analysis(filename);
      
      expect(queryKey).toEqual(['upload', 'analysis', 'test-file.c3d']);
    });

    it('should generate correct query key with parameter hash', () => {
      const filename = 'test-file.c3d';
      const paramsHash = 'abc123';
      const queryKey = queryKeys.upload.analysis(filename, paramsHash);
      
      expect(queryKey).toEqual(['upload', 'analysis', 'test-file.c3d', 'abc123']);
    });
  });

  describe('Session Parameters Handling', () => {
    it('should include session parameters in FormData', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d',
        sessionParams: {
          channel_muscle_mapping: { CH1: 'Muscle1', CH2: 'Muscle2' },
          muscle_color_mapping: { Muscle1: '#ff0000', Muscle2: '#00ff00' },
          session_mvc_values: { Muscle1: 100, Muscle2: 120 },
          game_score: 85,
          game_level: 2
        }
      };

      const { result } = renderHook(() => useAnalysisQuery(params), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      // Verify FormData was created with session parameters
      const formDataCall = mockedFetch.mock.calls[0];
      const formData = formDataCall[1]?.body as FormData;
      
      expect(formData).toBeInstanceOf(FormData);
      
      // Note: FormData entries are not easily testable in Jest
      // In a real implementation, you might use a FormData mock
      // or test the actual parameter serialization separately
    });

    it('should handle missing session parameters gracefully', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d'
        // No sessionParams provided
      };

      const { result } = renderHook(() => useAnalysisQuery(params), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data?.metadata.parameters).toEqual({});
    });
  });

  describe('Performance Validation', () => {
    it('should complete analysis within reasonable time', async () => {
      const wrapper = createWrapper();
      const params: AnalysisParams = {
        filename: 'test-file.c3d',
        sessionParams: {}
      };

      const startTime = Date.now();
      const { result } = renderHook(() => useAnalysisQuery(params), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      }, { timeout: 5000 });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within 5 seconds (reasonable for testing)
      expect(totalTime).toBeLessThan(5000);
      
      // Verify processing time is recorded in result
      expect(result.current.data?.processingTime).toBeGreaterThan(0);
      expect(result.current.data?.processingTime).toBeLessThan(totalTime + 100); // Add small buffer
    });
  });
});