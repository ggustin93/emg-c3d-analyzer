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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import { Alert, AlertDescription } from '../../ui/alert'
import { 
  PersonIcon, 
  FileIcon as File
} from '@radix-ui/react-icons'
import * as Icons from '@radix-ui/react-icons'
import { useToast } from '../../../hooks/use-toast'
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
  const { user, userRole, userProfile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  
  // Debug auth state
  console.log('🔍 DEBUG: Auth state in PatientManagement', {
    user: user?.email,
    userRole,
    userProfile,
    authLoading
  })
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
        // Focus: System Management - streamlined oversight and assignment management
        return {
          patient_id: false,      // Hidden - technical detail
          name: true,            // ✅ Essential - patient identification
          age: false,            // Hidden - not needed for admin management
          therapist: true,       // ✅ Critical - assignment management
          treatment_start: true, // ✅ Important - timeline tracking
          sessions: true,        // ✅ Essential - system utilization
          last_session: false,   // Hidden - less critical for admin view
          adherence: true,       // ✅ Important - system-wide metrics
          protocol_day: true,    // ✅ Important - treatment monitoring
          progress_trend: false, // Hidden - clinical analysis, not admin management focus
          status: false          // Hidden - not needed by default for admin view
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
  // TIMING FIX: Initialize with null, set proper state when userRole is available
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility | null>(null)

  // Initialize column visibility once userRole is available
  useEffect(() => {
    if (userRole && !visibleColumns) {
      const roleDefaults = getRoleBasedColumnDefaults(userRole)
      const saved = localStorage.getItem('patient-management-visible-columns')
      
      console.log('🚀 DEBUG: Initializing columns with proper userRole', {
        userRole,
        roleDefaults,
        hasSaved: !!saved
      })
      
      if (saved) {
        try {
          const savedColumns = JSON.parse(saved)
          
          // CRITICAL: Role-based security settings override user preferences
          const mergedColumns = {
            ...savedColumns,      // Start with user preferences
            ...roleDefaults       // Override with role-based security rules
          }
          
          console.log('🔍 DEBUG: Final merged columns', mergedColumns)
          setVisibleColumns(mergedColumns)
        } catch (error) {
          console.warn('Failed to parse saved column visibility, using role defaults:', error)
          setVisibleColumns(roleDefaults)
        }
      } else {
        setVisibleColumns(roleDefaults)
      }
    }
  }, [userRole, visibleColumns])

  // Save column visibility to localStorage (only when visibleColumns is initialized)
  useEffect(() => {
    if (visibleColumns) {
      console.log('💾 DEBUG: Saving column visibility', {
        userRole,
        visibleColumns,
        progress_trend: visibleColumns?.progress_trend
      })
      localStorage.setItem('patient-management-visible-columns', JSON.stringify(visibleColumns))
    }
  }, [visibleColumns, userRole])

  // Reset to role-based defaults when user role changes (handles role switching)
  useEffect(() => {
    if (userRole && visibleColumns) {
      const roleDefaults = getRoleBasedColumnDefaults(userRole)
      console.log('🔄 DEBUG: Role changed - updating column visibility', {
        userRole,
        roleDefaults,
        progress_trend: roleDefaults.progress_trend
      })
      setVisibleColumns(prevColumns => ({
        ...prevColumns,   // Keep user customizations
        ...roleDefaults   // Apply new role defaults (override security settings)
      }))
    }
  }, [userRole])

  // State for modal controls
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [showInactiveDialog, setShowInactiveDialog] = useState(false)
  const [showDeleteInfoDialog, setShowDeleteInfoDialog] = useState(false)
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
      
      // Only set patientsLoading to false after we have the data
      if (data && data.length > 0) {
        setPatientsLoading(false)
      } else {
        // For empty results, still set loading to false but keep the loading state
        // until we're sure everything is ready
        setPatientsLoading(false)
      }
      
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

  // Handle setting patient as inactive/active
  const handleSetPatientInactive = useCallback(async (patient: Patient) => {
    setSelectedPatient(patient)
    setShowInactiveDialog(true)
  }, [])

  // Handle showing delete info dialog
  const handleShowPatientDeleteInfo = useCallback((patient: Patient) => {
    setSelectedPatient(patient)
    setShowDeleteInfoDialog(true)
  }, [])

  // Handle confirming inactive/active status change
  const handleConfirmInactiveChange = useCallback(async () => {
    if (!selectedPatient) return

    try {
      const { error } = await supabase
        .from('patients')
        .update({ active: !selectedPatient.active })
        .eq('patient_code', selectedPatient.patient_code)

      if (error) throw error

      toast({
        title: 'Success',
        description: `Patient ${selectedPatient.display_name} has been ${!selectedPatient.active ? 'activated' : 'deactivated'} successfully`,
        variant: 'success'
      })

      setShowInactiveDialog(false)
      await loadPatientsData()
    } catch (error: any) {
      console.error('Failed to update patient status:', error)
      toast({
        title: 'Error',
        description: `Failed to update patient status: ${error.message}`,
        variant: 'destructive'
      })
    }
  }, [selectedPatient, toast, loadPatientsData])

  // Handle loading state - Show loading until everything is ready
  if (patientsLoading || !visibleColumns || (userRole === 'ADMIN' && therapistsLoading)) {
    return <PatientTableLoading />
  }

  // Handle error state
  if (error) {
    return <ErrorPatientState error={error as Error} />
  }

  // Handle empty state - Only show after loading is complete and we're sure there are no patients
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
        visibleColumns={visibleColumns!}
        setVisibleColumns={(value) => {
          if (typeof value === 'function') {
            setVisibleColumns(prev => prev ? value(prev) : prev);
          } else {
            setVisibleColumns(value);
          }
        }}
        onCreatePatient={() => setShowCreateDialog(true)}
        onReassignPatient={(patient) => {
          setSelectedPatient(patient)
          setNewTherapistId(patient.therapist_id || '')
          setShowReassignDialog(true)
        }}
        onSetPatientInactive={handleSetPatientInactive}
        onShowPatientDeleteInfo={handleShowPatientDeleteInfo}
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

      {/* Set Patient Inactive/Active Dialog */}
      <Dialog open={showInactiveDialog} onOpenChange={setShowInactiveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPatient?.active ? (
                <>
                  <Icons.PauseIcon className="h-5 w-5 text-orange-600" />
                  Set Patient Inactive
                </>
              ) : (
                <>
                  <Icons.PlayIcon className="h-5 w-5 text-green-600" />
                  Set Patient Active
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedPatient?.active 
                ? `You are about to deactivate ${selectedPatient?.display_name} (${selectedPatient?.patient_code})`
                : `You are about to activate ${selectedPatient?.display_name} (${selectedPatient?.patient_code})`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className={selectedPatient?.active ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
              <Icons.ExclamationTriangleIcon className={`h-4 w-4 ${selectedPatient?.active ? 'text-orange-600' : 'text-green-600'}`} />
              <AlertDescription className={selectedPatient?.active ? 'text-orange-800' : 'text-green-800'}>
                <strong>
                  {selectedPatient?.active ? 'Deactivating' : 'Activating'} this patient will:
                </strong>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1 ml-4">
                {selectedPatient?.active ? (
                  <>
                    <li>Remove the patient from active treatment lists</li>
                    <li>Hide the patient from regular therapist views</li>
                    <li>Preserve all historical data and sessions</li>
                    <li>Allow reactivation at any time</li>
                  </>
                ) : (
                  <>
                    <li>Make the patient visible in therapist views</li>
                    <li>Include the patient in active treatment lists</li>
                    <li>Allow new session uploads and processing</li>
                    <li>Restore full patient management capabilities</li>
                  </>
                )}
              </ul>
              <p className="text-muted-foreground mt-3">
                This action can be reversed at any time.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInactiveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmInactiveChange}
              className={selectedPatient?.active ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
            >
              {selectedPatient?.active ? 'Set Inactive' : 'Set Active'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Patient Information Dialog */}
      <Dialog open={showDeleteInfoDialog} onOpenChange={setShowDeleteInfoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Icons.ExclamationTriangleIcon className="h-5 w-5" />
              Patient Deletion Information
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icons.ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-yellow-800">
                    Sensitive Operation Required
                  </p>
                  <p className="text-sm text-yellow-700">
                    Patient deletion is a sensitive operation that requires technical team intervention 
                    to ensure proper data integrity and audit trail maintenance.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Icons.PersonIcon className="h-4 w-4 text-slate-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Patient to be deleted:</p>
                  <p className="text-sm text-slate-600">
                    {selectedPatient ? `${selectedPatient.display_name} (${selectedPatient.patient_code})` : 'Unknown patient'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Icons.LockClosedIcon className="h-4 w-4 text-slate-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Alternative Recommendation:</p>
                  <p className="text-sm text-slate-600">
                    Consider setting the patient as <strong>inactive</strong> instead. This preserves all data 
                    while removing them from active workflows.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Icons.TrashIcon className="h-4 w-4 text-slate-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">For Complete Deletion:</p>
                  <p className="text-sm text-slate-600">
                    Contact your technical team to remove this patient through Supabase Studio interface.
                    This ensures proper cleanup of all related data and maintains audit trails.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteInfoDialog(false)}>
              Understood
            </Button>
            {selectedPatient && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteInfoDialog(false)
                  setSelectedPatient(selectedPatient)
                  setShowInactiveDialog(true)
                }}
                className="border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                Set Inactive Instead
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 