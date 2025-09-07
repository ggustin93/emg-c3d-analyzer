import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TherapySession {
  id: string;
  file_path: string;
  session_date?: string;
  game_metadata?: {
    time?: string;
    game_name?: string;
    level?: string;
    duration?: string;
    therapist_id?: string;
    group_id?: string;
    [key: string]: any;
  };
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  processed_at?: string;
  patient_id?: string;
  therapist_id?: string;
}

export class TherapySessionsService {
  /**
   * Check if Supabase is properly configured
   */
  static isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * Get therapy session by file path
   */
  static async getSessionByFilePath(filePath: string): Promise<TherapySession | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured');
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .eq('file_path', filePath)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Error fetching therapy session:', error);
        }
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getSessionByFilePath:', error);
      return null;
    }
  }

  /**
   * Get multiple therapy sessions by file paths
   */
  static async getSessionsByFilePaths(filePaths: string[]): Promise<Record<string, TherapySession>> {
    if (!isSupabaseConfigured()) {
      return {};
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {};
    }

    if (filePaths.length === 0) {
      return {};
    }

    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .in('file_path', filePaths);

      if (error) {
        console.error('Error fetching therapy sessions:', error);
        return {};
      }

      // Convert array to record keyed by file_path
      const sessionMap: Record<string, TherapySession> = {};
      data?.forEach(session => {
        sessionMap[session.file_path] = session;
      });

      return sessionMap;
    } catch (error) {
      console.error('Error in getSessionsByFilePaths:', error);
      return {};
    }
  }

  /**
   * List all therapy sessions with basic info
   */
  static async listAllSessions(): Promise<TherapySession[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing therapy sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in listAllSessions:', error);
      return [];
    }
  }

  /**
   * Get session processing status
   */
  static async getSessionStatus(sessionId: string): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('therapy_sessions')
        .select('processing_status')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.processing_status;
    } catch (error) {
      console.error('Error getting session status:', error);
      return null;
    }
  }
}

export default TherapySessionsService;