import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ClinicalNotesModal } from '../../shared/ClinicalNotesModal'
import { useClinicalNotes } from '../../../hooks/useClinicalNotes'
import PatientSessionBrowser from './PatientSessionBrowser'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Separator } from '../../ui/separator'
import Spinner from '../../ui/Spinner'
import {
  ArrowLeftIcon as ArrowLeft,
  UserIcon as User,
  CalendarIcon as Calendar,
  ActivityIcon as Activity,
  FileTextIcon as FileText,
  BarChartIcon as ChartBar,
  ClockIcon as Clock,
  TargetIcon as Target,
  TrendingUpIcon as TrendingUp,
  AlertCircleIcon as AlertCircle,
  CheckCircle2Icon as CheckCircle2,
  XCircleIcon as XCircle,
  BarChart3Icon as BarChart3,
  BrainIcon as Brain,
  HeartIcon as Heart,
  FootprintsIcon as Footprints,
  PillIcon as Pill,
  HomeIcon as Home,
  MapPinIcon as MapPin,
  PhoneIcon as Phone,
  MailIcon as Mail,
  CalendarDaysIcon as CalendarDays,
  TimerIcon as Timer,
  ZapIcon as Zap,
  MessageSquareIcon as MessageSquare,
  EditIcon as Edit,
  PlusIcon as Plus
} from 'lucide-react'

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
  patient_status: 'active' | 'dropped_out' | 'completed' | 'on_hold'
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
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Get status badge variant
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'active': return 'default'
    case 'completed': return 'secondary'
    case 'on_hold': return 'outline'
    case 'dropped_out': return 'destructive'
    default: return 'outline'
  }
}

// Get mobility icon
function getMobilityIcon(status: string | null) {
  switch (status) {
    case 'ambulatory': return <Footprints className="h-4 w-4" />
    case 'wheelchair': return <Heart className="h-4 w-4" />
    case 'bed_rest': return <Home className="h-4 w-4" />
    case 'assisted': return <Activity className="h-4 w-4" />
    default: return <User className="h-4 w-4" />
  }
}

