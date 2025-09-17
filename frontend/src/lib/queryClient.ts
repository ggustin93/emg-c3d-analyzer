/**
 * TanStack Query Client Configuration
 * 
 * Provides intelligent caching and background refetching for dashboard data.
 * Implements stale-while-revalidate pattern for instant UI updates.
 */
import { QueryClient } from '@tanstack/react-query'

// Create a singleton query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes - no refetch during this time
      staleTime: 5 * 60 * 1000,
      
      // Keep cache for 10 minutes after component unmounts
      gcTime: 10 * 60 * 1000,
      
      // Retry failed requests once
      retry: 1,
      
      // Don't refetch on window focus - reduces unnecessary API calls
      refetchOnWindowFocus: false,
      
      // Refetch stale data when component mounts
      refetchOnMount: true,
      
      // Don't refetch when internet reconnects (optional)
      refetchOnReconnect: 'always',
      
      // Network mode - keep showing cached data even offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      
      // Network mode for mutations
      networkMode: 'offlineFirst',
    },
  },
})

// Query key factory for consistent cache keys
export const queryKeys = {
  all: ['emg-c3d-analyzer'] as const,
  
  // Therapist queries
  therapist: {
    all: ['therapist'] as const,
    patients: (therapistId: string) => ['therapist', 'patients', therapistId] as const,
    dashboard: (therapistId: string) => ['therapist', 'dashboard', therapistId] as const,
  },
  
  // Patient queries
  patients: {
    all: ['patients'] as const,
    detail: (patientId: string) => ['patients', patientId] as const,
    adherence: (patientIds: string[]) => ['patients', 'adherence', ...patientIds] as const,
  },
  
  // C3D file queries
  c3dFiles: {
    all: ['c3d-files'] as const,
    recent: () => ['c3d-files', 'recent'] as const,
    byPatient: (patientId: string) => ['c3d-files', 'patient', patientId] as const,
  },
  
  // Session queries
  sessions: {
    all: ['sessions'] as const,
    byPatient: (patientId: string) => ['sessions', 'patient', patientId] as const,
    counts: (patientIds: string[]) => ['sessions', 'counts', ...patientIds] as const,
  },

  // C3D Browser queries
  c3dBrowser: {
    all: ['c3d-browser'] as const,
    files: () => ['c3d-browser', 'files'] as const,
    sessions: (filePaths: string[]) => ['c3d-browser', 'sessions', ...filePaths] as const,
    therapists: (patientCodes: string[]) => ['c3d-browser', 'therapists', ...patientCodes] as const,
    patients: (patientCodes: string[]) => ['c3d-browser', 'patients', ...patientCodes] as const,
    medicalInfo: (patientCodes: string[]) => ['c3d-browser', 'medical-info', ...patientCodes] as const,
  },

  // Upload workflow queries
  upload: {
    all: ['upload'] as const,
    status: (uploadId: string) => ['upload', 'status', uploadId] as const,
    analysis: (filename: string, paramsHash?: string) => 
      paramsHash 
        ? ['upload', 'analysis', filename, paramsHash] as const
        : ['upload', 'analysis', filename] as const,
  },
}