/**
 * Simplified TanStack Query Test for useTherapistDashboardQuery
 * 
 * Tests the core caching functionality and primary user experience goal:
 * - No loading spinners on refresh (primary goal)
 * - Cached data available immediately
 * - Proper interface compatibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTherapistDashboardQuery } from '../useTherapistDashboardQuery'
import React from 'react'

// Simple mocks focused on core functionality
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [
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
              therapy_sessions: []
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
          ],
          error: null
        })),
        in: vi.fn(() => Promise.resolve({
          data: [],
          error: null
        }))
      }))
    }))
  },
  isSupabaseConfigured: vi.fn(() => true)
}))

vi.mock('../../services/supabaseStorage', () => ({
  default: {
    isConfigured: vi.fn(() => true),
    listC3DFiles: vi.fn(() => Promise.resolve([
      {
        name: 'P001_session_001.c3d',
        created_at: '2024-01-20T15:30:00Z',
        size: 1024000,
        updated_at: '2024-01-20T15:30:00Z'
      }
    ]))
  }
}))

vi.mock('../../services/therapySessionsService', () => ({
  default: {
    getSessionsByFilePaths: vi.fn(() => Promise.resolve({}))
  }
}))

vi.mock('../../services/c3dSessionsService', () => ({
  default: {
    getPatientSessionData: vi.fn(() => Promise.resolve([
      { patient_code: 'P001', session_count: 5 }
    ]))
  }
}))

vi.mock('../../hooks/useAdherence', () => ({
  useAdherence: vi.fn(() => ({
    adherenceData: [
      { patient_code: 'P001', adherence_score: 0.85, protocol_day: 5 }
    ],
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

describe('useTherapistDashboardQuery - Core Caching Tests', () => {
  let queryClient: QueryClient

  const createWrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    // Fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false
        }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Core Functionality', () => {
    it('should provide the correct interface (backward compatibility)', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify interface matches TherapistDashboardData
      expect(result.current).toHaveProperty('activePatients')
      expect(result.current).toHaveProperty('recentC3DFiles')
      expect(result.current).toHaveProperty('adherence')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('error')

      expect(typeof result.current.activePatients).toBe('number')
      expect(Array.isArray(result.current.recentC3DFiles)).toBe(true)
      expect(Array.isArray(result.current.adherence)).toBe(true)
      expect(typeof result.current.loading).toBe('boolean')

      // Should have loaded some data
      expect(result.current.activePatients).toBeGreaterThan(0)
      expect(result.current.error).toBeNull()
    })

    it('should show cached data immediately on subsequent calls (PRIMARY GOAL)', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // First render - load data initially
      const { result: firstResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(firstResult.current.loading).toBe(false)
      })

      const initialPatientCount = firstResult.current.activePatients
      expect(initialPatientCount).toBeGreaterThan(0)

      // Clear mock call history to verify cache usage
      vi.clearAllMocks()

      // Second render - should use cache immediately (PRIMARY GOAL)
      const { result: secondResult } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // CRITICAL ASSERTION: Should have data immediately without loading state
      expect(secondResult.current.loading).toBe(false)
      expect(secondResult.current.activePatients).toBe(initialPatientCount)
      expect(secondResult.current.error).toBeNull()

      // Verify no API calls were made (data came from cache)
      const { supabase } = await import('../../lib/supabase')
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should handle disabled queries when therapistId is undefined', () => {
      const wrapper = createWrapper(queryClient)

      const { result } = renderHook(
        () => useTherapistDashboardQuery(undefined),
        { wrapper }
      )

      // Should not attempt to fetch when therapistId is undefined
      expect(result.current.loading).toBe(false)
      expect(result.current.activePatients).toBe(0)
      expect(result.current.recentC3DFiles).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })

    it('should handle loading states correctly', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // May or may not show loading initially (depends on React query behavior)
      // But should eventually have data without loading
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.activePatients).toBeGreaterThan(0)
      expect(result.current.error).toBeNull()
    })

    it('should maintain data structure consistency', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      const { result } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify data structure
      expect(result.current.activePatients).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.current.recentC3DFiles)).toBe(true)
      expect(Array.isArray(result.current.adherence)).toBe(true)
      
      // Recent C3D files should have proper structure if present
      if (result.current.recentC3DFiles.length > 0) {
        const file = result.current.recentC3DFiles[0]
        expect(file).toHaveProperty('name')
        expect(file).toHaveProperty('created_at')
        expect(file).toHaveProperty('patient')
        expect(file.patient).toHaveProperty('patient_code')
        expect(file.patient).toHaveProperty('display_name')
      }
    })
  })

  describe('Performance & Caching', () => {
    it('should use TanStack Query caching effectively', async () => {
      const wrapper = createWrapper(queryClient)
      const therapistId = 'therapist-123'

      // Multiple simultaneous hook instances
      const { result: result1 } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      const { result: result2 } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
        expect(result2.current.loading).toBe(false)
      })

      // Both should have the same data from cache
      expect(result1.current.activePatients).toBe(result2.current.activePatients)
      expect(result1.current.recentC3DFiles.length).toBe(result2.current.recentC3DFiles.length)
    })

    it('should demonstrate the main user experience improvement', async () => {
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

      expect(initialLoad.current.activePatients).toBeGreaterThan(0)

      // Simulate user refresh/navigation back to dashboard 
      // This is the critical user experience we're testing
      const { result: refresh } = renderHook(
        () => useTherapistDashboardQuery(therapistId),
        { wrapper }
      )

      // ✅ CRITICAL SUCCESS METRIC: NO loading spinner on refresh
      expect(refresh.current.loading).toBe(false)
      expect(refresh.current.activePatients).toBeGreaterThan(0)
      expect(refresh.current.recentC3DFiles).toBeDefined()

      // Data is available immediately from cache
      expect(refresh.current.activePatients).toBe(initialLoad.current.activePatients)
    })
  })
})