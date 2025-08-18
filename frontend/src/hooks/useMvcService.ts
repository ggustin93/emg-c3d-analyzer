/**
 * React Hook for MVC Service Management
 * =====================================
 * 
 * Custom hook for managing MVC estimation, validation, and integration
 * with session parameters and backend services.
 */

import { useState, useCallback, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { MVCService, MVCEstimationResponse, MVCEstimationResult } from '@/services/mvcService';
import { EMGAnalysisResult } from '@/types/emg';

export interface UseMvcServiceReturn {
  // State
  isEstimating: boolean;
  estimationResults: Record<string, MVCEstimationResult> | null;
  error: string | null;
  
  // Actions
  estimateFromFile: (file: File, options?: { threshold_percentage?: number }) => Promise<void>;
  extractFromAnalysis: (analysisResult: EMGAnalysisResult) => void;
  applyToSession: (mvcResults: Record<string, MVCEstimationResult>) => void;
  clearResults: () => void;
  validateEstimation: (channel: string) => { isValid: boolean; warnings: string[] } | null;
  
  // Utilities
  formatMVCValue: (value: number) => string;
  formatThresholdValue: (value: number) => string;
  getEstimationMethodName: (method: string) => string;
  getConfidenceLevelName: (score: number) => string;
}

export const useMvcService = (): UseMvcServiceReturn => {
  // State
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimationResults, setEstimationResults] = useState<Record<string, MVCEstimationResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Session store
  const { sessionParams, setSessionParams } = useSessionStore();
  
  // Ref to track current estimation
  const currentEstimationRef = useRef<AbortController | null>(null);

  /**
   * Estimate MVC from uploaded file
   */
  const estimateFromFile = useCallback(async (
    file: File, 
    options: { threshold_percentage?: number } = {}
  ) => {
    // Cancel any ongoing estimation
    if (currentEstimationRef.current) {
      currentEstimationRef.current.abort();
    }

    setIsEstimating(true);
    setError(null);
    
    const abortController = new AbortController();
    currentEstimationRef.current = abortController;

    try {
      console.log('🔄 Starting MVC estimation from file:', file.name);
      
      const response = await MVCService.calibrate(file, {
        user_id: sessionParams.user_id,
        session_id: sessionParams.session_id,
        threshold_percentage: options.threshold_percentage || sessionParams.session_mvc_threshold_percentage || 75
      });

      if (abortController.signal.aborted) {
        console.log('⏹️ MVC estimation aborted');
        return;
      }

      if (response.status === 'success') {
        console.log('✅ MVC estimation completed:', response);
        setEstimationResults(response.mvc_estimations);
        
        // Log estimation details for debugging
        Object.entries(response.mvc_estimations).forEach(([channel, result]) => {
          console.log(`📊 ${channel} MVC:`, {
            value: MVCService.formatMVCValue(result.mvc_value),
            threshold: MVCService.formatThresholdValue(result.threshold_value),
            method: result.estimation_method,
            confidence: MVCService.getConfidenceLevelName(result.confidence_score)
          });
        });
      } else {
        throw new Error(response.error || 'MVC estimation failed');
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('❌ MVC estimation error:', errorMessage);
        setError(errorMessage);
        setEstimationResults(null);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsEstimating(false);
        currentEstimationRef.current = null;
      }
    }
  }, [sessionParams]);

  /**
   * Extract MVC from existing analysis result
   */
  const extractFromAnalysis = useCallback((analysisResult: EMGAnalysisResult) => {
    console.log('🔍 Extracting MVC from analysis result');
    
    try {
      const extractedResults = MVCService.extractMVCFromAnalysis(analysisResult);
      
      if (extractedResults) {
        console.log('✅ MVC extracted from analysis:', extractedResults);
        setEstimationResults(extractedResults);
        setError(null);
      } else {
        console.log('⚠️ No MVC data found in analysis result');
        setError('No MVC data found in analysis result');
        setEstimationResults(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract MVC from analysis';
      console.error('❌ MVC extraction error:', errorMessage);
      setError(errorMessage);
      setEstimationResults(null);
    }
  }, []);

  /**
   * Apply MVC results to session parameters
   */
  const applyToSession = useCallback((mvcResults: Record<string, MVCEstimationResult>) => {
    console.log('📝 Applying MVC results to session parameters');
    
    try {
      const sessionData = MVCService.convertToSessionParameters(mvcResults);
      
      const updatedSessionParams = {
        ...sessionParams,
        ...sessionData
      };
      
      setSessionParams(updatedSessionParams);
      
      console.log('✅ Session parameters updated with MVC data:', {
        mvc_values: sessionData.session_mvc_values,
        threshold_percentages: sessionData.session_mvc_threshold_percentages
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply MVC to session';
      console.error('❌ MVC application error:', errorMessage);
      setError(errorMessage);
    }
  }, [sessionParams, setSessionParams]);

  /**
   * Clear estimation results
   */
  const clearResults = useCallback(() => {
    console.log('🗑️ Clearing MVC estimation results');
    
    // Cancel any ongoing estimation
    if (currentEstimationRef.current) {
      currentEstimationRef.current.abort();
      currentEstimationRef.current = null;
    }
    
    setEstimationResults(null);
    setError(null);
    setIsEstimating(false);
  }, []);

  /**
   * Validate specific channel estimation
   */
  const validateEstimation = useCallback((channel: string) => {
    if (!estimationResults || !estimationResults[channel]) {
      return null;
    }
    
    return MVCService.validateEstimation(estimationResults[channel]);
  }, [estimationResults]);

  return {
    // State
    isEstimating,
    estimationResults,
    error,
    
    // Actions
    estimateFromFile,
    extractFromAnalysis,
    applyToSession,
    clearResults,
    validateEstimation,
    
    // Utilities - Direct references to service methods
    formatMVCValue: MVCService.formatMVCValue,
    formatThresholdValue: MVCService.formatThresholdValue,
    getEstimationMethodName: MVCService.getEstimationMethodName,
    getConfidenceLevelName: MVCService.getConfidenceLevelName,
  };
};