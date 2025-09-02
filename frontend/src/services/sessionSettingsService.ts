import { supabase } from '@/lib/supabase';
import { GameSessionParameters } from '@/types/emg';

export interface PersistedSessionSettings {
  id?: string;
  session_id: string;
  mvc_threshold_percentage: number;
  target_mvc_ch1?: number | null;
  target_mvc_ch2?: number | null;
  target_duration_ch1?: number | null;
  target_duration_ch2?: number | null;
  bfr_enabled: boolean;
  updated_at?: string;
}

export async function loadSessionSettings(_userId: string, sessionId: string): Promise<GameSessionParameters | null> {
  // Note: session_settings table is linked to therapy_sessions by session_id, not user_id
  // We need to fetch the settings for this specific session
  // userId parameter kept for API compatibility but not used
  const { data, error } = await supabase
    .from('session_settings')
    .select(`
      mvc_threshold_percentage,
      target_mvc_ch1,
      target_mvc_ch2,
      target_duration_ch1,
      target_duration_ch2,
      bfr_enabled
    `)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load session settings:', error.message);
    return null;
  }
  
  if (!data) {
    return null;
  }

  // Convert database format to GameSessionParameters format
  // Note: Some fields from GameSessionParameters may not be stored in session_settings
  // and would need to come from other tables (like therapy_sessions)
  const params: Partial<GameSessionParameters> = {
    session_mvc_threshold_percentage: data.mvc_threshold_percentage,
    // Map per-channel target values if they exist
    session_mvc_values: {
      'CH1': data.target_mvc_ch1 || undefined,
      'CH2': data.target_mvc_ch2 || undefined
    },
    // Duration thresholds are stored in milliseconds
    contraction_duration_threshold: data.target_duration_ch1 || data.target_duration_ch2 || 2000,
    // BFR flag
    bfr_enabled: data.bfr_enabled
  };

  return params as GameSessionParameters;
}

export async function saveSessionSettings(_userId: string, sessionId: string, params: GameSessionParameters): Promise<boolean> {
  // Convert GameSessionParameters to database format
  // userId parameter kept for API compatibility but not used
  const settingsData: Partial<PersistedSessionSettings> = {
    session_id: sessionId,
    mvc_threshold_percentage: params.session_mvc_threshold_percentage || 75,
    target_mvc_ch1: params.session_mvc_values?.['CH1'] || null,
    target_mvc_ch2: params.session_mvc_values?.['CH2'] || null,
    target_duration_ch1: params.contraction_duration_threshold || 2000,
    target_duration_ch2: params.contraction_duration_threshold || 2000,
    bfr_enabled: params.bfr_enabled !== undefined ? params.bfr_enabled : true
  };

  const { error } = await supabase
    .from('session_settings')
    .upsert(settingsData, { onConflict: 'session_id' });

  if (error) {
    console.warn('Failed to save session settings:', error.message);
    return false;
  }
  return true;
}


