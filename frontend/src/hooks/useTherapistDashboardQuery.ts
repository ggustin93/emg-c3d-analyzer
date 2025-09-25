import { useQuery, useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Patient } from '../components/dashboards/therapist/types'
import SupabaseStorageService from '../services/supabaseStorage'
import TherapySessionsService, { TherapySession } from '../services/therapySessionsService'
import C3DSessionsService from '../services/c3dSessionsService'
import { 
  C3DFile,
  resolvePatientId,
  resolveSessionDateTime
} from '../services/C3DFileDataResolver'
import { AdherenceData } from '../services/adherenceService'
import { useAdherence } from './useAdherence'
import { getAvatarColor, getPatientIdentifier, getPatientAvatarInitials } from '../lib/avatarColors'
import { queryKeys } from '../lib/queryClient'

export interface RecentC3DFile {
  name: string
  created_at: string
  size: number
  session_date: string | null
  patient: {
    patient_code: string
    display_name: string
    avatar_initials: string
    avatar_color: string
  }
}

export interface TherapistDashboardData {
  activePatients: number
  recentC3DFiles: RecentC3DFile[]
  adherence: AdherenceData[]
  patients: Patient[]
  loading: boolean
  error: Error | null
}

// Enhanced session date resolution - follows C3DFileBrowser pattern
function resolveEnhancedSessionDate(
  file: C3DFile, 
  sessionMetadata: Record<string, TherapySession>
): string | null {
  const filePath = `c3d-examples/${file.name}`
  const session = sessionMetadata[filePath]
  
  if (session?.session_date) {
    return session.session_date
  }
  
  if (session?.game_metadata?.time) {
    return session.game_metadata.time
  }
  
  return resolveSessionDateTime(file)
}

// Utility function to create missing patient_medical_info records
async function createMissingPatientMedicalInfo(patientCodes: string[]): Promise<void> {
  try {
    const { data: existingPatients, error: fetchError } = await supabase
      .from('patients')
      .select(`
        patient_code,
        patient_medical_info (patient_code)
      `)
      .in('patient_code', patientCodes)

    if (fetchError) {
      console.error('Error checking existing patient medical info:', fetchError)
      return
    }

    const existingCodes = existingPatients?.map(p => p.patient_code) || []
    const missingCodes = patientCodes.filter(code => !existingCodes.includes(code))

    if (missingCodes.length === 0) {
      return
    }

    console.log('Creating medical info records for patients:', missingCodes)

    const medicalInfoRecords = missingCodes.map(patientCode => {
      const numericPart = patientCode.replace(/\D/g, '')
      const number = parseInt(numericPart) || 0
      
      return {
        patient_code: patientCode,
        first_name: `Patient`,
        last_name: `${number.toString().padStart(3, '0')}`,
        date_of_birth: null
      }
    })

    const { error: insertError } = await supabase
      .from('patient_medical_info')
      .insert(medicalInfoRecords)

    if (insertError) {
      console.error('Error creating patient medical info records:', insertError)
    } else {
      console.log(`Successfully created ${medicalInfoRecords.length} patient medical info records`)
    }
  } catch (error) {
    console.error('Error in createMissingPatientMedicalInfo:', error)
  }
}

