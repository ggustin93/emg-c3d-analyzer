/**
 * Export Tab Utility Functions
 * Business logic and data transformation utilities
 */

import { EMGAnalysisResult } from '@/types/emg';
import { AvailableChannel, MusclePerformanceData } from './types';
import { PERFORMANCE_DEFAULTS } from './constants';

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
  
  // R_comp: Completion Rate
  const completionRate = expectedContractions > 0 ? 
    Math.min(totalContractions / expectedContractions, 1.0) : 0;
  
  // R_int: Intensity Rate (≥75% MVC) 
  const intensityRate = totalContractions > 0 ? 
    (goodContractions / totalContractions) : 0;
  
  // R_dur: Duration Rate (≥2s threshold)
  const durationRate = totalContractions > 0 ? 
    (goodContractions / totalContractions) : 0; // Approximation
  
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
      formula: `${goodContractions}/${totalContractions}`,
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