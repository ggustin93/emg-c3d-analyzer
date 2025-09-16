/**
 * Enhanced Export Data Hook with Patient Code Integration
 * T016: Frontend hooks integration for patient code enhancement
 */

import { useCallback, useMemo } from 'react';
import { EMGAnalysisResult } from '@/types/emg';
import { ExportData } from '../types';
import { useExportData } from '../hooks';
import { usePatientCode } from './usePatientCode';

/**
 * Enhanced export data hook that integrates patient code functionality
 * Wraps the original useExportData hook and enhances it with patient code information
 */
export function useEnhancedExportData(
  analysisResult: EMGAnalysisResult | null,
  uploadedFileName: string | null | undefined,
  sessionParams: any
) {
  // Get original export data functionality
  const exportDataHook = useExportData(analysisResult, uploadedFileName, sessionParams);
  
  // Get patient code information
  const patientCodeHook = usePatientCode(analysisResult);

  // Enhanced generateExportData function that includes patient code
  const generateExportData = useCallback((isPreview: boolean = false): ExportData | null => {
    // Get base export data from original hook
    const baseExportData = exportDataHook.generateExportData(isPreview);
    
    if (!baseExportData) return null;

    // T016: Enhance export data with patient code information
    const enhancedExportData: ExportData = {
      ...baseExportData,
      metadata: {
        ...baseExportData.metadata,
        // Add patient code metadata
        patientCode: patientCodeHook.patientCode,
        patientCodeSource: patientCodeHook.source,
        patientCodeConfidence: patientCodeHook.confidence,
        // Add enhanced filename if available
        ...(patientCodeHook.enhancedFileName && {
          enhancedFileName: patientCodeHook.enhancedFileName
        })
      }
    };

    return enhancedExportData;
  }, [exportDataHook.generateExportData, patientCodeHook]);

  // Enhanced downloadData function that uses patient code for filename
  const downloadData = useCallback((format: 'json' | 'csv' = 'json') => {
    const exportData = generateExportData(false);
    if (!exportData) return;

    // Use enhanced filename if available, otherwise fall back to original
    const filename = patientCodeHook.enhancedFileName || 
                    exportData.metadata.fileName || 
                    'export_data';

    if (format === 'json') {
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename.replace('.c3d', '')}_analysis_export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // For CSV, we'll need to import the CSV generator
      import('../csvGenerator').then(({ generateCsvFromExportData }) => {
        generateCsvFromExportData(exportData, filename);
      }).catch(error => {
        console.error('Failed to generate CSV:', error);
      });
    }
  }, [generateExportData, patientCodeHook.enhancedFileName]);

  // Estimate export size with patient code considerations
  const estimatedSize = useMemo(() => {
    const baseSize = exportDataHook.estimatedSize || '0 KB';
    
    // Patient code metadata adds minimal size (< 1KB)
    // The enhancement is primarily in metadata fields
    return baseSize; // Patient code doesn't significantly affect size
  }, [exportDataHook.estimatedSize]);

  // Loading state includes both export preparation and patient code extraction
  const isGenerating = useMemo(() => {
    return exportDataHook.isGenerating || patientCodeHook.isLoading;
  }, [exportDataHook.isGenerating, patientCodeHook.isLoading]);

  // Error handling combines both export and patient code errors
  const error = useMemo(() => {
    return exportDataHook.error || patientCodeHook.error || null;
  }, [exportDataHook.error, patientCodeHook.error]);

  return {
    // Enhanced core functionality
    generateExportData,
    downloadData,
    estimatedSize,
    isGenerating,
    error,
    
    // Pass through all original export functionality
    ...exportDataHook,
    
    // Add patient code functionality
    patientCode: patientCodeHook,
    
    // Enhanced metadata for UI display
    enhancedMetadata: useMemo(() => ({
      patientCode: patientCodeHook.patientCode,
      patientCodeSource: patientCodeHook.source,
      patientCodeConfidence: patientCodeHook.confidence,
      enhancedFileName: patientCodeHook.enhancedFileName,
      isPatientCodeAvailable: patientCodeHook.isAvailable,
      confidenceDescription: patientCodeHook.confidenceDescription
    }), [patientCodeHook])
  };
}