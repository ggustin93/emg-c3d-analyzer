import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import * as Icons from '@radix-ui/react-icons'
import { getAvatarColor, getPatientIdentifier, getPatientAvatarInitials } from '../../../lib/avatarColors'
import { RecentC3DFile } from '../../../hooks/useTherapistDashboardQuery'
import { Patient } from './types'

// ===== CONSTANTS =====

/** Animation timing constants for progressive loading */
const ANIMATION_DELAYS = {
  IMMEDIATE: 0,
  FAST: 100,
  MEDIUM: 150,
  SLOW: 200,
  SLOWEST: 300,
  SECTION: 400,
  PROGRESSIVE_THRESHOLD: 500,
  CONTENT_LOAD: 100,
} as const

// ===== INTERFACES =====

/** Patient alert types */
type AlertSeverity = 'warning' | 'critical'

/** Patient alert data structure with avatar support */
interface PatientAlert {
  id: string
  patientCode: string
  patientName: string
  alertType: 'adherence' | 'fatigue' | 'performance'
  alertCategory: string // "Lowest Adherence", "Highest Reported Fatigue", "Performance Concerns"
  severity: AlertSeverity
  value: string | number
  description: string
  actionRequired: string
  // Avatar properties (matching Recent Session Activity pattern)
  avatarInitials: string
  avatarColor: string
  displayName: string
}

/** Props for PatientAlerts component */
interface PatientAlertsProps {
  adherence: any[]
  recentC3DFiles: RecentC3DFile[]
  patients: Patient[]
  isAdherenceLoading: boolean
  className?: string
}

/** Props for ProgressiveContent component */
interface ProgressiveContentProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

// ===== CUSTOM HOOKS =====

/** 
 * Optimized visibility hook for progressive content loading
 * Reduces the number of individual timers by batching visibility updates
 */
const useProgressiveVisibility = (delay: number) => {
  const [isVisible, setIsVisible] = React.useState(delay === ANIMATION_DELAYS.IMMEDIATE)
  
  React.useEffect(() => {
    if (delay > ANIMATION_DELAYS.IMMEDIATE) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [delay])
  
  return isVisible
}

// ===== UTILITY FUNCTIONS =====

// Create fatigue alerts from real patient data (demo values for now)
function createFatigueAlerts(recentC3DFiles: RecentC3DFile[]): PatientAlert[] {
  if (!recentC3DFiles || recentC3DFiles.length === 0) return []
  
  // Use real patient from recent files but fake fatigue value
  const patientWithFatigue = recentC3DFiles[0] // First patient from recent activity
  
  return [
    {
      id: `fatigue-${patientWithFatigue.patient.patient_code}`,
      patientCode: patientWithFatigue.patient.patient_code,
      patientName: patientWithFatigue.patient.display_name,
      displayName: patientWithFatigue.patient.display_name,
      alertType: 'fatigue',
      alertCategory: 'Highest Reported Fatigue',
      severity: 'critical',
      value: 9.2, // Fake value for demo
      description: 'Reported extremely high fatigue level during session',
      actionRequired: 'Immediate consultation recommended',
      avatarInitials: patientWithFatigue.patient.avatar_initials,
      avatarColor: patientWithFatigue.patient.avatar_color
    }
  ]
}

// Create performance alerts from real patient data (demo values for now)
function createPerformanceAlerts(recentC3DFiles: RecentC3DFile[]): PatientAlert[] {
  if (!recentC3DFiles || recentC3DFiles.length < 2) return []
  
  // Use second patient from recent files but fake performance value
  const patientWithPerformance = recentC3DFiles[1] // Second patient from recent activity
  
  return [
    {
      id: `performance-${patientWithPerformance.patient.patient_code}`,
      patientCode: patientWithPerformance.patient.patient_code,
      patientName: patientWithPerformance.patient.display_name,
      displayName: patientWithPerformance.patient.display_name,
      alertType: 'performance',
      alertCategory: 'Performance Concerns',
      severity: 'warning',
      value: '-23%', // Fake value for demo
      description: 'Performance dropped 23% in last 6 sessions',
      actionRequired: 'Review exercise technique and motivation',
      avatarInitials: patientWithPerformance.patient.avatar_initials,
      avatarColor: patientWithPerformance.patient.avatar_color
    }
  ]
}

// Create adherence alerts from real adherence data with avatar support
function createAdherenceAlerts(adherenceData: any[], patients: Patient[]): PatientAlert[] {
  if (!adherenceData || adherenceData.length === 0) return []
  
  // Find patients with poor adherence (below 70%)
  const poorAdherence = adherenceData
    .filter(a => 
      a.adherence_score !== null && 
      a.adherence_score < 70 &&
      a.protocol_day >= 3 // Only include eligible patients
    )
    .sort((a, b) => a.adherence_score - b.adherence_score) // Lowest first
  
  if (poorAdherence.length === 0) return []
  
  // Return the patient with lowest adherence
  const worst = poorAdherence[0]
  
  // Find matching patient data for actual name and avatar info
  const matchingPatient = patients.find(p => p.patient_code === worst.patient_id)
  
  // Use patient data if available, otherwise create fallback
  const patientData = matchingPatient ? {
    patient_code: matchingPatient.patient_code,
    first_name: matchingPatient.first_name,
    last_name: matchingPatient.last_name,
    display_name: matchingPatient.display_name
  } : {
    patient_code: worst.patient_id,
    first_name: null,
    last_name: null,
    display_name: null
  }
  
  const avatarColor = getAvatarColor(getPatientIdentifier(patientData))
  const avatarInitials = matchingPatient?.avatar_initials || getPatientAvatarInitials(patientData.first_name, patientData.last_name, worst.patient_id)
  const displayName = matchingPatient?.display_name || `Patient ${worst.patient_id}`
  
  return [{
    id: `adherence-${worst.patient_id}`,
    patientCode: worst.patient_id,
    patientName: displayName,
    displayName: displayName,
    alertType: 'adherence',
    alertCategory: 'Lowest Adherence',
    severity: worst.adherence_score < 50 ? 'critical' : 'warning',
    value: `${Math.round(worst.adherence_score)}%`,
    description: `Only ${worst.sessions_completed} of ${worst.sessions_expected} sessions completed`,
    actionRequired: worst.adherence_score < 50 
      ? 'Immediate intervention required'
      : 'Schedule follow-up call',
    avatarInitials,
    avatarColor
  }]
}

// ===== COMPONENTS =====

// Progressive content loader component with optimized performance
const ProgressiveContent = React.memo(function ProgressiveContent({ 
  children, 
  delay = ANIMATION_DELAYS.IMMEDIATE, 
  className = "" 
}: ProgressiveContentProps) {
  const isVisible = useProgressiveVisibility(delay)
  
  if (!isVisible) return null
  
  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  )
})

