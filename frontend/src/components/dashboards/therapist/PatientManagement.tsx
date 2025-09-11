import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
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
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover'
import { Checkbox } from '../../ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import Spinner from '../../ui/Spinner'
import { 
  DotsHorizontalIcon as MoreHorizontal, 
  PersonIcon as User, 
  GroupIcon as Users, 
  CalendarIcon as Calendar, 
  FileIcon as File, 
  MagnifyingGlassIcon as Search,
  MixerHorizontalIcon as Filter,
  ChevronDownIcon,
  ChevronUpIcon as SortAsc,
  EyeOpenIcon as Eye,
  EyeClosedIcon as EyeOff,
  ViewGridIcon as Columns3
} from '@radix-ui/react-icons'
import { Patient, PatientManagementProps } from './types'

type SortField = 'patient_code' | 'display_name' | 'session_count' | 'last_session' | 'age' | 'patient_status'
type SortDirection = 'asc' | 'desc'

interface FilterState {
  searchTerm: string
  statusFilter: string[]
  showDroppedOut: boolean
}

interface ColumnVisibility {
  patient_id: boolean
  name: boolean
  age: boolean
  sessions: boolean
  last_session: boolean
  adherence: boolean
  status: boolean
}

/**
 * Patient Management Component for Therapist Dashboard
 * Displays patient list with session counts and last session info
 * Follows KISS principles with inline avatar and simple state management
 */

