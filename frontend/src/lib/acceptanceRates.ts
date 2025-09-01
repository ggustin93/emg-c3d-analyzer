/**
 * Acceptance Rates Calculator
 * Single Source of Truth (SoT) for backend analytics flags and thresholds
 * 
 * Backend analytics is the authoritative source for:
 * - mvc_threshold_actual_value, duration_threshold_actual_value  
 * - contractions[].meets_mvc, contractions[].meets_duration, contractions[].is_good
 * - good_contraction_count (and sometimes per-criterion counts)
 * 
 * Frontend NEVER re-derives thresholds; only counts backend flags when counts are missing.
 */

import { ChannelAnalyticsData } from '@/types/emg';
import { logger, LogCategory } from '@/services/logger';

export interface AcceptanceRates {
  // Good Rate (combined metric)
  goodPct: number;
  good: number;
  total: number; // Denominator only counts contractions from channels where BOTH thresholds are defined
  
  // MVC Acceptance (meets amplitude threshold)
  mvcPct: number;
  mvc: number;
  mvcTotal: number;
  mvcThreshold: number | null;
  
  // Duration Acceptance (meets duration threshold)
  durationPct: number;
  duration: number;
  durationTotal: number;
  durationThreshold: number | null;
}

export function computeAcceptanceRates(
  analytics: Record<string, ChannelAnalyticsData> | null
): AcceptanceRates {
  const result: AcceptanceRates = {
    goodPct: 0, good: 0, total: 0,
    mvcPct: 0, mvc: 0, mvcTotal: 0, mvcThreshold: null,
    durationPct: 0, duration: 0, durationTotal: 0, durationThreshold: null
  };
  
  if (!analytics) {
    logger.debug(LogCategory.DATA_PROCESSING, 'No analytics data provided');
    return result;
  }
  
  // Good rate denominator: only include contractions from channels where BOTH thresholds are defined
  let totalGoodCount = 0;
  let totalContractionCountBothCriteria = 0;
  let totalMvcCount = 0;
  let totalMvcTotal = 0; // Denominator only counts channels where MVC threshold is defined
  let totalDurationCount = 0;
  let totalDurationTotal = 0; // Denominator only counts channels where duration threshold is defined
  let avgMvcThreshold: number | null = null;
  let avgDurationThreshold: number | null = null;
  let channelCount = 0;
  
  logger.debug(LogCategory.DATA_PROCESSING, 'Computing acceptance rates', {
    channels: Object.keys(analytics),
    strategy: 'backend-flags-first'
  });
  
  Object.entries(analytics).forEach(([channelName, channelData]) => {
    if (!channelData.contractions || channelData.contractions.length === 0) {
      logger.debug(LogCategory.DATA_PROCESSING, `Skipping ${channelName} - no contractions`);
      return;
    }
    
    const contractions = channelData.contractions;
    const channelTotal = contractions.length;
    const hasMvcThreshold = channelData.mvc_threshold_actual_value !== null && channelData.mvc_threshold_actual_value !== undefined;
    const hasDurationThreshold = channelData.duration_threshold_actual_value !== null && channelData.duration_threshold_actual_value !== undefined;
    
    // Good rate must reflect BOTH criteria per metricsDefinitions when both thresholds are available
    // Denominator includes ONLY channels where both thresholds are defined
    let channelGood: number = 0;
    let channelMvc: number;
    let channelDuration: number;
    
    if (hasMvcThreshold && hasDurationThreshold) {
      // Strict BOTH-criteria good count from backend flags
      channelGood = contractions.filter(c => c.meets_mvc === true && c.meets_duration === true).length;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Good (both) counted from flags = ${channelGood}`);
      totalContractionCountBothCriteria += channelTotal;
    } else {
      // Threshold(s) missing: do NOT include in Good Rate denominator; still log for transparency
      // For display in other places, we derive a best-effort good using backend count/flag but exclude from denominator
      const bestEffortGood = channelData.good_contraction_count ?? contractions.filter(c => c.is_good === true).length;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Thresholds incomplete (mvc:${hasMvcThreshold}, dur:${hasDurationThreshold}). Best-effort good = ${bestEffortGood} (excluded from denominator)`);
    }
    
    // For MVC and Duration counts, prefer backend counts but usually need to count flags
    if (channelData.mvc_contraction_count !== undefined && channelData.mvc_contraction_count !== null) {
      channelMvc = channelData.mvc_contraction_count;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Using backend mvc_contraction_count = ${channelMvc}`);
    } else {
      // Count meets_mvc flags (NEVER re-apply mvc_threshold_actual_value)
      channelMvc = contractions.filter(c => c.meets_mvc === true).length;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Counted meets_mvc flags = ${channelMvc}`);
    }
    
    if (channelData.duration_contraction_count !== undefined && channelData.duration_contraction_count !== null) {
      channelDuration = channelData.duration_contraction_count;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Using backend duration_contraction_count = ${channelDuration}`);
    } else {
      // Count meets_duration flags (NEVER re-apply duration_threshold_actual_value)
      channelDuration = contractions.filter(c => c.meets_duration === true).length;
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Counted meets_duration flags = ${channelDuration}`);
    }
    
    // Accumulate totals
    totalGoodCount += channelGood;
    totalMvcCount += channelMvc;
    if (hasMvcThreshold) {
      totalMvcTotal += channelTotal;
    } else {
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: MVC threshold missing, excluding ${channelTotal} from mvcTotal denominator`);
    }
    totalDurationCount += channelDuration;
    if (hasDurationThreshold) {
      totalDurationTotal += channelTotal;
    } else {
      logger.debug(LogCategory.DATA_PROCESSING, `${channelName}: Duration threshold missing, excluding ${channelTotal} from durationTotal denominator`);
    }
    
    // Collect thresholds for averaging (backend thresholds are authoritative)
    if (channelData.mvc_threshold_actual_value !== null && channelData.mvc_threshold_actual_value !== undefined) {
      avgMvcThreshold = avgMvcThreshold === null 
        ? channelData.mvc_threshold_actual_value
        : (avgMvcThreshold + channelData.mvc_threshold_actual_value) / 2;
    }
    
    if (channelData.duration_threshold_actual_value !== null && channelData.duration_threshold_actual_value !== undefined) {
      avgDurationThreshold = avgDurationThreshold === null
        ? channelData.duration_threshold_actual_value
        : (avgDurationThreshold + channelData.duration_threshold_actual_value) / 2;
    }
    
    channelCount++;
    
    logger.debug(LogCategory.DATA_PROCESSING, `${channelName} summary`, {
      total: channelTotal,
      good: channelGood,
      mvc: channelMvc, 
      duration: channelDuration,
      mvcThreshold: channelData.mvc_threshold_actual_value,
      durationThreshold: channelData.duration_threshold_actual_value
    });
  });
  
  // Calculate final percentages
  result.good = totalGoodCount;
  result.total = totalContractionCountBothCriteria;
  result.goodPct = totalContractionCountBothCriteria > 0 ? (totalGoodCount / totalContractionCountBothCriteria) * 100 : 0;
  
  result.mvc = totalMvcCount;
  result.mvcTotal = totalMvcTotal;
  result.mvcPct = totalMvcTotal > 0 ? (totalMvcCount / totalMvcTotal) * 100 : 0;
  result.mvcThreshold = avgMvcThreshold;
  
  result.duration = totalDurationCount;
  result.durationTotal = totalDurationTotal;
  result.durationPct = totalDurationTotal > 0 ? (totalDurationCount / totalDurationTotal) * 100 : 0;
  result.durationThreshold = avgDurationThreshold;
  
  logger.debug(LogCategory.DATA_PROCESSING, 'Final acceptance rates', {
    goodRate: `${result.goodPct.toFixed(1)}% (${result.good}/${result.total})`,
    mvcRate: `${result.mvcPct.toFixed(1)}% (${result.mvc}/${result.mvcTotal})`,
    durationRate: `${result.durationPct.toFixed(1)}% (${result.duration}/${result.durationTotal})`,
    thresholds: {
      mvc: result.mvcThreshold,
      duration: result.durationThreshold
    },
    channels: channelCount,
    strategy: 'backend-flags-SoT (good=both-criteria; denom=channels-with-both-thresholds)'
  });
  
  return result;
}