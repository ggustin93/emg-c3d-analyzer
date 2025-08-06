/**
 * Export Tab Constants and Configuration
 * Centralized configuration for the Export Tab component
 */

// Default Export Options
export const DEFAULT_EXPORT_OPTIONS = {
  includeAnalytics: true,
  includeSessionParams: true,
  includePerformanceAnalysis: true,
  includeC3dMetadata: true,
} as const;

// Downsampling Configuration
export const DEFAULT_DOWNSAMPLING_OPTIONS = {
  enabled: false,
  samplingRate: 10, // Default to 1/10 sampling
} as const;

export const DOWNSAMPLING_RATES = [
  { value: 5, label: "1/5", size: "2-5MB" },
  { value: 10, label: "1/10", size: "1-2.5MB", recommended: true },
  { value: 50, label: "1/50", size: "200-500KB" },
  { value: 100, label: "1/100", size: "100-250KB" },
] as const;

// Performance Thresholds
export const PERFORMANCE_DEFAULTS = {
  expectedContractions: 12, // Default from GHOSTLY+ protocol
  durationThreshold: 2000, // 2s default
} as const;

// Export Metadata
export const EXPORT_VERSION = '1.0.0';

// File Size Estimates
export const FILE_SIZE_INFO = {
  perChannel: {
    min: 10, // MB
    max: 25, // MB
  },
  tooltips: {
    downsampling: "Downsampling preserves signal shape while dramatically reducing file size",
    c3dMetadata: "Original game metadata, player information, and session parameters",
    analytics: "Clinical EMG analysis metrics including RMS, MAV, MPF, MDF, fatigue indices, and contraction detection results",
    sessionParams: "Therapeutic configuration including MVC thresholds, duration settings, expected contractions, and BFR parameters",
    performanceAnalysis: "Compliance scoring, symmetry analysis, therapeutic effectiveness metrics, and quality assessment data",
  },
} as const;

// Style Classes
export const TOGGLE_STYLES = {
  active: 'border-primary/30 bg-primary/10 ring-1 ring-primary/30',
  inactive: 'border-border bg-muted/50 hover:border-primary/50',
  control: 'border-border bg-muted/30 hover:bg-muted/50', // For controls like downsampling
} as const;