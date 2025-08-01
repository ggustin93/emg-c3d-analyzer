export interface EMGPoint {
  time: number;
  value: number;
}

export interface ContractionDetectionParameters {
  // Paramètres de base
  threshold_factor: number;          // 0.1-0.5 (défaut: 0.3)
  min_duration_ms: number;          // 10-200ms (défaut: 50ms)
  smoothing_window_ms: number;      // 10-100ms (défaut: 25ms)
  
  // Paramètres avancés
  merge_threshold_ms: number;       // 100-1000ms (défaut: 500ms)
  refractory_period_ms: number;     // 0-500ms (défaut: 0ms)
  
  // Seuils de qualité thérapeutique
  quality_threshold_ms: number;     // 100-5000ms (défaut: 2000ms) - Seuil adaptatif pour la qualité de contraction
  mvc_threshold_percentage: number; // 50-100% (défaut: 75%) - Seuil MVC pour activation thérapeutique
}

export interface GameScoreNormalization {
  algorithm: 'linear' | 'logarithmic' | 'custom';
  min_score: number;
  max_score: number;
  custom_parameters?: Record<string, any>;
}

export interface ScoringWeights {
  completion: number;         // 0.20
  mvcQuality: number;        // 0.30
  qualityThreshold: number;  // 0.15 - Seuil adaptatif de qualité
  symmetry: number;          // 0.20
  effort: number;            // 0.15
  compliance: number;        // 0.10 - BFR compliance
  gameScore: number;         // 0.00 (expérimental)
}

export interface ComponentScore {
  value: number;
  count: number;
  total: number;
  formula: string;
}

export interface MusclePerformanceData {
  muscleName: string;
  totalScore: number;
  components: {
    completion: ComponentScore;
    mvcQuality: ComponentScore;
    qualityThreshold: ComponentScore;
  };
}

export interface EnhancedPerformanceData {
  // Niveau Global
  overallScore: number;
  
  // Niveau Par Muscle
  leftMuscle: MusclePerformanceData;
  rightMuscle: MusclePerformanceData;
  
  // Métriques Inter-Muscles
  symmetryScore: number;
  effortScore: number;
  complianceScore: number;
  gameScoreNormalized: number;
  
  // Configuration
  weights: ScoringWeights;
  isDebugMode: boolean;
}

export interface Contraction {
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  mean_amplitude: number;
  max_amplitude: number;
  is_good?: boolean; // Meets both MVC and duration criteria
  meets_mvc?: boolean; // Meets MVC threshold only
  meets_duration?: boolean; // Meets duration threshold only
  is_long?: boolean; // true for long, false for short
}

export interface StatsData {
  min: number; 
  max: number; 
  avg: number; 
  duration: string; 
  samples: number;
}

export interface StatsPanelProps {
  stats?: StatsData | null;
  channelAnalytics?: ChannelAnalyticsData | null;
  selectedChannel?: string | null;
  availableChannels?: string[];
  onChannelSelect?: (channel: string | null) => void;
  sessionExpectedContractions?: number | null;
}

export interface EMGChartProps {
  chartData: EMGPoint[];
  mvcThresholdForPlot?: number | null;
}

// For the session parameters from GUI
export interface GameSessionParameters {
  channel_muscle_mapping: { [channelName: string]: string };
  muscle_color_mapping: { [muscleName: string]: string };
  show_raw_signals?: boolean;
  
  // Session configuration
  session_mvc_value?: number | null;  // Kept for backward compatibility
  session_mvc_values?: Record<string, number | null>; // New: channel-specific MVC values
  session_mvc_threshold_percentage?: number | null;  // Global threshold
  session_mvc_threshold_percentages?: Record<string, number | null>; // New: channel-specific thresholds
  session_expected_contractions?: number | null;
  session_expected_contractions_ch1?: number | null;
  session_expected_contractions_ch2?: number | null;
  
  // Contraction expectations
  session_expected_long_left?: number | null;
  session_expected_short_left?: number | null;
  session_expected_long_right?: number | null;
  session_expected_short_right?: number | null;
  
  // Thresholds
  contraction_duration_threshold?: number | null;
  contraction_duration_threshold_ms?: number | null; // Backend compatibility
  session_duration_thresholds_per_muscle?: Record<string, number | null>; // Per-muscle duration thresholds
  
