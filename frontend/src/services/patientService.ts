import { supabase } from '../lib/supabase';
import { logger, LogCategory } from './logger';

export interface PatientInfo {
  patient_code: string;
  first_name?: string;
  last_name?: string;
  display_name: string;
  avatar_initials: string;
}

export class PatientService {
  private static patientCache: Map<string, PatientInfo> = new Map();
  private static lastCacheUpdate: Date | null = null;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get patient information by patient codes
   */
  static async getPatientsByCode(patientCodes: string[]): Promise<Record<string, PatientInfo>> {
    if (patientCodes.length === 0) {
      return {};
    }

    try {
      // Check cache first
      const now = new Date();
      const needsUpdate = !this.lastCacheUpdate || 
        (now.getTime() - this.lastCacheUpdate.getTime()) > this.CACHE_DURATION;

      if (needsUpdate) {
        await this.refreshCache();
      }

      // Return cached data for requested patient codes
      const result: Record<string, PatientInfo> = {};
      patientCodes.forEach(code => {
        const patient = this.patientCache.get(code);
        if (patient) {
          result[code] = patient;
        }
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.API, 'Failed to fetch patient information:', error);
      return {};
    }
  }

  /**
   * Get patient information for a single patient code
   */
  static async getPatientByCode(patientCode: string): Promise<PatientInfo | null> {
    const patients = await this.getPatientsByCode([patientCode]);
    return patients[patientCode] || null;
  }

  /**
   * Refresh the patient cache from database
   */
  private static async refreshCache(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          patient_code,
          patient_medical_info (
            first_name,
            last_name
          )
        `);

      if (error) {
        logger.error(LogCategory.API, 'Error fetching patients from database:', error);
        return;
      }

      // Clear existing cache
      this.patientCache.clear();

      // Process and cache patient data
      data?.forEach(patient => {
        const medical = Array.isArray(patient.patient_medical_info) 
          ? patient.patient_medical_info[0] 
          : patient.patient_medical_info;

        const patientInfo: PatientInfo = {
          patient_code: patient.patient_code,
          first_name: medical?.first_name || undefined,
          last_name: medical?.last_name || undefined,
          display_name: this.generateDisplayName(patient.patient_code, medical?.first_name, medical?.last_name),
          avatar_initials: this.generateAvatarInitials(patient.patient_code, medical?.first_name, medical?.last_name)
        };

        this.patientCache.set(patient.patient_code, patientInfo);
      });

      this.lastCacheUpdate = new Date();
      logger.info(LogCategory.API, `Patient cache updated with ${this.patientCache.size} patients`);
    } catch (error) {
      logger.error(LogCategory.API, 'Failed to refresh patient cache:', error);
    }
  }

  /**
   * Generate display name for patient
   */
  private static generateDisplayName(patientCode: string, firstName?: string, lastName?: string): string {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    return patientCode;
  }

  /**
   * Generate avatar initials for patient
   */
  private static generateAvatarInitials(patientCode: string, firstName?: string, lastName?: string): string {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase();
    }
    // Extract numeric part from patient code (P001 → P1)
    const numericPart = patientCode.replace(/\D/g, '');
    const number = parseInt(numericPart) || 0;
    return `P${number}`;
  }

  /**
   * Force cache refresh
   */
  static async forceRefresh(): Promise<void> {
    this.lastCacheUpdate = null;
    await this.refreshCache();
  }

  /**
   * Clear cache (for testing or logout)
   */
  static clearCache(): void {
    this.patientCache.clear();
    this.lastCacheUpdate = null;
  }
}

export default PatientService;