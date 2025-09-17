import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
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
      <Card className={`border border-orange-200/80 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/50 backdrop-blur-sm ring-1 ring-orange-100/60 ${className || ''}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200/80 shadow-md ring-1 ring-orange-200/50">
              <Icons.BellIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold text-gray-900 tracking-tight">Patients with Alerts</CardTitle>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Critical notifications requiring attention
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-6">
          {patientAlerts.length > 0 ? (
            <div className="space-y-3">
              {patientAlerts.map((alert, index) => (
                <ProgressiveContent key={alert.id} delay={ANIMATION_DELAYS.FAST + (index * 50)}>
                  <Link
                    to={`/patients/${alert.patientCode}`}
                    className="group flex items-center justify-between p-4 rounded-xl hover:bg-gradient-to-r hover:from-orange-50/70 hover:to-red-50/70 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-transparent hover:border-orange-200/80 hover:backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-11 w-11 ring-2 ring-white shadow-lg group-hover:shadow-xl group-hover:ring-orange-100 transition-all duration-300 group-hover:scale-105">
                        <AvatarFallback className={`${alert.avatarColor} text-white font-bold text-sm`}>
                          {alert.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-base font-bold text-gray-900 tracking-tight">
                            {alert.displayName}
                          </p>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                            alert.severity === 'critical' 
                              ? 'bg-red-50 text-red-800 border border-red-200 ring-1 ring-red-200/50' 
                              : 'bg-orange-50 text-orange-800 border border-orange-200 ring-1 ring-orange-200/50'
                          }`}>
                            {alert.alertType === 'adherence' && <Icons.CrossCircledIcon className="h-3.5 w-3.5" />}
                            {alert.alertType === 'fatigue' && <Icons.ExclamationTriangleIcon className="h-3.5 w-3.5" />}
                            {alert.alertType === 'performance' && <Icons.ArrowDownIcon className="h-3.5 w-3.5" />}
                            <span>{alert.alertCategory}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-right shrink-0 font-black text-xl tracking-tight ${
                        alert.severity === 'critical' ? 'text-red-700' : 'text-orange-700'
                      }`}>
                        {alert.value}
                      </div>
                      <Icons.ChevronRightIcon className="h-6 w-6 text-gray-300 transition-all duration-300 group-hover:translate-x-2 group-hover:text-orange-500 group-hover:scale-125" />
                    </div>
                  </Link>
                </ProgressiveContent>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-lg ring-1 ring-green-200/50">
                <Icons.CheckCircledIcon className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-gray-900 text-lg tracking-tight">All Clear</p>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">No active patient alerts</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ProgressiveContent>
  )
})

export default PatientAlerts