/**
 * CSV Export with Patient Code Integration Tests
 * TDD setup - these tests MUST FAIL initially before implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCsvFromExportData, canGenerateCsv, estimateCsvSize } from '../csvGenerator';
import type { ExportData } from '../types';
import type { EMGAnalysisResult } from '@/types/emg';

// Mock DOM for file download testing
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement.mockReturnValue({
    href: '',
    download: '',
    click: mockClick
  }),
});
Object.defineProperty(document.body, 'appendChild', { value: mockAppendChild });
Object.defineProperty(document.body, 'removeChild', { value: mockRemoveChild });

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock console.log to verify CSV generation
const mockConsoleLog = vi.fn();
console.log = mockConsoleLog;

const mockExportDataWithPatientCode: ExportData = {
  metadata: {
    exportDate: '2025-01-17T10:00:00Z',
    fileName: 'P012_Ghostly_Emg_20230321_17-23-09-0409.c3d',
    exportVersion: '2.0',
    exportOptions: {
      includeAnalytics: true,
      includeSessionParams: true,
      includePerformanceAnalysis: true,
      includeC3dMetadata: true,
      format: 'csv'
    },
    // NEW: Patient code information
    patientCode: 'P012',
    patientCodeSource: 'filename',
    patientCodeConfidence: 'high'
  },
  analytics: {
    'Channel 1': {
      contraction_count: 15,
      avg_duration_ms: 2500,
      total_time_under_tension_ms: 37500
    },
    'Channel 2': {
      contraction_count: 14,
      avg_duration_ms: 2300,
      total_time_under_tension_ms: 32200
    }
  },
  sessionParameters: {
    rpe_pre_session: 4,
    rpe_post_session: 6,
    mvc_threshold_ch1: 0.75,
    session_duration_seconds: 300
  }
};

describe('CSV Export with Patient Code Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCsvFromExportData with patient code', () => {
    it('should include patient code in CSV metadata section - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'test_file.c3d');
      
      // TDD: This test MUST fail until T011 is implemented
      // Verify Blob was created with patient code in content
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      expect(csvContent).toContain('"Patient Code","P012"');
      expect(csvContent).toContain('# Patient: P012 - EMG Analysis Export Report');
    });

    it('should include patient code source and confidence in metadata - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'test_file.c3d');
      
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      expect(csvContent).toContain('"Patient Code Source","filename"');
      expect(csvContent).toContain('"Patient Code Confidence","high"');
    });

    it('should enhance filename with patient code prefix - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'Ghostly_Emg_20230321_17-23-09-0409.c3d');
      
      // TDD: This test MUST fail until T020 is implemented
      expect(mockCreateElement().download).toBe('P012_Ghostly_Emg_20230321_17-23-09-0409_analysis_report.csv');
    });

    it('should handle missing patient code gracefully - MUST FAIL initially', () => {
      const mockWithoutPatientCode = {
        ...mockExportDataWithPatientCode,
        metadata: {
          ...mockExportDataWithPatientCode.metadata,
          patientCode: null,
          patientCodeSource: 'unknown' as const,
          patientCodeConfidence: 'low' as const
        }
      };
      
      generateCsvFromExportData(mockWithoutPatientCode, 'test_file.c3d');
      
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      expect(csvContent).toContain('"Patient Code","N/A"');
      expect(csvContent).not.toContain('# Patient: P012');
      expect(mockCreateElement().download).toBe('test_file_analysis_report.csv');
    });

    it('should include patient code in CSV header section - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'test_file.c3d');
      
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      // Should have enhanced header with patient identification
      expect(csvContent).toContain('# Patient: P012 - EMG Analysis Export Report');
      expect(csvContent).toContain('# Source File: P012_Ghostly_Emg_20230321_17-23-09-0409.c3d');
    });
  });

  describe('Patient code in various CSV sections', () => {
    it('should include patient code in file metadata section - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'test_file.c3d');
      
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      expect(csvContent).toContain('"=== FILE METADATA ==="');
      expect(csvContent).toContain('"Patient Code","P012"');
      expect(csvContent).toContain('"Patient Code Source","filename"');
    });

    it('should include patient code in export information footer - MUST FAIL initially', () => {
      generateCsvFromExportData(mockExportDataWithPatientCode, 'test_file.c3d');
      
      const [blobArg] = (global.Blob as any).mock.calls[0];
      const csvContent = blobArg[0];
      
      expect(csvContent).toContain('"=== EXPORT INFORMATION ==="');
      expect(csvContent).toContain('"Patient Code","P012"');
    });
  });

  describe('estimateCsvSize with patient code', () => {
    it('should account for patient code data in size estimation - MUST FAIL initially', () => {
      const sizeWithoutPatientCode = estimateCsvSize({
        ...mockExportDataWithPatientCode,
        metadata: {
          ...mockExportDataWithPatientCode.metadata,
          patientCode: null
        }
      });
      
      const sizeWithPatientCode = estimateCsvSize(mockExportDataWithPatientCode);
      
      // TDD: This test MUST fail until patient code size calculation is implemented
      expect(sizeWithPatientCode).not.toBe(sizeWithoutPatientCode);
      expect(sizeWithPatientCode).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
    });
  });

  describe('Error handling', () => {
    it('should handle null export data gracefully - MUST FAIL initially', () => {
      expect(() => generateCsvFromExportData(null as any, 'test.c3d')).not.toThrow();
      
      // Should log error message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No export data available for CSV generation')
      );
    });

    it('should handle malformed patient code data - MUST FAIL initially', () => {
      const malformedData = {
        ...mockExportDataWithPatientCode,
        metadata: {
          ...mockExportDataWithPatientCode.metadata,
          patientCode: undefined, // Malformed
          patientCodeSource: null as any // Malformed
        }
      };
      
      expect(() => generateCsvFromExportData(malformedData, 'test.c3d')).not.toThrow();
    });
  });

  describe('Backward compatibility', () => {
    it('should work with export data without patient code fields - MUST FAIL initially', () => {
      const legacyExportData = {
        metadata: {
          exportDate: '2025-01-17T10:00:00Z',
          fileName: 'legacy_file.c3d',
          exportVersion: '1.0',
          exportOptions: {
            includeAnalytics: true,
            includeSessionParams: false,
            includePerformanceAnalysis: false,
            includeC3dMetadata: false,
            format: 'csv' as const
          }
          // No patient code fields
        },
        analytics: { 'Channel 1': { contraction_count: 5 } }
      };
      
      expect(() => generateCsvFromExportData(legacyExportData, 'legacy.c3d')).not.toThrow();
      expect(mockCreateElement().download).toBe('legacy_analysis_report.csv');
    });
  });
});