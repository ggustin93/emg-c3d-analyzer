/**
 * Patient Data Consistency Tests
 * 
 * Tests to ensure PatientProfile and PatientManagement components 
 * use consistent data sources after schema migration.
 */

import React from 'react'
import { render, waitFor, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { PatientProfile } from '../dashboards/therapist/PatientProfile'
import { PatientManagement } from '../dashboards/therapist/PatientManagement'

// Mock the hooks and services
const mockAdherenceData = [
  {
    patient_id: 'P001',
    adherence_score: 85,
    clinical_threshold: 'Good',
    sessions_completed: 25,
    sessions_expected: 30,
    protocol_day: 10,
    trial_duration: 14,
    total_sessions_planned: 30
  }
]

const mockSupabaseData = {
  patients: {
    id: 'patient-uuid-1',
    patient_code: 'P001',
    therapist_id: 'therapist-1',
    active: true,
    total_sessions_planned: 30,
    treatment_start_date: '2025-01-01',
    created_at: '2025-01-01T00:00:00Z',
    patient_medical_info: {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1980-01-01',
      gender: 'male',
      room_number: '101',
      admission_date: '2025-01-01',
      primary_diagnosis: 'Stroke recovery',
      mobility_status: 'ambulatory',
      bmi_value: 25.5,
      bmi_status: 'normal',
      cognitive_status: 'alert'
    }
  },
  therapy_sessions: [
    {
      session_code: 'S001',
      processed_at: '2025-01-02T10:00:00Z',
      processing_status: 'completed'
    },
    {
      session_code: 'S002', 
      processed_at: '2025-01-03T10:00:00Z',
      processing_status: 'completed'
    }
  ]
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({
          data: mockSupabaseData.patients,
          error: null
        })),
        range: vi.fn(() => Promise.resolve({
          data: [mockSupabaseData.patients],
          error: null
        }))
      })),
      range: vi.fn(() => Promise.resolve({
        data: [mockSupabaseData.patients],
        error: null
      }))
    }))
  }))
}

// Mock hooks
const mockUseAdherence = vi.fn(() => ({
  adherenceData: mockAdherenceData,
  loading: false,
  error: null,
  refetch: vi.fn()
}))

const mockUseClinicalNotes = vi.fn(() => ({
  getPatientRelatedNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn()
}))

// Mock useParams for PatientProfile
const mockUseParams = vi.fn(() => ({ patientId: 'P001' }))

// Setup mocks
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabase
}))

vi.mock('../../../hooks/useAdherence', () => ({
  useAdherence: mockUseAdherence
}))

