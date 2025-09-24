/**
 * PatientManagement - Main orchestrating component for patient data management
 * 
 * This component serves as the main coordinator for patient management functionality,
 * handling state management, data loading, and orchestrating child components.
 * 
 * Key Features:
 * - Progressive loading with split loading states for optimal UX
 * - Performance-optimized with memoization patterns
 * - Clean separation of concerns with modular architecture
 * 
 * Performance Optimizations Applied:
 * - Split loading states (patients vs therapists) for progressive rendering
 * - Memoized patient codes and session counts mapping
 * - Adherence data cached in Map structure for O(1) lookups
 * - Callback optimization for event handlers
 * 
 * Architecture:
 * - Main state orchestrator pattern
 * - Delegates UI rendering to PatientTable component
 * - Delegates form handling to PatientModals component
 * - Follows React best practices and TypeScript standards
 * 
 * Refactored for maintainability and performance
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import C3DSessionsService from '../../../services/c3dSessionsService'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import Spinner from '../../ui/Spinner'
import { 
  PersonIcon, 
  FileIcon as File
} from '@radix-ui/react-icons'
import { Patient, PatientManagementProps } from './types'
import { useAdherence } from '../../../hooks/useAdherence'
import { getPatientInitials } from '../../../lib/avatarColors'
import { usePatientCodeGeneration } from '../../../hooks/usePatientCodeGeneration'
import { PatientTable } from './PatientTable'
import { PatientModals } from './PatientModals'

export type SortField = 'patient_code' | 'display_name' | 'session_count' | 'last_session' | 'age' | 'active' | 'treatment_start_date' | 'adherence_score' | 'protocol_day' | 'progress_trend'
export type SortDirection = 'asc' | 'desc'

export interface FilterState {
  searchTerm: string
  showInactive: boolean  // Simple toggle for inactive patients
}

export interface ColumnVisibility {
  patient_id: boolean
  name: boolean
  age: boolean
  therapist: boolean
  treatment_start: boolean
  sessions: boolean
  last_session: boolean
  adherence: boolean
  protocol_day: boolean
  progress_trend: boolean
  status: boolean
}

/**
 * Patient Management Component for Therapist Dashboard
 * Displays patient list with session counts and last session info
 * Follows KISS principles with inline avatar and simple state management
 */

// Fetch patients with C3D-based session data and medical info
// Uses actual C3D files for accurate session counts (matches C3DFileBrowser data)
export async function fetchPatients(therapistId: string | null, isAdmin: boolean): Promise<Patient[]> {
  
  // Build query - admins see all patients, therapists see only their own
  let query = supabase
    .from('patients')
    .select(`
      patient_code,
      created_at,
      treatment_start_date,
      total_sessions_planned,
      active,
      therapist_id,
      patient_medical_info (
        first_name,
        last_name,
        date_of_birth
      )
    `)
  
  // Only filter by therapist_id if not admin
  if (!isAdmin && therapistId) {
    query = query.eq('therapist_id', therapistId)
  }
  
  const { data, error } = await query

  if (error) {
    console.error('Error fetching patients:', error)
    throw error
  }

  if (!data || data.length === 0) {
    return []
  }

  // Get patient codes for C3D session data lookup
  const patientCodes = data.map((patient: any) => patient.patient_code)
  
  // Get accurate session data from C3D files (matches PatientSessionBrowser logic)
  let sessionDataMap = new Map<string, { session_count: number; last_session: string | null }>()
  
  try {
    const patientSessionData = await C3DSessionsService.getPatientSessionData(patientCodes)
    
    // Create map of patient session data
    patientSessionData.forEach(sessionData => {
      sessionDataMap.set(sessionData.patient_code, {
        session_count: sessionData.session_count,
        last_session: sessionData.last_session
      })
    })
    
    console.log('C3D session data loaded for patients:', sessionDataMap)
  } catch (error) {
    console.error('Error fetching C3D session data:', error)
    // Continue with zero sessions if C3D service fails
  }

  // Transform data to include C3D-based session counts and medical info
  const patientsWithSessions = data?.map((patient: any) => {
    // Get accurate session data from C3D files
    const sessionData = sessionDataMap.get(patient.patient_code)
    const sessionCount = sessionData?.session_count || 0
    const lastSession = sessionData?.last_session || null

    // Handle medical info - it might be an array or single object
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
      active: patient.active ?? true, // Default to active if null
      // Medical info (will be null for researchers due to RLS)
      first_name: medical?.first_name || null,
      last_name: medical?.last_name || null,
      age: age,
      // Treatment configuration
      treatment_start_date: patient.treatment_start_date || patient.created_at,
      total_sessions_planned: patient.total_sessions_planned || 30, // TODO: Move to configuration - default session count
      // Therapist assignment (for admin view)
      therapist_id: patient.therapist_id || null,
      // UI helpers
      display_name: medical?.first_name && medical?.last_name 
        ? `${medical.first_name} ${medical.last_name}`
        : patient.patient_code,
      avatar_initials: medical?.first_name && medical?.last_name
        ? `${medical.first_name.charAt(0)}${medical.last_name.charAt(0)}`.toUpperCase()
        : getPatientInitials(patient.patient_code)
    }
  }) || []

  return patientsWithSessions.sort((a, b) => {
    // Sort by last session date (most recent first), then by display name
    if (!a.last_session && !b.last_session) {
      return (a.display_name || a.patient_code).localeCompare(b.display_name || b.patient_code)
    }
    if (!a.last_session) return 1
    if (!b.last_session) return -1
    return new Date(b.last_session).getTime() - new Date(a.last_session).getTime()
  })
}

