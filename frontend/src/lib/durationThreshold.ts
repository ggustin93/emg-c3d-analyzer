import { GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { EMG_CHART_CONFIG } from '@/config/emgChartConfig';

export function getEffectiveDurationThreshold(
  channelName: string,
  sessionParams?: GameSessionParameters,
  channelAnalytics?: ChannelAnalyticsData | null
): number {
  const defaultMs = EMG_CHART_CONFIG.DEFAULT_DURATION_THRESHOLD_MS;
  if (!sessionParams) return channelAnalytics?.duration_threshold_actual_value ?? defaultMs;

  // 1) Backend actual per-channel
  const backendMs = channelAnalytics?.duration_threshold_actual_value;
  if (backendMs !== null && backendMs !== undefined) return backendMs;

  // 2) Per-muscle override (seconds) → ms
  const perMuscleSeconds = sessionParams.session_duration_thresholds_per_muscle?.[channelName];
  if (perMuscleSeconds !== null && perMuscleSeconds !== undefined) {
    return Math.round(perMuscleSeconds * 1000);
  }

  // 3) Global session (ms)
  const globalMs = sessionParams.contraction_duration_threshold;
  if (globalMs !== null && globalMs !== undefined) return globalMs;

  // 4) Default
  return defaultMs;
}


