/**
 * EMG Chart Configuration Constants
 * Centralized configuration for EMG chart visualization and analysis
 */

export const EMG_CHART_CONFIG = {
  // MVC Threshold Configuration
  MVC_THRESHOLD_PERCENTAGE: 75,
  DEFAULT_MVC_THRESHOLD_PERCENTAGE: 75,
  
  // Duration Thresholds (in milliseconds)
  DEFAULT_DURATION_THRESHOLD_MS: 2000,
  DURATION_THRESHOLD_CONVERSION_FACTOR: 1000, // seconds to milliseconds
  
  // Chart Visualization
  Y_AXIS: {
    PADDING_FACTOR: 0.1,
    THRESHOLD_MULTIPLIER: {
      MIN: 0.8,
      MAX: 1.2
    }
  },
  
  // Overlay Mode Configuration
  OVERLAY: {
    RAW_OPACITY: 0.4,
    RMS_OPACITY: 1.0,
    RAW_STROKE_WIDTH: 1.5,
    RMS_STROKE_WIDTH: 3.0
  },
  
  // Chart Styling
  STROKE_WIDTH: {
    DEFAULT: 2.5,
    REFERENCE_LINE: 2.5,
    REFERENCE_AREA: 2.25,
    REFERENCE_DOT: 2.25
  },
  
  // Chart Layout
  MARGINS: {
    top: 5,
    right: 30,
    left: 20,
    bottom: 25
  },
  
  CHART_SIZE: {
    HEIGHT: 500,
    LEGEND_HEIGHT: 36
  },
  
  // Tooltip Configuration
  TOOLTIP: {
    WIDTH: '28rem',
    Z_INDEX: 999,
    OFFSET: 8
  },
  
  // Data Processing
  PREVIEW: {
    LIMIT: 5,
    NOTE: "🔍 PREVIEW MODE: This is a limited extract showing only sample data (5 points per array)",
    DOWNLOAD_NOTE: "📥 Complete datasets with ALL data points available in file download"
  },
  
  // Performance Thresholds
  PERFORMANCE: {
    MAX_DATA_POINTS: 10000,
    DEBOUNCE_MS: 100,
    RENDER_TIMEOUT_MS: 16 // ~60fps
  },
  
  // Clinical Standards
  CLINICAL: {
    GOOD_CONTRACTION_COLOR: '#22c55e', // green-500
    PARTIAL_CONTRACTION_COLOR: '#eab308', // yellow-500  
    POOR_CONTRACTION_COLOR: '#ef4444', // red-500
    MVC_LINE_COLOR: '#f97316', // orange-500
    
    CONTRACTION_DOT_RADIUS: 6,
    BRUSH_HEIGHT: 30,
    BRUSH_COLOR: '#1abc9c'
  },
  
  // Debug Configuration
  DEBUG: {
    ENABLED: process.env.NODE_ENV === 'development',
    LOG_LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'error'
  }
} as const;

// Type for chart configuration
export type EMGChartConfigType = typeof EMG_CHART_CONFIG;

// Helper functions for configuration access
export const getThresholdMultiplier = (type: 'min' | 'max') => 
  EMG_CHART_CONFIG.Y_AXIS.THRESHOLD_MULTIPLIER[type.toUpperCase() as 'MIN' | 'MAX'];

export const getOverlayOpacity = (signalType: 'raw' | 'rms') => 
  signalType === 'raw' ? EMG_CHART_CONFIG.OVERLAY.RAW_OPACITY : EMG_CHART_CONFIG.OVERLAY.RMS_OPACITY;

export const getStrokeWidth = (elementType: keyof typeof EMG_CHART_CONFIG.STROKE_WIDTH) =>
  EMG_CHART_CONFIG.STROKE_WIDTH[elementType];