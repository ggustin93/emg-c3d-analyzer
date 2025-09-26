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
import { supabase } from '../lib/supabase'

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

// Get bucket name from centralized configuration
import { ENV_CONFIG } from '../config/environment';
const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME;

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
    // Enhanced query with JOIN to performance_scores for better performance
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select(`
        *,
        performance_scores (
          overall_score,
          compliance_score,
          symmetry_score,
          effort_score,
          game_score
        )
      `)
      .in('file_path', filePaths);

    if (error) {
      logger.warn(LogCategory.API, 'Failed to load session data:', error);
      return {};
    }

    // Transform to expected format with performance data
    const sessionMap: Record<string, any> = {};
    data?.forEach(session => {
      sessionMap[session.file_path] = {
        ...session,
        performance_score: session.performance_scores?.[0]?.overall_score || null,
        processing_status: session.processing_status
      };
    });

    return sessionMap;
  } catch (error) {
    logger.warn(LogCategory.API, 'Failed to load session data:', error)
    return {} // Not critical - continue without session data
  }
}

/**
 * 🔧 THERAPIST DATA RESOLUTION USING RPC FUNCTION
 * 
 * This function replaces the complex multi-query approach with a single RPC call
 * to resolve therapist information for C3D files efficiently.
 * 
 * 🎯 PROBLEM SOLVED:
 * - Previously: Multiple separate queries (patients → therapist_ids → user_profiles)
 * - Now: Single RPC call that handles all joins and logic in the database
 * - Result: Faster, more reliable, and eliminates "Unknown Therapist" issues
 * 
 * 🔄 DATA FLOW:
 * 1. Input: Array of C3D file paths (e.g., ["P001/Ghostly_Emg_20250115_10-30-00-1234_test.c3d", "P002/file.c3d"])
 * 2. RPC Call: get_therapists_for_c3d_files(file_paths) 
 * 3. Database Logic: 
 *    - Extract patient codes from file paths using get_patient_code_from_storage_path()
 *    - Join patients table to get therapist_id for each patient_code
 *    - Join user_profiles table to get therapist details (name, user_code, role)
 *    - Format display name as "Dr. LastName" or fallback to user_code
 * 4. Output: Object mapping file_path → therapist_info
 * 
 * 📊 EXAMPLE RPC RESULT:
 * [
 *   {
 *     file_path: "P001/Ghostly_Emg_20250115_10-30-00-1234_test.c3d",
 *     patient_code: "P001", 
 *     therapist_id: "e7b43581-743b-4211-979e-76196575ee99",
 *     therapist_first_name: "Marie-Claire",
 *     therapist_last_name: "Tremblay", 
 *     therapist_user_code: "T001",
 *     therapist_role: "therapist",
 *     therapist_display_name: "Dr. Tremblay"
 *   }
 * ]
 * 
 * 🎨 FRONTEND INTEGRATION:
 * - Maps database result to component-expected format
 * - Provides fallback display names for edge cases
 * - Maintains backward compatibility with existing C3DFileBrowser component
 */
async function fetchTherapistData(filePaths: string[]) {
  if (!filePaths.length) {
    return {}
  }
  
  try {
    console.log('🔍 Fetching therapist data for files:', filePaths)
    
    // 📡 SINGLE RPC CALL - Replaces complex multi-query approach
    // This RPC function handles all the database joins and logic in one efficient call
    const { data, error } = await supabase.rpc('get_therapists_for_c3d_files', {
      file_paths: filePaths  // Pass array of file paths directly
    })

    console.log('🔍 RPC function result:', { data, error })

    if (error) {
      console.error('🔍 RPC function error:', error)
      return {}
    }

    if (!data || data.length === 0) {
      console.log('🔍 No therapist data found')
      return {}
    }

    // 🔄 TRANSFORM DATABASE RESULT TO COMPONENT FORMAT
    // Map the RPC result to the format expected by C3DFileBrowser component
    const result: Record<string, any> = {}
    data.forEach((row: any) => {
      if (row.therapist_id) {
        result[row.file_path] = {
          // Core therapist identification
          id: row.therapist_id,
          first_name: row.therapist_first_name,
          last_name: row.therapist_last_name,
          user_code: row.therapist_user_code,
          role: row.therapist_role,
          
          // 🎨 SMART DISPLAY NAME LOGIC
          // Priority: Database computed → Full name → User code → Fallback ID
          display_name: row.therapist_display_name || 
            (row.therapist_first_name && row.therapist_last_name 
              ? `${row.therapist_first_name} ${row.therapist_last_name}`
              : row.therapist_user_code || `Therapist ${row.therapist_id.slice(0, 8)}...`)
        }
      }
    })

    console.log('🔍 Final therapist result:', result)
    return result
  } catch (error) {
    console.error('🔍 Error in fetchTherapistData:', error)
    return {}
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
    staleTime: 0, // Disable caching for debugging
    gcTime: 0, // Don't keep in cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const files = filesQuery.data || []

  // Query 2: Session data (dependent on files)
  const filePaths = files.map(file => `${BUCKET_NAME}/${file.name}`)
  const sessionQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.sessions(filePaths),
    queryFn: () => fetchSessionData(filePaths),
    enabled: filePaths.length > 0,
    staleTime: 0, // Disable caching for debugging
    gcTime: 0, // Don't keep in cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Query 3: Therapist data (dependent on files) - now using file paths directly
  const therapistFilePaths = files.map(file => file.name)

  console.log('🔍 File paths for therapist query:', therapistFilePaths)

  const therapistQuery = useQuery({
    queryKey: queryKeys.c3dBrowser.therapists(therapistFilePaths),
    queryFn: () => fetchTherapistData(therapistFilePaths),
    enabled: therapistFilePaths.length > 0,
    staleTime: 0, // Disable caching - always fetch fresh data
    gcTime: 0, // Don't keep in cache
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
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
    staleTime: 0, // Disable caching for debugging
    gcTime: 0, // Don't keep in cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
    console.log('🔍 Processing therapist cache with data:', therapistQuery.data)
    
    files.forEach(file => {
      // Now the data is keyed by file path, so we can access it directly
      const therapistData = therapistQuery.data[file.name]
      
      if (therapistData) {
        // Map therapist data by filename for the component to use
        therapistCache[file.name] = therapistData
        console.log('🔍 Added to therapist cache:', {
          fileName: file.name,
          therapistData: therapistCache[file.name]
        })
      } else {
        console.log('🔍 No therapist data found for file:', {
          fileName: file.name,
          availableKeys: Object.keys(therapistQuery.data)
        })
      }
    })
    
    console.log('🔍 Final therapist cache:', therapistCache)
  } else {
    console.log('🔍 No therapist data to process:', {
      hasTherapistQueryData: !!therapistQuery.data,
      filesLength: files.length,
      therapistQueryError: therapistQuery.error
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