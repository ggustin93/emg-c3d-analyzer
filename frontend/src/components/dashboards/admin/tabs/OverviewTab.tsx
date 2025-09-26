/**
 * Overview Tab Component for Admin Dashboard
 * 
 * Purpose: Display system metrics and clinical trial data
 * Architecture: Direct Supabase integration with real-time updates
 * Inspired by TherapistOverview.tsx patterns
 * 
 * UX Improvements:
 * - Removed Trial Config widget (not essential for daily admin tasks)
 * - Removed Quick Actions (redundant with sidebar navigation)
 * - Removed Recent Admin Activity (not relevant for trial admins)
 * - Added Average Adherence and Average Performance metrics
 * - Added Last Sessions widget for recent therapy activity
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { navigateToAnalysis } from '@/utils/navigationUtils'
import { fetchMultiplePatientAdherence, calculateAverageAdherence, type AdherenceData } from '@/services/adherenceService'
import { SupabaseStorageService } from '@/services/supabaseStorage'
import { TherapySessionsService } from '@/services/therapySessionsService'
import { C3DSessionsService } from '@/services/c3dSessionsService'
// import { createMissingPatientMedicalInfo } from '@/services/patientMedicalInfoService'
import { getAvatarColor, getPatientIdentifier, getPatientAvatarInitials } from '@/lib/avatarColors'
import { ENV_CONFIG } from '@/config/environment'

const BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME
import * as Icons from '@radix-ui/react-icons'

interface SystemMetrics {
  totalUsers: number
  usersByRole: {
    admin: number
    therapist: number
    researcher: number
  }
  totalPatients: number
  activePatients: number
  sessionsToday: number
  sessionsThisWeek: number
}

interface RecentC3DFile {
  name: string
  created_at: string
  session_date?: string
  patient: {
    patient_code: string
    display_name: string
    avatar_initials: string
    avatar_color: string
  }
}

interface ClinicalMetrics {
  averageAdherence: number | null
  averagePerformance: number | null
  adherenceSubtitle: string
  performanceSubtitle: string
}

interface RecentUserActivity {
  id: string
  user_id: string
  user_email: string
  user_name: string
  role: string
  last_sign_in_at: string
  avatar_initials: string
  avatar_color: string
}

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  iconColor?: string
  loading?: boolean
  tooltip?: {
    content: string
    subtext?: string
  }
}

// Reusable shimmer CSS class (from TherapistOverview)
const SHIMMER_CLASS = "bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded"

// Enhanced metrics card component (inspired by TherapistOverview)
const MetricCard = React.memo(function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  iconColor = "text-muted-foreground",
  loading = false,
  tooltip
}: MetricCardProps) {
  return (
    <Card className="transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1 border border-gray-200/70 shadow-lg bg-gradient-to-br from-white via-gray-50/20 to-blue-50/10 backdrop-blur-sm">
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/80 shadow-sm ${iconColor.replace('text-', 'text-')}`}>
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-700 tracking-wide">{title}</CardTitle>
          </div>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                    <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-3" side="left">
                  <p className="text-sm font-medium text-gray-900 mb-1">{tooltip.content}</p>
                  {tooltip.subtext && (
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                      {tooltip.subtext}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-5">
        {loading ? (
          <div className="space-y-1" role="status" aria-label="Loading metric data">
            <div className={`h-8 ${SHIMMER_CLASS} mb-2`} style={{ width: '60px' }} />
            <div className={`h-3 ${SHIMMER_CLASS}`} style={{ width: '100px' }} />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-900 font-display">{value}</div>
            {subtitle && (
              <p className="text-xs text-gray-600 font-medium">{subtitle}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// Helper function to resolve patient ID from filename (from TherapistOverview)
function resolvePatientId(file: { name: string }): string {
  const match = file.name.match(/[A-Z]+(\d+)/)
  return match ? match[0] : 'Unknown'
}

// Helper function to resolve enhanced session date (from TherapistOverview)
function resolveEnhancedSessionDate(file: { name: string }, sessionMetadata: any[]): string | null {
  const session = sessionMetadata.find(s => s.c3d_file_path?.includes(file.name))
  return session?.session_date || null
}

// Format session date for display (from TherapistOverview)
function formatSessionDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString('fr-FR', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

// Recent C3D file item component (inspired by TherapistOverview)
const RecentC3DFileItem = React.memo(function RecentC3DFileItem({ file }: { file: RecentC3DFile }) {
  const navigate = useNavigate()
  
  const handleClick = useCallback(() => {
    navigateToAnalysis(navigate, file.name)
  }, [navigate, file.name])

  return (
    <div 
      onClick={handleClick}
      className="group flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-indigo-50/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200/60 hover:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 ring-2 ring-white shadow-md group-hover:shadow-lg group-hover:ring-blue-100 transition-all duration-200">
          <AvatarFallback className={`${file.patient.avatar_color} text-white font-semibold text-xs`}>
            {file.patient.avatar_initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {file.patient.display_name}
          </p>
          <p className="text-xs text-gray-500 font-medium">
            {file.session_date ? `Session on ${formatSessionDate(file.session_date)}` : `Uploaded ${formatSessionDate(file.created_at)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:scale-105">
          <div className="text-xs font-medium text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100/70 px-3 py-1.5 rounded-lg shadow-sm border border-blue-200/40">
            Analyze
          </div>
        </div>
        <Icons.ChevronRightIcon className="h-5 w-5 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500 group-hover:scale-110" />
      </div>
    </div>
  )
})

// Recent user activity item component
const RecentUserActivityItem = React.memo(function RecentUserActivityItem({ activity }: { activity: RecentUserActivity }) {
  const navigate = useNavigate()
  
  const handleClick = useCallback(() => {
    // Navigate to User Management tab
    navigate('/dashboard', { state: { activeTab: 'users' } })
  }, [navigate])

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 shadow-sm'
      case 'therapist': return 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 shadow-sm'
      case 'researcher': return 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 shadow-sm'
      default: return 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 shadow-sm'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return Icons.LockClosedIcon
      case 'therapist': return Icons.PersonIcon
      case 'researcher': return Icons.MagnifyingGlassIcon
      default: return Icons.PersonIcon
    }
  }

  const RoleIcon = getRoleIcon(activity.role)

  return (
    <div 
      onClick={handleClick}
      className="group flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-gray-50/60 hover:to-slate-50/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200/60 hover:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 ring-2 ring-white shadow-md group-hover:shadow-lg group-hover:ring-gray-100 transition-all duration-200">
          <AvatarFallback className={`${activity.avatar_color} text-white font-semibold text-xs`}>
            {activity.avatar_initials}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {activity.user_name}
            </p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${getRoleColor(activity.role)}`}>
              <RoleIcon className="h-3 w-3" />
              <span className="capitalize">{activity.role}</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Last login {formatSessionDate(activity.last_sign_in_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:scale-105">
          <div className="text-xs font-medium text-gray-600 bg-gradient-to-r from-gray-50 to-gray-100/70 px-3 py-1.5 rounded-lg shadow-sm border border-gray-200/40">
            Manage
          </div>
        </div>
        <Icons.ChevronRightIcon className="h-5 w-5 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-gray-500 group-hover:scale-110" />
      </div>
    </div>
  )
})

export function OverviewTab() {
  const { user, userProfile } = useAuth()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    usersByRole: { admin: 0, therapist: 0, researcher: 0 },
    totalPatients: 0,
    activePatients: 0,
    sessionsToday: 0,
    sessionsThisWeek: 0
  })
  const [clinicalMetrics, setClinicalMetrics] = useState<ClinicalMetrics>({
    averageAdherence: null,
    averagePerformance: null,
    adherenceSubtitle: 'Calculating...',
    performanceSubtitle: 'Demo calculation'
  })
  const [recentC3DFiles, setRecentC3DFiles] = useState<RecentC3DFile[]>([])
  const [recentUserActivity, setRecentUserActivity] = useState<RecentUserActivity[]>([])
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [clinicalLoading, setClinicalLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)

  // Extract and memoize the first name for welcome message (same pattern as TherapistOverview)
  const adminFirstName = useMemo(() => {
    if (userProfile?.first_name) {
      return userProfile.first_name
    }
    if (userProfile?.full_name) {
      return userProfile.full_name.split(' ')[0]
    }
    if (user?.email) {
      const emailName = user.email.split('@')[0]
      return emailName.charAt(0).toUpperCase() + emailName.slice(1).split(/[._-]/)[0]
    }
    return 'Admin'
  }, [userProfile?.first_name, userProfile?.full_name, user?.email])

  useEffect(() => {
    loadMetricsData()
    loadClinicalData()
    loadRecentSessions()
    loadRecentUserActivity()
  }, [])

  // Optimized date calculations (computed once per component mount)
  const dateRanges = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      today: today.toISOString(),
      weekAgo: weekAgo.toISOString()
    }
  }, [])

  const loadMetricsData = async () => {
    try {
      // Execute metric queries in parallel (cards data only)
      const [
        usersResult,
        patientsResult,
        todaySessionsResult,
        weekSessionsResult
      ] = await Promise.all([
        // User metrics - use RPC function to bypass RLS restrictions
        supabase
          .rpc('get_users_simple')
          .then(result => ({
            data: result.data?.map((user: any) => ({ role: user.role })) || [],
            error: result.error
          })),
        
        // Patient metrics
        supabase
          .from('patients')
          .select('active'),
        
        // Today's sessions
        supabase
          .from('therapy_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateRanges.today),
        
        // This week's sessions
        supabase
          .from('therapy_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dateRanges.weekAgo)
      ])

      // Process user metrics
      const users = usersResult.data || []
      const usersByRole = users.reduce((acc: Record<string, number>, user: any) => {
        acc[user.role as keyof typeof acc] = (acc[user.role as keyof typeof acc] || 0) + 1
        return acc
      }, { admin: 0, therapist: 0, researcher: 0 })

      // Process patient metrics
      const patients = patientsResult.data || []
      const activePatients = patients.filter(p => p.active).length

      // Update state with metrics (cards can render immediately)
      setMetrics({
        totalUsers: users.length,
        usersByRole,
        totalPatients: patients.length,
        activePatients,
        sessionsToday: todaySessionsResult.count || 0,
        sessionsThisWeek: weekSessionsResult.count || 0
      })
      
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

  const loadClinicalData = async () => {
    try {
      setClinicalLoading(true)
      
      // Get all patient codes for adherence calculation
      const { data: patientsData, error } = await supabase
        .from('patients')
        .select('patient_code')
      
      if (error) {
        console.error('Error fetching patients for adherence:', error)
        return
      }

      const patientCodes = patientsData?.map(p => p.patient_code) || []
      
      if (patientCodes.length === 0) {
        setClinicalMetrics({
          averageAdherence: null,
          averagePerformance: null,
          adherenceSubtitle: 'No patients',
          performanceSubtitle: 'No patients'
        })
        return
      }

      // Get session counts for accurate adherence calculation
      let sessionCountsMap = new Map<string, number>()
      try {
        const sessionData = await C3DSessionsService.getPatientSessionData(patientCodes)
        sessionCountsMap = new Map(
          sessionData.map(data => [data.patient_code, data.session_count])
        )
      } catch (err) {
        console.warn('Error fetching C3D session counts:', err)
      }

      // Fetch adherence data for all patients
      const adherenceData = await fetchMultiplePatientAdherence(patientCodes, sessionCountsMap)
      const averageAdherence = calculateAverageAdherence(adherenceData)
      
      // Count eligible patients for subtitle
      const eligibleCount = adherenceData.filter(a => a.protocol_day >= 3).length
      const totalCount = adherenceData.length
      
      setClinicalMetrics({
        averageAdherence,
        averagePerformance: null, // Demo calculation below
        adherenceSubtitle: eligibleCount === 0 ? 'No eligible patients' : 
                          eligibleCount === totalCount ? `All ${totalCount} patients` : 
                          `${eligibleCount} of ${totalCount} patients`,
        performanceSubtitle: 'Demo calculation (3 patients)'
      })
      
    } catch (error) {
      console.error('Failed to load clinical data:', error)
    } finally {
      setClinicalLoading(false)
    }
  }

  const loadRecentSessions = async () => {
    try {
      setSessionsLoading(true)
      
      // Fetch recent C3D files (similar to TherapistOverview pattern)
      if (!SupabaseStorageService.isConfigured()) {
        setRecentC3DFiles([])
        return
      }

      const c3dFiles = await SupabaseStorageService.listC3DFiles()
      
      // Get session metadata for enhanced date resolution
      const filePaths = c3dFiles.map(file => `${BUCKET_NAME}/${file.name}`)
      const sessionMetadataResult = await TherapySessionsService.getSessionsByFilePaths(filePaths)
      const sessionMetadata = sessionMetadataResult ? Object.values(sessionMetadataResult) : []
      
      // Add enhanced dates and sort by most recent session
      const filesWithDates = c3dFiles.map((file: any) => ({
        file,
        sessionDate: resolveEnhancedSessionDate(file, sessionMetadata)
      }))

      // Sort by session date (most recent first)
      filesWithDates.sort((a, b) => {
        if (!a.sessionDate && !b.sessionDate) return 0
        if (!a.sessionDate) return 1
        if (!b.sessionDate) return -1
        return new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
      })
      
      // Get last 5 sessions
      const recentFiles = filesWithDates.slice(0, 5).map(item => item.file)

      // Get unique patient codes from files
      const patientCodes = [...new Set(recentFiles.map(file => resolvePatientId(file)))]
      
      // Ensure all patients have medical info records
      // await createMissingPatientMedicalInfo(patientCodes)
      
      // Fetch patient medical info for all unique patients
      const { data: patientsData, error } = await supabase
        .from('patients')
        .select(`
          patient_code,
          patient_medical_info (
            first_name,
            last_name,
            date_of_birth
          )
        `)
        .in('patient_code', patientCodes)

      if (error) {
        console.error('Error fetching patient medical info:', error)
      }

      // Create patient info map
      const patientInfoMap = new Map()
      if (patientsData) {
        patientsData.forEach(patient => {
          const medical = Array.isArray(patient.patient_medical_info) 
            ? patient.patient_medical_info[0] 
            : patient.patient_medical_info
          patientInfoMap.set(patient.patient_code, medical)
        })
      }

      // Create files with patient info and avatar data
      const filesWithPatientInfo = recentFiles.map(file => {
        const patientCode = resolvePatientId(file)
        const patientInfo = patientInfoMap.get(patientCode)
        
        // Create patient data for avatar generation
        const patientData = {
          patient_code: patientCode,
          first_name: patientInfo?.first_name || null,
          last_name: patientInfo?.last_name || null,
          display_name: patientInfo?.first_name && patientInfo?.last_name 
            ? `${patientInfo.first_name} ${patientInfo.last_name}` 
            : `Patient ${patientCode}`
        }
        
        const avatarColor = getAvatarColor(getPatientIdentifier(patientData))
        const avatarInitials = getPatientAvatarInitials(
          patientInfo?.first_name, 
          patientInfo?.last_name, 
          patientCode
        )
        
        const sessionDate = filesWithDates.find(f => f.file.name === file.name)?.sessionDate
        
        return {
          name: file.name,
          created_at: file.created_at,
          session_date: sessionDate || undefined,
          patient: {
            patient_code: patientCode,
            display_name: patientData.display_name,
            avatar_initials: avatarInitials,
            avatar_color: avatarColor
          }
        }
      })

      setRecentC3DFiles(filesWithPatientInfo)
      
    } catch (error) {
      console.error('Failed to load recent sessions:', error)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadRecentUserActivity = async () => {
    try {
      setUsersLoading(true)
      
      // Use the same RPC function as UserManagementTab to get user data with emails and last_sign_in_at
      const { data, error } = await supabase
        .rpc('get_users_with_emails')

      if (error) {
        console.error('Error loading users for activity:', error)
        return
      }

      if (!data || data.length === 0) {
        setRecentUserActivity([])
        return
      }

      // Filter users who have signed in and sort by last sign in
      const usersWithActivity = data
        .filter((user: any) => user.last_sign_in_at) // Only users who have signed in
        .map((user: any) => {
          const email = user.email || 'Unknown'
          const emailName = email.split('@')[0]
          
          // Create user data for avatar generation
          const userData = {
            patient_code: emailName,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : emailName.charAt(0).toUpperCase() + emailName.slice(1).split(/[._-]/)[0]
          }
          
          const avatarColor = getAvatarColor(getPatientIdentifier(userData))
          const avatarInitials = getPatientAvatarInitials(user.first_name, user.last_name, emailName)
          
          return {
            id: user.id,
            user_id: user.id,
            user_email: email,
            user_name: userData.display_name,
            role: user.role,
            last_sign_in_at: user.last_sign_in_at,
            avatar_initials: avatarInitials,
            avatar_color: avatarColor
          }
        })
        .sort((a: any, b: any) => new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime())
        .slice(0, 5) // Get last 5 active users

      setRecentUserActivity(usersWithActivity)
      
    } catch (error) {
      console.error('Failed to load recent user activity:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  // Memoized computed values to prevent unnecessary re-renders
  const userSubtitle = useMemo(() => 
    `${metrics.usersByRole.therapist} therapists, ${metrics.usersByRole.admin} admins`,
    [metrics.usersByRole.therapist, metrics.usersByRole.admin]
  )

  const patientSubtitle = useMemo(() => 
    `${metrics.activePatients} active`,
    [metrics.activePatients]
  )

  const sessionSubtitle = useMemo(() => 
    `${metrics.sessionsThisWeek} this week`,
    [metrics.sessionsThisWeek]
  )

  const adherenceValue = useMemo(() => {
    if (clinicalLoading) return '--'
    if (clinicalMetrics.averageAdherence === null) return '--'
    return `${Math.round(clinicalMetrics.averageAdherence)}%`
  }, [clinicalMetrics.averageAdherence, clinicalLoading])

  const performanceValue = useMemo(() => {
    // Demo calculation (same as TherapistOverview)
    const isDemo = true
    if (isDemo) {
      const demoScores = {
        compliance: 87.3,
        symmetry: 98.8,
        effort: 100,
        gameScore: 85
      }
      const weights = { compliance: 0.5, symmetry: 0.25, effort: 0.25, gameScore: 0.0 }
      const demoPerformance = (
        weights.compliance * demoScores.compliance +
        weights.symmetry * demoScores.symmetry +
        weights.effort * demoScores.effort +
        weights.gameScore * demoScores.gameScore
      ).toFixed(1)
      return `${demoPerformance}%`
    }
    return '--'
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center space-y-2 py-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
          Welcome back, {adminFirstName}!
        </h1>
        <p className="text-base text-gray-600 font-medium">
          Here's your system overview and clinical trial monitoring dashboard
        </p>
      </div>

      {/* Metrics Grid - 5 cards in responsive layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers}
          icon={Icons.PersonIcon}
          subtitle={userSubtitle}
          iconColor="text-blue-600"
          loading={metricsLoading}
          tooltip={{
            content: "Total registered users in the system",
            subtext: "Includes therapists, researchers, and administrators"
          }}
        />

        <MetricCard
          title="Patients"
          value={metrics.totalPatients}
          icon={Icons.PersonIcon}
          subtitle={patientSubtitle}
          iconColor="text-green-600"
          loading={metricsLoading}
          tooltip={{
            content: "Total patients enrolled in the trial",
            subtext: "Active patients are currently receiving treatment"
          }}
        />

        <MetricCard
          title="Sessions Today"
          value={metrics.sessionsToday}
          icon={Icons.ActivityLogIcon}
          subtitle={sessionSubtitle}
          iconColor="text-purple-600"
          loading={metricsLoading}
          tooltip={{
            content: "Therapy sessions completed today",
            subtext: "Includes all processed C3D files"
          }}
        />

        <MetricCard
          title="Avg Adherence"
          value={adherenceValue}
          icon={Icons.TargetIcon}
          subtitle={clinicalMetrics.adherenceSubtitle}
          iconColor="text-emerald-600"
          loading={clinicalLoading}
          tooltip={{
            content: "Average adherence score across eligible patients (≥3 trial days)",
            subtext: "Calculated as game sessions completed vs expected based on GHOSTLY+ protocol"
          }}
        />

        <MetricCard
          title="Avg Performance"
          value={performanceValue}
          icon={Icons.ActivityLogIcon}
          subtitle={clinicalMetrics.performanceSubtitle}
          iconColor="text-indigo-600"
          loading={false}
          tooltip={{
            content: "Average performance across all patients and rehabilitation sessions",
            subtext: "Performance depends on exercise compliance (50%), muscle balance (25%), and patient effort (25%)"
          }}
        />
      </div>

      {/* Two-column layout for Last Sessions and Last Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Last Sessions */}
        <Card className="border border-blue-200/60 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200/80 shadow-sm">
                  <Icons.FileIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Last Sessions</CardTitle>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    Recent therapy activity
                  </p>
                </div>
              </div>
              <Button 
                variant="link" 
                className="text-blue-600 hover:text-blue-700 font-semibold"
                onClick={() => {
                  // Navigate to Sessions tab using React Router
                  navigate('/dashboard', { state: { activeTab: 'sessions' } })
                }}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {sessionsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '120px' }} />
                      <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '150px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentC3DFiles.length > 0 ? (
              <div className="space-y-1">
                {recentC3DFiles.map((file, index) => (
                  <RecentC3DFileItem key={`${file.name}-${index}`} file={file} />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Icons.FileIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">No Recent Sessions</p>
                  <p className="text-sm text-gray-600">C3D files will appear here when uploaded</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Activity */}
        <Card className="border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-gray-50/30 to-slate-50/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200/80 shadow-sm">
                  <Icons.PersonIcon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Last Activity</CardTitle>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    Last login activity
                  </p>
                </div>
              </div>
              <Button 
                variant="link" 
                className="text-gray-600 hover:text-gray-700 font-semibold"
                onClick={() => {
                  // Navigate to User Management tab using React Router
                  navigate('/dashboard', { state: { activeTab: 'users' } })
                }}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {usersLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '120px' }} />
                      <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '150px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentUserActivity.length > 0 ? (
              <div className="space-y-1">
                {recentUserActivity.map((activity, index) => (
                  <RecentUserActivityItem key={`${activity.id}-${index}`} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Icons.PersonIcon className="w-6 h-6 text-gray-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">No Recent Activity</p>
                  <p className="text-sm text-gray-600">Last login activity will appear here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}