// Fetch therapist's patients with session data and medical info
async function fetchTherapistPatients(therapistId: string): Promise<Patient[]> {
  
  const { data, error } = await supabase
    .from('patients')
    .select(`
      patient_code,
      created_at,
      patient_medical_info (
        first_name,
        last_name,
        date_of_birth,
        patient_status
      ),
      therapy_sessions (processed_at)
    `)
    .eq('therapist_id', therapistId)

  if (error) {
    console.error('Error fetching patients:', error)
    throw error
  }

  // Transform data to include session count, last session, and medical info
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
      // Medical info (will be null for researchers due to RLS)
      first_name: medical?.first_name || null,
      last_name: medical?.last_name || null,
      age: age,
      patient_status: medical?.patient_status || 'active',
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

// Use unified color system for patient avatars (DRY principle)
function getAvatarColor(patient: Patient): string {
  // Use full name if available for more distinct colors, fallback to patient code
  const identifier = patient.first_name && patient.last_name 
    ? `${patient.first_name}${patient.last_name}` 
    : patient.patient_code
  
  // Get darker avatar colors for better visibility
  const avatarColors = [
    'bg-lime-500',     // Bright lime
    'bg-emerald-500',  // Bright emerald  
    'bg-amber-500',    // Bright amber
    'bg-orange-500',   // Bright orange
    'bg-fuchsia-500',  // Bright fuchsia
    'bg-rose-500',     // Bright rose
    'bg-sky-500',      // Bright sky
    'bg-indigo-500',   // Bright indigo
    'bg-violet-500',   // Bright violet
    'bg-cyan-500',     // Bright cyan
  ]
  
  // Generate hash from identifier for consistent colors
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  const index = Math.abs(hash) % avatarColors.length
  
  return avatarColors[index]
}

// Generate patient avatar initials from patient code (e.g., "P001" → "P1")
function getPatientInitials(patientCode: string): string {
  // Extract numeric part from patient code (P001 → 001 → 1)
  const numericPart = patientCode.replace(/\D/g, '')
  const number = parseInt(numericPart) || 0
  return `P${number}`
}

// Format date for display
function formatLastSession(dateString: string | null): string {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  
  return date.toLocaleDateString()
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
          <User className="h-5 w-5" />
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
          <User className="h-5 w-5" />
          Patient Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
          <User className="h-5 w-5" />
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

// Individual patient row component
function PatientRow({ patient, visibleColumns }: { patient: Patient; visibleColumns: ColumnVisibility }) {
  const navigate = useNavigate()
  const avatarColor = getAvatarColor(patient)
  const sessionBadgeVariant = getSessionBadgeVariant(patient.session_count)
  const lastSessionText = formatLastSession(patient.last_session)
  
  // Get status badge variant
  const statusBadgeVariant = patient.patient_status === 'dropped_out' ? 'destructive' : 'secondary'

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

      {/* Session Count */}
      {visibleColumns.sessions && (
        <TableCell>
          <Badge variant={sessionBadgeVariant} className="font-mono">
            {patient.session_count}
          </Badge>
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

      {/* Adherence Level */}
      {visibleColumns.adherence && (
        <TableCell className="hidden lg:table-cell text-center">
          {patient.adherence_level ? (
            <Badge 
              variant={
                patient.adherence_level === 'high' ? 'default' : 
                patient.adherence_level === 'moderate' ? 'secondary' : 
                'outline'
              }
              className="capitalize"
            >
              {patient.adherence_level}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No Data</span>
          )}
        </TableCell>
      )}

      {/* Patient Status */}
      {visibleColumns.status && (
        <TableCell className="hidden lg:table-cell text-center">
          <Badge variant={statusBadgeVariant} className="capitalize">
            {patient.patient_status?.replace('_', ' ')}
          </Badge>
        </TableCell>
      )}

      {/* Actions */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu for {patient.display_name}</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation()
              navigate(`/patients/${patient.patient_code}`)
            }}>
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
              Session History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

// Main PatientManagement component
export function PatientManagement({ className }: PatientManagementProps) {
  const { user } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  // Filter and sort states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    statusFilter: ['active', 'completed', 'on_hold'], // Don't show dropped_out by default
    showDroppedOut: false
  })
  const [sortField, setSortField] = useState<SortField>('last_session')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)
  
  // Column visibility state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('patient-management-visible-columns')
    return saved ? JSON.parse(saved) : {
      patient_id: true,
      name: true,
      age: true,
      sessions: true,
      last_session: true,
      adherence: true,
      status: true
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

      // Status filter logic
      const patientStatus = patient.patient_status || 'active'
      
      // Handle dropped out patients separately
      if (patientStatus === 'dropped_out') {
        return filters.showDroppedOut  // Only show if explicitly enabled
      }
      
      // For other statuses, check if they're in the statusFilter
      if (filters.statusFilter.length > 0 && !filters.statusFilter.includes(patientStatus)) {
        return false
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
        case 'patient_status':
          aValue = a.patient_status || 'active'
          bValue = b.patient_status || 'active'
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
  }, [patients, filters, sortField, sortDirection])

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Simple useEffect for data fetching (KISS approach)
  useEffect(() => {
    if (!user?.id) return

    const loadPatients = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await fetchTherapistPatients(user.id)
        setPatients(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPatients()
  }, [user?.id])

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
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
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
                          sessions: 'Sessions', 
                          last_session: 'Last Session',
                          adherence: 'Adherence',
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
                        <h4 className="font-medium text-sm">Patient Status</h4>
                        <div className="space-y-2">
                          {(['active', 'completed', 'on_hold'] as const).map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                              <Checkbox 
                                id={status}
                                checked={filters.statusFilter.includes(status)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters(prev => ({
                                      ...prev,
                                      statusFilter: [...prev.statusFilter, status]
                                    }))
                                  } else {
                                    setFilters(prev => ({
                                      ...prev,
                                      statusFilter: prev.statusFilter.filter(s => s !== status)
                                    }))
                                  }
                                }}
                              />
                              <label htmlFor={status} className="text-sm capitalize">
                                {status.replace('_', ' ')}
                              </label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="dropped_out"
                              checked={filters.showDroppedOut}
                              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showDroppedOut: !!checked }))}
                            />
                            <label htmlFor="dropped_out" className="text-sm">
                              {filters.showDroppedOut ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
                              Show Dropped Out
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
                onClick={() => setFilters({ searchTerm: '', statusFilter: ['active', 'completed', 'on_hold'], showDroppedOut: false })}
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
            <Users className="h-5 w-5" />
            Patient Management
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
                        sessions: 'Sessions', 
                        last_session: 'Last Session',
                        adherence: 'Adherence',
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
                      <h4 className="font-medium text-sm">Patient Status</h4>
                      <div className="space-y-2">
                        {(['active', 'completed', 'on_hold'] as const).map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox 
                              id={status}
                              checked={filters.statusFilter.includes(status)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilters(prev => ({
                                    ...prev,
                                    statusFilter: [...prev.statusFilter, status]
                                  }))
                                } else {
                                  setFilters(prev => ({
                                    ...prev,
                                    statusFilter: prev.statusFilter.filter(s => s !== status)
                                  }))
                                }
                              }}
                            />
                            <label htmlFor={status} className="text-sm capitalize">
                              {status.replace('_', ' ')}
                            </label>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="dropped_out"
                            checked={filters.showDroppedOut}
                            onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showDroppedOut: !!checked }))}
                          />
                          <label htmlFor="dropped_out" className="text-sm">
                            {filters.showDroppedOut ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
                            Show Dropped Out
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Avatar</TableHead>
                  
                  {visibleColumns.patient_id && (
                    <TableHead className="w-32">
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
                    <TableHead>
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
                    <TableHead className="w-16 text-center">
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
                  
                  {visibleColumns.sessions && (
                    <TableHead className="w-24">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('session_count')}
                      >
                        Sessions
                        {sortField === 'session_count' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  {visibleColumns.last_session && (
                    <TableHead className="hidden md:table-cell w-40">
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
                    <TableHead className="hidden lg:table-cell w-28 text-center">Adherence</TableHead>
                  )}
                  
                  {visibleColumns.status && (
                    <TableHead className="hidden lg:table-cell w-24 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 data-[state=open]:bg-accent"
                        onClick={() => handleSort('patient_status')}
                      >
                        Status
                        {sortField === 'patient_status' && (
                          sortDirection === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <ChevronDownIcon className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPatients.map((patient) => (
                  <PatientRow key={patient.patient_code} patient={patient} visibleColumns={visibleColumns} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}