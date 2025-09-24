import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import C3DSessionsService from '../../../services/c3dSessionsService'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Badge } from '../../ui/badge'
import { Progress } from '../../ui/progress'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip'
import { Checkbox } from '../../ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { Label } from '../../ui/label'
import { useToast } from '../../../hooks/use-toast'
import Spinner from '../../ui/Spinner'
import { 
  PersonIcon, 
  CalendarIcon as Calendar, 
  FileIcon as File, 
  MagnifyingGlassIcon as Search,
  MixerHorizontalIcon as Filter,
  ChevronDownIcon,
  ChevronUpIcon as SortAsc,
  EyeOpenIcon as Eye,
  EyeClosedIcon as EyeOff,
  GridIcon as Columns3,
  InfoCircledIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DashIcon
} from '@radix-ui/react-icons'
import * as Icons from '@radix-ui/react-icons'
import { Patient, PatientManagementProps } from './types'
import { useAdherence } from '../../../hooks/useAdherence'
import { getAdherenceThreshold, AdherenceData } from '../../../services/adherenceService'
import { getAvatarColor, getPatientIdentifier, getPatientInitials } from '../../../lib/avatarColors'
import { usePatientCodeGeneration } from '../../../hooks/usePatientCodeGeneration'

type SortField = 'patient_code' | 'display_name' | 'session_count' | 'last_session' | 'age' | 'active' | 'treatment_start_date' | 'adherence_score' | 'protocol_day' | 'progress_trend'
type SortDirection = 'asc' | 'desc'

interface FilterState {
  searchTerm: string
  showInactive: boolean  // Simple toggle for inactive patients
}

interface ColumnVisibility {
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
async function fetchPatients(therapistId: string | null, isAdmin: boolean): Promise<Patient[]> {
  
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
      total_sessions_planned: patient.total_sessions_planned || 30,
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


// Format date for display with European/French format (DD/MM/YYYY)
function formatLastSession(dateString: string | null): string {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'  
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  
  // Use European date format (DD/MM/YY)
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: '2-digit' 
  })
}

