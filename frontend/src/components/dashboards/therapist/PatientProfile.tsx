import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ClinicalNotesModal } from '../../shared/ClinicalNotesModal'
import { useClinicalNotes } from '../../../hooks/useClinicalNotes'
import PatientSessionBrowser from './PatientSessionBrowser'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import Spinner from '../../ui/Spinner'
import {
  PersonIcon,
  ActivityLogIcon,
  FileTextIcon,
  BarChartIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  CalendarIcon,
  HeartIcon,
  InfoCircledIcon,
  Pencil1Icon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  TrashIcon
} from '@radix-ui/react-icons'

interface PatientProfileData {
  patient_code: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: 'male' | 'female' | 'non_binary' | 'not_specified' | null
  room_number: string | null
  admission_date: string | null
  primary_diagnosis: string | null
  mobility_status: 'ambulatory' | 'bed_rest' | 'wheelchair' | 'assisted' | null
  bmi_value: number | null
  bmi_status: 'underweight' | 'normal' | 'overweight' | 'obese' | null
  cognitive_status: 'alert' | 'confused' | 'impaired' | 'unresponsive' | null
  active: boolean  // Simple active/inactive status for clinical trial
  therapist_name?: string
  total_sessions: number
  completed_sessions: number
  last_session_date: string | null
  next_session_date?: string | null
  adherence_percentage?: number
  average_performance?: number
}

// Get avatar color based on patient identifier
function getAvatarColor(identifier: string): string {
  const avatarColors = [
    'bg-lime-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500',
    'bg-fuchsia-500', 'bg-rose-500', 'bg-sky-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-cyan-500'
  ]
  
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  const index = Math.abs(hash) % avatarColors.length
  return avatarColors[index]
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}


// Get mobility status label
function getMobilityStatus(status: string | null): string {
  switch (status) {
    case 'ambulatory': return 'Ambulatory'
    case 'wheelchair': return 'Wheelchair'
    case 'bed_rest': return 'Bed Rest'
    case 'assisted': return 'Assisted'
    default: return 'Not specified'
  }
}



// Status Badge Component with better styling
const StatusBadge = ({ status }: { status?: string }) => {
  if (!status || status === 'N/A') {
    return <span className="text-sm text-muted-foreground">N/A</span>
  }

  let badgeClass = ''
  switch (status.toLowerCase()) {
    case 'good':
    case 'high':
    case 'excellent':
    case 'improving':
      badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700'
      break
    case 'fair':
    case 'medium':
      badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
      break
    case 'declining':
    case 'poor':
    case 'low':
      badgeClass = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300 dark:border-red-700'
      break
    default:
      badgeClass = 'border-border'
  }

  return (
    <Badge variant="outline" className={`font-medium ${badgeClass}`}>
      {status}
    </Badge>
  )
}

