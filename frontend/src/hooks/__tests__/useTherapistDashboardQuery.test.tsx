/**
 * TanStack Query Therapist Dashboard Hook Tests
 * 
 * Comprehensive test suite validating the caching implementation and user experience goals:
 * - No loading spinners on refresh (primary goal)
 * - Cached data shows immediately 
 * - Background refetch updates data when stale
 * - Error handling and fallbacks
 * - Query independence and proper cache keys
 * 
 * Following project principles: SOLID, DRY, KISS, SSoT, User-Centric Testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTherapistDashboardQuery } from '../useTherapistDashboardQuery'
import { queryKeys } from '../../lib/queryClient'
import React from 'react'

// Mock the services and dependencies  
vi.mock('../../lib/supabase', () => {
  const createQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    // Make it thenable for Promise resolution
    then: vi.fn((resolve) => resolve({ data: [], error: null }))
  })

  return {
    supabase: {
      from: vi.fn(() => createQueryBuilder())
    },
    isSupabaseConfigured: vi.fn(() => true)
  }
})

vi.mock('../../services/supabaseStorage', () => ({
  default: {
    isConfigured: vi.fn(() => true),
    listC3DFiles: vi.fn(() => Promise.resolve([]))
  }
}))

vi.mock('../../services/therapySessionsService', () => ({
  default: {
    getSessionsByFilePaths: vi.fn(() => Promise.resolve({}))
  }
}))

vi.mock('../../services/c3dSessionsService', () => ({
  default: {
    getPatientSessionData: vi.fn(() => Promise.resolve([]))
  }
}))

vi.mock('../../hooks/useAdherence', () => ({
  useAdherence: vi.fn(() => ({
    adherenceData: [],
    loading: false
  }))
}))

vi.mock('../../services/C3DFileDataResolver', () => ({
  resolvePatientId: vi.fn(() => 'P001'),
  resolveSessionDateTime: vi.fn(() => '2024-01-20T15:30:00Z')
}))

vi.mock('../../lib/avatarColors', () => ({
  getAvatarColor: vi.fn(() => 'bg-blue-500'),
  getPatientIdentifier: vi.fn(() => 'P001'),
  getPatientAvatarInitials: vi.fn(() => 'JD')
}))

// Mock patients data - realistic therapist dashboard data
const mockPatients = [
  {
    patient_code: 'P001',
    created_at: '2024-01-15T10:00:00Z',
    treatment_start_date: '2024-01-15T10:00:00Z',
    total_sessions_planned: 30,
    active: true,
    patient_medical_info: {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1990-01-01'
    },
    therapy_sessions: [
      { processed_at: '2024-01-20T10:00:00Z' }
    ]
  },
  {
    patient_code: 'P002',
    created_at: '2024-01-20T10:00:00Z',
    treatment_start_date: '2024-01-20T10:00:00Z',
    total_sessions_planned: 30,
    active: true,
    patient_medical_info: {
      first_name: 'Jane',
      last_name: 'Smith',
      date_of_birth: '1985-05-15'
    },
    therapy_sessions: []
  }
]

// Mock C3D files data
const mockC3DFiles = [
  {
    name: 'P001_session_001.c3d',
    created_at: '2024-01-20T15:30:00Z',
    size: 1024000,
    updated_at: '2024-01-20T15:30:00Z'
  },
  {
    name: 'P002_session_001.c3d', 
    created_at: '2024-01-21T10:15:00Z',
    size: 2048000,
    updated_at: '2024-01-21T10:15:00Z'
  }
]

// Mock session count data
const mockSessionCounts = [
  { patient_code: 'P001', session_count: 5 },
  { patient_code: 'P002', session_count: 3 }
]

describe('useTherapistDashboardQuery - TanStack Query Implementation', () => {
  let queryClient: QueryClient
  let mockSupabase: any
  let mockSupabaseStorage: any
  let mockTherapySessionsService: any
  let mockC3DSessionsService: any
  let mockUseAdherence: any

  // Test wrapper component for React Query
  const createWrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    )
  }

  beforeEach(async () => {
    // Create fresh query client for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for faster tests
          staleTime: 5 * 60 * 1000, // Match production config
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false,
          networkMode: 'offlineFirst'
        }
      }
    })

    // Setup mocks with realistic data
    const supabaseModule = await import('../../lib/supabase')
    mockSupabase = supabaseModule.supabase

    const storageModule = await import('../../services/supabaseStorage')
    mockSupabaseStorage = storageModule.default
    
    const therapyModule = await import('../../services/therapySessionsService')
    mockTherapySessionsService = therapyModule.default
    
    const c3dModule = await import('../../services/c3dSessionsService')
    mockC3DSessionsService = c3dModule.default
    
    const adherenceModule = await import('../../hooks/useAdherence')
    mockUseAdherence = adherenceModule.useAdherence

    // Reset all mocks
    vi.clearAllMocks()

    // Setup default successful responses
    setupSuccessfulMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  function setupSuccessfulMocks() {
    // Mock Supabase patients query - create a chainable query builder
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: mockPatients, error: null }))
    }
    
    mockSupabase.from.mockReturnValue(queryBuilder)

    // Mock storage service
    mockSupabaseStorage.isConfigured.mockReturnValue(true)
    mockSupabaseStorage.listC3DFiles.mockResolvedValue(mockC3DFiles)

    // Mock therapy sessions service
    mockTherapySessionsService.getSessionsByFilePaths.mockResolvedValue({})

    // Mock C3D sessions service
    mockC3DSessionsService.getPatientSessionData.mockResolvedValue(mockSessionCounts)

    // Mock adherence hook
    mockUseAdherence.mockReturnValue({
      adherenceData: [
        { patient_code: 'P001', adherence_score: 0.85, protocol_day: 5 },
        { patient_code: 'P002', adherence_score: 0.92, protocol_day: 3 }
      ],
      loading: false
    })
  }

  function setupErrorMocks() {
    const errorQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: null, error: new Error('Database connection failed') }))
    }
    
    mockSupabase.from.mockReturnValue(errorQueryBuilder)

    mockSupabaseStorage.listC3DFiles.mockRejectedValue(new Error('Storage service unavailable'))
    mockC3DSessionsService.getPatientSessionData.mockRejectedValue(new Error('Session service error'))
  }

  describe('Core Functionality - Caching Behavior', () => {
    it('should show cached data immediately on subsequent calls (no loading spinners)', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First render - should load data initially
      const { result: firstResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Wait for first load to complete
      await waitFor(() => {
        expect(firstResult.current.loading).toBe(false)
      })

      // Verify data is loaded
      expect(firstResult.current.activePatients).toBe(2)
      expect(firstResult.current.recentC3DFiles).toHaveLength(2)
      expect(firstResult.current.error).toBeNull()

      // Clear mock call history to verify cache usage
      vi.clearAllMocks()

      // Second render - should use cache immediately (PRIMARY GOAL)
      const { result: secondResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Should have data immediately without loading state
      expect(secondResult.current.loading).toBe(false)
      expect(secondResult.current.activePatients).toBe(2)
      expect(secondResult.current.recentC3DFiles).toHaveLength(2)

      // Verify no API calls were made (data came from cache)
      expect(mockSupabase.from).not.toHaveBeenCalled()
      expect(mockSupabaseStorage.listC3DFiles).not.toHaveBeenCalled()
      expect(mockC3DSessionsService.getPatientSessionData).not.toHaveBeenCalled()
    })

    it('should use independent query keys for proper cache separation', () => {
      const therapistId1 = 'therapist-123'
      const therapistId2 = 'therapist-456'

      // Verify query keys are different for different therapists
      const patientsKey1 = queryKeys.therapist.patients(therapistId1)
      const patientsKey2 = queryKeys.therapist.patients(therapistId2)
      
      expect(patientsKey1).toEqual(['therapist', 'patients', 'therapist-123'])
      expect(patientsKey2).toEqual(['therapist', 'patients', 'therapist-456'])
      expect(patientsKey1).not.toEqual(patientsKey2)

      // Recent files should be shared across therapists (same query key)
      const recentFilesKey = queryKeys.c3dFiles.recent()
      expect(recentFilesKey).toEqual(['c3d-files', 'recent'])
    })

    it('should cache each query independently (patients, files, counts)', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First load
      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify all queries have cached data
      const patientsCache = queryClient.getQueryData(queryKeys.therapist.patients(therapistId))
      const recentFilesCache = queryClient.getQueryData(queryKeys.c3dFiles.recent())
      const sessionCountsCache = queryClient.getQueryData(queryKeys.sessions.counts(['P001', 'P002']))

      expect(patientsCache).toBeDefined()
      expect(recentFilesCache).toBeDefined()
      expect(sessionCountsCache).toBeDefined()

      // Each query should have independent cache entries
      expect(Array.isArray(patientsCache)).toBe(true)
      expect(Array.isArray(recentFilesCache)).toBe(true)
      expect(sessionCountsCache instanceof Map).toBe(true)
    })
  })

  describe('Loading States - Smart Loading Logic', () => {
    it('should only show loading for initial load, not when cached data exists', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Mock slow API response for first load
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => 
            new Promise(resolve => 
              setTimeout(() => resolve({ data: mockPatients, error: null }), 100)
            )
          )
        })
      })

      // First render - should show loading initially
      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.activePatients).toBe(0)

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.activePatients).toBe(2)

      // Second render - should NOT show loading (cached data available)
      const { result: secondResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      expect(secondResult.current.loading).toBe(false)
      expect(secondResult.current.activePatients).toBe(2)
    })

    it.skip('should handle loading states when different data components are loading', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Setup mocks to return data
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockPatients, error: null })
        })
      })

      mockSupabaseStorage.listC3DFiles.mockResolvedValue(mockC3DFiles)

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Initial state should be loading
      expect(result.current.loading).toBe(true)

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Data should be loaded
      expect(result.current.recentC3DFiles).toHaveLength(2)
      expect(result.current.activePatients).toBe(2)
    })
  })

  describe('Background Refetch - Stale While Revalidate', () => {
    it.skip('should refetch data in background when stale but show cached data immediately', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First load
      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.activePatients).toBe(2)

      // Manually mark queries as stale to simulate time passing
      queryClient.invalidateQueries({ queryKey: queryKeys.therapist.patients(therapistId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.c3dFiles.recent() })

      // Clear mock history to track refetch calls
      vi.clearAllMocks()

      // Setup updated mock data for refetch
      const updatedPatients = [...mockPatients, {
        patient_code: 'P003',
        created_at: '2024-01-22T10:00:00Z',
        treatment_start_date: '2024-01-22T10:00:00Z',
        total_sessions_planned: 30,
        active: true,
        patient_medical_info: {
          first_name: 'Alice',
          last_name: 'Johnson',
          date_of_birth: '1992-03-10'
        },
        therapy_sessions: []
      }]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: updatedPatients, error: null }),
          in: vi.fn().mockResolvedValue({ data: updatedPatients, error: null })
        })
      })

      // Second render should show cached data immediately, then update
      const { result: secondResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Should show old cached data immediately (no loading spinner)
      expect(secondResult.current.loading).toBe(false)
      expect(secondResult.current.activePatients).toBe(2) // Old cached value

      // Wait for background refetch to complete
      await waitFor(() => {
        expect(secondResult.current.activePatients).toBe(3) // Updated value
      })

      // Verify refetch was triggered
      expect(mockSupabase.from).toHaveBeenCalled()
    })

    it('should respect staleTime configuration (5 minutes)', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First load
      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Clear mocks
      vi.clearAllMocks()

      // Immediate second render (within staleTime) should not refetch
      renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Wait a bit to ensure no background refetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      // Should not have made new API calls (data is still fresh)
      expect(mockSupabase.from).not.toHaveBeenCalled()
      expect(mockSupabaseStorage.listC3DFiles).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should handle API errors gracefully and maintain error state', async () => {
      setupErrorMocks()
      
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.activePatients).toBe(0)
      expect(result.current.recentC3DFiles).toHaveLength(0)
    })

    it('should provide fallback data when individual services fail', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Mock patients success, files failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockPatients, error: null }),
          in: vi.fn().mockResolvedValue({ data: mockPatients, error: null })
        })
      })

      mockSupabaseStorage.listC3DFiles.mockRejectedValue(new Error('Storage error'))

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should have patients data but empty files (graceful degradation)
      expect(result.current.activePatients).toBe(2)
      expect(result.current.recentC3DFiles).toHaveLength(0)
      expect(result.current.error).toBeNull() // Files error doesn't propagate
    })

    it('should recover from errors when queries succeed on retry', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First, mock failure
      setupErrorMocks()

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      // Then mock success and retry
      setupSuccessfulMocks()
      
      await act(async () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.therapist.patients(therapistId) })
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.activePatients).toBe(2)
      })
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain the same interface as useTherapistDashboardData', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify interface matches expected TherapistDashboardData
      expect(result.current).toHaveProperty('activePatients')
      expect(result.current).toHaveProperty('recentC3DFiles')
      expect(result.current).toHaveProperty('adherence')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('error')

      expect(typeof result.current.activePatients).toBe('number')
      expect(Array.isArray(result.current.recentC3DFiles)).toBe(true)
      expect(Array.isArray(result.current.adherence)).toBe(true)
      expect(typeof result.current.loading).toBe('boolean')
    })

    it('should work with undefined therapistId (disabled queries)', async () => {
      const wrapper = createWrapper(queryClient)

      const { result } = renderHook(
        () => useTherapistDashboardQuery(undefined),
        { wrapper }
      )

      // Should not attempt to fetch when therapistId is undefined
      expect(result.current.loading).toBe(false)
      expect(result.current.activePatients).toBe(0)
      expect(result.current.recentC3DFiles).toHaveLength(0)
      // useAdherence returns empty array by default, which is fine
      expect(result.current.adherence).toBeDefined()
      expect(result.current.error).toBeNull()

      // Verify no API calls were made
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('Performance and Optimization', () => {
    it.skip('should minimize API calls through intelligent caching', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Render multiple times
      const { result: result1 } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      const { result: result2 } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      const { result: result3 } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
        expect(result2.current.loading).toBe(false)
        expect(result3.current.loading).toBe(false)
      })

      // Despite multiple hook instances, should only call APIs once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
      expect(mockSupabaseStorage.listC3DFiles).toHaveBeenCalledTimes(1)
      expect(mockC3DSessionsService.getPatientSessionData).toHaveBeenCalledTimes(1)
    })

    it('should handle concurrent renders efficiently', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Start multiple renders simultaneously
      const promises = Array.from({ length: 5 }, () => {
        const { result } = renderHook(
          () => useTherapistDashboardQuery(therapistId),
          { wrapper }
        )
        return new Promise(resolve => {
          const checkComplete = () => {
            if (!result.current.loading) {
              resolve(result.current)
            } else {
              setTimeout(checkComplete, 10)
            }
          }
          checkComplete()
        })
      })

      const results = await Promise.all(promises)

      // All should have same data
      results.forEach(result => {
        expect((result as any).activePatients).toBe(2)
        expect((result as any).recentC3DFiles).toHaveLength(2)
      })

      // Should still only call APIs once despite concurrent renders
      expect(mockSupabaseStorage.listC3DFiles).toHaveBeenCalledTimes(1)
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle the primary use case: dashboard refresh without loading spinners', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Simulate initial app load
      const { result: initialLoad } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(initialLoad.current.loading).toBe(false)
      })

      expect(initialLoad.current.activePatients).toBe(2)

      // Simulate user refresh/navigation back to dashboard
      vi.clearAllMocks()

      const { result: refresh } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // Critical assertion: NO loading spinner on refresh
      expect(refresh.current.loading).toBe(false)
      expect(refresh.current.activePatients).toBe(2)
      expect(refresh.current.recentC3DFiles).toHaveLength(2)

      // Data is available immediately from cache
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should handle therapist switching between different patient lists', async () => {
      const wrapper = createWrapper(queryClient)

      // Load data for first therapist
      const { result: therapist1 } = renderHook(
        () => useTherapistDashboardQuery('therapist-123'),
        { wrapper }
      )

      await waitFor(() => {
        expect(therapist1.current.loading).toBe(false)
      })

      // Switch to second therapist (should trigger new queries)
      const { result: therapist2 } = renderHook(
        () => useTherapistDashboardQuery('therapist-456'),
        { wrapper }
      )

      // New therapist should load initially
      expect(therapist2.current.loading).toBe(true)

      await waitFor(() => {
        expect(therapist2.current.loading).toBe(false)
      })

      // Switch back to first therapist (should use cache)
      const { result: backToFirst } = renderHook(
        () => useTherapistDashboardQuery('therapist-123'),
        { wrapper }
      )

      // Should have cached data immediately
      expect(backToFirst.current.loading).toBe(false)
      expect(backToFirst.current.activePatients).toBe(2)
    })
  })
})