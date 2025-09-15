/**
 * Reusable Adherence Hook - Used by both therapist and researcher dashboards
 * Follows DRY/SOLID principles for code reusability
 */

import { useState, useEffect } from 'react'
import { 
  AdherenceData, 
  fetchMultiplePatientAdherence, 
  calculateAverageAdherence 
} from '../services/adherenceService'

export interface AdherenceHookResult {
  adherenceData: AdherenceData[]
  averageAdherence: number | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch adherence data for multiple patients
 * @param patientIds - Array of patient IDs to fetch adherence for
 * @param sessionCounts - Optional map of patient IDs to their session counts
 * @param enabled - Whether to fetch data (default: true)
 */
export function useAdherence(
  patientIds: string[], 
  enabled: boolean = true,
  sessionCounts?: Map<string, number>
): AdherenceHookResult {
  const [adherenceData, setAdherenceData] = useState<AdherenceData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = async () => {
    if (!enabled || patientIds.length === 0) {
      setAdherenceData([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Pass session counts to the service for optimized fetching
      const data = await fetchMultiplePatientAdherence(patientIds, sessionCounts)
      setAdherenceData(data)
    } catch (err) {
      console.error('Error fetching adherence data:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [enabled, JSON.stringify(patientIds)]) // Using JSON.stringify for array comparison

  const averageAdherence = calculateAverageAdherence(adherenceData)

  return {
    adherenceData,
    averageAdherence,
    loading,
    error,
    refetch: fetchData
  }
}