// Get cognitive status color
function getCognitiveStatusColor(status: string | null): string {
  switch (status) {
    case 'alert': return 'text-green-600'
    case 'confused': return 'text-amber-600'
    case 'impaired': return 'text-orange-600'
    case 'unresponsive': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

// Get BMI status color
function getBMIStatusColor(status: string | null): string {
  switch (status) {
    case 'normal': return 'text-green-600'
    case 'underweight': return 'text-blue-600'
    case 'overweight': return 'text-amber-600'
    case 'obese': return 'text-red-600'
    default: return 'text-gray-600'
  }
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
  
  const { getPatientNotes } = useClinicalNotes()

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
              patient_status,
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
          patient_status: medical?.patient_status || 'active',
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
      const notes = await getPatientNotes(patientId)
      setPatientNotes(notes || [])
    } catch (err) {
      console.error('Error loading patient notes:', err)
    }
  }

  const handleNotesChanged = () => {
    // Reload notes after changes
    loadPatientNotes()
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
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header Navigation */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard', { state: { activeTab: 'patients' } })}
              className="p-0 h-auto font-normal hover:text-foreground"
            >
              Patients
            </Button>
            <span>/</span>
            <span className="text-foreground font-medium">{displayName}</span>
          </div>
        </div>

        {/* Patient Header Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className={`${avatarColor} text-white text-2xl font-bold`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold">{displayName}</h1>
                    <Badge variant={getStatusVariant(patient.patient_status)}>
                      {patient.patient_status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>ID: {patient.patient_code}</span>
                    </div>
                    {age && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{age} years old</span>
                      </div>
                    )}
                    {patient.gender && patient.gender !== 'not_specified' && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span className="capitalize">{patient.gender.replace('_', ' ')}</span>
                      </div>
                    )}
                    {patient.room_number && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>Room {patient.room_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:ml-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {patient.completed_sessions}/{patient.total_sessions}
                  </div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {patient.adherence_percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">Adherence</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {patient.average_performance || 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Score</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">
                    {patient.last_session_date ? formatDate(patient.last_session_date) : 'Never'}
                  </div>
                  <div className="text-xs text-muted-foreground">Last Session</div>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Medical Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Diagnosis & Condition */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Medical Information</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Heart className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Primary Diagnosis</div>
                      <div className="text-sm text-muted-foreground">
                        {patient.primary_diagnosis || 'Not specified'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {getMobilityIcon(patient.mobility_status)}
                    <div>
                      <div className="text-sm font-medium">Mobility Status</div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {patient.mobility_status?.replace('_', ' ') || 'Not specified'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Cognitive Status</div>
                      <div className={`text-sm capitalize ${getCognitiveStatusColor(patient.cognitive_status)}`}>
                        {patient.cognitive_status || 'Not specified'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Metrics */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Physical Metrics</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">BMI</div>
                      <div className="text-sm">
                        {patient.bmi_value ? (
                          <>
                            <span className="font-medium">{patient.bmi_value.toFixed(1)}</span>
                            <span className={`ml-2 ${getBMIStatusColor(patient.bmi_status)}`}>
                              ({patient.bmi_status})
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not recorded</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Admission Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(patient.admission_date)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Treatment Plan */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Treatment Plan</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Total Sessions Planned</div>
                      <div className="text-sm text-muted-foreground">{patient.total_sessions} sessions</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <div>
                      <div className="text-sm font-medium">Sessions Completed</div>
                      <div className="text-sm text-muted-foreground">{patient.completed_sessions} sessions</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 mt-0.5 text-blue-600" />
                    <div>
                      <div className="text-sm font-medium">Progress</div>
                      <div className="text-sm">
                        <span className="font-medium">{patient.adherence_percentage}%</span>
                        <span className="text-muted-foreground ml-1">adherence rate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Card>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
                <TabsTrigger value="sessions" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="progress" className="flex items-center gap-2">
                  <ChartBar className="h-4 w-4" />
                  Progress Tracking
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Clinical Notes
                </TabsTrigger>
              </TabsList>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Session History</h3>
                    <div className="text-sm text-muted-foreground">
                      Showing C3D files for patient {patient.patient_code}
                    </div>
                  </div>
                  
                  {/* Patient-filtered C3D File Browser */}
                  <PatientSessionBrowser 
                    patientCode={patient.patient_code}
                    onFileSelect={(filename) => {
                      // Handle file selection - could navigate to analysis view
                      console.log('Selected file:', filename)
                    }}
                  />
                </div>
              </TabsContent>

              {/* Progress Tracking Tab */}
              <TabsContent value="progress" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Progress Overview</h3>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                  
                  {/* Placeholder for Progress Tracking */}
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-12">
                    <div className="text-center">
                      <ChartBar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Progress Tracking</h4>
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
                </div>
              </TabsContent>

              {/* Clinical Notes Tab */}
              <TabsContent value="notes" className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Clinical Notes</h3>
                    <Button size="sm" onClick={() => setIsNotesModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                  
                  {/* Display existing notes or placeholder */}
                  {patientNotes.length > 0 ? (
                    <div className="space-y-4">
                      {patientNotes.map((note: any) => (
                        <Card key={note.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm text-muted-foreground mb-2">
                                  {new Date(note.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                <div className="prose prose-sm max-w-none" 
                                     dangerouslySetInnerHTML={{ __html: note.content }} />
                              </div>
                              <Badge variant="outline" className="ml-4">
                                {note.note_type}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-12">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No Clinical Notes Yet</h4>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          Document clinical observations, treatment adjustments, and patient feedback. 
                          Click "Add Note" to create your first note.
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                          <Badge variant="outline">SOAP Notes</Badge>
                          <Badge variant="outline">Observations</Badge>
                          <Badge variant="outline">Plans</Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Clinical Notes Modal */}
      {patient && (
        <ClinicalNotesModal
          isOpen={isNotesModalOpen}
          onClose={() => setIsNotesModalOpen(false)}
          noteType="patient"
          targetId={patient.patient_code}
          targetDisplayName={displayName}
          existingNotes={patientNotes}
          onNotesChanged={handleNotesChanged}
        />
      )}
    </div>
  )
}