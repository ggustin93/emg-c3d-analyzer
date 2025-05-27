export interface EMGPoint {
  time: number;
  value: number;
}

export interface StatsData {
  min: string; 
  max: string; 
  avg: string; 
  duration: string; 
  samples: number;
}

export interface EmgSignalData {
  channel_name: string;
  sampling_rate: number;
  data: number[];
  time_axis: number[];
  original_length: number;
  url?: string; 
}

export interface StatsPanelProps {
  stats: StatsData | null;
}

export interface EMGChartProps {
  chartData: EMGPoint[];
}

// For the backend response structure you provided earlier:
export interface GameMetadata {
  game_name: string;
  level: string;
  duration: number; // Assuming this should be number based on '74'
  therapist_id: string;
  group_id: string;
  time: string; // Or number if it represents a year or timestamp
  player_name: string;
  score: number;
}

export interface ChannelAnalyticsData {
  contraction_count: number;
  avg_duration_ms: number;
  total_duration_ms: number;
  max_duration_ms: number;
  min_duration_ms: number;
  avg_amplitude: number;
  max_amplitude: number;
}

export interface EMGAnalysisResult {
  file_id: string;
  timestamp: string;
  metadata: GameMetadata;
  analytics: { [channelName: string]: ChannelAnalyticsData };
  user_id?: string;
  session_id?: string;
  patient_id?: string;
  plots?: { [key: string]: string };
} 