// Query function: Fetch therapist's patients
async function fetchTherapistPatients(therapistId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      patient_code,
      created_at,
      treatment_start_date,
      total_sessions_planned,
      active,
      patient_medical_info (
        first_name,
        last_name,
        date_of_birth
      ),
      therapy_sessions (processed_at)
    `)
    .eq('therapist_id', therapistId)

  if (error) {
    console.error('Error fetching patients:', error)
    throw error
  }

  const patientsWithSessions = data?.map((patient: any) => {
    const sessions = patient.therapy_sessions || []
    const sessionCount = sessions.length
    const lastSession = sessions.length > 0 
      ? sessions
          .map((session: any) => session.processed_at)
          .filter(Boolean)
          .sort()
          .pop()
      : null

    const medical = Array.isArray(patient.patient_medical_info) 
      ? patient.patient_medical_info[0] 
      : patient.patient_medical_info
    
    const age = medical?.date_of_birth 
      ? new Date().getFullYear() - new Date(medical.date_of_birth).getFullYear()
      : null

    return {
      patient_code: patient.patient_code,
      created_at: patient.created_at,
      session_count: sessionCount,
      last_session: lastSession,
      active: patient.active ?? true,
      first_name: medical?.first_name || null,
      last_name: medical?.last_name || null,
      age: age,
      treatment_start_date: patient.treatment_start_date || patient.created_at,
      total_sessions_planned: patient.total_sessions_planned || 30,
      display_name: medical?.first_name && medical?.last_name 
        ? `${medical.first_name} ${medical.last_name}`
        : patient.patient_code,
      avatar_initials: getPatientAvatarInitials(medical?.first_name, medical?.last_name, patient.patient_code)
    }
  }) || []

  return patientsWithSessions
}

// Query function: Fetch recent C3D files
async function fetchRecentC3DFiles(): Promise<RecentC3DFile[]> {
  try {
    if (!SupabaseStorageService.isConfigured()) {
      return []
    }

    const c3dFiles = await SupabaseStorageService.listC3DFiles()
    
    const filePaths = c3dFiles.map(file => `c3d-examples/${file.name}`)
    const sessionMetadata = await TherapySessionsService.getSessionsByFilePaths(filePaths)
    
    const filesWithDates = c3dFiles.map((file: C3DFile) => ({
      file,
      sessionDate: resolveEnhancedSessionDate(file, sessionMetadata)
    }))

    filesWithDates.sort((a, b) => {
      if (!a.sessionDate && !b.sessionDate) return 0
      if (!a.sessionDate) return 1
      if (!b.sessionDate) return -1
      return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
    })
    
    const recentFiles = filesWithDates.slice(0, 5).map(item => item.file)

    const patientCodes = [...new Set(recentFiles.map(file => resolvePatientId(file)))]
    
    await createMissingPatientMedicalInfo(patientCodes)
    
    const { data: patientsData, error } = await supabase
      .from('patients')
      .select(`
        patient_code,
        patient_medical_info (
          first_name,
          last_name,
          date_of_birth
        )
      `)
      .in('patient_code', patientCodes)

    if (error) {
      console.error('Error fetching patient medical info:', error)
    }

    const patientInfoMap = new Map()
    if (patientsData) {
      patientsData.forEach(patient => {
        const medical = Array.isArray(patient.patient_medical_info) 
          ? patient.patient_medical_info[0] 
          : patient.patient_medical_info
        patientInfoMap.set(patient.patient_code, medical)
      })
    }

    const filesWithPatientInfo = recentFiles.map((file: C3DFile) => {
      const patientCode = resolvePatientId(file)
      const sessionDate = resolveSessionDateTime(file)
      
      const medical = patientInfoMap.get(patientCode)
      
      const displayName = medical?.first_name && medical?.last_name 
        ? `${medical.first_name} ${medical.last_name}`
        : medical?.first_name 
        ? medical.first_name
        : patientCode
      
      const patientForAvatar = {
        first_name: medical?.first_name,
        last_name: medical?.last_name,
        patient_code: patientCode,
        display_name: displayName
      }
      
      const avatarInitials = getPatientAvatarInitials(medical?.first_name, medical?.last_name, patientCode)
      const avatarColor = getAvatarColor(getPatientIdentifier(patientForAvatar))

      return {
        name: file.name,
        created_at: file.created_at,
        size: file.size,
        session_date: sessionDate,
        patient: {
          patient_code: patientCode,
          display_name: displayName,
          avatar_initials: avatarInitials,
          avatar_color: avatarColor
        }
      }
    })

    return filesWithPatientInfo
  } catch (error) {
    console.error('Error fetching recent C3D files:', error)
    return []
  }
}

// Query function: Fetch session counts for adherence
async function fetchSessionCounts(patientCodes: string[]): Promise<Map<string, number>> {
  if (patientCodes.length === 0) {
    return new Map()
  }

  try {
    const sessionData = await C3DSessionsService.getPatientSessionData(patientCodes)
    return new Map(
      sessionData.map(data => [data.patient_code, data.session_count])
    )
  } catch (err) {
    console.warn('Error fetching C3D session counts:', err)
    // Return empty map on error - adherence hook will handle fallback
    return new Map()
  }
}

/**
 * Hook using TanStack Query for therapist dashboard data
 * Implements stale-while-revalidate pattern with intelligent caching
 */
export function useTherapistDashboardQuery(therapistId: string | undefined): TherapistDashboardData {
  // Query 1: Fetch therapist's patients
  const patientsQuery = useQuery({
    queryKey: queryKeys.therapist.patients(therapistId || ''),
    queryFn: () => fetchTherapistPatients(therapistId!),
    enabled: !!therapistId,
    // Data considered fresh for 5 minutes (from queryClient config)
    // Will use cache on mount if data is fresh
    // Will refetch in background if stale
  })

  // Query 2: Fetch recent C3D files  
  const recentFilesQuery = useQuery({
    queryKey: queryKeys.c3dFiles.recent(),
    queryFn: fetchRecentC3DFiles,
    enabled: !!therapistId,
    // Independent of patients query - can be cached separately
  })

  // Query 3: Fetch session counts for adherence calculation
  const patientCodes = patientsQuery.data?.map(p => p.patient_code) || []
  const sessionCountsQuery = useQuery({
    queryKey: queryKeys.sessions.counts(patientCodes),
    queryFn: () => fetchSessionCounts(patientCodes),
    enabled: patientCodes.length > 0,
    // Only refetch when patient list changes
  })

  // Side effect: Ensure medical info exists for all patients
  const allPatientCodes = [
    ...(patientsQuery.data?.map(p => p.patient_code) || []),
    ...(recentFilesQuery.data?.map(f => f.patient.patient_code) || [])
  ]
  
  useQuery({
    queryKey: ['patient-medical-info-check', allPatientCodes],
    queryFn: async () => {
      if (allPatientCodes.length > 0) {
        await createMissingPatientMedicalInfo([...new Set(allPatientCodes)])
      }
      return true
    },
    enabled: allPatientCodes.length > 0,
    staleTime: Infinity, // Only run once per session
  })

  // Use the reusable adherence hook with cached session counts
  // Wait for session counts to load before fetching adherence to prevent showing 0% initially
  const { 
    adherenceData, 
    loading: adherenceLoading 
  } = useAdherence(
    patientCodes, 
    patientCodes.length > 0 && !!sessionCountsQuery.data, 
    sessionCountsQuery.data || new Map()
  )

  // Calculate active patients count
  const activePatients = patientsQuery.data?.filter(patient => patient.active).length || 0

  // Combine loading states
  // On initial load, show loading
  // On background refetch (when data exists), don't show loading spinner
  const loading = (
    (patientsQuery.isLoading && !patientsQuery.data) ||
    (recentFilesQuery.isLoading && !recentFilesQuery.data) ||
    (sessionCountsQuery.isLoading && !sessionCountsQuery.data && patientCodes.length > 0) ||
    (adherenceLoading) || // Always consider adherence loading state
    (!sessionCountsQuery.data && patientCodes.length > 0) // Loading if session counts not ready
  )

  // Collect errors
  const error = patientsQuery.error || recentFilesQuery.error || sessionCountsQuery.error || null

  return {
    activePatients,
    recentC3DFiles: recentFilesQuery.data || [],
    adherence: adherenceData,
    patients: patientsQuery.data || [],
    loading,
    error: error as Error | null
  }
}

// Export the original hook name for backward compatibility
// This allows gradual migration without breaking existing code
export const useTherapistDashboardData = useTherapistDashboardQuery