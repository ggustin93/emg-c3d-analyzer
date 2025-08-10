import { supabase } from '@/lib/supabase';
import { GameSessionParameters } from '@/types/emg';

export interface PersistedSessionSettings {
  user_id: string;
  session_id: string;
  params: GameSessionParameters;
  updated_at: string;
}

export async function loadSessionSettings(userId: string, sessionId: string): Promise<GameSessionParameters | null> {
  const { data, error } = await supabase
    .from('session_settings')
    .select('params')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load session settings:', error.message);
    return null;
  }
  return (data?.params as GameSessionParameters) ?? null;
}

export async function saveSessionSettings(userId: string, sessionId: string, params: GameSessionParameters): Promise<boolean> {
  const { error } = await supabase
    .from('session_settings')
    .upsert({ user_id: userId, session_id: sessionId, params }, { onConflict: 'user_id,session_id' });

  if (error) {
    console.warn('Failed to save session settings:', error.message);
    return false;
  }
  return true;
}


