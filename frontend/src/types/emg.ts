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
  session_mvc_value?: number | null;
  session_mvc_threshold_percentage?: number | null;
  session_expected_contractions?: number | null;
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
  mpf?: number | null;
  mdf?: number | null;
  fatigue_index_fi_nsm5?: number | null;
  contractions?: Contraction[];
  errors?: { [metric: string]: string };
  
  mvc_threshold_actual_value?: number | null;
  good_contraction_count?: number | null;
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
} 