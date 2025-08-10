import { useEffect, useMemo, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useAuth } from '@/contexts/AuthContext';
import { loadSessionSettings, saveSessionSettings } from '@/services/sessionSettingsService';
import { EMGAnalysisResult, GameSessionParameters } from '@/types/emg';

function deriveSessionId(analysisResult: EMGAnalysisResult | null): string | null {
  if (!analysisResult) return null;
  return analysisResult.session_id || analysisResult.file_id || null;
}

export function usePersistedSessionSettings(analysisResult: EMGAnalysisResult | null) {
  const { sessionParams, setSessionParams } = useSessionStore();
  const { authState } = useAuth();
  const userId = authState.user?.id || null;
  const sessionId = useMemo(() => deriveSessionId(analysisResult), [analysisResult]);
  const saveTimerRef = useRef<number | null>(null);

  // Load settings when user/sessionId becomes available
  useEffect(() => {
    if (!userId || !sessionId) return;
    let cancelled = false;
    (async () => {
      const loaded = await loadSessionSettings(userId, sessionId);
      if (!cancelled && loaded) {
        // Merge loaded params; prioritize loaded values to respect persistence
        setSessionParams(prev => ({ ...prev, ...loaded } as GameSessionParameters));
      }
    })();
    return () => { cancelled = true; };
  }, [userId, sessionId, setSessionParams]);

  // Save settings on changes with debounce
  useEffect(() => {
    if (!userId || !sessionId) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      // Best-effort save; do not block UI
      void saveSessionSettings(userId, sessionId, sessionParams as GameSessionParameters);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [userId, sessionId, sessionParams]);
}