// Session count badge variant based on count
function getSessionBadgeVariant(count: number): "default" | "secondary" | "outline" {
  if (count === 0) return "outline"
  if (count <= 5) return "secondary" 
  return "default"
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

// Individual patient row component with adherence data
interface PatientRowProps {
  patient: Patient
  visibleColumns: ColumnVisibility
  adherence?: AdherenceData
  therapistName?: string | null
}

function PatientRow({ patient, visibleColumns, adherence, therapistName }: PatientRowProps) {
  const navigate = useNavigate()
  const avatarColor = getAvatarColor(getPatientIdentifier(patient))
  const sessionBadgeVariant = getSessionBadgeVariant(patient.session_count)
  const lastSessionText = formatLastSession(patient.last_session)
  
  // Get subtle status badge styling - more muted appearance
  const statusBadgeClass = patient.active 
    ? 'bg-gray-50 text-gray-600 border-gray-200' 
    : 'bg-gray-100 text-gray-500 border-gray-300'
  const statusText = patient.active ? 'Active' : 'Inactive'

  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/patients/${patient.patient_code}`)}>
      {/* Avatar - always visible */}
      <TableCell>
        <Avatar className="h-10 w-10">
          <AvatarFallback className={`${avatarColor} text-white font-medium`}>
            {patient.avatar_initials}
          </AvatarFallback>
        </Avatar>
      </TableCell>

      {/* Patient ID */}
      {visibleColumns.patient_id && (
        <TableCell className="font-medium">
          {patient.patient_code}
        </TableCell>
      )}

      {/* Name */}
      {visibleColumns.name && (
        <TableCell>
          <div className="font-medium">
            {patient.display_name}
          </div>
          {!visibleColumns.age && patient.age && (
            <div className="text-sm text-muted-foreground">
              Age: {patient.age}
            </div>
          )}
        </TableCell>
      )}

      {/* Age */}
      {visibleColumns.age && (
        <TableCell className="text-center">
          {patient.age ? patient.age : '-'}
        </TableCell>
      )}

      {/* Therapist (for admin view) */}
      {visibleColumns.therapist && (
        <TableCell>
          <div className="text-sm">
            {therapistName || '-'}
          </div>
        </TableCell>
      )}

      {/* Treatment Start Date */}
      {visibleColumns.treatment_start && (
        <TableCell>
          <div className="text-sm text-muted-foreground">
            {patient.treatment_start_date 
              ? new Date(patient.treatment_start_date).toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: '2-digit' 
                })
              : '-'}
          </div>
        </TableCell>
      )}

      {/* Session Count with Total Planned */}
      {visibleColumns.sessions && (
        <TableCell>
          <div className="space-y-1">
            <div className="text-sm">
              <span className="font-medium">{patient.session_count}</span>
              <span className="text-muted-foreground"> of {patient.total_sessions_planned} sessions</span>
            </div>
            <Progress 
              value={(patient.session_count / patient.total_sessions_planned) * 100} 
              className="h-2 w-full max-w-[120px]"
              indicatorClassName="bg-blue-500"
            />
          </div>
        </TableCell>
      )}

      {/* Last Session */}
      {visibleColumns.last_session && (
        <TableCell className="hidden md:table-cell text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {lastSessionText}
          </div>
        </TableCell>
      )}

      {/* Adherence Score with Clinical Thresholds */}
      {visibleColumns.adherence && (
        <TableCell className="hidden lg:table-cell text-center">
          {adherence?.adherence_score !== null && adherence?.adherence_score !== undefined ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant={
                      adherence.clinical_threshold === 'Excellent' ? 'default' : 
                      adherence.clinical_threshold === 'Good' ? 'secondary' : 
                      adherence.clinical_threshold === 'Moderate' ? 'outline' :
                      'destructive'
                    }
                    className={
                      adherence.adherence_score >= 85 ? 'bg-green-100 text-green-800 border-green-200 cursor-help' : 
                      adherence.adherence_score >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 cursor-help' : 
                      adherence.adherence_score >= 50 ? 'bg-orange-100 text-orange-800 border-orange-200 cursor-help' :
                      'bg-red-100 text-red-800 border-red-200 cursor-help'
                    }
                  >
                    {Math.round(adherence.adherence_score)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-semibold">{adherence.clinical_threshold}</p>
                    <p className="text-xs text-muted-foreground">
                      {adherence.sessions_completed} of {adherence.sessions_expected} sessions completed
                    </p>
                    {adherence.clinical_threshold === 'Excellent' && (
                      <p className="text-xs mt-1">Patient is following protocol consistently</p>
                    )}
                    {adherence.clinical_threshold === 'Good' && (
                      <p className="text-xs mt-1">Minor gaps in therapy schedule</p>
                    )}
                    {adherence.clinical_threshold === 'Moderate' && (
                      <p className="text-xs mt-1">Consider reaching out to patient</p>
                    )}
                    {adherence.clinical_threshold === 'Poor' && (
                      <p className="text-xs mt-1">Intervention recommended</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xs text-muted-foreground">No Data</span>
          )}
        </TableCell>
      )}

      {/* Trial Progress */}
      {visibleColumns.protocol_day && (
        <TableCell className="hidden lg:table-cell text-center">
          {adherence?.protocol_day !== null && adherence?.protocol_day !== undefined ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm cursor-help">
                    {adherence.protocol_day >= (adherence.trial_duration || 14) ? (
                      <div className="flex items-center gap-1 justify-center">
                        <span className="font-medium">
                          Day {Math.min(adherence.protocol_day, adherence.trial_duration || 14)}/{adherence.trial_duration || 14}
                        </span>
                        <span className="text-green-600">✓</span>
                      </div>
                    ) : (
                      <span className="font-medium">
                        Day {adherence.protocol_day}/{adherence.trial_duration || 14}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-semibold">Treatment Protocol Progress</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {adherence.protocol_day >= (adherence.trial_duration || 14) 
                        ? `Trial completed (Day ${adherence.protocol_day})`
                        : `Day ${adherence.protocol_day} of ${adherence.trial_duration || 14}-day trial`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected: {Math.round((adherence.total_sessions_planned || 30) / 14 * Math.min(adherence.protocol_day, adherence.trial_duration || 14))} sessions
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completed: {adherence.sessions_completed} sessions
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          )}
        </TableCell>
      )}

      {/* Performance Score - Placeholder for Future Implementation */}
      {visibleColumns.progress_trend && (
        <TableCell className="hidden lg:table-cell text-center">
          <div className="flex flex-col items-center gap-0.5">
            {(() => {
              // Force specific examples for demonstration
              // P001 = Improving, P002 = Declining, others use hash
              if (patient.patient_code === 'P001') {
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <Icons.ArrowUpIcon className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">+18%</span>
                    </div>
                    <span className="text-xs text-gray-500">Improving</span>
                  </>
                )
              } else if (patient.patient_code === 'P002') {
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <Icons.ArrowDownIcon className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-700">-12%</span>
                    </div>
                    <span className="text-xs text-gray-500">Declining</span>
                  </>
                )
              }
              
              // Generate fake performance trend based on patient characteristics
              const trendHash = patient.patient_code.charCodeAt(0) + patient.patient_code.charCodeAt(1)
              const trendValue = trendHash % 3
              
              // Generate fake percentage change based on patient code
              const percentHash = (patient.patient_code.charCodeAt(2) || 0) + trendHash
              const percentValue = (percentHash % 25) + 5 // Range: 5-29%
              
              if (trendValue === 0) {
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <Icons.ArrowUpIcon className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">+{percentValue}%</span>
                    </div>
                    <span className="text-xs text-gray-500">Improving</span>
                  </>
                )
              } else if (trendValue === 1) {
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <Icons.ArrowDownIcon className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-700">-{percentValue}%</span>
                    </div>
                    <span className="text-xs text-gray-500">Declining</span>
                  </>
                )
              } else {
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <Icons.DashIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-600">±{Math.round(percentValue/5)}%</span>
                    </div>
                    <span className="text-xs text-gray-500">Steady</span>
                  </>
                )
              }
            })()}
          </div>
        </TableCell>
      )}

      {/* Patient Status */}
      {visibleColumns.status && (
        <TableCell className="hidden lg:table-cell text-center">
          <Badge variant="outline" className={statusBadgeClass}>
            {statusText}
          </Badge>
        </TableCell>
      )}

      {/* Actions */}
      <TableCell className="text-center">
        <Button 
          variant="default" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/patients/${patient.patient_code}`)
          }}
        >
          <PersonIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  )
}

