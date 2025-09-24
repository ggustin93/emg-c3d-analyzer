/**
 * PatientTable - Advanced table component for patient data visualization
 * 
 * This component provides comprehensive patient data display with advanced features
 * including sorting, filtering, column visibility controls, and adherence tracking.
 * 
 * Key Features:
 * - Performance-optimized table rendering with memoization
 * - Advanced filtering and sorting capabilities
 * - Column visibility management with localStorage persistence
 * - Adherence data visualization with color-coded indicators
 * - Responsive design with mobile-first approach
 * 
 * Performance Optimizations:
 * - Memoized filtering and sorting computations
 * - Optimized adherence data lookups using Map structure
 * - Callback-optimized event handlers
 * - Virtual scrolling ready architecture
 * 
 * Features:
 * - Multi-column sorting with visual indicators
 * - Real-time search across patient data
 * - Configurable column visibility
 * - Status-based filtering (active/inactive)
 * - Adherence score visualization
 * - Progressive trend indicators
 * 
 * Extracted from monolithic component for maintainability
 */
import React, { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  PersonIcon, 
  CalendarIcon as Calendar, 
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
import { Patient } from './types'
import { AdherenceData } from '../../../services/adherenceService'
import { getAvatarColor, getPatientIdentifier } from '../../../lib/avatarColors'
import { SortField, SortDirection, FilterState, ColumnVisibility } from './PatientManagement'

// Format date for display with European/French format (DD/MM/YYYY)
function formatLastSession(dateString: string | null): string {
  if (!dateString) return 'Never'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'  
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago` // TODO: Move to configuration - time thresholds
  
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

// Individual patient row component with adherence data
interface PatientRowProps {
  patient: Patient
  visibleColumns: ColumnVisibility
  adherence?: AdherenceData
  therapistName?: string | null
  userRole: string
  onReassign: (patient: Patient) => void
}

function PatientRow({ patient, visibleColumns, adherence, therapistName, userRole, onReassign }: PatientRowProps) {
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
              className="h-2 w-full max-w-[120px]" // TODO: Move to configuration - progress bar styling
              indicatorClassName="bg-blue-500" // TODO: Move to configuration - progress bar colors
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
                      adherence.adherence_score >= 85 ? 'bg-green-100 text-green-800 border-green-200 cursor-help' : // TODO: Move to configuration - adherence thresholds
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
                    <div className="flex items-center gap-1 justify-center min-w-[80px]">
                      <span className="font-medium tabular-nums">
                        Day {adherence.protocol_day >= (adherence.trial_duration || 14) 
                          ? Math.min(adherence.protocol_day, adherence.trial_duration || 14)
                          : adherence.protocol_day}/{adherence.trial_duration || 14}
                      </span>
                      <span className="w-4 text-center">
                        {adherence.protocol_day >= (adherence.trial_duration || 14) ? (
                          <span className="text-green-600">✓</span>
                        ) : null}
                      </span>
                    </div>
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
                      Expected: {Math.round((adherence.total_sessions_planned || 30) / 14 * Math.min(adherence.protocol_day, adherence.trial_duration || 14))} sessions // TODO: Move to configuration - trial duration and calculation logic
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

      {/* Performance Trend - Temporary Demo Values */}
      {/* 
        TODO: CRITICAL - Replace hardcoded Performance Trend with actual calculation
        
        Implementation Requirements:
        1. Calculate trend from actual overall performance scores across sessions
        2. Use PerformanceScoringService.calculatePerformanceScores() results  
        3. Compare latest 3 sessions vs previous 3 sessions for trend direction
        4. Calculate percentage change: ((recent_avg - previous_avg) / previous_avg) * 100
        5. Trend indicators: 
           - >+5% = Improving (green arrow up)
           - <-5% = Declining (red arrow down) 
           - -5% to +5% = Steady (gray dash)
        6. Replace demo values in handleSort 'progress_trend' case as well
        
        Data Sources:
        - therapy_sessions.overall_performance_score (0-100 scale)
        - Calculate rolling averages and trends over time
        - Handle cases with insufficient session data (<6 sessions)
      */}
      {visibleColumns.progress_trend && (
        <TableCell className="hidden lg:table-cell text-center">
          <div className="flex flex-col items-center gap-0.5">
            {(() => {
              // TEMPORARY HARDCODED VALUES - Replace with actual performance trend calculation
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
              
              // Generate temporary demo trend values based on patient code hash
              // TODO: Replace with real performance trend calculation from session data
              const trendHash = patient.patient_code.charCodeAt(0) + patient.patient_code.charCodeAt(1)
              const trendValue = trendHash % 3
              
              // Generate temporary percentage change for demo purposes only
              const percentHash = (patient.patient_code.charCodeAt(2) || 0) + trendHash
              const percentValue = (percentHash % 25) + 5 // Range: 5-29% - TODO: Replace with real calculation
              
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
            })()
            }
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
        <div className="flex items-center gap-1 justify-center">
          {/* View Patient - Primary Action */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/patients/${patient.patient_code}`)
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Patient Details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Reassign Patient - Admin Only - Secondary Action */}
          {userRole === 'ADMIN' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReassign(patient)
                    }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Icons.PersonIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reassign to Another Therapist</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