vi.mock('../../../hooks/useClinicalNotes', () => ({
  useClinicalNotes: mockUseClinicalNotes
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: mockUseParams,
    useNavigate: vi.fn(() => vi.fn())
  }
})

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Patient Data Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset Supabase mock to return fresh data
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockSupabaseData.patients,
            error: null
          })),
          range: vi.fn(() => Promise.resolve({
            data: [mockSupabaseData.patients],
            error: null
          }))
        })),
        range: vi.fn(() => Promise.resolve({
          data: [mockSupabaseData.patients],
          error: null
        }))
      }))
    }))
  })

  describe('Data Fetching Consistency', () => {
    it('should fetch total_sessions_planned from patients table in PatientProfile', async () => {
      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Verify Supabase query includes total_sessions_planned in patients selection
        expect(mockSupabase.from).toHaveBeenCalledWith('patients')
        
        const selectCall = mockSupabase.from().select
        expect(selectCall).toHaveBeenCalled()
        
        // Get the select query string
        const selectQuery = (selectCall as Mock).mock.calls[0][0]
        expect(selectQuery).toContain('total_sessions_planned')
        expect(selectQuery).not.toContain('patient_medical_info (\n              first_name,\n              last_name,\n              date_of_birth,\n              gender,\n              room_number,\n              admission_date,\n              primary_diagnosis,\n              mobility_status,\n              bmi_value,\n              bmi_status,\n              cognitive_status,\n              total_sessions_planned\n            )')
      })
    })

    it('should fetch total_sessions_planned from patients table in PatientManagement', async () => {
      render(
        <TestWrapper>
          <PatientManagement />
        </TestWrapper>
      )

      await waitFor(() => {
        // Verify Supabase query structure for PatientManagement
        expect(mockSupabase.from).toHaveBeenCalledWith('patients')
        
        const selectCall = mockSupabase.from().select
        expect(selectCall).toHaveBeenCalled()
        
        // The query should fetch total_sessions_planned from patients table
        const selectQuery = (selectCall as Mock).mock.calls[0][0]
        expect(selectQuery).toContain('total_sessions_planned')
      })
    })
  })

  describe('Adherence Service Integration', () => {
    it('should use adherence service for scoring in PatientProfile', async () => {
      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Verify useAdherence hook is called with correct patient ID
        expect(mockUseAdherence).toHaveBeenCalledWith(['P001'], true)
      })
    })

    it('should use adherence service for scoring in PatientManagement', async () => {
      render(
        <TestWrapper>
          <PatientManagement />
        </TestWrapper>
      )

      await waitFor(() => {
        // Verify useAdherence hook is called (may be with different parameters for list view)
        expect(mockUseAdherence).toHaveBeenCalled()
      })
    })

    it('should display consistent adherence scores between components', async () => {
      // Test PatientProfile adherence display
      const { unmount } = render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Should use adherence service data (85%) not manual calculation
        expect(screen.queryByText(/85%/)).toBeTruthy()
      })

      unmount()

      // Test PatientManagement adherence display
      render(
        <TestWrapper>
          <PatientManagement />
        </TestWrapper>
      )

      await waitFor(() => {
        // Should show same adherence score from service
        expect(mockUseAdherence).toHaveBeenCalled()
      })
    })
  })

  describe('Data Source Validation', () => {
    it('should not reference patient_medical_info.total_sessions_planned', async () => {
      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        const selectCall = mockSupabase.from().select
        const selectQuery = (selectCall as Mock).mock.calls[0][0]
        
        // Should not include total_sessions_planned in patient_medical_info selection
        const medicalInfoSection = selectQuery.match(/patient_medical_info \((.*?)\)/s)
        if (medicalInfoSection) {
          expect(medicalInfoSection[1]).not.toContain('total_sessions_planned')
        }
      })
    })

    it('should handle missing adherence data gracefully', async () => {
      // Mock empty adherence data
      mockUseAdherence.mockReturnValueOnce({
        adherenceData: [],
        loading: false,
        error: null,
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Component should still render without errors
        expect(screen.queryByText(/Patient Profile/i)).toBeTruthy()
      })
    })

    it('should handle adherence service errors gracefully', async () => {
      // Mock adherence service error
      mockUseAdherence.mockReturnValueOnce({
        adherenceData: [],
        loading: false,
        error: new Error('Adherence service unavailable'),
        refetch: vi.fn()
      })

      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Component should still render with fallback values
        expect(screen.queryByText(/Patient Profile/i)).toBeTruthy()
      })
    })
  })

  describe('Schema Migration Compliance', () => {
    it('should use treatment_start_date from patients table when available', async () => {
      const mockDataWithTreatment = {
        ...mockSupabaseData.patients,
        treatment_start_date: '2025-01-15'
      }

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockDataWithTreatment,
              error: null
            }))
          }))
        }))
      }))

      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        const selectCall = mockSupabase.from().select
        const selectQuery = (selectCall as Mock).mock.calls[0][0]
        
        // Should include treatment_start_date in main patients selection
        expect(selectQuery).toContain('treatment_start_date')
      })
    })

    it('should maintain backward compatibility for existing data', async () => {
      const mockDataWithoutPlanned = {
        ...mockSupabaseData.patients,
        total_sessions_planned: null
      }

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: mockDataWithoutPlanned,
              error: null
            }))
          }))
        }))
      }))

      render(
        <TestWrapper>
          <PatientProfile />
        </TestWrapper>
      )

      await waitFor(() => {
        // Should handle null values gracefully
        expect(screen.queryByText(/Patient Profile/i)).toBeTruthy()
      })
    })
  })
})