  // BFR Parameters - separate monitoring for left and right muscles
  bfr_parameters?: {
    left: {
      aop_measured: number;      // Arterial Occlusion Pressure in mmHg
      applied_pressure: number;  // Applied pressure in mmHg
      percentage_aop: number;    // Calculated percentage of AOP
      is_compliant: boolean;     // Within therapeutic range
      therapeutic_range_min: number;     // Minimum acceptable % AOP (default: 40)
      therapeutic_range_max: number;     // Maximum acceptable % AOP (default: 60)
      application_time_minutes?: number; // Duration of BFR application for left muscle
    };
    right: {
      aop_measured: number;      // Arterial Occlusion Pressure in mmHg
      applied_pressure: number;  // Applied pressure in mmHg
      percentage_aop: number;    // Calculated percentage of AOP
      is_compliant: boolean;     // Within therapeutic range
      therapeutic_range_min: number;     // Minimum acceptable % AOP (default: 40)
      therapeutic_range_max: number;     // Maximum acceptable % AOP (default: 60)
      application_time_minutes?: number; // Duration of BFR application for right muscle
    };
  };
  
  // RPE Parameters
  pre_session_rpe?: number | null;
  post_session_rpe?: number | null;
  
  // Enhanced Performance Scoring
  enhanced_scoring?: {
    enabled: boolean;
    weights: ScoringWeights;
    game_score_normalization?: GameScoreNormalization;
  };
  
  // Contraction Detection Parameters
  contraction_detection?: ContractionDetectionParameters;
  
  // Experimental Features
  experimental_features?: {
    enabled: boolean;
    allow_game_score_weight?: boolean;
    allow_detection_params?: boolean;
  };
  
  // Allow string indexing for dynamic access (excluding specific typed properties)
  [key: string]: any;

  expected_contractions?: number;
  mvc_threshold_factor?: number;
  mvc_thresholds?: { [muscleName: string]: number };
}

// For the backend response structure
export interface GameMetadata {
  game_name?: string | null;
  level?: string | null;
  duration?: number | null;
  therapist_id?: string | null;
  group_id?: string | null;
  time?: string | null;
  player_name?: string | null;
  score?: number | null;
  session_parameters_used?: GameSessionParameters | null;
  game_title: string;
  game_type: string;
  game_version: string;
  session_date: string;
  session_duration: number;
  session_notes: string | null;
}

// Interface for temporal analysis stats from the backend
export interface TemporalAnalysisStats {
  mean_value?: number;
  std_value?: number;
  min_value?: number;
  max_value?: number;
  valid_windows?: number;
  coefficient_of_variation?: number;
}

export interface ChannelAnalyticsData {
  contraction_count: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  total_time_under_tension_ms: number;
  avg_amplitude: number;
  max_amplitude: number;
  rms: number;
  mav: number;
  mpf: number;
  mdf: number;
  fatigue_index_fi_nsm5: number;
  
  // Corresponding standard deviation values, all optional
  std_duration_ms?: number;
  std_amplitude?: number;
  std_rms?: number;
  std_mav?: number;
  std_mpf?: number;
  std_mdf?: number;
  std_fatigue_index_fi_nsm5?: number;

  // Optional temporal analysis stats
  rms_temporal_stats?: TemporalAnalysisStats;
  mav_temporal_stats?: TemporalAnalysisStats;
  fatigue_index_temporal_stats?: TemporalAnalysisStats;

  contractions?: Contraction[];
  errors?: { [metric: string]: string };
  
  mvc_threshold_actual_value?: number | null;
  good_contraction_count?: number | null; // Meets both MVC and duration criteria
  mvc_contraction_count?: number | null; // Meets MVC criteria only  
  duration_contraction_count?: number | null; // Meets duration criteria only
  duration_threshold_actual_value?: number | null; // Actual duration threshold used
  
  // Additional counts for long and short contractions
  long_contraction_count?: number | null;
  short_contraction_count?: number | null;
  good_long_contraction_count?: number | null;
  good_short_contraction_count?: number | null;
  
  mvc_threshold_used?: number;
}

export interface EMGChannelSignalData {
  sampling_rate: number;
  time_axis: number[];
  data: number[]; // This will hold the primary C3D signal (e.g., "CH1 Raw")
  rms_envelope?: number[]; // For the calculated RMS envelope
  activated_data?: number[]; // If you have a separate "activated" signal processing step
}

export interface EMGAnalysisResult {
  file_id: string;
  timestamp: string;
  source_filename: string;
  metadata: GameMetadata;
  analytics: { [channelName: string]: ChannelAnalyticsData };
  available_channels: string[];
  emg_signals: { [channelName: string]: EMGChannelSignalData };
  user_id?: string | null;
  session_id?: string | null;
  patient_id?: string | null;
  overall_score?: number;
  symmetry_score?: number;
} 