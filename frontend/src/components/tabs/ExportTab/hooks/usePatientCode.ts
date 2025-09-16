/**
 * Patient Code Hook
 * T016: Frontend integration for patient code extraction and management
 */

import { useState, useEffect, useMemo } from 'react';
import { EMGAnalysisResult } from '@/types/emg';
import { getPatientCode, type PatientCodeResult } from '../utils';

/**
 * Hook for managing patient code extraction and state
 * Provides patient code information for export enhancement
 */
export function usePatientCode(analysisResult: EMGAnalysisResult | null) {
  const [patientCodeResult, setPatientCodeResult] = useState<PatientCodeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract patient code when analysis result changes
  useEffect(() => {
    if (!analysisResult) {
      setPatientCodeResult(null);
      setError(null);
      return;
    }

    const extractPatientCode = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getPatientCode(analysisResult);
        setPatientCodeResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to extract patient code');
        setPatientCodeResult({
          patientCode: null,
          source: 'unknown',
          confidence: 'low'
        });
      } finally {
        setIsLoading(false);
      }
    };

    extractPatientCode();
  }, [analysisResult]);

  // Enhanced filename with patient code prefix
  const enhancedFileName = useMemo(() => {
    if (!patientCodeResult?.patientCode || patientCodeResult.confidence === 'low') {
      return null;
    }

    // Get original filename from analysis result
    const originalFilename = analysisResult?.source_filename || 'unknown.c3d';
    const cleanFilename = originalFilename.split('/').pop() || originalFilename;

    // Only enhance if not already prefixed
    if (!cleanFilename.startsWith(patientCodeResult.patientCode)) {
      return `${patientCodeResult.patientCode}_${cleanFilename}`;
    }

    return cleanFilename;
  }, [patientCodeResult, analysisResult]);

  // Patient code display information
  const displayInfo = useMemo(() => {
    if (!patientCodeResult) return null;

    return {
      code: patientCodeResult.patientCode,
      source: patientCodeResult.source,
      confidence: patientCodeResult.confidence,
      isAvailable: Boolean(patientCodeResult.patientCode),
      isHighConfidence: patientCodeResult.confidence === 'high',
      isMediumConfidence: patientCodeResult.confidence === 'medium',
      isLowConfidence: patientCodeResult.confidence === 'low'
    };
  }, [patientCodeResult]);

  // Confidence description for tooltips
  const confidenceDescription = useMemo(() => {
    if (!patientCodeResult) return null;

    const { source, confidence } = patientCodeResult;
    
    const descriptions = {
      'patient_id': {
        'high': 'Patient code extracted from patient_id with high reliability',
        'medium': 'Patient code extracted from patient_id but format validation failed',
        'low': 'Patient code extraction from patient_id failed'
      },
      'filename': {
        'high': 'Patient code extracted from filename pattern with high confidence',
        'medium': 'Patient code found in filename but with lower pattern confidence',
        'low': 'Patient code extraction from filename failed'
      },
      'session_metadata': {
        'high': 'Patient code found in session metadata with high confidence',
        'medium': 'Patient code found in session metadata with moderate confidence',
        'low': 'Patient code extraction from session metadata failed'
      },
      'unknown': {
        'high': 'Patient code source unknown but high confidence',
        'medium': 'Patient code source unknown with moderate confidence',
        'low': 'Patient code unavailable - no valid extraction method found'
      }
    };

    return descriptions[source]?.[confidence] || 'Patient code confidence assessment unavailable';
  }, [patientCodeResult]);

  return {
    // Core patient code data
    patientCodeResult,
    
    // Loading and error states
    isLoading,
    error,
    
    // Enhanced filename
    enhancedFileName,
    
    // Display information
    displayInfo,
    confidenceDescription,
    
    // Convenience getters
    patientCode: patientCodeResult?.patientCode || null,
    source: patientCodeResult?.source || 'unknown',
    confidence: patientCodeResult?.confidence || 'low',
    isAvailable: Boolean(patientCodeResult?.patientCode),
    
    // Refresh function for manual re-extraction
    refresh: () => {
      if (analysisResult) {
        const extractPatientCode = async () => {
          setIsLoading(true);
          setError(null);

          try {
            const result = await getPatientCode(analysisResult);
            setPatientCodeResult(result);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to extract patient code');
            setPatientCodeResult({
              patientCode: null,
              source: 'unknown',
              confidence: 'low'
            });
          } finally {
            setIsLoading(false);
          }
        };

        extractPatientCode();
      }
    }
  };
}