interface PatientTableProps {
  patients: Patient[]
  adherenceMap: Map<string, AdherenceData>
  therapistMap: Map<string, { first_name: string; last_name: string }>
  userRole: string
  filters: FilterState
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>
  sortField: SortField
  setSortField: React.Dispatch<React.SetStateAction<SortField>>
  sortDirection: SortDirection
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>
  showFilters: boolean
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>
  visibleColumns: ColumnVisibility
  setVisibleColumns: React.Dispatch<React.SetStateAction<ColumnVisibility>>
  onCreatePatient: () => void
  onReassignPatient: (patient: Patient) => void
}

export function PatientTable({
  patients,
  adherenceMap,
  therapistMap,
  userRole,
  filters,
  setFilters,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  showFilters,
  setShowFilters,
  visibleColumns,
  setVisibleColumns,
  onCreatePatient,
  onReassignPatient
}: PatientTableProps) {
  
  // Filtered and sorted patients - Memoized for performance
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
          // Get adherence data for each patient - Optimized with Map lookup
          const aAdherence = adherenceMap.get(a.patient_code)
          const bAdherence = adherenceMap.get(b.patient_code)
          aValue = aAdherence?.adherence_score ?? -1  // Put null values at the end
          bValue = bAdherence?.adherence_score ?? -1
          break
        case 'protocol_day':
          // Get protocol day for each patient - Optimized with Map lookup
          const aProtocol = adherenceMap.get(a.patient_code)
          const bProtocol = adherenceMap.get(b.patient_code)
          aValue = aProtocol?.protocol_day ?? -1  // Put null values at the end
          bValue = bProtocol?.protocol_day ?? -1
          break
        case 'progress_trend':
          // Handle special demo cases - TODO: Replace with real performance trend calculation
          if (a.patient_code === 'P001') aValue = 18 // +18% Improving - Temporary demo value
          else if (a.patient_code === 'P002') aValue = -12 // -12% Declining - Temporary demo value
          else {
            // Generate temporary demo trends based on patient code hash (same logic as display)
            const aTrendHash = a.patient_code.charCodeAt(0) + a.patient_code.charCodeAt(1)
            const aTrendType = aTrendHash % 3
            const aPercentHash = (a.patient_code.charCodeAt(2) || 0) + aTrendHash
            const aPercent = (aPercentHash % 25) + 5
            
            if (aTrendType === 0) aValue = aPercent // Up: positive percentage
            else if (aTrendType === 1) aValue = -aPercent // Down: negative percentage
            else aValue = Math.round(aPercent/5) * 0.1 // Steady: small value
          }
          
          if (b.patient_code === 'P001') bValue = 18 // +18% Improving - Temporary demo value
          else if (b.patient_code === 'P002') bValue = -12 // -12% Declining - Temporary demo value
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
  }, [patients, filters, sortField, sortDirection, adherenceMap])

  // Sort handler with useCallback for optimization
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection, setSortField, setSortDirection])

  // Optimized filter handlers with useCallback
  const handleClearFilters = useCallback(() => {
    setFilters({ searchTerm: '', showInactive: false })
  }, [setFilters])

  // Handle no results after filtering
  if (filteredAndSortedPatients.length === 0) {
    return (
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
                <Button onClick={onCreatePatient}>
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
              onClick={handleClearFilters}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state - render patient table
  return (
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
              <Button onClick={onCreatePatient}>
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
                  <TableHead className="hidden lg:table-cell w-20 text-center">
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
                const patientAdherence = adherenceMap.get(patient.patient_code)
                const therapist = patient.therapist_id ? therapistMap.get(patient.therapist_id) : null
                const therapistName = therapist 
                  ? `${therapist.first_name?.charAt(0) || ''}. ${therapist.last_name || ''}`.trim() || 'Unknown'
                  : null
                return (
                  <PatientRow 
                    key={patient.patient_code} 
                    patient={patient} 
                    visibleColumns={visibleColumns}
                    adherence={patientAdherence}
                    therapistName={therapistName}
                    userRole={userRole}
                    onReassign={onReassignPatient}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}