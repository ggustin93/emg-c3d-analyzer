import { useState, useEffect } from 'react'
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
import { ENV_CONFIG } from '../config/environment'

const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME

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
  loading: boolean
  error: Error | null
}

// Avatar functions are now imported from centralized lib/avatarColors.ts

// Enhanced session date resolution - follows C3DFileBrowser pattern
// Priority: session_date → game_metadata.time → filename patterns
function resolveEnhancedSessionDate(
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

// Avatar functions are now imported from centralized lib/avatarColors.ts

// Utility function to create missing patient_medical_info records
async function createMissingPatientMedicalInfo(patientCodes: string[]): Promise<void> {
  try {
    // Check which patients don't have medical info
    const { data: existingPatients, error: fetchError } = await supabase
      .from('patients')
      .select(`
        patient_code,
        id,
        patient_medical_info!inner (id)
      `)
      .in('patient_code', patientCodes)

    if (fetchError) {
      console.error('Error checking existing patient medical info:', fetchError)
      return
    }

    const existingCodes = existingPatients?.map(p => p.patient_code) || []
    const missingCodes = patientCodes.filter(code => !existingCodes.includes(code))

    if (missingCodes.length === 0) {
      console.log('All patients already have medical info records')
      return
    }

    console.log('Creating medical info records for patients:', missingCodes)

    // Get current user ID first
    const { data: userData } = await supabase.auth.getUser()
    const currentUserId = userData.user?.id

    // Create medical info records for missing patients
    const medicalInfoRecords = missingCodes.map(patientCode => {
      const patient = existingPatients?.find(p => p.patient_code === patientCode)
      // Generate a reasonable name from patient code
      const numericPart = patientCode.replace(/\D/g, '')
      const number = parseInt(numericPart) || 0
      
      return {
        patient_id: patient?.id,
        first_name: `Patient`,
        last_name: `${number.toString().padStart(3, '0')}`, // P001 → Patient 001
        date_of_birth: '1990-01-01', // Will be filled by therapist later
        gender: 'NS',
        created_by: currentUserId
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

// Fetch therapist's patients (reuse existing logic)
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
      // Treatment configuration
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


// Fetch recent C3D files (last 5 sessions) with enhanced patient info
async function fetchRecentC3DFiles(): Promise<RecentC3DFile[]> {
  try {
    if (!SupabaseStorageService.isConfigured()) {
      return []
    }

    // Get all C3D files
    const c3dFiles = await SupabaseStorageService.listC3DFiles()
    
    // Get session metadata for enhanced date resolution
    const filePaths = c3dFiles.map(file => `${BUCKET_NAME}/${file.name}`)
    const sessionMetadata = await TherapySessionsService.getSessionsByFilePaths(filePaths)
    
    // Add enhanced dates and sort by most recent session
    const filesWithDates = c3dFiles.map((file: C3DFile) => ({
      file,
      sessionDate: resolveEnhancedSessionDate(file, sessionMetadata)
    }))

    // Sort by session date (most recent first), handle null values
    filesWithDates.sort((a, b) => {
      if (!a.sessionDate && !b.sessionDate) return 0
      if (!a.sessionDate) return 1  // Files without session dates go to end
      if (!b.sessionDate) return -1
      return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
    })
    
    // Get last 5 sessions (more flexible than 7-day filter)
    const recentFiles = filesWithDates.slice(0, 5).map(item => item.file)

    // Get unique patient codes from files
    const patientCodes = [...new Set(recentFiles.map(file => resolvePatientId(file)))]
    
    // Ensure all patients have medical info records (create missing ones)
    await createMissingPatientMedicalInfo(patientCodes)
    
    // Fetch patient medical info for all unique patients
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
      // Fall back to patient codes if medical info fails
    }

    // Log patients without medical info for debugging
    if (patientsData) {
      const patientsWithoutMedicalInfo = patientsData.filter(patient => 
        !patient.patient_medical_info || 
        (Array.isArray(patient.patient_medical_info) && patient.patient_medical_info.length === 0)
      )
      
      if (patientsWithoutMedicalInfo.length > 0) {
        console.warn('Patients missing medical information:', 
          patientsWithoutMedicalInfo.map(p => p.patient_code)
        )
      }
    }

    // Create a lookup map for patient medical info
    const patientInfoMap = new Map()
    if (patientsData) {
      patientsData.forEach(patient => {
        const medical = Array.isArray(patient.patient_medical_info) 
          ? patient.patient_medical_info[0] 
          : patient.patient_medical_info
        patientInfoMap.set(patient.patient_code, medical)
      })
    }

    // Transform to our format with enhanced patient info
    const filesWithPatientInfo = recentFiles.map((file: C3DFile) => {
      const patientCode = resolvePatientId(file)
      const sessionDate = resolveSessionDateTime(file)
      
      // Get medical info for this patient
      const medical = patientInfoMap.get(patientCode)
      
      // Create display name: prefer "First Last" over patient code
      const displayName = medical?.first_name && medical?.last_name 
        ? `${medical.first_name} ${medical.last_name}`
        : medical?.first_name 
        ? medical.first_name
        : patientCode
      
      // Create patient object for consistent avatar color generation
      const patientForAvatar = {
        first_name: medical?.first_name,
        last_name: medical?.last_name,
        patient_code: patientCode,
        display_name: displayName
      }
      
      // Create avatar initials and color using consistent pattern
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

export function useTherapistDashboardData(therapistId: string | undefined): TherapistDashboardData {
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentC3DFiles, setRecentC3DFiles] = useState<RecentC3DFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [accurateSessionCounts, setAccurateSessionCounts] = useState<Map<string, number>>(new Map())

  // Get ALL patient IDs for adherence fetching
  // We want average adherence across ALL patients, not just active ones
  const allPatientIds = patients.map(patient => patient.patient_code)
  
  // Use accurate session counts from C3D files (not therapy_sessions table)
  // This ensures consistency with PatientManagement view
  const sessionCountsMap = accurateSessionCounts

  // Use the reusable adherence hook with accurate session counts for ALL patients
  const { 
    adherenceData, 
    loading: adherenceLoading 
  } = useAdherence(allPatientIds, allPatientIds.length > 0, sessionCountsMap)

  useEffect(() => {
    if (!therapistId) {
      setLoading(false)
      return
    }

    const loadDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch patients and recent C3D files concurrently  
        const [patientsData, recentFilesData] = await Promise.all([
          fetchTherapistPatients(therapistId),
          fetchRecentC3DFiles()
        ])

        // Ensure all therapist's patients have medical info records
        const therapistPatientCodes = patientsData.map(p => p.patient_code)
        if (therapistPatientCodes.length > 0) {
          await createMissingPatientMedicalInfo(therapistPatientCodes)
        }

        // Get accurate session counts from C3D files (like PatientManagement does)
        // This ensures adherence calculation matches between views
        if (therapistPatientCodes.length > 0) {
          try {
            const sessionData = await C3DSessionsService.getPatientSessionData(therapistPatientCodes)
            const countsMap = new Map(
              sessionData.map(data => [data.patient_code, data.session_count])
            )
            setAccurateSessionCounts(countsMap)
          } catch (err) {
            console.warn('Error fetching C3D session counts, using therapy_sessions fallback:', err)
            // Fallback to therapy_sessions counts if C3D service fails
            const countsMap = new Map(
              patientsData.map(p => [p.patient_code, p.session_count])
            )
            setAccurateSessionCounts(countsMap)
          }
        }

        setPatients(patientsData)
        setRecentC3DFiles(recentFilesData)

      } catch (err) {
        console.error('Error loading dashboard data:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [therapistId])

  // Calculate active patients count
  const activePatients = patients.filter(patient => patient.active).length

  return {
    activePatients,
    recentC3DFiles,
    adherence: adherenceData,
    loading: loading || adherenceLoading,
    error
  }
}