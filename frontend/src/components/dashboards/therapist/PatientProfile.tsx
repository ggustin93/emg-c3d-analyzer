import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ClinicalNotesModal } from '../../shared/ClinicalNotesModal'
import { useClinicalNotes } from '../../../hooks/useClinicalNotes'
import { fetchMultiplePatientAdherence } from '../../../services/adherenceService'
import C3DSessionsService from '../../../services/c3dSessionsService'
import { getMuscleConfiguration, type MuscleConfiguration } from '../../../services/trialConfigurationService'
import PatientSessionBrowser from './PatientSessionBrowser'
import PatientProgressCharts from './PatientProgressCharts'
import { getAvatarColor, getPatientIdentifier, getPatientAvatarInitials } from '../../../lib/avatarColors'
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
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { useToast } from '../../../hooks/use-toast'
import { API_CONFIG } from '../../../config/apiConfig'
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
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DashIcon
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
  height_cm: number | null  // Height in centimeters for BMI calculation
  weight_kg: number | null  // Weight in kilograms for BMI calculation
  bmi_value: number | null  // Auto-calculated BMI (kg/m²)
  bmi_status: 'underweight' | 'normal' | 'overweight' | 'obese' | null
  cognitive_status: 'alert' | 'confused' | 'impaired' | 'unresponsive' | null
  // Treatment targets (from patients table)
  current_mvc75_ch1: number | null  // Current MVC 75% target for channel 1
  current_mvc75_ch2: number | null  // Current MVC 75% target for channel 2
  current_target_ch1_ms: number | null  // Current target duration for channel 1 (ms)
  current_target_ch2_ms: number | null  // Current target duration for channel 2 (ms)
  bfr_target_lop_percentage_ch1: number | null  // BFR target LOP percentage for channel 1
  bfr_target_lop_percentage_ch2: number | null  // BFR target LOP percentage for channel 2
  active: boolean  // Simple active/inactive status for clinical trial
  therapist_name?: string
  total_sessions: number
  completed_sessions: number
  last_session_date: string | null
  next_session_date?: string | null
  adherence_percentage?: number
  clinical_threshold?: string
  average_performance?: number
}

