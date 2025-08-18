/**
 * useMvcService Hook Integration Tests
 * ===================================
 * 
 * Integration tests for the MVC service hook including:
 * - State management and session integration
 * - Error handling and recovery
 * - Complete MVC workflow testing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMvcService } from '../useMvcService';
import { MVCService } from '@/services/mvcService';
import { useSessionStore } from '@/store/sessionStore';
import { EMGAnalysisResult } from '@/types/emg';

// Mock the MVC service
vi.mock('@/services/mvcService', () => ({
  MVCService: {
    calibrate: vi.fn(),
    extractMVCFromAnalysis: vi.fn(),
    convertToSessionParameters: vi.fn(),
    validateEstimation: vi.fn(),
    formatMVCValue: vi.fn(),
    formatThresholdValue: vi.fn(),
    getEstimationMethodName: vi.fn(),
    getConfidenceLevelName: vi.fn(),
  },
}));

// Mock session store
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

describe('useMvcService Integration Tests', () => {
  const mockSetSessionParams = vi.fn();
  const mockSessionParams = {
    user_id: 'test-user',
    session_id: 'test-session',
    session_mvc_threshold_percentage: 75,
    session_mvc_values: {},
    session_mvc_threshold_percentages: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup session store mock
    (useSessionStore as any).mockReturnValue({
      sessionParams: mockSessionParams,
      setSessionParams: mockSetSessionParams
    });

    // Setup MVC service mocks
    (MVCService.formatMVCValue as any).mockImplementation((val: number) => val ? `${val.toExponential(3)} mV` : 'N/A');
    (MVCService.formatThresholdValue as any).mockImplementation((val: number) => val ? `${val.toExponential(3)} mV` : 'N/A');
    (MVCService.getEstimationMethodName as any).mockImplementation((method: string) => `📊 ${method}`);
    (MVCService.getConfidenceLevelName as any).mockImplementation((score: number) => score > 0.8 ? '🟢 High' : '🟡 Medium');
  });

  describe('estimateFromFile functionality', () => {
    it('should successfully estimate MVC from file', async () => {
      const mockFile = new File(['test'], 'test.c3d', { type: 'application/octet-stream' });
      const mockEstimationResponse = {
        status: 'success' as const,
        file_info: {
          filename: 'test.c3d',
          channels_processed: ['CH1', 'CH2'],
          sampling_rate: 1000
        },
        mvc_estimations: {
          CH1: {
            mvc_value: 0.005,
            threshold_value: 0.00375,
            threshold_percentage: 75,
            estimation_method: 'clinical_estimation' as const,
            confidence_score: 0.85,
            metadata: {},
            timestamp: '2025-08-18T12:00:00Z'
          },
          CH2: {
            mvc_value: 0.0053,
            threshold_value: 0.004,
            threshold_percentage: 75,
            estimation_method: 'backend_estimation' as const,
            confidence_score: 0.9,
            metadata: {},
            timestamp: '2025-08-18T12:00:00Z'
          }
        }
      };

      (MVCService.calibrate as any).mockResolvedValue(mockEstimationResponse);

      const { result } = renderHook(() => useMvcService());

      // Initial state
      expect(result.current.isEstimating).toBe(false);
      expect(result.current.estimationResults).toBeNull();
      expect(result.current.error).toBeNull();

      // Start estimation
      await act(async () => {
        await result.current.estimateFromFile(mockFile);
      });

      // Verify MVC service was called correctly
      expect(MVCService.calibrate).toHaveBeenCalledWith(mockFile, {
        user_id: 'test-user',
        session_id: 'test-session',
        threshold_percentage: 75
      });

      // Verify state updates
      expect(result.current.isEstimating).toBe(false);
      expect(result.current.estimationResults).toEqual(mockEstimationResponse.mvc_estimations);
      expect(result.current.error).toBeNull();
    });

    it('should handle estimation errors gracefully', async () => {
      const mockFile = new File(['test'], 'test.c3d', { type: 'application/octet-stream' });
      const mockError = new Error('Invalid C3D file format');

      (MVCService.calibrate as any).mockRejectedValue(mockError);

      const { result } = renderHook(() => useMvcService());

      await act(async () => {
        await result.current.estimateFromFile(mockFile);
      });

      expect(result.current.isEstimating).toBe(false);
      expect(result.current.estimationResults).toBeNull();
      expect(result.current.error).toBe('Invalid C3D file format');
    });

    it('should cancel ongoing estimation when new one starts', async () => {
      const mockFile1 = new File(['test1'], 'test1.c3d', { type: 'application/octet-stream' });
      const mockFile2 = new File(['test2'], 'test2.c3d', { type: 'application/octet-stream' });

      // First estimation takes longer
      (MVCService.calibrate as any).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      // Second estimation completes quickly
      const mockResponse2 = {
        status: 'success' as const,
        mvc_estimations: { CH1: { mvc_value: 0.006 } }
      };
      (MVCService.calibrate as any).mockImplementationOnce(() => 
        Promise.resolve(mockResponse2)
      );

      const { result } = renderHook(() => useMvcService());

      // Start first estimation
      act(() => {
        result.current.estimateFromFile(mockFile1);
      });

      // Immediately start second estimation
      await act(async () => {
        await result.current.estimateFromFile(mockFile2);
      });

      // Should have results from second estimation only
      expect(result.current.estimationResults).toEqual(mockResponse2.mvc_estimations);
    });
  });

  describe('extractFromAnalysis functionality', () => {
    it('should successfully extract MVC from analysis', () => {
      const mockAnalysisResult: EMGAnalysisResult = {
        file_id: 'test-file',
        timestamp: '2025-08-18T12:00:00Z',
        source_filename: 'test.c3d',
        analytics: {
          CH1: {
            mvc_threshold_actual_value: 0.00375,
            mvc_estimation_method: 'clinical_estimation'
          }
        },
        available_channels: ['CH1'],
        emg_signals: {},
        metadata: null,
        c3d_parameters: {},
        user_id: 'test-user',
        patient_id: null,
        session_id: null
      } as any;

      const mockExtractedResults = {
        CH1: {
          mvc_value: 0.005,
          threshold_value: 0.00375,
          threshold_percentage: 75,
          estimation_method: 'clinical_estimation' as const,
          confidence_score: 0.8,
          metadata: {},
          timestamp: '2025-08-18T12:00:00Z'
        }
      };

      (MVCService.extractMVCFromAnalysis as any).mockReturnValue(mockExtractedResults);

      const { result } = renderHook(() => useMvcService());

      act(() => {
        result.current.extractFromAnalysis(mockAnalysisResult);
      });

      expect(MVCService.extractMVCFromAnalysis).toHaveBeenCalledWith(mockAnalysisResult);
      expect(result.current.estimationResults).toEqual(mockExtractedResults);
      expect(result.current.error).toBeNull();
    });

    it('should handle extraction failures', () => {
      const mockAnalysisResult: EMGAnalysisResult = {
        file_id: 'test-file',
        analytics: {},
        available_channels: [],
        emg_signals: {},
      } as any;

      (MVCService.extractMVCFromAnalysis as any).mockReturnValue(null);

      const { result } = renderHook(() => useMvcService());

      act(() => {
        result.current.extractFromAnalysis(mockAnalysisResult);
      });

      expect(result.current.estimationResults).toBeNull();
      expect(result.current.error).toBe('No MVC data found in analysis result');
    });
  });

  describe('applyToSession functionality', () => {
    it('should apply MVC results to session parameters', () => {
      const mockMVCResults = {
        CH1: {
          mvc_value: 0.005,
          threshold_value: 0.00375,
          threshold_percentage: 75,
          estimation_method: 'clinical_estimation' as const,
          confidence_score: 0.85,
          metadata: {},
          timestamp: '2025-08-18T12:00:00Z'
        },
        CH2: {
          mvc_value: 0.0053,
          threshold_value: 0.004,
          threshold_percentage: 80,
          estimation_method: 'backend_estimation' as const,
          confidence_score: 0.9,
          metadata: {},
          timestamp: '2025-08-18T12:00:00Z'
        }
      };

      const mockSessionData = {
        session_mvc_values: { CH1: 0.005, CH2: 0.0053 },
        session_mvc_threshold_percentages: { CH1: 75, CH2: 80 }
      };

      (MVCService.convertToSessionParameters as any).mockReturnValue(mockSessionData);

      const { result } = renderHook(() => useMvcService());

      act(() => {
        result.current.applyToSession(mockMVCResults);
      });

      expect(MVCService.convertToSessionParameters).toHaveBeenCalledWith(mockMVCResults);
      expect(mockSetSessionParams).toHaveBeenCalledWith({
        ...mockSessionParams,
        ...mockSessionData
      });
    });

    it('should handle session application errors', () => {
      const mockMVCResults = { CH1: { mvc_value: 0.005 } } as any;
      const mockError = new Error('Session update failed');

      (MVCService.convertToSessionParameters as any).mockImplementation(() => {
        throw mockError;
      });

      const { result } = renderHook(() => useMvcService());

      act(() => {
        result.current.applyToSession(mockMVCResults);
      });

      expect(result.current.error).toBe('Session update failed');
    });
  });

  describe('validation functionality', () => {
    it('should validate estimation results', () => {
      const mockResults = {
        CH1: {
          mvc_value: 0.005,
          confidence_score: 0.85,
          estimation_method: 'clinical_estimation' as const
        }
      } as any;

      const mockValidation = {
        isValid: true,
        warnings: []
      };

      (MVCService.validateEstimation as any).mockReturnValue(mockValidation);

      const { result } = renderHook(() => useMvcService());

      // Set estimation results
      act(() => {
        result.current.extractFromAnalysis({ analytics: {} } as any);
      });
      
      // Mock the results
      (result.current as any).estimationResults = mockResults;

      const validation = result.current.validateEstimation('CH1');

      expect(MVCService.validateEstimation).toHaveBeenCalledWith(mockResults.CH1);
      expect(validation).toEqual(mockValidation);
    });

    it('should return null for missing channel validation', () => {
      const { result } = renderHook(() => useMvcService());

      const validation = result.current.validateEstimation('NON_EXISTENT');
      expect(validation).toBeNull();
    });
  });

  describe('clearResults functionality', () => {
    it('should clear all estimation state', () => {
      const { result } = renderHook(() => useMvcService());

      // Set some initial state
      act(() => {
        (result.current as any).estimationResults = { CH1: { mvc_value: 0.005 } };
        (result.current as any).error = 'Some error';
      });

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.estimationResults).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isEstimating).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should provide access to formatting utilities', () => {
      const { result } = renderHook(() => useMvcService());

      result.current.formatMVCValue(0.005);
      result.current.formatThresholdValue(0.00375);
      result.current.getEstimationMethodName('clinical_estimation');
      result.current.getConfidenceLevelName(0.85);

      expect(MVCService.formatMVCValue).toHaveBeenCalledWith(0.005);
      expect(MVCService.formatThresholdValue).toHaveBeenCalledWith(0.00375);
      expect(MVCService.getEstimationMethodName).toHaveBeenCalledWith('clinical_estimation');
      expect(MVCService.getConfidenceLevelName).toHaveBeenCalledWith(0.85);
    });
  });
});