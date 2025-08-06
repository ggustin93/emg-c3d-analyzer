/**
 * Tabs Components
 * Feature-based tab organization for the EMG C3D Analyzer
 */

// Main tab orchestrator
export * from './shared';

// Individual tab components
export * from './SignalPlotsTab';
export * from './GameStatsTab';
export * from './PerformanceTab';
export * from './BFRMonitoringTab';

// ExportTab moved to tabs structure
export { default as ExportTab } from './ExportTab/ExportTab';