/**
 * Export Tab Module Index
 * Centralized exports for the Export Tab components and utilities
 */

// Main component
export { default as ExportTab } from './ExportTab';

// Sub-components
export { ChannelSelector } from './ChannelSelector';
export { DownsamplingControl } from './DownsamplingControl';
export { ExportOptionsPanel } from './ExportOptionsPanel';
export { ExportActions } from './ExportActions';

// Custom hooks
export { useExportData } from './hooks';

// Types
export type {
  ExportOptions,
  DownsamplingOptions,
  ChannelSelection,
  ChannelSelectionMap,
  AvailableChannel,
  PerformanceSubscore,
  MusclePerformanceData,
  ExportData,
  DownsamplingRate
} from './types';

// Constants
export {
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_DOWNSAMPLING_OPTIONS,
  DOWNSAMPLING_RATES,
  PERFORMANCE_DEFAULTS,
  EXPORT_VERSION,
  FILE_SIZE_INFO,
  TOGGLE_STYLES
} from './constants';

// Utilities
export {
  extractAvailableChannels,
  downsampleArray,
  detectOriginalFilename,
  calculateMusclePerformance,
  getExpectedContractions,
  isRawChannel,
  isActivatedChannel,
  formatBytes
} from './utils';