// Loading component - simple spinner approach (KISS)
function PatientTableLoading() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PersonIcon className="h-5 w-5 text-blue-500" />
          Patient Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Spinner />
            <p className="mt-4 text-sm text-muted-foreground">Loading patients...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Empty state component
function EmptyPatientState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PersonIcon className="h-5 w-5 text-blue-500" />
          Patient Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <PersonIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No patients found</h3>
          <p className="text-muted-foreground">
            Patients assigned to you will appear here once they complete their first session.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// Error state component
function ErrorPatientState({ error }: { error: Error }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PersonIcon className="h-5 w-5 text-blue-500" />
          Patient Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <File className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Unable to load patients</h3>
          <p className="text-muted-foreground mb-4">
            {error.message || 'An error occurred while fetching patient data.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Main PatientManagement component
export function PatientManagement({ className }: PatientManagementProps) {
  const { user, userRole } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [therapistsLoading, setTherapistsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [therapistMap, setTherapistMap] = useState<Map<string, { first_name: string; last_name: string }>>(new Map())
  const [therapistsList, setTherapistsList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([])  // For create dialog dropdown
  
  // Get patient IDs and session counts for optimized adherence fetching - Memoized for performance
  const patientCodes = useMemo(() => patients.map(p => p.patient_code), [patients])
  const sessionCountsMap = useMemo(() => new Map(patients.map(p => [p.patient_code, p.session_count])), [patients])
  const { adherenceData, loading: adherenceLoading } = useAdherence(
    patientCodes, 
    patientCodes.length > 0,
    sessionCountsMap
  )

  // Memoized adherence lookup map for performance optimization
  const adherenceMap = useMemo(() => {
    return new Map(adherenceData.map(data => [data.patient_id, data]))
  }, [adherenceData])
  
  // Filter and sort states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    showInactive: false
  })
  const [sortField, setSortField] = useState<SortField>('last_session')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)
  
  // Role-based default column visibility configuration
  const getRoleBasedColumnDefaults = (userRole: string): ColumnVisibility => {
    switch (userRole) {
      case 'THERAPIST':
        // Focus: Direct Patient Care - streamlined view for daily therapeutic work
        return {
          patient_id: false,      // Hidden - technical detail
          name: true,            // ✅ Essential - patient identification  
          age: true,             // ✅ Important - clinical context
          therapist: false,      // Hidden - they know it's their patients
          treatment_start: false, // Hidden - less critical for daily workflow
          sessions: true,        // ✅ Essential - progress tracking
          last_session: true,    // ✅ Important - recent activity
          adherence: true,       // ✅ Critical - therapeutic compliance
          protocol_day: true,    // ✅ Essential - treatment progress
          progress_trend: false, // Hidden - simplified view
          status: false          // Hidden - assume active patients focus
        }
      
      case 'ADMIN':
        // Focus: System Management - comprehensive oversight and assignment management
        return {
          patient_id: false,      // Hidden - still technical
          name: true,            // ✅ Essential - patient identification
          age: true,             // ✅ Important - demographic insights
          therapist: true,       // ✅ Critical - assignment management
          treatment_start: true, // ✅ Important - timeline tracking
          sessions: true,        // ✅ Essential - system utilization
          last_session: false,   // Hidden - less critical for admin view
          adherence: true,       // ✅ Important - system-wide metrics
          protocol_day: true,    // ✅ Important - treatment monitoring
          progress_trend: true,  // ✅ Important - system performance
          status: true           // ✅ Essential - patient lifecycle management
        }
      
      case 'RESEARCHER':
        // Focus: Data Analysis - research-oriented view with emphasis on data quality
        return {
          patient_id: true,       // ✅ Important - data correlation
          name: false,           // Hidden - privacy/anonymization
          age: true,             // ✅ Essential - demographic analysis
          therapist: false,      // Hidden - research focus on patient data
          treatment_start: true, // ✅ Important - temporal analysis
          sessions: true,        // ✅ Essential - data collection status
          last_session: true,    // ✅ Important - recent data availability
          adherence: true,       // ✅ Critical - research validity
          protocol_day: true,    // ✅ Important - treatment phase analysis
          progress_trend: true,  // ✅ Essential - outcome analysis
          status: false          // Hidden - assume focus on active data
        }
      
      default:
        // Default to researcher configuration for any undefined roles
        return {
          patient_id: true,
          name: false,
          age: true,
          therapist: false,
          treatment_start: true,
          sessions: true,
          last_session: true,
          adherence: true,
          protocol_day: true,
          progress_trend: true,
          status: false
        }
    }
  }

  // Column visibility state with role-based defaults and localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('patient-management-visible-columns')
    return saved ? JSON.parse(saved) : getRoleBasedColumnDefaults(userRole || 'RESEARCHER')
  })

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('patient-management-visible-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // State for modal controls
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [newTherapistId, setNewTherapistId] = useState('')
  
  // Patient creation state
  const [createForm, setCreateForm] = useState({
    patient_code: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: 'not_specified' as 'male' | 'female' | 'non_binary' | 'not_specified',
    therapistId: '',
    totalSessions: '30'
  })
  
  // Use the custom hook for patient code generation
  const {
    isGenerating: isGeneratingCode,
    validation: codeValidation,
    generateCode,
    validateCode,
    formatCode,
    cleanup: cleanupCodeGeneration
  } = usePatientCodeGeneration()

  // Load patients data function (extracted for reuse) - defined early to avoid initialization errors
  const loadPatientsData = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setPatientsLoading(true)
      setTherapistsLoading(true)
      setError(null)
      
      // Check if user is admin
      const isAdmin = userRole === 'ADMIN'
      
      // Fetch patients (all for admin, filtered for therapists)
      const data = await fetchPatients(user.id, isAdmin)
      setPatients(data)
      setPatientsLoading(false) // Enable progressive rendering - show patients immediately
      
      // If admin, fetch therapist information for display
      if (isAdmin) {
        // Fetch all therapists for dropdown (patient creation)
        const { data: allTherapists } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name')
          .eq('role', 'therapist')
          .eq('active', true)
        
        if (allTherapists) {
          setTherapistsList(allTherapists)
        }
        
        // Fetch therapist map for patient display (only assigned therapists)
        if (data.length > 0) {
          const uniqueTherapistIds = [...new Set(data.map(p => p.therapist_id).filter(Boolean))]
          
          if (uniqueTherapistIds.length > 0) {
            const { data: therapistData } = await supabase
              .from('user_profiles')
              .select('id, first_name, last_name')
              .in('id', uniqueTherapistIds)
              .eq('role', 'therapist')
            
            if (therapistData) {
              const therapistMapData = new Map(
                therapistData.map(t => [t.id, { first_name: t.first_name, last_name: t.last_name }])
              )
              setTherapistMap(therapistMapData)
            }
          }
        }
        setTherapistsLoading(false) // Mark therapist data as loaded
      } else {
        // For non-admin users, no therapist data needed
        setTherapistsLoading(false)
      }
    } catch (err) {
      setError(err as Error)
      setPatientsLoading(false)
      setTherapistsLoading(false)
    }
  }, [user?.id, userRole])

  // Simple useEffect for data fetching (KISS approach)
  useEffect(() => {
    loadPatientsData()
  }, [loadPatientsData])

  // Handle loading state - Progressive loading: show patients when available, even if therapists still loading
  if (patientsLoading) {
    return <PatientTableLoading />
  }

  // Handle error state
  if (error) {
    return <ErrorPatientState error={error as Error} />
  }

  // Handle empty state
  if (!patients || patients.length === 0) {
    return <EmptyPatientState />
  }

  // Success state - render patient table with extracted components
  return (
    <div className={className}>
      <PatientTable
        patients={patients}
        adherenceMap={adherenceMap}
        therapistMap={therapistMap}
        userRole={userRole || ''}
        filters={filters}
        setFilters={setFilters}
        sortField={sortField}
        setSortField={setSortField}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        onCreatePatient={() => setShowCreateDialog(true)}
        onReassignPatient={(patient) => {
          setSelectedPatient(patient)
          setNewTherapistId(patient.therapist_id || '')
          setShowReassignDialog(true)
        }}
      />
      
      <PatientModals
        showCreateDialog={showCreateDialog}
        onCreateDialogChange={setShowCreateDialog}
        showReassignDialog={showReassignDialog}
        onReassignDialogChange={setShowReassignDialog}
        createForm={createForm}
        setCreateForm={setCreateForm}
        selectedPatient={selectedPatient}
        newTherapistId={newTherapistId}
        setNewTherapistId={setNewTherapistId}
        therapistsList={therapistsList}
        therapistMap={therapistMap}
        isGeneratingCode={isGeneratingCode}
        codeValidation={codeValidation}
        formatCode={formatCode}
        validateCode={validateCode}
        generateCode={generateCode}
        cleanupCodeGeneration={cleanupCodeGeneration}
        loadPatientsData={loadPatientsData}
      />
    </div>
  )
} 