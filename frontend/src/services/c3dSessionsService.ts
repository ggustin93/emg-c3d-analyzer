import SupabaseStorageService from './supabaseStorage'
import TherapySessionsService, { TherapySession } from './therapySessionsService'
import { 
  C3DFile,
  resolvePatientId,
  resolveTherapistId,
  resolveSessionDateTime 
} from './C3DFileDataResolver'
import { ENV_CONFIG } from '../config/environment'

const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME

export interface PatientSessionData {
  patient_code: string
  session_count: number
  last_session: string | null
  c3d_files: C3DFile[]
}

/**
 * C3DSessionsService - Accurate session counting based on actual C3D files
 * 
 * This service follows the same data pattern as C3DFileBrowser to ensure
 * consistency between Patient Management table and actual C3D file data.
 * 
 * Key differences from therapy_sessions table approach:
 * - Counts actual C3D files from Supabase Storage
 * - Uses enhanced date resolution (session_date → game_metadata.time → filename patterns)
 * - Provides accurate session counts that match uploaded files
 */
export class C3DSessionsService {
  /**
   * Check if Supabase Storage is properly configured
   */
  static isConfigured(): boolean {
    return SupabaseStorageService.isConfigured()
  }

  /**
   * Get session data for specific patients using same logic as PatientSessionBrowser
   * This ensures session counts match exactly between Patient Management and Patient Profile
   */
  static async getPatientSessionData(patientCodes: string[]): Promise<PatientSessionData[]> {
    if (!this.isConfigured()) {
      console.warn('Supabase Storage not configured for C3D session counting')
      return []
    }

    if (patientCodes.length === 0) {
      return []
    }

    try {
      // Get all C3D files from storage (same as PatientSessionBrowser)
      const allC3DFiles = await SupabaseStorageService.listC3DFiles()
      
      if (allC3DFiles.length === 0) {
        return patientCodes.map(code => ({
          patient_code: code,
          session_count: 0,
          last_session: null,
          c3d_files: []
        }))
      }

      // Get session metadata for enhanced date resolution
      const filePaths = allC3DFiles.map(file => `${BUCKET_NAME}/${file.name}`)
      const sessionMetadata = await TherapySessionsService.getSessionsByFilePaths(filePaths)

      // Process each patient individually (matches PatientSessionBrowser logic exactly)
      const patientSessionData: PatientSessionData[] = []

      for (const patientCode of patientCodes) {
        // Filter files for this patient (same logic as PatientSessionBrowser)
        const patientFiles = allC3DFiles.filter(file => {
          const patientId = resolvePatientId(file)
          return patientId === patientCode
        })

        // Sort files by date (most recent first) using enhanced date resolution
        const filesWithDates = patientFiles.map(file => ({
          file,
          sessionDate: this.resolveEnhancedSessionDate(file, sessionMetadata)
        }))

        filesWithDates.sort((a, b) => {
          if (!a.sessionDate && !b.sessionDate) return 0
          if (!a.sessionDate) return 1
          if (!b.sessionDate) return -1
          return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
        })

        // Count sessions exactly like PatientSessionBrowser
        const sessionCount = patientFiles.length
        const lastSession = filesWithDates[0]?.sessionDate || null
        
        patientSessionData.push({
          patient_code: patientCode,
          session_count: sessionCount,
          last_session: lastSession,
          c3d_files: patientFiles
        })
      }

      return patientSessionData

    } catch (error) {
      console.error('Error in getPatientSessionData:', error)
      return patientCodes.map(code => ({
        patient_code: code,
        session_count: 0,
        last_session: null,
        c3d_files: []
      }))
    }
  }

  /**
   * Enhanced session date resolution - follows C3DFileBrowser pattern
   * Priority: session_date → game_metadata.time → filename patterns
   */
  private static resolveEnhancedSessionDate(
    file: C3DFile, 
    sessionMetadata: Record<string, TherapySession>
  ): string | null {
    const filePath = `${BUCKET_NAME}/${file.name}`
    const session = sessionMetadata[filePath]
    
    // Priority 1: Processed session timestamp from therapy_sessions table
    if (session?.session_date) {
      return session.session_date
    }
    
    // Priority 2: C3D metadata time from therapy_sessions table
    if (session?.game_metadata?.time) {
      return session.game_metadata.time
    }
    
    // Priority 3: Use filename-based datetime resolver
    return resolveSessionDateTime(file)
  }

  /**
   * Get session count for a specific patient
   */
  static async getPatientSessionCount(patientCode: string): Promise<number> {
    if (!this.isConfigured()) {
      return 0
    }

    try {
      const allFiles = await SupabaseStorageService.listC3DFiles()
      const patientFiles = allFiles.filter(file => resolvePatientId(file) === patientCode)
      return patientFiles.length
    } catch (error) {
      console.error(`Error counting sessions for patient ${patientCode}:`, error)
      return 0
    }
  }

  /**
   * Get last session date for a specific patient
   */
  static async getPatientLastSession(patientCode: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return null
    }

    try {
      const allFiles = await SupabaseStorageService.listC3DFiles()
      const patientFiles = allFiles.filter(file => resolvePatientId(file) === patientCode)
      
      if (patientFiles.length === 0) {
        return null
      }

      // Get session metadata for enhanced date resolution
      const filePaths = patientFiles.map(file => `${BUCKET_NAME}/${file.name}`)
      const sessionMetadata = await TherapySessionsService.getSessionsByFilePaths(filePaths)

      // Find most recent session date
      let mostRecentDate: string | null = null
      let mostRecentTime = 0

      for (const file of patientFiles) {
        const sessionDate = this.resolveEnhancedSessionDate(file, sessionMetadata)
        if (sessionDate) {
          const dateTime = new Date(sessionDate).getTime()
          if (dateTime > mostRecentTime) {
            mostRecentTime = dateTime
            mostRecentDate = sessionDate
          }
        }
      }

      return mostRecentDate
    } catch (error) {
      console.error(`Error getting last session for patient ${patientCode}:`, error)
      return null
    }
  }

  /**
   * Get recent C3D files (last N sessions) for dashboard display
   * Replaces time-based filtering with session-based counting
   */
  static async getRecentSessions(limit: number = 5): Promise<C3DFile[]> {
    if (!this.isConfigured()) {
      return []
    }

    try {
      const allFiles = await SupabaseStorageService.listC3DFiles()
      
      if (allFiles.length === 0) {
        return []
      }

      // Get session metadata for enhanced date resolution
      const filePaths = allFiles.map(file => `${BUCKET_NAME}/${file.name}`)
      const sessionMetadata = await TherapySessionsService.getSessionsByFilePaths(filePaths)

      // Add enhanced dates and sort by most recent
      const filesWithDates = allFiles.map(file => ({
        file,
        sessionDate: this.resolveEnhancedSessionDate(file, sessionMetadata)
      }))

      // Sort by date (most recent first), handle null values
      filesWithDates.sort((a, b) => {
        if (!a.sessionDate && !b.sessionDate) return 0
        if (!a.sessionDate) return 1
        if (!b.sessionDate) return -1
        return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
      })

      // Return last N sessions (files)
      return filesWithDates.slice(0, limit).map(item => item.file)
    } catch (error) {
      console.error('Error getting recent sessions:', error)
      return []
    }
  }
}

export default C3DSessionsService