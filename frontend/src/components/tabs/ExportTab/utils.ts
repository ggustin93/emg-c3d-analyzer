/**
 * Export Tab Utility Functions
 * Business logic and data transformation utilities
 */

import { EMGAnalysisResult } from '@/types/emg';
import { AvailableChannel, MusclePerformanceData } from './types';
import { PERFORMANCE_DEFAULTS } from './constants';
import { logger, LogCategory } from '@/services/logger';

// Patient code extraction utilities
export interface PatientCodeResult {
  patientCode: string | null;
  source: 'patient_id' | 'filename' | 'session_metadata' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extracts available channels from analysis result
 */
export function extractAvailableChannels(analysisResult: EMGAnalysisResult | null): AvailableChannel[] {
  if (!analysisResult?.emg_signals) return [];

  const channelMap = new Map<string, AvailableChannel>();
  
  const normalizeBaseName = (name: string): string => {
    let parts = name.trim().replace(/\s+/g, ' ').split(' ');
    const suffixes = new Set(['raw', 'activated', 'processed', 'rms', 'envelope']);
    while (parts.length > 1 && suffixes.has(parts[parts.length - 1].toLowerCase())) {
      parts.pop();
    }
    return parts.join(' ');
  };
  
  Object.keys(analysisResult.emg_signals).forEach(channelName => {
    // Normalize base names by removing common suffixes (robust)
    const baseName = normalizeBaseName(channelName);
    const isRaw = /\bRaw$/i.test(channelName);
    const isActivated = /\bactivated$/i.test(channelName);
    const isProcessedChannel = /\bProcessed$/i.test(channelName);
    
    if (!channelMap.has(baseName)) {
      channelMap.set(baseName, {
        baseName,
        hasRaw: false,
        hasActivated: false,
        hasProcessedRms: false
      });
    }
    
    const channel = channelMap.get(baseName)!;
    if (isRaw) channel.hasRaw = true;
    if (isActivated) channel.hasActivated = true;
    // Also consider a channel as having processed RMS if:
    // 1) its raw entry contains an RMS envelope, or
    // 2) there exists a separate "Processed" channel entry
    if (isRaw) {
      const rawData = analysisResult.emg_signals[channelName] as any;
      if (rawData && Array.isArray(rawData.rms_envelope) && rawData.rms_envelope.length > 0) {
        channel.hasProcessedRms = true;
      }
    }
    if (isProcessedChannel) {
      channel.hasProcessedRms = true;
    }
  });
  
  return Array.from(channelMap.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
}

/**
 * Downsamples an array by taking every Nth element
 */
export function downsampleArray(array: number[], samplingRate: number): number[] {
  if (samplingRate === 1) return array;
  return array.filter((_, index) => index % samplingRate === 0);
}

/**
 * Detects the original filename from various sources
 */
export function detectOriginalFilename(
  uploadedFileName: string | null | undefined,
  analysisResult: EMGAnalysisResult | null
): string {
  // Priority order for filename detection
  let detectedFilename = uploadedFileName;
  
  if (!detectedFilename && analysisResult?.source_filename) {
    detectedFilename = analysisResult.source_filename;
  }
  
  // If still no filename, try to construct from game metadata
  if (!detectedFilename && analysisResult?.metadata?.game_name) {
    const sessionDate = analysisResult.metadata.session_date || new Date().toISOString().split('T')[0];
    detectedFilename = `${analysisResult.metadata.game_name}_${sessionDate}.c3d`;
  }
  
  // Final fallback
  if (!detectedFilename) {
    detectedFilename = 'unknown.c3d';
  }
  
  // Clean up the filename (remove any path components)
  if (detectedFilename.includes('/') || detectedFilename.includes('\\')) {
    detectedFilename = detectedFilename.split(/[/\\]/).pop() || 'unknown.c3d';
  }
  
  return detectedFilename;
}

/**
 * Calculates performance subscores for a muscle
 */
export function calculateMusclePerformance(
  analytics: any,
  expectedContractions: number,
  durationThreshold: number
): MusclePerformanceData['compliance_subscores'] {
  const totalContractions = analytics.contraction_count || 0;
  const goodContractions = analytics.good_contraction_count || 0;
  
  // Count contractions that meet MVC threshold and duration threshold separately
  let mvcContractions = analytics.mvc75_compliance_rate || 0;
  let durationContractions = analytics.duration_compliance_rate || 0;
  
  // If backend doesn't provide these counts, calculate from contractions array
  if (analytics.contractions && Array.isArray(analytics.contractions)) {
    if (mvcContractions === 0 && analytics.mvc75_compliance_rate === undefined) {
      mvcContractions = analytics.contractions.filter((c: any) => c.meets_mvc === true).length;
    }
    if (durationContractions === 0 && analytics.duration_compliance_rate === undefined) {
      durationContractions = analytics.contractions.filter((c: any) => c.meets_duration === true).length;
    }
  }
  
  // R_comp: Completion Rate
  const completionRate = expectedContractions > 0 ? 
    Math.min(totalContractions / expectedContractions, 1.0) : 0;
  
  // R_int: Intensity Rate (≥75% MVC) - use contractions that meet MVC, not just good ones
  const intensityRate = totalContractions > 0 ? 
    (mvcContractions / totalContractions) : 0;
  
  // R_dur: Duration Rate (≥threshold) - use contractions that meet duration, not just good ones
  const durationRate = totalContractions > 0 ? 
    (durationContractions / totalContractions) : 0;
  
  // S_comp^muscle: Per-muscle compliance (equal weights: 1/3 each)
  const muscleCompliance = (completionRate + intensityRate + durationRate) / 3;

  return {
    completion_rate: {
      value: completionRate,
      percentage: (completionRate * 100).toFixed(1) + '%',
      formula: `${totalContractions}/${expectedContractions}`,
      description: "Fraction of prescribed contractions completed"
    },
    intensity_rate: {
      value: intensityRate,
      percentage: (intensityRate * 100).toFixed(1) + '%',
      formula: `${mvcContractions}/${totalContractions}`,
      description: "Fraction of contractions ≥75% MVC threshold"
    },
    duration_rate: {
      value: durationRate,
      percentage: (durationRate * 100).toFixed(1) + '%',
      formula: `contractions≥${durationThreshold}ms/${totalContractions}`,
      description: "Fraction of contractions meeting duration threshold"
    },
    muscle_compliance: {
      value: muscleCompliance,
      percentage: (muscleCompliance * 100).toFixed(1) + '%',
      formula: "(R_comp + R_int + R_dur) / 3",
      description: "Combined per-muscle compliance score"
    }
  };
}

/**
 * Determines the expected contractions for a channel
 */
export function getExpectedContractions(
  params: any,
  channelIndex: number,
  defaultValue: number = PERFORMANCE_DEFAULTS.expectedContractions
): number {
  if (!params) return defaultValue;
  
  const perChannelKey = `session_expected_contractions_ch${channelIndex + 1}`;
  if (params.hasOwnProperty(perChannelKey)) {
    return params[perChannelKey] ?? defaultValue;
  }
  
  return params.session_expected_contractions || defaultValue;
}

/**
 * Checks if channel is a raw EMG channel
 */
export function isRawChannel(channelName: string): boolean {
  return channelName.toLowerCase().includes('raw');
}

/**
 * Checks if channel is an activated EMG channel
 */
export function isActivatedChannel(channelName: string): boolean {
  return channelName.toLowerCase().includes('activated');
}

/**
 * Formats bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================================
// PATIENT CODE EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract patient code from patient_id via database lookup
 * T009: Database integration for patient code resolution
 */
export async function extractPatientCodeFromPatientId(patientId: string): Promise<PatientCodeResult> {
  if (!patientId || typeof patientId !== 'string') {
    return {
      patientCode: null,
      source: 'patient_id',
      confidence: 'low'
    };
  }

  try {
    // Import Supabase client dynamically to avoid circular dependencies
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.warn(LogCategory.DATA_PROCESSING, 'Supabase configuration missing for patient code lookup');
      return {
        patientCode: null,
        source: 'patient_id',
        confidence: 'low'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query the users table for patient code
    // Note: This assumes a 'patient_code' field exists in the auth.users table or related table
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('patient_code')
      .eq('id', patientId)
      .single();

    if (userError || !userData?.patient_code) {
      // Try alternative approach: query sessions table for patient code
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('patient_code, user_id')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !sessionData?.patient_code) {
        return {
          patientCode: null,
          source: 'patient_id',
          confidence: 'low'
        };
      }

      // Validate patient code format (P### pattern)
      const patientCode = sessionData.patient_code;
      if (!/^P\d{3}$/.test(patientCode)) {
        return {
          patientCode: patientCode, // Return as-is but low confidence
          source: 'patient_id',
          confidence: 'medium'
        };
      }

      return {
        patientCode,
        source: 'patient_id',
        confidence: 'high'
      };
    }

    // Validate patient code format from user profile
    const patientCode = userData.patient_code;
    if (!/^P\d{3}$/.test(patientCode)) {
      return {
        patientCode: patientCode, // Return as-is but lower confidence
        source: 'patient_id',
        confidence: 'medium'
      };
    }

    return {
      patientCode,
      source: 'patient_id',
      confidence: 'high'
    };

  } catch (error) {
    logger.warn(LogCategory.DATA_PROCESSING, 'Error extracting patient code from patient_id:', error);
    return {
      patientCode: null,
      source: 'patient_id',
      confidence: 'low'
    };
  }
}

/**
 * Extract patient code from source filename pattern (P###/Ghostly_Emg_*)
 * T010: Pattern matching implementation for filename-based extraction
 */
export function extractPatientCodeFromFilename(filename: string): PatientCodeResult {
  if (!filename || typeof filename !== 'string') {
    return {
      patientCode: null,
      source: 'filename',
      confidence: 'low'
    };
  }

  // Clean filename: remove any leading/trailing whitespace and normalize paths
  const cleanFilename = filename.trim().replace(/\\/g, '/');
  
  // Primary pattern: P###/Ghostly_Emg_* format (most common)
  const primaryPattern = /(?:^|\/)(P\d{3})\/.*Ghostly_Emg_.*\.c3d$/i;
  const primaryMatch = cleanFilename.match(primaryPattern);
  
  if (primaryMatch && primaryMatch[1]) {
    const patientCode = primaryMatch[1].toUpperCase();
    return {
      patientCode,
      source: 'filename',
      confidence: 'high'
    };
  }
  
  // Secondary pattern: P###/any_file.c3d format
  const secondaryPattern = /(?:^|\/)(P\d{3})\/.*\.c3d$/i;
  const secondaryMatch = cleanFilename.match(secondaryPattern);
  
  if (secondaryMatch && secondaryMatch[1]) {
    const patientCode = secondaryMatch[1].toUpperCase();
    return {
      patientCode,
      source: 'filename',
      confidence: 'high'
    };
  }
  
  // Tertiary pattern: filename starts with P### (P###_anything.c3d)
  const tertiaryPattern = /(?:^|\/)(P\d{3})_.*\.c3d$/i;
  const tertiaryMatch = cleanFilename.match(tertiaryPattern);
  
  if (tertiaryMatch && tertiaryMatch[1]) {
    const patientCode = tertiaryMatch[1].toUpperCase();
    return {
      patientCode,
      source: 'filename',
      confidence: 'medium'
    };
  }
  
  // Quaternary pattern: P### anywhere in filename (less reliable)
  const quaternaryPattern = /(P\d{3})/i;
  const quaternaryMatch = cleanFilename.match(quaternaryPattern);
  
  if (quaternaryMatch && quaternaryMatch[1]) {
    const patientCode = quaternaryMatch[1].toUpperCase();
    // Lower confidence because it could be false positive
    return {
      patientCode,
      source: 'filename',
      confidence: 'medium'
    };
  }
  
  // Fallback pattern: look for any 3-digit number preceded by P (case insensitive)
  const fallbackPattern = /[Pp](\d{3})/;
  const fallbackMatch = cleanFilename.match(fallbackPattern);
  
  if (fallbackMatch && fallbackMatch[1]) {
    const patientCode = `P${fallbackMatch[1]}`;
    return {
      patientCode,
      source: 'filename',
      confidence: 'low'
    };
  }
  
  // No patient code found
  return {
    patientCode: null,
    source: 'filename',
    confidence: 'low'
  };
}

/**
 * Unified patient code extraction with fallback chain
 * T011: Comprehensive extraction logic with multiple sources
 * Priority: patient_id → filename → session_metadata → unknown
 */
export async function getPatientCode(analysisResult: EMGAnalysisResult): Promise<PatientCodeResult> {
  if (!analysisResult) {
    return {
      patientCode: null,
      source: 'unknown',
      confidence: 'low'
    };
  }

  // Strategy 1: Extract from patient_id (highest priority and confidence)
  if (analysisResult.patient_id) {
    try {
      const patientIdResult = await extractPatientCodeFromPatientId(analysisResult.patient_id);
      if (patientIdResult.patientCode) {
        return patientIdResult;
      }
    } catch (error) {
      logger.warn(LogCategory.DATA_PROCESSING, 'Patient ID extraction failed, falling back to filename:', error);
    }
  }

  // Strategy 2: Extract from source filename (high confidence if pattern matches)
  let lowConfidenceFilenameResult: PatientCodeResult | null = null;
  if (analysisResult.source_filename) {
    const filenameResult = extractPatientCodeFromFilename(analysisResult.source_filename);
    if (filenameResult.patientCode && filenameResult.confidence !== 'low') {
      return filenameResult;
    }
    // Store low-confidence filename result as fallback
    lowConfidenceFilenameResult = filenameResult.confidence === 'low' ? filenameResult : null;
  }

  // Strategy 3: Extract from session metadata (medium confidence)
  if (analysisResult.metadata || (analysisResult as any).session_parameters) {
    const sessionMetadata: any = analysisResult.metadata || (analysisResult as any).session_parameters;
    
    // Check for direct patient_code field
    if (sessionMetadata.patient_code && typeof sessionMetadata.patient_code === 'string') {
      const patientCode = sessionMetadata.patient_code.trim().toUpperCase();
      
      // Validate P### format
      if (/^P\d{3}$/.test(patientCode)) {
        return {
          patientCode,
          source: 'session_metadata',
          confidence: 'high'
        };
      } else {
        return {
          patientCode,
          source: 'session_metadata',
          confidence: 'medium'
        };
      }
    }
    
    // Check for patient_id field in metadata
    if (sessionMetadata.patient_id && typeof sessionMetadata.patient_id === 'string') {
      try {
        const metadataPatientIdResult = await extractPatientCodeFromPatientId(sessionMetadata.patient_id);
        if (metadataPatientIdResult.patientCode) {
          return {
            ...metadataPatientIdResult,
            source: 'session_metadata'
          };
        }
      } catch (error) {
        logger.warn(LogCategory.DATA_PROCESSING, 'Session metadata patient_id extraction failed:', error);
      }
    }
    
    // Check for filename field in metadata
    if (sessionMetadata.filename || sessionMetadata.source_filename) {
      const metadataFilename = sessionMetadata.filename || sessionMetadata.source_filename;
      const metadataFilenameResult = extractPatientCodeFromFilename(metadataFilename);
      if (metadataFilenameResult.patientCode && metadataFilenameResult.confidence !== 'low') {
        return {
          ...metadataFilenameResult,
          source: 'session_metadata'
        };
      }
    }
  }

  // Strategy 4: Return low-confidence filename result if available
  if (lowConfidenceFilenameResult && lowConfidenceFilenameResult.patientCode) {
    return lowConfidenceFilenameResult;
  }

  // Strategy 5: Last resort - check if there's any P### pattern in file_id or session_id
  const idsToCheck = [
    analysisResult.file_id,
    analysisResult.session_id,
    (analysisResult as any).id
  ].filter(Boolean);

  for (const id of idsToCheck) {
    if (typeof id === 'string') {
      const idResult = extractPatientCodeFromFilename(id); // Reuse pattern matching logic
      if (idResult.patientCode) {
        return {
          patientCode: idResult.patientCode,
          source: 'session_metadata',
          confidence: 'low'
        };
      }
    }
  }

  // No patient code found through any method
  return {
    patientCode: null,
    source: 'unknown',
    confidence: 'low'
  };
}