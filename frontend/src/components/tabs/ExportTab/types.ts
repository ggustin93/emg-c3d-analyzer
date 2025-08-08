/**
 * Export Tab Type Definitions
 * Type safety for the Export Tab component and its utilities
 */

export interface ExportOptions {
  includeAnalytics: boolean;
  includeSessionParams: boolean;
  includePerformanceAnalysis: boolean;
  includeC3dMetadata: boolean;
}

export interface DownsamplingOptions {
  enabled: boolean;
  samplingRate: number;
}

export interface ChannelSelection {
  includeRaw: boolean;
  includeActivated: boolean;
  includeProcessedRms: boolean;
}

export interface ChannelSelectionMap {
  [channelName: string]: ChannelSelection;
}

export interface AvailableChannel {
  baseName: string;
  hasRaw: boolean;
  hasActivated: boolean;
  hasProcessedRms: boolean;
}

export interface PerformanceSubscore {
  value: number;
  percentage: string;
  formula: string;
  description: string;
}

export interface MusclePerformanceData {
  compliance_subscores: {
    completion_rate: PerformanceSubscore;
    intensity_rate: PerformanceSubscore;
    duration_rate: PerformanceSubscore;
    muscle_compliance: PerformanceSubscore;
  };
  raw_metrics: {
    contractions: {
      total: number;
      good: number;
      poor: number;
      expected: number;
    };
    timing: {
      average_duration_ms: number;
      total_active_time_ms: number;
      min_duration_ms: number;
      max_duration_ms: number;
    };
    intensity: {
      average_amplitude: number;
      max_amplitude: number;
      mvc_threshold: number;
      mvc_percentage_achieved: number;
    };
    fatigue: {
      dimitrov_index: number | null;
      median_frequency_slope: number | null;
      estimated_fatigue_percentage: number | null;
    };
  };
}

export interface ExportData {
  metadata: {
    exportDate: string;
    fileName: string;
    exportVersion: string;
    exportOptions: ExportOptions;
  };
  originalMetadata?: any;
  sessionParameters?: any;
  analytics?: any;
  processedSignals?: any;
  performanceAnalysis?: any;
  c3dParameters?: any;
}

export interface DownsamplingRate {
  value: number;
  label: string;
  size: string;
  recommended?: boolean;
}