export function PatientProfile() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('sessions')
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [patientNotes, setPatientNotes] = useState<any[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'list' | 'create' | 'edit'>('list')
  const [noteToEdit, setNoteToEdit] = useState<any>(null)
  
  const { getPatientRelatedNotes, updateNote, deleteNote } = useClinicalNotes()

  useEffect(() => {
    if (!patientId) return

    const fetchPatientProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch patient with medical info using proper join
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select(`
            id,
            patient_code,
            therapist_id,
            created_at,
            active,
            patient_medical_info (
              first_name,
              last_name,
              date_of_birth,
              gender,
              room_number,
              admission_date,
              primary_diagnosis,
              mobility_status,
              bmi_value,
              bmi_status,
              cognitive_status,
              total_sessions_planned
            )
          `)
          .eq('patient_code', patientId)
          .single()

        if (patientError) throw patientError

        // Extract medical info from the joined data
        const medical = Array.isArray(patientData.patient_medical_info) 
          ? patientData.patient_medical_info[0] 
          : patientData.patient_medical_info

        // Fetch therapy sessions using patient ID
        const { data: sessionsData } = await supabase
          .from('therapy_sessions')
          .select('session_code, processed_at, processing_status')
          .eq('patient_id', patientData.id)

        const sessions = sessionsData || []
        const completedSessions = sessions.filter((s: any) => s.processing_status === 'completed').length
        const lastSession = sessions
          .map((s: any) => s.processed_at)
          .filter(Boolean)
          .sort()
          .pop()

        const profileData: PatientProfileData = {
          patient_code: patientData.patient_code,
          first_name: medical?.first_name || null,
          last_name: medical?.last_name || null,
          date_of_birth: medical?.date_of_birth || null,
          gender: medical?.gender || null,
          room_number: medical?.room_number || null,
          admission_date: medical?.admission_date || null,
          primary_diagnosis: medical?.primary_diagnosis || null,
          mobility_status: medical?.mobility_status || null,
          bmi_value: medical?.bmi_value || null,
          bmi_status: medical?.bmi_status || null,
          cognitive_status: medical?.cognitive_status || null,
          active: patientData.active ?? true,  // Default to active if null
          total_sessions: medical?.total_sessions_planned || 0,
          completed_sessions: completedSessions,
          last_session_date: lastSession || null,
          adherence_percentage: medical?.total_sessions_planned 
            ? Math.round((completedSessions / medical.total_sessions_planned) * 100)
            : 0
        }

        setPatient(profileData)
      } catch (err) {
        console.error('Error fetching patient profile:', err)
        setError('Failed to load patient profile')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPatientProfile()
  }, [patientId])

  // Load patient notes when the notes tab is active
  useEffect(() => {
    if (activeTab === 'notes' && patientId) {
      loadPatientNotes()
    }
  }, [activeTab, patientId])

  const loadPatientNotes = async () => {
    if (!patientId) return
    try {
      const notes = await getPatientRelatedNotes(patientId)
      setPatientNotes(notes || [])
    } catch (err) {
      console.error('Error loading patient notes:', err)
    }
  }

  const handleNotesChanged = () => {
    // Reload notes after changes
    loadPatientNotes()
  }

  const handleEditNote = (note: any) => {
    setNoteToEdit(note)
    setModalMode('edit')
    setIsNotesModalOpen(true)
  }

  const handleAddNote = () => {
    setNoteToEdit(null)
    setModalMode('create')
    setIsNotesModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsNotesModalOpen(false)
    setModalMode('list')
    setNoteToEdit(null)
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ? Cette action ne peut pas être annulée.')) {
      return
    }
    
    setDeletingNoteId(noteId)
    try {
      await deleteNote(noteId)
      await loadPatientNotes() // Refresh the list
    } catch (err) {
      console.error('Error deleting note:', err)
      alert('Erreur lors de la suppression de la note')
    } finally {
      setDeletingNoteId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-sm text-muted-foreground">Loading patient profile...</p>
        </div>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to load patient profile</h3>
              <p className="text-muted-foreground mb-4">{error || 'Patient not found'}</p>
              <Button onClick={() => navigate('/dashboard', { state: { activeTab: 'patients' } })}>
                Return to Patient List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const age = calculateAge(patient.date_of_birth)
  const displayName = patient.first_name && patient.last_name 
    ? `${patient.first_name} ${patient.last_name}`
    : patient.patient_code
  const initials = patient.first_name && patient.last_name
    ? `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase()
    : patient.patient_code.substring(0, 2).toUpperCase()
  const avatarColor = getAvatarColor(displayName)

  // Calculate treatment metrics
  const totalPrescribedSessions = patient.total_sessions || 0
  const completedSessionsCount = patient.completed_sessions || 0
  const adherencePercentage = patient.adherence_percentage || 0
  const averagePerformance = patient.average_performance || 0

  const getAdherenceStatus = (percentage: number): string => {
    if (percentage >= 80) return 'High'
    if (percentage >= 50) return 'Medium'
    if (percentage > 0) return 'Low'
    return 'N/A'
  }

  const getComplianceStatus = (score: number): string => {
    if (score >= 85) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score > 0) return 'Fair'
    return 'N/A'
  }

  // Calculate missed sessions based on expected vs completed
  const expectedSessions = Math.min(
    totalPrescribedSessions,
    patient.active ? Math.floor((Date.now() - new Date(patient.admission_date || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 7)) : totalPrescribedSessions
  )
  const missedSessions = Math.max(0, expectedSessions - completedSessionsCount)

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard', { state: { activeTab: 'patients' } })}
          className="p-0 h-auto font-normal hover:text-foreground transition-colors font-medium"
        >
          All Patients
        </Button>
        <ChevronRightIcon className="h-4 w-4" />
        <span className="text-foreground font-medium">{displayName}</span>
      </nav>

      {/* Patient Header */}
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <div className="flex items-center space-x-4 mx-auto sm:mx-0">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarFallback 
              className={`${avatarColor} text-white text-lg font-semibold flex items-center justify-center h-full w-full`}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold md:text-3xl mb-1">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {patient.active ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100 border-green-300 dark:border-green-600">
                  Active
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100 border-red-300 dark:border-red-600">
                  Inactive
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                ID: {patient.patient_code}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Demographics Card */}
        <Card className="overflow-hidden h-full flex flex-col relative">
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10">
            <Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </Button>
          <CardHeader className="pb-3 pr-12">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <PersonIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base font-semibold">Demographics</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Age</span>
                <span className="text-sm font-semibold text-gray-900">
                  {age ? `${age} years` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Gender</span>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {patient.gender?.replace('_', ' ') || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Room</span>
                <span className="text-sm font-semibold text-gray-900">
                  {patient.room_number || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Admission</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatDate(patient.admission_date)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Info Card */}
        <Card className="overflow-hidden h-full flex flex-col relative">
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10">
            <Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </Button>
          <CardHeader className="pb-3 pr-12">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <HeartIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base font-semibold">Medical Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Diagnosis</span>
                <span className="text-sm font-semibold text-right max-w-[65%] truncate" title={patient.primary_diagnosis || 'N/A'}>
                  {patient.primary_diagnosis || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Mobility</span>
                <span className="text-sm font-semibold text-gray-900">
                  {getMobilityStatus(patient.mobility_status)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">BMI</span>
                  <InfoCircledIcon className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
                </div>
                {patient.bmi_value ? (
                  <Badge variant="outline" className={`font-medium ${
                    patient.bmi_status === 'normal' ? 'bg-green-100 text-green-800 border-green-300' :
                    patient.bmi_status === 'underweight' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    patient.bmi_status === 'overweight' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-red-100 text-red-800 border-red-300'
                  }`}>
                    {patient.bmi_value.toFixed(1)} kg/m²
                  </Badge>
                ) : (
                  <span className="text-sm font-semibold text-gray-900">N/A</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Cognitive</span>
                  <InfoCircledIcon className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
                </div>
                <Badge variant="outline" className={`font-medium capitalize ${
                  patient.cognitive_status === 'alert' ? 'bg-green-100 text-green-800 border-green-300' :
                  patient.cognitive_status === 'confused' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                  patient.cognitive_status === 'impaired' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                  patient.cognitive_status === 'unresponsive' ? 'bg-red-100 text-red-800 border-red-300' :
                  'bg-gray-100 text-gray-800 border-gray-300'
                }`}>
                  {patient.cognitive_status || 'N/A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treatment Summary Card */}
        <Card className="overflow-hidden h-full flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <ActivityLogIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base font-semibold">Treatment Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Sessions</span>
                <span className="text-sm font-semibold text-gray-900">
                  {completedSessionsCount} / {totalPrescribedSessions} completed
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Last Session</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatDate(patient.last_session_date)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Compliance</span>
                <StatusBadge status={getComplianceStatus(averagePerformance)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Adherence</span>
                <StatusBadge status={getAdherenceStatus(adherencePercentage)} />
              </div>
              {missedSessions > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-3 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Missed Sessions</span>
                    <span className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                      {missedSessions} in last 7 days
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="border-l border-r border-b border-blue-500 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="border-b mb-4 relative">
          <TabsList className="w-full flex justify-between border border-primary">
            <TabsTrigger value="sessions" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>Sessions</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <BarChartIcon className="h-4 w-4" />
                <span>Progress</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                <span>Notes</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardContent className="p-6">
              <PatientSessionBrowser 
                patientCode={patient.patient_code}
                // No onFileSelect prop - component will handle analysis internally
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tracking Tab */}
        <TabsContent value="progress">
          <Card>
            <CardContent className="p-6">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-12">
                <div className="text-center">
                  <BarChartIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Progress Analytics</h4>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Visualize patient progress over time with charts, metrics, and trend analysis. 
                    Monitor improvement in strength, endurance, and compliance.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Badge variant="outline">Charts</Badge>
                    <Badge variant="outline">Trends</Badge>
                    <Badge variant="outline">Analytics</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clinical Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <FileTextIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Clinical Notes</h2>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddNote} 
                        className="border-teal-400 text-teal-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-500">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              
              {patientNotes.length > 0 ? (
                <div className="space-y-4">
                  {patientNotes.map((note: any) => (
                    <div key={note.id} className="group relative rounded-xl border border-gray-200/80 bg-white/50 backdrop-blur-sm hover:border-gray-300/80 hover:bg-white/80 hover:shadow-lg transition-all duration-200 ease-in-out">
                      {/* Header Section avec hiérarchie visuelle améliorée */}
                      <div className="p-6 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 truncate leading-tight">
                                {note.title}
                              </h3>
                              <Badge 
                                variant="outline" 
                                className={`shrink-0 font-medium text-xs px-2 py-0.5 ${
                                  note.note_type === 'patient' 
                                    ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                                }`}
                              >
                                {note.note_type === 'patient' ? 'Patient' : 'Session'}
                              </Badge>
                            </div>
                            
                            {/* Métadonnées condensées et élégantes */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                              <time className="flex items-center gap-1.5 font-medium">
                                <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                                {new Date(note.created_at).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })} • {new Date(note.created_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </time>
                              
                              {note.updated_at && note.updated_at !== note.created_at && (
                                <span className="flex items-center gap-1.5 text-orange-600">
                                  <ClockIcon className="h-3.5 w-3.5" />
                                  Modifié {new Date(note.updated_at).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </span>
                              )}
                              
                              {note.file_path && (
                                <span className="flex items-center gap-1.5 text-blue-600">
                                  <FileIcon className="h-3.5 w-3.5" />
                                  {note.file_path.split('/').pop()?.replace('.c3d', '') || 'Session'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions boutons repositionnés et stylisés */}
                          <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditNote(note)}
                              className="h-8 px-3 text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 transition-colors"
                            >
                              <Pencil1Icon className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={deletingNoteId === note.id}
                              className="h-8 px-3 text-slate-600 hover:text-red-700 hover:bg-red-50/80 transition-colors disabled:opacity-50"
                            >
                              {deletingNoteId === note.id ? (
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-red-600 border-t-transparent rounded-full" />
                              ) : (
                                <TrashIcon className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Contenu principal avec meilleure lisibilité */}
                      <div className="px-6 pb-6">
                        <div 
                          className="prose prose-sm max-w-none text-gray-700 leading-relaxed
                                   prose-headings:text-gray-900 prose-headings:font-semibold
                                   prose-p:mb-3 prose-ul:mb-3 prose-ol:mb-3
                                   prose-li:mb-1 prose-strong:text-gray-900"
                          dangerouslySetInnerHTML={{ __html: note.content }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Notes Yet</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Start documenting patient progress by adding clinical notes.
                  </p>
                  <Button variant="outline" onClick={handleAddNote} 
                          className="border-teal-400 text-teal-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-500">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add First Note
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Clinical Notes Modal */}
      {patient && (
        <ClinicalNotesModal
          isOpen={isNotesModalOpen}
          onClose={handleCloseModal}
          noteType="patient"
          targetId={patient.patient_code}
          targetDisplayName={displayName}
          existingNotes={patientNotes}
          onNotesChanged={handleNotesChanged}
          initialMode={modalMode}
          initialNoteToEdit={noteToEdit}
        />
      )}
    </div>
  )
}