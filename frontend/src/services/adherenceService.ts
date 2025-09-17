/**
 * Adherence Service - Reusable service for fetching adherence data
 * Used by both therapists and researchers following DRY/SOLID principles
 */

import { API_CONFIG } from '@/config/apiConfig';

export interface AdherenceData {
  patient_id: string
  adherence_score: number | null
  clinical_threshold: string
  sessions_completed: number
  sessions_expected: number
  protocol_day: number
  trial_duration: number
  total_sessions_planned: number
  message?: string
}

/**
 * Fetch adherence data for a single patient
 * @param patientId - Patient code (e.g., P001)
 * @param sessionsCompleted - Optional number of completed sessions (C3D files)
 */
export async function fetchPatientAdherence(patientId: string, sessionsCompleted?: number): Promise<AdherenceData> {
  try {
    // Build URL with optional sessions_completed parameter
    let url = `${API_CONFIG.baseUrl}/scoring/adherence/${patientId}`
    if (sessionsCompleted !== undefined) {
      url += `?sessions_completed=${sessionsCompleted}`
    }
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.warn(`Failed to fetch adherence for patient ${patientId}:`, response.status)
      // If we know the session count, calculate a simple adherence score
      if (sessionsCompleted !== undefined) {
        const expectedSessions = 30 // Default protocol
        const adherenceScore = (sessionsCompleted / expectedSessions) * 100
        return {
          patient_id: patientId,
          adherence_score: adherenceScore,
          clinical_threshold: getAdherenceThreshold(adherenceScore),
          sessions_completed: sessionsCompleted,
          sessions_expected: expectedSessions,
          protocol_day: 0,
          trial_duration: 14,
          total_sessions_planned: 30,
          message: 'Calculated from session count'
        }
      }
      return {
        patient_id: patientId,
        adherence_score: null,
        clinical_threshold: 'Unknown',
        sessions_completed: 0,
        sessions_expected: 30,
        protocol_day: 0,
        trial_duration: 14,
        total_sessions_planned: 30,
        message: 'Failed to fetch adherence data'
      }
    }

    const data = await response.json()
    return {
      patient_id: patientId,
      adherence_score: data.adherence_score,
      clinical_threshold: data.category || data.clinical_threshold || 'Unknown',
      sessions_completed: data.completed_sessions || data.sessions_completed || 0,
      sessions_expected: data.expected_sessions || data.sessions_expected || 30,
      protocol_day: data.protocol_day || 0,
      trial_duration: data.trial_duration || 14,
      total_sessions_planned: data.total_sessions_planned || 30,
      message: data.message
    }
  } catch (error) {
    console.error(`Error fetching adherence for patient ${patientId}:`, error)
    // If we know the session count, calculate a simple adherence score
    if (sessionsCompleted !== undefined) {
      const expectedSessions = 30 // Default protocol
      const adherenceScore = (sessionsCompleted / expectedSessions) * 100
      return {
        patient_id: patientId,
        adherence_score: adherenceScore,
        clinical_threshold: getAdherenceThreshold(adherenceScore),
        sessions_completed: sessionsCompleted,
        sessions_expected: expectedSessions,
        protocol_day: 0,
        trial_duration: 14,
        total_sessions_planned: 30,
        message: 'Calculated from session count'
      }
    }
    return {
      patient_id: patientId,
      adherence_score: null,
      clinical_threshold: 'Error',
      sessions_completed: 0,
      sessions_expected: 30,
      protocol_day: 0,
      trial_duration: 14,
      total_sessions_planned: 30,
      message: 'Network error'
    }
  }
}

/**
 * Fetch adherence data for multiple patients
 * @param patientIds - Array of patient IDs
 * @param sessionCounts - Optional map of patient IDs to their session counts for optimization
 */
export async function fetchMultiplePatientAdherence(
  patientIds: string[], 
  sessionCounts?: Map<string, number>
): Promise<AdherenceData[]> {
  // If we have session counts, pass them to optimize API calls
  const adherencePromises = patientIds.map(patientId => {
    const sessionCount = sessionCounts?.get(patientId)
    return fetchPatientAdherence(patientId, sessionCount)
  })
  return Promise.all(adherencePromises)
}

/**
 * Calculate average adherence score from adherence data array
 * Only includes patients with protocol_day >= 3 (minimum for adherence calculation)
 */
export function calculateAverageAdherence(adherenceData: AdherenceData[]): number | null {
  // Filter for eligible patients: protocol_day >= 3 and valid adherence score
  const eligibleData = adherenceData.filter(data => 
    data.protocol_day >= 3 && 
    data.adherence_score !== null && 
    data.adherence_score !== undefined
  )
  
  if (eligibleData.length === 0) {
    return null
  }
  
  const sum = eligibleData.reduce((total, data) => total + (data.adherence_score || 0), 0)
  return sum / eligibleData.length
}

/**
 * Get clinical threshold classification for adherence score
 */
export function getAdherenceThreshold(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Moderate'
  return 'Poor'
}