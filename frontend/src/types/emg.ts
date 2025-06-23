export interface EMGPoint {
  time: number;
  value: number;
}

export interface Contraction {
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  mean_amplitude: number;
  max_amplitude: number;
  is_good?: boolean;
  is_long?: boolean; // true for long, false for short
}

export interface StatsData {
  min: number; 
  max: number; 
  avg: number; 
  duration: string; 
  samples: number;
}

export interface EmgSignalData {
  channel_name: string;
  sampling_rate: number;
  data: number[];
  time_axis: number[];
  activated_data?: number[];
  contractions?: Contraction[];
  original_length?: number;
  url?: string; 
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
  
  // Allow string indexing for dynamic access
  [key: string]: Record<string, string | number | null> | boolean | number | null | undefined;

  expected_contractions?: number;
  mvc_threshold_factor?: number;
  mvc_thresholds?: { [muscleName: string]: number };
  subjective_fatigue_level?: number; // 0-10 scale for patient-reported fatigue
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
  good_contraction_count?: number | null;
  
  // Additional counts for long and short contractions
  long_contraction_count?: number | null;
  short_contraction_count?: number | null;
  good_long_contraction_count?: number | null;
  good_short_contraction_count?: number | null;
  
  mvc_threshold_used?: number;
}

export interface EMGAnalysisResult {
  file_id: string;
  timestamp: string;
  source_filename: string;
  metadata: GameMetadata;
  analytics: { [channelName: string]: ChannelAnalyticsData };
  available_channels: string[];
  user_id?: string | null;
  session_id?: string | null;
  patient_id?: string | null;
  plots?: { [key: string]: string };
  overall_score?: number;
  symmetry_score?: number;
} 