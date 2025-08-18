import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { EMGAnalysisResult, GameSessionParameters, ChannelAnalyticsData } from '@/types/emg';
import { MVCService } from '@/services/mvcService';
import { useCalibrationStore } from '@/store/calibrationStore';

const getMvcThresholdForChannel = (params: GameSessionParameters, channelName: string): number | null => {
  if (!params) return null;
  
  const mvcValue = (params.session_mvc_values || {})[channelName] ?? params.session_mvc_value ?? 0;
  const thresholdPercent = (params.session_mvc_threshold_percentages || {})[channelName] ?? params.session_mvc_threshold_percentage ?? 75;

  if (mvcValue === null || mvcValue === undefined) return null;

  return mvcValue * (thresholdPercent / 100);
};

export const useLiveAnalytics = (analysisResult: EMGAnalysisResult | null) => {
  const { sessionParams } = useSessionStore();
  const [serverResult, setServerResult] = useState<EMGAnalysisResult | null>(analysisResult);
  const { setCalibrationPending, markCalibrationComplete } = useCalibrationStore();
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  // Recalculate analytics on backend whenever sessionParams change
  useEffect(() => {
    if (!analysisResult) return;
    // Clear previous debounce
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Abort any in-flight request
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }

    // Set pending immediately
    setCalibrationPending(true);

    // Debounce 300ms before firing
    debounceTimerRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      inFlightAbortRef.current = controller;
      try {
        // Call the analysis recalc endpoint for full EMG analysis update
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'}/analysis/recalc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existing: analysisResult, session_params: sessionParams }),
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error(`Analysis recalc failed: ${response.status}`);
        }
        
        const updated = await response.json() as EMGAnalysisResult;
        if (!controller.signal.aborted) {
          setServerResult(updated);
        }
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          // Swallow aborted fetch
        } else {
          console.warn('Recalc failed; falling back to original analytics', e);
          if (!controller.signal.aborted) setServerResult(analysisResult);
        }
      } finally {
        if (!controller.signal.aborted) markCalibrationComplete();
        inFlightAbortRef.current = null;
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
        inFlightAbortRef.current = null;
      }
    };
  }, [analysisResult, sessionParams, setCalibrationPending, markCalibrationComplete]);

  const liveAnalytics = useMemo(() => {
    const base = serverResult ?? analysisResult;
    if (!base?.analytics) return null;
    // TRUST backend analytics entirely (flags, thresholds, counts)
    return base.analytics as { [key: string]: ChannelAnalyticsData };
  }, [serverResult, analysisResult]);

  return liveAnalytics;
}; 