// Avatar functions are now imported from centralized lib/avatarColors.ts

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
  const { toast } = useToast()
  const [session, setSession] = useState<any>(null)
  const [patient, setPatient] = useState<PatientProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('medical-info')
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [patientNotes, setPatientNotes] = useState<any[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'list' | 'create' | 'edit'>('list')
  const [noteToEdit, setNoteToEdit] = useState<any>(null)
  const [adherenceData, setAdherenceData] = useState<any[]>([])
  const [adherenceLoading, setAdherenceLoading] = useState(false)
  
  // Medical info editing states
  const [showEditDemographics, setShowEditDemographics] = useState(false)
  const [showEditMedicalInfo, setShowEditMedicalInfo] = useState(false)
  const [showEditTreatmentTargets, setShowEditTreatmentTargets] = useState(false)
  const [editingDemographics, setEditingDemographics] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: 'not_specified' as 'male' | 'female' | 'non_binary' | 'not_specified',
    room_number: '',
    admission_date: ''
  })
  const [editingMedicalInfo, setEditingMedicalInfo] = useState({
    primary_diagnosis: '',
    mobility_status: 'ambulatory' as 'ambulatory' | 'bed_rest' | 'wheelchair' | 'assisted',
    height_cm: '',
    weight_kg: '',
    bmi_value: '',
    bmi_status: 'normal' as 'underweight' | 'normal' | 'overweight' | 'obese',
    cognitive_status: 'alert' as 'alert' | 'confused' | 'impaired' | 'unresponsive',
    // Treatment targets are in patients table, not editable through this modal
  })
  const [editingTreatmentTargets, setEditingTreatmentTargets] = useState({
    current_mvc75_ch1: '',
    current_mvc75_ch2: '',
    current_target_ch1_ms: '',
    current_target_ch2_ms: '',
    bfr_target_lop_percentage_ch1: '',
    bfr_target_lop_percentage_ch2: ''
  })
  const [saving, setSaving] = useState(false)
  const [muscleConfig, setMuscleConfig] = useState<MuscleConfiguration>({
    channel_1_muscle_name: '{muscleConfig.channel_1_muscle_name}',
    channel_2_muscle_name: '{muscleConfig.channel_2_muscle_name}'
  })
  
  const { getPatientRelatedNotes, updateNote, deleteNote } = useClinicalNotes()

  useEffect(() => {
    if (!patientId) return

    const fetchPatientProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch patient data
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select(`
            id,
            patient_code,
            therapist_id,
            created_at,
            active,
            total_sessions_planned,
            treatment_start_date,
            current_mvc75_ch1,
            current_mvc75_ch2,
            current_target_ch1_ms,
            current_target_ch2_ms,
            bfr_target_lop_percentage_ch1,
            bfr_target_lop_percentage_ch2
          `)
          .eq('patient_code', patientId)
          .single()
        
        if (patientError) throw patientError

        // Fetch medical info separately
        const { data: medicalData, error: medicalError } = await supabase
          .from('patient_medical_info')
          .select(`
            first_name,
            last_name,
            date_of_birth,
            gender,
            room_number,
            admission_date,
            primary_diagnosis,
            mobility_status,
            height_cm,
            weight_kg,
            bmi_value,
            bmi_status,
            cognitive_status
          `)
          .eq('patient_id', patientData.id)
          .single()

        if (medicalError) {
          console.warn('Medical info query error (continuing without):', medicalError)
        }

        // Use the separate medical data
        const medical = medicalData

        // Get accurate session data from C3D files (same pattern as PatientManagement)
        let sessionData: { session_count: number; last_session: string | null } = { session_count: 0, last_session: null }
        try {
          const patientSessionData = await C3DSessionsService.getPatientSessionData([patientId])
          if (patientSessionData.length > 0) {
            sessionData = {
              session_count: patientSessionData[0].session_count,
              last_session: patientSessionData[0].last_session
            }
          }
        } catch (error) {
          console.error('Error fetching C3D session data:', error)
          // Continue with zero sessions if C3D service fails
        }

        // Fetch adherence data with session counts (same pattern as PatientManagement)
        setAdherenceLoading(true)
        try {
          const sessionCountsMap = new Map([[patientId, sessionData.session_count]])
          const adherenceResults = await fetchMultiplePatientAdherence([patientId], sessionCountsMap)
          setAdherenceData(adherenceResults)
        } catch (error) {
          console.error('Error fetching adherence data:', error)
          setAdherenceData([])
        } finally {
          setAdherenceLoading(false)
        }

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
          height_cm: medical?.height_cm || null,
          weight_kg: medical?.weight_kg || null,
          bmi_value: medical?.bmi_value || null,
          bmi_status: medical?.bmi_status || null,
          cognitive_status: medical?.cognitive_status || null,
          current_mvc75_ch1: patientData.current_mvc75_ch1 || null,
          current_mvc75_ch2: patientData.current_mvc75_ch2 || null,
          current_target_ch1_ms: patientData.current_target_ch1_ms || null,
          current_target_ch2_ms: patientData.current_target_ch2_ms || null,
          bfr_target_lop_percentage_ch1: patientData.bfr_target_lop_percentage_ch1 || null,
          bfr_target_lop_percentage_ch2: patientData.bfr_target_lop_percentage_ch2 || null,
          active: patientData.active ?? true,  // Default to active if null
          total_sessions: patientData.total_sessions_planned || 0,
          completed_sessions: sessionData.session_count,  // Use C3D session count (same as PatientManagement)
          last_session_date: sessionData.last_session,
          adherence_percentage: 0,  // Will be calculated in render using adherence lookup
          clinical_threshold: 'Unknown'  // Will be calculated in render using adherence lookup
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
  }, [patientId]) // Simple dependency on patientId only

  // Load muscle configuration
  useEffect(() => {
    const loadMuscleConfiguration = async () => {
      try {
        const config = await getMuscleConfiguration()
        setMuscleConfig(config)
      } catch (error) {
        console.error('Failed to load muscle configuration:', error)
        // Keep default values if loading fails
      }
    }

    loadMuscleConfiguration()
  }, [])

  // Get session for API calls
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
    }
    getSession()
  }, [])

  // Load patient notes when the notes tab is active
  useEffect(() => {
    if (activeTab === 'notes' && patientId) {
      loadPatientNotes()
    }
  }, [activeTab, patientId])

  // Auto-calculate BMI when height or weight changes
  useEffect(() => {
    if (editingMedicalInfo.height_cm && editingMedicalInfo.weight_kg) {
      const height = parseFloat(editingMedicalInfo.height_cm)
      const weight = parseFloat(editingMedicalInfo.weight_kg)
      
      if (height > 0 && weight > 0) {
        const { bmi, status } = calculateBMI(height, weight)
        setEditingMedicalInfo(prev => ({
          ...prev,
          bmi_value: bmi.toString(),
          bmi_status: status as any
        }))
      }
    }
  }, [editingMedicalInfo.height_cm, editingMedicalInfo.weight_kg])

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
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return
    }
    
    setDeletingNoteId(noteId)
    try {
      await deleteNote(noteId)
      await loadPatientNotes() // Refresh the list
    } catch (err) {
      console.error('Error deleting note:', err)
      alert('Error deleting note')
    } finally {
      setDeletingNoteId(null)
    }
  }

  // Medical info editing functions
  const handleEditDemographics = () => {
    if (patient) {
      setEditingDemographics({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        date_of_birth: patient.date_of_birth || '',
        gender: patient.gender || 'not_specified',
        room_number: patient.room_number || '',
        admission_date: patient.admission_date || ''
      })
      setShowEditDemographics(true)
    }
  }

  // Function to calculate BMI from height and weight
  const calculateBMI = (heightCm: number, weightKg: number): { bmi: number; status: string } => {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
      return { bmi: 0, status: 'normal' }
    }
    
    const heightM = heightCm / 100
    const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10 // Round to 1 decimal place
    
    let status: string
    if (bmi < 18.5) {
      status = 'underweight'
    } else if (bmi >= 18.5 && bmi < 25) {
      status = 'normal'
    } else if (bmi >= 25 && bmi < 30) {
      status = 'overweight'
    } else {
      status = 'obese'
    }
    
    return { bmi, status }
  }

  const handleEditMedicalInfo = () => {
    if (patient) {
      setEditingMedicalInfo({
        primary_diagnosis: patient.primary_diagnosis || '',
        mobility_status: patient.mobility_status || 'ambulatory',
      height_cm: patient.height_cm?.toString() || '',
      weight_kg: patient.weight_kg?.toString() || '',
      bmi_value: patient.bmi_value?.toString() || '',
      bmi_status: patient.bmi_status || 'normal',
      cognitive_status: patient.cognitive_status || 'alert',
      // Treatment targets are in patients table, not editable through this modal
      })
      setShowEditMedicalInfo(true)
    }
  }

  const handleSaveDemographics = async () => {
    if (!patient?.patient_code) return
    
    setSaving(true)
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/patients/${patient.patient_code}/medical-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editingDemographics,
          // Keep existing medical info
          primary_diagnosis: patient.primary_diagnosis,
          mobility_status: patient.mobility_status,
          bmi_value: patient.bmi_value,
          bmi_status: patient.bmi_status,
          cognitive_status: patient.cognitive_status
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update demographics')
      }

      toast({
        title: 'Demographics Updated',
        description: 'Patient demographics have been updated successfully.',
        variant: 'success'
      })

      setShowEditDemographics(false)
      // Refresh patient data by re-running the useEffect
      window.location.reload()
    } catch (error) {
      console.error('Error updating demographics:', error)
      toast({
        title: 'Update Failed',
        description: 'Failed to update patient demographics. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMedicalInfo = async () => {
    if (!patient?.patient_code) return
    
    setSaving(true)
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/patients/${patient.patient_code}/medical-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Keep existing demographics
          first_name: patient.first_name,
          last_name: patient.last_name,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender,
          room_number: patient.room_number,
          admission_date: patient.admission_date,
          ...editingMedicalInfo,
          height_cm: editingMedicalInfo.height_cm ? parseFloat(editingMedicalInfo.height_cm) : null,
          weight_kg: editingMedicalInfo.weight_kg ? parseFloat(editingMedicalInfo.weight_kg) : null,
          bmi_value: editingMedicalInfo.bmi_value ? parseFloat(editingMedicalInfo.bmi_value) : null,
          // Note: Treatment targets are in patients table, not patient_medical_info
          // They will be updated separately if needed
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update medical info')
      }

      toast({
        title: 'Medical Info Updated',
        description: 'Patient medical information has been updated successfully.',
        variant: 'success'
      })

      setShowEditMedicalInfo(false)
      // Refresh patient data by re-running the useEffect
      window.location.reload()
    } catch (error) {
      console.error('Error updating medical info:', error)
      toast({
        title: 'Update Failed',
        description: 'Failed to update patient medical information. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditTreatmentTargets = () => {
    if (patient) {
      setEditingTreatmentTargets({
        current_mvc75_ch1: patient.current_mvc75_ch1?.toString() || '',
        current_mvc75_ch2: patient.current_mvc75_ch2?.toString() || '',
        current_target_ch1_ms: patient.current_target_ch1_ms?.toString() || '',
        current_target_ch2_ms: patient.current_target_ch2_ms?.toString() || '',
        bfr_target_lop_percentage_ch1: patient.bfr_target_lop_percentage_ch1?.toString() || '',
        bfr_target_lop_percentage_ch2: patient.bfr_target_lop_percentage_ch2?.toString() || ''
      })
      setShowEditTreatmentTargets(true)
    }
  }

  const handleSaveTreatmentTargets = async () => {
    if (!patient?.patient_code) return
    
    setSaving(true)
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/patients/${patient.patient_code}/treatment-targets`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_mvc75_ch1: editingTreatmentTargets.current_mvc75_ch1 ? parseFloat(editingTreatmentTargets.current_mvc75_ch1) : null,
          current_mvc75_ch2: editingTreatmentTargets.current_mvc75_ch2 ? parseFloat(editingTreatmentTargets.current_mvc75_ch2) : null,
          current_target_ch1_ms: editingTreatmentTargets.current_target_ch1_ms ? parseFloat(editingTreatmentTargets.current_target_ch1_ms) * 1000 : null, // Convert seconds to milliseconds
          current_target_ch2_ms: editingTreatmentTargets.current_target_ch2_ms ? parseFloat(editingTreatmentTargets.current_target_ch2_ms) * 1000 : null,
          bfr_target_lop_percentage_ch1: editingTreatmentTargets.bfr_target_lop_percentage_ch1 ? parseFloat(editingTreatmentTargets.bfr_target_lop_percentage_ch1) : null,
          bfr_target_lop_percentage_ch2: editingTreatmentTargets.bfr_target_lop_percentage_ch2 ? parseFloat(editingTreatmentTargets.bfr_target_lop_percentage_ch2) : null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update treatment targets')
      }

      toast({
        title: 'Treatment Targets Updated',
        description: 'Patient treatment targets have been updated successfully.',
        variant: 'success'
      })

      setShowEditTreatmentTargets(false)
      // Refresh patient data by re-running the useEffect
      window.location.reload()
    } catch (error) {
      console.error('Error updating treatment targets:', error)
      toast({
        title: 'Update Failed',
        description: 'Failed to update patient treatment targets. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
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
  const initials = getPatientAvatarInitials(patient.first_name, patient.last_name, patient.patient_code)
  const avatarColor = getAvatarColor(getPatientIdentifier(patient))

  // Get adherence data from centralized service (exact PatientManagement pattern)
  const patientAdherence = adherenceData.find(a => a.patient_id === patient.patient_code)

  // Calculate treatment metrics
  const totalPrescribedSessions = patient.total_sessions || 0
  const completedSessionsCount = patient.completed_sessions || 0
  const adherencePercentage = patientAdherence?.adherence_score || 0
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
          className="p-0 h-auto hover:text-foreground transition-colors font-medium"
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


      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="border-l border-r border-b border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="border-b mb-4 relative">
          <TabsList className="w-full flex justify-between border border-gray-200">
            <TabsTrigger value="medical-info" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <HeartIcon className="h-4 w-4" />
                <span>Medical Info</span>
              </div>
            </TabsTrigger>
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

        {/* Medical Info Tab */}
        <TabsContent value="medical-info">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-2">
            {/* Demographics Card */}
            <Card className="overflow-hidden h-full flex flex-col relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                onClick={handleEditDemographics}
              >
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
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                onClick={handleEditMedicalInfo}
              >
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
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge variant="outline" className={`font-medium ${
                          patient.bmi_status === 'normal' ? 'bg-green-100 text-green-800 border-green-300' :
                          patient.bmi_status === 'underweight' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          patient.bmi_status === 'overweight' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                          'bg-red-100 text-red-800 border-red-300'
                        }`}>
                          {patient.bmi_value.toFixed(1)} kg/m²
                        </Badge>
                        {(patient.height_cm && patient.weight_kg) && (
                          <span className="text-xs text-muted-foreground">
                            Auto-calculated
                          </span>
                        )}
                      </div>
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

            {/* Treatment Targets Card */}
            <Card className="overflow-hidden h-full flex flex-col relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                onClick={handleEditTreatmentTargets}
              >
                <Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
              <CardHeader className="pb-3 pr-12">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChartIcon className="h-5 w-5 text-blue-600" />
                  Treatment Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MVC Targets */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700 border-b pb-1">MVC 75% Targets</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_1_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.current_mvc75_ch1 ? `${patient.current_mvc75_ch1}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_2_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.current_mvc75_ch2 ? `${patient.current_mvc75_ch2}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* BFR Targets */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700 border-b pb-1">BFR LOP Targets</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_1_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.bfr_target_lop_percentage_ch1 ? `${patient.bfr_target_lop_percentage_ch1}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_2_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.bfr_target_lop_percentage_ch2 ? `${patient.bfr_target_lop_percentage_ch2}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Duration Targets */}
                <div className="space-y-3 pt-2 border-t">
                  <h4 className="font-medium text-sm text-gray-700">Duration Targets</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_1_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.current_target_ch1_ms ? `${(patient.current_target_ch1_ms / 1000).toFixed(1)}s` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{muscleConfig.channel_2_muscle_name}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {patient.current_target_ch2_ms ? `${(patient.current_target_ch2_ms / 1000).toFixed(1)}s` : 'N/A'}
                      </span>
                    </div>
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
                      {patient.last_session_date ? formatDate(patient.last_session_date) : 'No sessions'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Performance Trend</span>
                    <div className="flex flex-col items-end gap-0.5">
                      {/* TODO: Performance trend will be calculated in background processing */}
                      <span className="text-sm font-semibold text-gray-500">TBD</span>
                      <span className="text-xs text-gray-500">Calculating...</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Adherence</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {adherencePercentage > 0 ? `${Math.round(adherencePercentage)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
          <PatientProgressCharts 
            completedSessions={patient?.completed_sessions || 0}
            totalSessions={patient?.total_sessions || 8}
            patientCode={patient?.patient_code || 'DEMO'}
          />
        </TabsContent>

        {/* Clinical Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-end">
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

      {/* Edit Demographics Dialog */}
      <Dialog open={showEditDemographics} onOpenChange={setShowEditDemographics}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Demographics</DialogTitle>
            <DialogDescription>
              Update patient demographic information
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="first_name" className="text-right">First Name</Label>
              <Input
                id="first_name"
                value={editingDemographics.first_name}
                onChange={(e) => setEditingDemographics(prev => ({ ...prev, first_name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="last_name" className="text-right">Last Name</Label>
              <Input
                id="last_name"
                value={editingDemographics.last_name}
                onChange={(e) => setEditingDemographics(prev => ({ ...prev, last_name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date_of_birth" className="text-right">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={editingDemographics.date_of_birth}
                onChange={(e) => setEditingDemographics(prev => ({ ...prev, date_of_birth: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="gender" className="text-right">Gender</Label>
              <Select 
                value={editingDemographics.gender} 
                onValueChange={(value: any) => setEditingDemographics(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-binary</SelectItem>
                  <SelectItem value="not_specified">Not specified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="room_number" className="text-right">Room Number</Label>
              <Input
                id="room_number"
                value={editingDemographics.room_number}
                onChange={(e) => setEditingDemographics(prev => ({ ...prev, room_number: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="admission_date" className="text-right">Admission Date</Label>
              <Input
                id="admission_date"
                type="date"
                value={editingDemographics.admission_date}
                onChange={(e) => setEditingDemographics(prev => ({ ...prev, admission_date: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDemographics(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDemographics} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Medical Info Dialog */}
      <Dialog open={showEditMedicalInfo} onOpenChange={setShowEditMedicalInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Medical Information</DialogTitle>
            <DialogDescription>
              Update patient medical information. Height and weight are used for automatic BMI calculation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primary_diagnosis" className="text-right">Primary Diagnosis</Label>
              <Input
                id="primary_diagnosis"
                value={editingMedicalInfo.primary_diagnosis}
                onChange={(e) => setEditingMedicalInfo(prev => ({ ...prev, primary_diagnosis: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="height_cm" className="text-right">Height (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                step="0.1"
                min="50"
                max="250"
                value={editingMedicalInfo.height_cm}
                onChange={(e) => setEditingMedicalInfo(prev => ({ ...prev, height_cm: e.target.value }))}
                className="col-span-3"
                placeholder="e.g., 175.5"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="weight_kg" className="text-right">Weight (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={editingMedicalInfo.weight_kg}
                onChange={(e) => setEditingMedicalInfo(prev => ({ ...prev, weight_kg: e.target.value }))}
                className="col-span-3"
                placeholder="e.g., 70.2"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="mobility_status" className="text-right">Mobility Status</Label>
              <Select 
                value={editingMedicalInfo.mobility_status} 
                onValueChange={(value: any) => setEditingMedicalInfo(prev => ({ ...prev, mobility_status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambulatory">Ambulatory</SelectItem>
                  <SelectItem value="bed_rest">Bed Rest</SelectItem>
                  <SelectItem value="wheelchair">Wheelchair</SelectItem>
                  <SelectItem value="assisted">Assisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bmi_value" className="text-right">BMI Value</Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="bmi_value"
                  type="number"
                  step="0.1"
                  value={editingMedicalInfo.bmi_value}
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder="Auto-calculated from height & weight"
                />
                <p className="text-xs text-muted-foreground">
                  BMI is automatically calculated from height and weight. Edit height/weight above to update.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bmi_status" className="text-right">BMI Status</Label>
              <Select 
                value={editingMedicalInfo.bmi_status} 
                onValueChange={(value: any) => setEditingMedicalInfo(prev => ({ ...prev, bmi_status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="underweight">Underweight</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="overweight">Overweight</SelectItem>
                  <SelectItem value="obese">Obese</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cognitive_status" className="text-right">Cognitive Status</Label>
              <Select 
                value={editingMedicalInfo.cognitive_status} 
                onValueChange={(value: any) => setEditingMedicalInfo(prev => ({ ...prev, cognitive_status: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="confused">Confused</SelectItem>
                  <SelectItem value="impaired">Impaired</SelectItem>
                  <SelectItem value="unresponsive">Unresponsive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Note: Treatment Targets are in patients table and require separate API */}
            <div className="border-t pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <InfoCircledIcon className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    <strong>Treatment Targets:</strong> MVC, BFR, and Duration targets are stored in the patient record 
                    and require a separate API endpoint for editing. Currently displayed as read-only information.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditMedicalInfo(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMedicalInfo} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Treatment Targets Dialog */}
      <Dialog open={showEditTreatmentTargets} onOpenChange={setShowEditTreatmentTargets}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Treatment Targets</DialogTitle>
            <DialogDescription>
              Update patient treatment targets for EMG therapy
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* MVC Targets */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700 border-b pb-2">MVC 75% Targets</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="mvc_left" className="text-right">{muscleConfig.channel_1_muscle_name}</Label>
                  <Input
                    id="mvc_left"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingTreatmentTargets.current_mvc75_ch1}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, current_mvc75_ch1: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., 75.0"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="mvc_right" className="text-right">{muscleConfig.channel_2_muscle_name}</Label>
                  <Input
                    id="mvc_right"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingTreatmentTargets.current_mvc75_ch2}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, current_mvc75_ch2: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., 75.0"
                  />
                </div>
              </div>
            </div>

            {/* BFR Targets */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700 border-b pb-2">BFR LOP Targets</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bfr_left" className="text-right">{muscleConfig.channel_1_muscle_name}</Label>
                  <Input
                    id="bfr_left"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingTreatmentTargets.bfr_target_lop_percentage_ch1}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, bfr_target_lop_percentage_ch1: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., 50.0"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="bfr_right" className="text-right">{muscleConfig.channel_2_muscle_name}</Label>
                  <Input
                    id="bfr_right"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingTreatmentTargets.bfr_target_lop_percentage_ch2}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, bfr_target_lop_percentage_ch2: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., 50.0"
                  />
                </div>
              </div>
            </div>

            {/* Duration Targets */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700 border-b pb-2">Duration Targets (seconds)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="duration_left" className="text-right">{muscleConfig.channel_1_muscle_name}</Label>
                  <Input
                    id="duration_left"
                    type="number"
                    step="0.1"
                    min="0"
                    max="60"
                    value={editingTreatmentTargets.current_target_ch1_ms ? (parseFloat(editingTreatmentTargets.current_target_ch1_ms) / 1000).toString() : ''}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, current_target_ch1_ms: (parseFloat(e.target.value) * 1000).toString() }))}
                    className="col-span-3"
                    placeholder="e.g., 5.0"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="duration_right" className="text-right">{muscleConfig.channel_2_muscle_name}</Label>
                  <Input
                    id="duration_right"
                    type="number"
                    step="0.1"
                    min="0"
                    max="60"
                    value={editingTreatmentTargets.current_target_ch2_ms ? (parseFloat(editingTreatmentTargets.current_target_ch2_ms) / 1000).toString() : ''}
                    onChange={(e) => setEditingTreatmentTargets(prev => ({ ...prev, current_target_ch2_ms: (parseFloat(e.target.value) * 1000).toString() }))}
                    className="col-span-3"
                    placeholder="e.g., 5.0"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTreatmentTargets(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTreatmentTargets} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}