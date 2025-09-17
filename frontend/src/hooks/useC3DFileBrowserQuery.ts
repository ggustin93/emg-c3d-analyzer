/**
 * C3D File Browser Query Hook
 * 
 * Replaces custom SimpleCache with TanStack Query for intelligent caching
 * and eliminates loading spinners on refresh.
 * 
 * Features:
 * - Stale-while-revalidate pattern for instant UI updates
 * - Parallel dependent queries for optimal performance
 * - Automatic cache invalidation on upload
 * - Background refresh without UI blocking
 */
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import SupabaseStorageService from '../services/supabaseStorage'
import { TherapySessionsService } from '../services/therapySessionsService'
import therapistService from '../services/therapistService'
import PatientService, { PatientInfo } from '../services/patientService'
import { C3DFile } from '../services/C3DFileDataResolver'
import { logger, LogCategory } from '../services/logger'

export interface C3DFileBrowserData {
  files: C3DFile[]
  sessionData: Record<string, any>
  therapistCache: Record<string, any>
  patientCache: Record<string, PatientInfo>
  loading: {
    files: boolean
    sessions: boolean
    therapists: boolean
    patients: boolean
  }
  error: string | null
  isLoading: boolean
}

// Get bucket name from environment variable or use default
const BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples'

// Individual query functions for better separation of concerns
async function fetchC3DFiles(): Promise<C3DFile[]> {
  try {
    return await SupabaseStorageService.listC3DFiles()
  } catch (error) {
    logger.error(LogCategory.API, 'Failed to fetch C3D files:', error)
    throw error
  }
}

async function fetchSessionData(filePaths: string[]) {
  if (!filePaths.length) return {}
  
  try {
    return await TherapySessionsService.getSessionsByFilePaths(filePaths)
  } catch (error) {
    logger.warn(LogCategory.API, 'Failed to load session data:', error)
    return {} // Not critical - continue without session data
  }
}

async function fetchTherapistData(patientCodes: string[]) {
  if (!patientCodes.length) return {}
  
  try {
    const uniquePatientCodes = Array.from(new Set(patientCodes))
    return await therapistService.resolveTherapistsForPatientCodes(uniquePatientCodes)
  } catch (error) {
    logger.warn(LogCategory.API, 'Failed to load therapist data:', error)
    return {} // Not critical - continue without therapist data
  }
}

async function fetchPatientData(patientCodes: string[]) {
  if (!patientCodes.length) return {}
  
  try {
    const uniquePatientCodes = Array.from(new Set(patientCodes))
    return await PatientService.getPatientsByCode(uniquePatientCodes)
  } catch (error) {
    logger.warn(LogCategory.API, 'Failed to load patient data:', error)
    return {} // Not critical - continue without patient data
  }
}

export function useC3DFileBrowserQuery(): C3DFileBrowserData {
  // Query 1: C3D files list (primary query)
  const filesQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.files(),
    queryFn: fetchC3DFiles,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,   // Keep cache for 10 minutes
  })

  const files = filesQuery.data || []

  // Query 2: Session data (dependent on files)
  const filePaths = files.map(file => `${BUCKET_NAME}/${file.name}`)
  const sessionQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.sessions(filePaths),
    queryFn: () => fetchSessionData(filePaths),
    enabled: filePaths.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes for session data
  })

  // Query 3: Therapist data (dependent on files)
  const patientCodes = files
    .map(file => therapistService.extractPatientCodeFromPath(file.name))
    .filter((code): code is string => !!code)

  const therapistQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.therapists(patientCodes),
    queryFn: () => fetchTherapistData(patientCodes),
    enabled: patientCodes.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes for therapist data (more stable)
  })

  // Query 4: Patient data (dependent on files)
  const patientCodesForPatients = files.map(file => {
    // Extract patient codes from file names for patient lookup
    const filename = file.name
    const match = filename.match(/[A-Z]+(\d+)/)
    return match ? `${match[0]}` : null
  }).filter((code): code is string => !!code)

  const patientQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.patients(patientCodesForPatients),
    queryFn: () => fetchPatientData(patientCodesForPatients),
    enabled: patientCodesForPatients.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes for patient data (more stable)
  })

  // Smart loading states - show loading only when necessary
  const loading = {
    files: filesQuery.isLoading,
    sessions: sessionQuery.isLoading,
    therapists: therapistQuery.isLoading,
    patients: patientQuery.isLoading,
  }

  // Process therapist data to match existing component expectations
  const therapistCache: Record<string, any> = {}
  if (therapistQuery.data && files.length > 0) {
    files.forEach(file => {
      const patientCode = therapistService.extractPatientCodeFromPath(file.name)
      if (patientCode && therapistQuery.data[patientCode.toUpperCase()]) {
        therapistCache[file.name] = therapistQuery.data[patientCode.toUpperCase()]
      }
    })
  }

  // Overall error state (only show file loading errors as critical)
  const error = filesQuery.error ? 
    `Failed to load C3D files: ${filesQuery.error.message}` : 
    null

  return {
    files,
    sessionData: sessionQuery.data || {},
    therapistCache,
    patientCache: patientQuery.data || {},
    loading,
    error,
    // Overall loading state - true only when files are loading for the first time
    isLoading: filesQuery.isLoading && !filesQuery.data,
  }
}