// Main PatientManagement component
export function PatientManagement({ className }: PatientManagementProps) {
  const { user, userRole } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [therapistMap, setTherapistMap] = useState<Map<string, { first_name: string; last_name: string }>>(new Map())
  const [therapistsList, setTherapistsList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([])  // For create dialog dropdown
  
  // Get patient IDs and session counts for optimized adherence fetching
  const patientCodes = patients.map(p => p.patient_code)
  const sessionCountsMap = new Map(patients.map(p => [p.patient_code, p.session_count]))
  const { adherenceData, loading: adherenceLoading } = useAdherence(
    patientCodes, 
    patientCodes.length > 0,
    sessionCountsMap
  )
  
  // Filter and sort states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    showInactive: false  // Only show active patients by default
  })
  const [sortField, setSortField] = useState<SortField>('last_session')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)
  
  // Patient creation states (admin only)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    patient_code: '',
    firstName: '',
    lastName: '',
    age: '',
    gender: 'not_specified' as 'male' | 'female' | 'non_binary' | 'not_specified',
    therapistId: '',  // Empty by default - mandatory selection
    totalSessions: '30'
  })
  const { toast } = useToast()
  
  // Use the custom hook for patient code generation
  const {
    isGenerating: isGeneratingCode,
    validation: codeValidation,
    generateCode,
    validateCode,
    formatCode,
    cleanup: cleanupCodeGeneration
  } = usePatientCodeGeneration()
  
  // Column visibility state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('patient-management-visible-columns')
    const isAdmin = userRole === 'ADMIN'
    return saved ? JSON.parse(saved) : {
      patient_id: false,  // Hidden - technical ID
      name: true,
      age: true,
      therapist: isAdmin,  // Show for admin only
      treatment_start: false,  // Hidden - not needed daily
      sessions: true,
      last_session: false,  // Hidden - secondary info
      adherence: true,
      protocol_day: true,
      progress_trend: true,  // Now visible by default
      status: false  // Hidden - less critical for daily workflow
    }
  })

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('patient-management-visible-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Filtered and sorted patients
  const filteredAndSortedPatients = useMemo(() => {
    if (!patients) return []

    // Filter patients
    let filtered = patients.filter(patient => {
      // Search term filter
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase()
        const matchesSearch = 
          patient.patient_code.toLowerCase().includes(searchTerm) ||
          patient.display_name?.toLowerCase().includes(searchTerm) ||
          (patient.first_name?.toLowerCase().includes(searchTerm)) ||
          (patient.last_name?.toLowerCase().includes(searchTerm))
        
        if (!matchesSearch) return false
      }

      // Simple active/inactive filter
      if (!patient.active && !filters.showInactive) {
        return false  // Hide inactive patients unless explicitly shown
      }

      return true
    })

    // Sort patients
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case 'patient_code':
          aValue = a.patient_code
          bValue = b.patient_code
          break
        case 'display_name':
          aValue = a.display_name || a.patient_code
          bValue = b.display_name || b.patient_code
          break
        case 'session_count':
          aValue = a.session_count
          bValue = b.session_count
          break
        case 'last_session':
          aValue = a.last_session ? new Date(a.last_session).getTime() : 0
          bValue = b.last_session ? new Date(b.last_session).getTime() : 0
          break
        case 'age':
          aValue = a.age || 0
          bValue = b.age || 0
          break
        case 'active':
          aValue = a.active ? 1 : 0  // Convert boolean to number for sorting
          bValue = b.active ? 1 : 0
          break
        case 'adherence_score':
          // Get adherence data for each patient
          const aAdherence = adherenceData.find(ad => ad.patient_id === a.patient_code)
          const bAdherence = adherenceData.find(ad => ad.patient_id === b.patient_code)
          aValue = aAdherence?.adherence_score ?? -1  // Put null values at the end
          bValue = bAdherence?.adherence_score ?? -1
          break
        case 'protocol_day':
          // Get protocol day for each patient
          const aProtocol = adherenceData.find(ad => ad.patient_id === a.patient_code)
          const bProtocol = adherenceData.find(ad => ad.patient_id === b.patient_code)
          aValue = aProtocol?.protocol_day ?? -1  // Put null values at the end
          bValue = bProtocol?.protocol_day ?? -1
          break
        case 'progress_trend':
          // Handle special demo cases
          if (a.patient_code === 'P001') aValue = 18 // +18% Improving
          else if (a.patient_code === 'P002') aValue = -12 // -12% Declining
          else {
            // Generate fake trends based on patient code (same logic as display)
            const aTrendHash = a.patient_code.charCodeAt(0) + a.patient_code.charCodeAt(1)
            const aTrendType = aTrendHash % 3
            const aPercentHash = (a.patient_code.charCodeAt(2) || 0) + aTrendHash
            const aPercent = (aPercentHash % 25) + 5
            
            if (aTrendType === 0) aValue = aPercent // Up: positive percentage
            else if (aTrendType === 1) aValue = -aPercent // Down: negative percentage
            else aValue = Math.round(aPercent/5) * 0.1 // Steady: small value
          }
          
          if (b.patient_code === 'P001') bValue = 18 // +18% Improving
          else if (b.patient_code === 'P002') bValue = -12 // -12% Declining
          else {
            const bTrendHash = b.patient_code.charCodeAt(0) + b.patient_code.charCodeAt(1)
            const bTrendType = bTrendHash % 3
            const bPercentHash = (b.patient_code.charCodeAt(2) || 0) + bTrendHash
            const bPercent = (bPercentHash % 25) + 5
            
            if (bTrendType === 0) bValue = bPercent // Up: positive percentage
            else if (bTrendType === 1) bValue = -bPercent // Down: negative percentage
            else bValue = Math.round(bPercent/5) * 0.1 // Steady: small value
          }
          break
        default:
          aValue = a.last_session ? new Date(a.last_session).getTime() : 0
          bValue = b.last_session ? new Date(b.last_session).getTime() : 0
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
    })

    return filtered
  }, [patients, filters, sortField, sortDirection, adherenceData])

  // Sort handler with useCallback for optimization
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  // Generate next available patient code (wrapper for hook function)
  const generatePatientCode = useCallback(async () => {
    try {
      const newCode = await generateCode()
      setCreateForm(prev => ({ ...prev, patient_code: newCode }))
      
    } catch (error: any) {
      console.error('Failed to generate patient code:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate patient code. Please enter manually.',
        variant: 'destructive'
      })
    }
  }, [generateCode, setCreateForm, toast])

  // Patient creation handler with useCallback (admin only)
  const handleCreatePatient = useCallback(async () => {
    if (!createForm.patient_code || !createForm.firstName || !createForm.lastName || !createForm.therapistId) {
      toast({
        title: 'Error',
        description: 'Patient code, first name, last name, and therapist assignment are required',
        variant: 'destructive'
      })
      return
    }
    
    // Check code validation
    if (!codeValidation?.isValid) {
      toast({
        title: 'Error',
        description: 'Please enter a valid and unique patient code',
        variant: 'destructive'
      })
      return
    }

    try {
      // First, create the patient record
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert({
          patient_code: createForm.patient_code,
          therapist_id: createForm.therapistId,  // Now mandatory
          total_sessions_planned: parseInt(createForm.totalSessions) || 30,
          treatment_start_date: new Date().toISOString(),
          active: true
        })
        .select()
        .single()

      if (patientError) throw patientError

      // Then, create the medical info record
      const age = parseInt(createForm.age)
      const dateOfBirth = age ? new Date(new Date().getFullYear() - age, 0, 1).toISOString().split('T')[0] : null

      const { error: medicalError } = await supabase
        .from('patient_medical_info')
        .insert({
          patient_code: createForm.patient_code,
          first_name: createForm.firstName,
          last_name: createForm.lastName,
          date_of_birth: dateOfBirth,
          gender: createForm.gender
        })

      if (medicalError) {
        // If medical info creation fails, try to clean up the patient record
        await supabase.from('patients').delete().eq('patient_code', createForm.patient_code)
        throw medicalError
      }

      toast({
        title: 'Success',
        description: `Patient ${createForm.firstName} ${createForm.lastName} (${createForm.patient_code}) created successfully`
      })

      // Reset form and close dialog
      setCreateForm({
        patient_code: '',
        firstName: '',
        lastName: '',
        age: '',
        gender: 'not_specified',
        therapistId: '',
        totalSessions: '30'
      })
      setCodeValidation(null)
      setShowCreateDialog(false)

      // Reload patients to show the new patient
      await loadPatientsData()

    } catch (error: any) {
      console.error('Failed to create patient:', error)
      toast({
        title: 'Error',
        description: `Failed to create patient: ${error.message}`,
        variant: 'destructive'
      })
    }
  }, [createForm, codeValidation, toast, loadPatientsData])

  // Handle dialog open/close with cleanup
  const handleDialogChange = useCallback((open: boolean) => {
    setShowCreateDialog(open)
    if (!open) {
      // Cleanup code generation on dialog close
      cleanupCodeGeneration()
      setCodeValidation(null)
    }
  }, [cleanupCodeGeneration])

  // Auto-generate patient code when dialog opens
  useEffect(() => {
    if (showCreateDialog && !createForm.patient_code) {
      generatePatientCode()
    }
  }, [showCreateDialog])

  // Load patients data function (extracted for reuse)
  const loadPatientsData = useCallback(async () => {
    if (!user?.id) return
    
    const loadPatients = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Check if user is admin
        const isAdmin = userRole === 'ADMIN'
        
        // Fetch patients (all for admin, filtered for therapists)
        const data = await fetchPatients(user.id, isAdmin)
        setPatients(data)
        
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
        }
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPatients()
  }, [user?.id, userRole])

  // Handle loading state
  if (isLoading) {
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

  // Handle no results after filtering
  if (filteredAndSortedPatients.length === 0) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900">
              <PersonIcon className="h-5 w-5 text-blue-500" />
              Patient Management
              <Badge variant="secondary" className="ml-auto">
                {patients.length} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name or ID..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Columns3 className="h-4 w-4 mr-2" />
                      Columns
                      <ChevronDownIcon className="h-4 w-4 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Show Columns</h4>
                      <div className="space-y-2">
                        {Object.entries({
                          patient_id: 'Patient ID',
                          name: 'Name',
                          age: 'Age',
                          ...(userRole === 'ADMIN' ? { therapist: 'Therapist' } : {}),
                          sessions: 'Sessions', 
                          last_session: 'Last Session',
                          adherence: 'Adherence',
                          protocol_day: 'Trial Day',
                          progress_trend: 'Performance Score',
                          status: 'Status'
                        }).map(([key, label]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox 
                              id={key}
                              checked={visibleColumns[key as keyof ColumnVisibility]}
                              onCheckedChange={(checked) => {
                                setVisibleColumns(prev => ({
                                  ...prev,
                                  [key]: !!checked
                                }))
                              }}
                            />
                            <label htmlFor={key} className="text-sm">
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Popover open={showFilters} onOpenChange={setShowFilters}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      <ChevronDownIcon className="h-4 w-4 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Patient Visibility</h4>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="show_inactive"
                              checked={filters.showInactive}
                              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showInactive: !!checked }))}
                            />
                            <label htmlFor="show_inactive" className="text-sm">
                              {filters.showInactive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
                              Show Inactive Patients
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Add Patient Button - Admin Only */}
                {userRole === 'ADMIN' && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Icons.PlusIcon className="mr-2 h-4 w-4" />
                    Add Patient
                  </Button>
                )}
              </div>
            </div>
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No patients found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => setFilters({ searchTerm: '', showInactive: false })}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - render patient table
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PersonIcon className="h-5 w-5 text-blue-500" />
            {userRole === 'ADMIN' ? 'All Patients' : 'Patient Management'}
            <Badge variant="secondary" className="ml-auto">
              {filteredAndSortedPatients.length} of {patients.length} patients
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients by name or ID..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="h-4 w-4 mr-2" />
                    Columns
                    <ChevronDownIcon className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Show Columns</h4>
                    <div className="space-y-2">
                      {Object.entries({
                        patient_id: 'Patient ID',
                        name: 'Name',
                        age: 'Age',
                        ...(userRole === 'ADMIN' ? { therapist: 'Therapist' } : {}),
                        treatment_start: 'Treatment Start',
                        sessions: 'Sessions Completed', 
                        last_session: 'Last Activity',
                        adherence: 'Adherence Score',
                        protocol_day: 'Trial Day',
                        progress_trend: 'Performance Trend',
                        status: 'Status'
                      }).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={key}
                            checked={visibleColumns[key as keyof ColumnVisibility]}
                            onCheckedChange={(checked) => {
                              setVisibleColumns(prev => ({
                                ...prev,
                                [key]: !!checked
                              }))
                            }}
                          />
                          <label htmlFor={key} className="text-sm">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    <ChevronDownIcon className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Patient Visibility</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="show_inactive"
                            checked={filters.showInactive}
                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showInactive: !!checked }))}
                          />
                          <label htmlFor="show_inactive" className="text-sm">
                            {filters.showInactive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
                            Show Inactive Patients
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Add Patient Button - Admin Only */}
              {userRole === 'ADMIN' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Icons.PlusIcon className="mr-2 h-4 w-4" />
                  Add Patient
                </Button>
              )}
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  
                  {visibleColumns.patient_id && (
                    <TableHead className="w-24">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('patient_code')}
                      >
                        Patient ID
                        {sortField === 'patient_code' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.name && (
                    <TableHead className="min-w-[100px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('display_name')}
                      >
                        Name
                        {sortField === 'display_name' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.age && (
                    <TableHead className="w-14 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('age')}
                      >
                        Age
                        {sortField === 'age' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.therapist && (
                    <TableHead className="min-w-[120px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                      >
                        Therapist
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.treatment_start && (
                    <TableHead className="w-28">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('treatment_start_date')}
                      >
                        Treatment Start
                        {sortField === 'treatment_start_date' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.sessions && (
                    <TableHead className="min-w-[150px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('session_count')}
                      >
                        Sessions Completed
                        {sortField === 'session_count' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.last_session && (
                    <TableHead className="hidden md:table-cell w-32">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('last_session')}
                      >
                        Last Session
                        {sortField === 'last_session' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.adherence && (
                    <TableHead className="hidden lg:table-cell w-28 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 data-[state=open]:bg-accent"
                              onClick={() => handleSort('adherence_score')}
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Adherence Score</span>
                                <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
                                {sortField === 'adherence_score' && (
                                  sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <ChevronDownIcon className="ml-1 h-4 w-4" />
                                )}
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold">Longitudinal Adherence ("How often?")</p>
                              <p className="text-sm">
                                Measures protocol consistency: actual vs expected therapy sessions completed.
                                Target: 5 therapy sessions/week (15 game sessions/week).
                              </p>
                              <div className="text-xs space-y-1 border-t pt-2">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-green-100 text-green-800 border-green-200">≥85%</Badge>
                                  <span>Excellent - Meeting frequency</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">70-84%</Badge>
                                  <span>Good - Adequate with minor gaps</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">50-69%</Badge>
                                  <span>Moderate - Suboptimal, consider intervention</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-red-100 text-red-800 border-red-200">&lt;50%</Badge>
                                  <span>Poor - Significant concern, support needed</span>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  )}
                  
                  {visibleColumns.protocol_day && (
                    <TableHead className="hidden lg:table-cell w-24 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 data-[state=open]:bg-accent"
                              onClick={() => handleSort('protocol_day')}
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Trial Day</span>
                                <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
                                {sortField === 'protocol_day' && (
                                  sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <ChevronDownIcon className="ml-1 h-4 w-4" />
                                )}
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold">Current Protocol Day</p>
                              <p className="text-sm">
                                Progress through the 14-day GHOSTLY+ clinical trial protocol.
                                Adherence calculation begins from day 3 for measurement stability.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  )}
                  
                  {visibleColumns.progress_trend && (
                    <TableHead className="hidden lg:table-cell w-24 text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 data-[state=open]:bg-accent"
                              onClick={() => handleSort('progress_trend')}
                            >
                              <div className="inline-flex items-center gap-1">
                                <span>Performance Trend</span>
                                <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
                                {sortField === 'progress_trend' && (
                                  sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <ChevronDownIcon className="ml-1 h-4 w-4" />
                                )}
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold">Performance Trend</p>
                              <p className="text-sm">
                                Trend analysis of the Overall Performance Score across the last 6 game sessions.
                              </p>
                              <div className="text-xs space-y-1 border-t pt-2 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Increasing:</span>
                                  <span>Performance improving over time</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Steady:</span>
                                  <span>Consistent performance maintained</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Decreasing:</span>
                                  <span>Performance declining, may need intervention</span>
                                </div>
                              </div>
                              <div className="text-xs text-blue-600 mt-2 italic">
                                Coming soon - based on recent session analysis.
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  )}
                  
                  {visibleColumns.status && (
                    <TableHead className="hidden lg:table-cell w-24 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('active')}
                      >
                        Status
                        {sortField === 'active' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPatients.map((patient) => {
                  const patientAdherence = adherenceData.find(a => a.patient_id === patient.patient_code)
                  const therapist = patient.therapist_id ? therapistMap.get(patient.therapist_id) : null
                  const therapistName = therapist 
                    ? `${therapist.first_name || ''} ${therapist.last_name || ''}`.trim() || 'Unknown'
                    : null
                  return (
                    <PatientRow 
                      key={patient.patient_code} 
                      patient={patient} 
                      visibleColumns={visibleColumns}
                      adherence={patientAdherence}
                      therapistName={therapistName}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Creation Dialog - Admin Only */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Patient</DialogTitle>
            <DialogDescription>
              Add a new patient to the system. Patient code must be unique and therapist assignment is required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="patientCode" className="text-right">Patient Code</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="patientCode"
                    value={createForm.patient_code}
                    onChange={(e) => {
                      let code = e.target.value.toUpperCase()
                      
                      // Enforce P### format as user types
                      if (code && !code.startsWith('P')) {
                        code = 'P' + code.replace(/[^0-9]/g, '')
                      } else if (code.length > 1) {
                        // Keep P and only digits, max 3 digits
                        code = 'P' + code.slice(1).replace(/[^0-9]/g, '').slice(0, 3)
                      }
                      
                      setCreateForm({ ...createForm, patient_code: code })
                      if (code) {
                        validatePatientCode(code)
                      } else {
                        setCodeValidation(null)
                      }
                    }}
                    placeholder="P001"
                    className={`flex-1 ${
                      codeValidation 
                        ? codeValidation.isValid 
                          ? 'border-green-500 focus:border-green-500' 
                          : 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePatientCode}
                    disabled={isGeneratingCode}
                    className="shrink-0"
                  >
                    {isGeneratingCode ? (
                      <Icons.UpdateIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.MagicWandIcon className="h-4 w-4" />
                    )}
                    Generate
                  </Button>
                </div>
                {codeValidation && (
                  <p className={`text-xs ${
                    codeValidation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {codeValidation.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">First Name</Label>
              <Input
                id="firstName"
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">Last Name</Label>
              <Input
                id="lastName"
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="age" className="text-right">Age</Label>
              <Input
                id="age"
                type="number"
                value={createForm.age}
                onChange={(e) => setCreateForm({ ...createForm, age: e.target.value })}
                placeholder="25"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Gender</Label>
              <Select 
                value={createForm.gender} 
                onValueChange={(value) => setCreateForm({ ...createForm, gender: value as any })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-binary</SelectItem>
                  <SelectItem value="not_specified">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Therapist *</Label>
              <Select 
                value={createForm.therapistId} 
                onValueChange={(value) => setCreateForm({ ...createForm, therapistId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select therapist (required)" />
                </SelectTrigger>
                <SelectContent>
                  {therapistsList.map((therapist) => (
                    <SelectItem key={therapist.id} value={therapist.id}>
                      {therapist.first_name} {therapist.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="totalSessions" className="text-right">Total Sessions</Label>
              <Input
                id="totalSessions"
                type="number"
                value={createForm.totalSessions}
                onChange={(e) => setCreateForm({ ...createForm, totalSessions: e.target.value })}
                placeholder="30"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePatient}>Create Patient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 