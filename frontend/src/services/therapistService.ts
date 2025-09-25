import { supabase } from '../lib/supabase';
import { API_CONFIG } from '@/config/apiConfig';
import { logger, LogCategory } from './logger';
import { TherapistInfo, TherapistCache } from '../types/therapist';

/**
 * TherapistService - Enhanced therapist management with FastAPI integration
 * 
 * Uses new FastAPI endpoints for patient-therapist resolution
 * Maintains backward compatibility with direct Supabase for ID-based lookups
 */
class TherapistService {
  // Dynamic API URL - evaluated at request time, not import time
  private get apiBaseUrl() {
    return API_CONFIG.getBaseUrl();
  }

  /**
   * Format therapist display name as "Dr. LastName"
   * Priority: "Dr. LastName" > user_code (fallback)
   */
  private formatTherapistName(therapist: {
    first_name: string | null;
    last_name: string | null;
    user_code: string;
  }): string {
    if (therapist.last_name) {
      return `Dr. ${therapist.last_name}`;
    }
    
    return therapist.user_code;
  }

  /**
   * Extract patient code from file path
   * Example: "patient_sessions/P001_Ghostly_..." -> "P001"
   */
  extractPatientCodeFromPath(filePath: string): string | null {
    // Pattern: P followed by 3 digits
    const match = filePath.match(/P\d{3}/i);
    return match ? match[0].toUpperCase() : null;
  }

  /**
   * Resolve therapist for a patient code using FastAPI backend
   */
  async resolveTherapistByPatientCode(patientCode: string): Promise<TherapistInfo | null> {
    if (!patientCode) return null;

    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        logger.error(LogCategory.API, 'No auth session for therapist resolution');
        return null;
      }

      const response = await fetch(`${this.apiBaseUrl}/therapists/resolve/${patientCode}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null; // No therapist found for patient
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data as TherapistInfo;

    } catch (error) {
      logger.error(LogCategory.API, `Error resolving therapist for patient ${patientCode}:`, error);
      return null;
    }
  }

  /**
   * Batch resolve therapists for multiple patient codes
   */
  async resolveTherapistsForPatientCodes(patientCodes: string[]): Promise<TherapistCache> {
    const result: TherapistCache = {};
    
    if (patientCodes.length === 0) return result;

    // Filter out empty codes
    const validCodes = patientCodes.filter(code => code);
    if (validCodes.length === 0) return result;

    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        logger.error(LogCategory.API, 'No auth session for batch therapist resolution');
        return result;
      }

      const response = await fetch(`${this.apiBaseUrl}/therapists/resolve/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ patient_codes: validCodes })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert patient code-based results to therapist ID-based cache
      // This requires extracting patient codes from file paths in the component
      return data.therapists || {};

    } catch (error) {
      logger.error(LogCategory.API, 'Error in batch therapist resolution:', error);
      return result;
    }
  }

  /**
   * Resolve therapist from file path
   * Convenience method that extracts patient code and resolves therapist
   */
  async resolveTherapistFromFilePath(filePath: string): Promise<TherapistInfo | null> {
    const patientCode = this.extractPatientCodeFromPath(filePath);
    if (!patientCode) return null;
    
    return this.resolveTherapistByPatientCode(patientCode);
  }

  /**
   * Get single therapist by UUID from user_profiles
   * (Backward compatibility - direct Supabase query)
   */
  async getTherapistById(therapistId: string): Promise<TherapistInfo | null> {
    if (!therapistId) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // Fallback to direct Supabase if no session
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, user_code, role')
          .eq('id', therapistId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // No rows returned
            return null;
          }
          throw error;
        }

        if (!data) return null;

        return {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          user_code: data.user_code,
          display_name: this.formatTherapistName(data),
          role: data.role
        };
      }

      // Use API endpoint if available
      const response = await fetch(`${this.apiBaseUrl}/therapists/by-id/${therapistId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data as TherapistInfo;

    } catch (error) {
      logger.error(LogCategory.API, `Error fetching therapist ${therapistId}:`, error);
      return null;
    }
  }

  /**
   * Batch fetch multiple therapists by UUIDs
   * (Backward compatibility - direct Supabase query)
   */
  async getTherapistsByIds(therapistIds: string[]): Promise<TherapistCache> {
    const result: TherapistCache = {};
    
    if (therapistIds.length === 0) return result;

    // Filter out empty IDs
    const validIds = therapistIds.filter(id => id);
    if (validIds.length === 0) return result;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, user_code, role')
        .in('id', validIds);

      if (error) {
        logger.error(LogCategory.API, 'Error batch fetching therapists:', error);
        return result;
      }

      if (!data) return result;

      // Process results
      for (const therapist of data) {
        result[therapist.id] = {
          id: therapist.id,
          first_name: therapist.first_name,
          last_name: therapist.last_name,
          user_code: therapist.user_code,
          display_name: this.formatTherapistName(therapist),
          role: therapist.role
        };
      }

    } catch (error) {
      logger.error(LogCategory.API, 'Error in batch therapist fetch:', error);
    }

    return result;
  }

  /**
   * Get therapist display name from file-indexed cache
   * Centralized helper to replace duplicate implementations
   */
  getDisplayFromFileCache(fileName: string, cache: Record<string, any>): string {
    const therapist = cache[fileName];
    if (therapist && therapist.display_name) {
      return therapist.display_name;
    }
    return this.getUnknownTherapistDisplay();
  }

  /**
   * Fallback display for unknown therapist
   */
  getUnknownTherapistDisplay(therapistId?: string | null): string {
    return therapistId ? `Therapist ${therapistId.slice(0, 8)}...` : 'Unknown Therapist';
  }
}

// Single instance for the app (KISS - no complex DI)
export const therapistService = new TherapistService();

// Export types
export type { TherapistInfo, TherapistCache } from '../types/therapist';

export default therapistService;