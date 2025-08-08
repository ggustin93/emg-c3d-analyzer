/**
 * MVC (Maximum Voluntary Contraction) Service
 * ===========================================
 * 
 * React service for MVC estimation, retrieval, and management.
 * Integrates with backend MVC service for clinical estimation and database persistence.
 */

import { EMGAnalysisResult } from '@/types/emg';

export interface MVCEstimationResult {
  mvc_value: number;
  threshold_value: number;
  threshold_percentage: number;
  estimation_method: 'database' | 'user_provided' | 'clinical_estimation' | 'signal_analysis';
  confidence_score: number;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface MVCEstimationResponse {
  status: 'success' | 'error';
  file_info: {
    filename: string;
    channels_processed: string[];
    sampling_rate: number;
  };
  mvc_estimations: Record<string, MVCEstimationResult>;
  error?: string;
}

export class MVCService {
  private static readonly BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  /**
   * Estimate MVC values from uploaded file
   */
  static async estimateMVC(
    file: File,
    options: {
      user_id?: string;
      session_id?: string;
      threshold_percentage?: number;
    } = {}
  ): Promise<MVCEstimationResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.user_id) formData.append('user_id', options.user_id);
    if (options.session_id) formData.append('session_id', options.session_id);
    if (options.threshold_percentage) formData.append('threshold_percentage', options.threshold_percentage.toString());

    try {
      const response = await fetch(`${this.BASE_URL}/mvc/estimate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MVC estimation failed:', error);
      throw error;
    }
  }

  /**
   * Extract MVC values from existing analysis result
   */
  static extractMVCFromAnalysis(analysisResult: EMGAnalysisResult): Record<string, MVCEstimationResult> | null {
    if (!analysisResult.analytics) return null;

    const mvcResults: Record<string, MVCEstimationResult> = {};

    for (const [channel, analytics] of Object.entries(analysisResult.analytics)) {
      if (analytics.mvc_threshold_actual_value !== null && 
          analytics.mvc_estimation_method) {
        
        // Calculate original MVC value from threshold
        const thresholdPercentage = analytics.mvc_threshold_percentage || 75;
        const mvcValue = analytics.mvc_threshold_actual_value / (thresholdPercentage / 100);

        mvcResults[channel] = {
          mvc_value: mvcValue,
          threshold_value: analytics.mvc_threshold_actual_value,
          threshold_percentage: thresholdPercentage,
          estimation_method: analytics.mvc_estimation_method as any,
          confidence_score: analytics.confidence_score || 0.8, // Default confidence
          metadata: {
            extracted_from_analysis: true,
            total_contractions: analytics.total_contractions,
            good_contractions: analytics.good_contractions,
            analysis_timestamp: analysisResult.timestamp
          },
          timestamp: new Date().toISOString()
        };
      }
    }

    return Object.keys(mvcResults).length > 0 ? mvcResults : null;
  }

  /**
   * Convert MVC results to session parameters format
   */
  static convertToSessionParameters(
    mvcResults: Record<string, MVCEstimationResult>
  ): {
    session_mvc_values: Record<string, number>;
    session_mvc_threshold_percentages: Record<string, number>;
  } {
    const mvcValues: Record<string, number> = {};
    const thresholdPercentages: Record<string, number> = {};

    for (const [channel, result] of Object.entries(mvcResults)) {
      mvcValues[channel] = result.mvc_value;
      thresholdPercentages[channel] = result.threshold_percentage;
    }

    return {
      session_mvc_values: mvcValues,
      session_mvc_threshold_percentages: thresholdPercentages
    };
  }

  /**
   * Validate MVC estimation quality
   */
  static validateEstimation(result: MVCEstimationResult): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check confidence score
    if (result.confidence_score < 0.5) {
      warnings.push('Low confidence score - consider manual verification');
    }

    // Check for reasonable MVC values
    if (result.mvc_value < 0.0001 || result.mvc_value > 0.01) {
      warnings.push('MVC value outside typical EMG range (0.1mV - 10mV)');
    }

    // Check estimation method
    if (result.estimation_method === 'signal_analysis') {
      warnings.push('Using fallback estimation method - may be inaccurate');
    }

    // Check metadata for signal quality indicators
    if (result.metadata.signal_length_seconds && result.metadata.signal_length_seconds < 10) {
      warnings.push('Short signal duration - estimation may be less reliable');
    }

    return {
      isValid: warnings.length === 0 || result.confidence_score > 0.7,
      warnings
    };
  }

  /**
   * Format MVC value for display
   */
  static formatMVCValue(value: number): string {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toExponential(3)} mV`;
  }

  /**
   * Format threshold value for display
   */
  static formatThresholdValue(value: number): string {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toExponential(3)} mV`;
  }

  /**
   * Get estimation method display name
   */
  static getEstimationMethodName(method: string): string {
    const methodNames: Record<string, string> = {
      'database': '📊 Database',
      'user_provided': '👤 User Provided',
      'clinical_estimation': '🤖 Clinical Algorithm',
      'signal_analysis': '📈 Signal Analysis',
      'backend_estimation': '🤖 Auto-estimated'
    };
    return methodNames[method] || method;
  }

  /**
   * Get confidence level description
   */
  static getConfidenceLevelName(score: number): string {
    if (score >= 0.9) return '🟢 Very High';
    if (score >= 0.7) return '🟡 High';
    if (score >= 0.5) return '🟠 Medium';
    if (score >= 0.3) return '🔴 Low';
    return '⚫ Very Low';
  }
}