/**
 * PatientAlerts Component
 * 
 * Displays critical patient alerts including adherence, fatigue, and performance concerns.
 * Features real patient data integration with avatar support and categorized alerts.
 * 
 * @param adherence - Array of adherence data for all patients
 * @param recentC3DFiles - Array of recent C3D files with patient information
 * @param patients - Array of patient data with medical information for name resolution
 * @param isAdherenceLoading - Loading state for adherence data
 * @param className - Optional additional CSS classes
 */
export const PatientAlerts = React.memo(function PatientAlerts({
  adherence,
  recentC3DFiles,
  patients,
  isAdherenceLoading,
  className
}: PatientAlertsProps) {
  // Generate patient alerts from all data sources
  const patientAlerts = useMemo(() => {
    const alerts: PatientAlert[] = []
    
    // 1. Low adherence alerts (real data)
    if (!isAdherenceLoading && adherence.length > 0) {
      alerts.push(...createAdherenceAlerts(adherence, patients))
    }
    
    // 2. High fatigue alerts (using real patient data with demo values)
    if (recentC3DFiles.length > 0) {
      alerts.push(...createFatigueAlerts(recentC3DFiles))
    }
    
    // 3. Performance drop alerts (using real patient data with demo values)
    if (recentC3DFiles.length > 1) {
      alerts.push(...createPerformanceAlerts(recentC3DFiles))
    }
    
    return alerts.slice(0, 3) // Limit to 3 most critical alerts
  }, [adherence, isAdherenceLoading, recentC3DFiles, patients])

  return (
    <ProgressiveContent delay={ANIMATION_DELAYS.IMMEDIATE}>
      <Card className={`border border-orange-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/40 backdrop-blur-sm ${className || ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200/80 shadow-sm">
                <Icons.BellIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Patients with Alerts</CardTitle>
                <p className="text-sm text-gray-600 font-medium mt-1">
                  Critical notifications requiring attention
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          {patientAlerts.length > 0 ? (
            <div className="space-y-1">
              {patientAlerts.map((alert, index) => (
                <ProgressiveContent key={alert.id} delay={ANIMATION_DELAYS.FAST + (index * 50)}>
                  <Link
                    to={`/patients/${alert.patientCode}`}
                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-red-50/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-transparent hover:border-orange-200/60 hover:backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 ring-2 ring-white shadow-md group-hover:shadow-lg group-hover:ring-orange-100 transition-all duration-200">
                        <AvatarFallback className={`${alert.avatarColor} text-white font-semibold text-xs`}>
                          {alert.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {alert.displayName}
                          </p>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            alert.severity === 'critical' 
                              ? 'border-red-200 bg-red-50/50 text-red-700' 
                              : 'border-orange-200 bg-orange-50/50 text-orange-700'
                          }`}>
                            {alert.alertType === 'adherence' && <Icons.CrossCircledIcon className="h-3 w-3" />}
                            {alert.alertType === 'fatigue' && <Icons.ExclamationTriangleIcon className="h-3 w-3" />}
                            {alert.alertType === 'performance' && <Icons.ArrowDownIcon className="h-3 w-3" />}
                            <span>{alert.alertCategory}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-right shrink-0 font-semibold text-sm ${
                        alert.severity === 'critical' ? 'text-red-700' : 'text-orange-700'
                      }`}>
                        {alert.value}
                      </div>
                      <Icons.ChevronRightIcon className="h-5 w-5 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-orange-500 group-hover:scale-110" />
                    </div>
                  </Link>
                </ProgressiveContent>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Icons.CheckCircledIcon className="w-6 h-6 text-green-500" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-900">All Clear</p>
                <p className="text-sm text-gray-600">No active patient alerts</p>
              </div>
            </div>
          )}
        </CardContent>
        </Card>
    </ProgressiveContent>
  )
})

export default PatientAlerts