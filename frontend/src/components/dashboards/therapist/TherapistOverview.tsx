import React, { useMemo, useCallback, Suspense, lazy, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useTherapistDashboardQuery, RecentC3DFile } from '../../../hooks/useTherapistDashboardQuery'
import { calculateAverageAdherence } from '../../../services/adherenceService'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Button } from '../../ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
import Spinner from '../../ui/Spinner'
import * as Icons from '@radix-ui/react-icons'

// Lazy load heavy components for better performance
const ClinicalTooltip = lazy(() => 
  import('../../ui/clinical-tooltip').then(module => ({
    default: module.ClinicalTooltip
  }))
)

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

/** Skeleton dimensions for consistent loading states */
const SKELETON_SIZES = {
  WELCOME_HEADER: '300px',
  WELCOME_SUBTITLE: '400px',
  CARD_TITLE: '80px',
  CARD_VALUE: '60px',
  CARD_SUBTITLE: '100px',
  ALERT_TITLE: '150px',
  ALERT_SUBTITLE: '200px',
  SESSION_TITLE: '180px',
  SESSION_SUBTITLE: '120px',
  VIEW_LINK: '60px',
  PATIENT_NAME: '120px',
  PATIENT_SESSION: '150px',
  ICON_PLACEHOLDER: '100px',
  FEATURE_DESCRIPTION: '180px',
} as const

/** File loading animation intervals */
const FILE_ITEM_DELAY = 100

/** Reusable shimmer CSS class */
const SHIMMER_CLASS = "bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded"

// ===== INTERFACES =====

interface TherapistOverviewProps {
  className?: string
}

/** Tooltip configuration for metric cards */
interface TooltipConfig {
  content: string
  subtext?: string
}

/** Props for MetricCard component */
interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  comingSoon?: boolean
  iconColor?: string
  placeholder?: string
  loading?: boolean
  tooltip?: TooltipConfig | React.ReactNode
}

/** Props for ProgressiveContent component */
interface ProgressiveContentProps {
  children: React.ReactNode
  delay?: number
  className?: string
}

/** Props for SkeletonCard component */
interface SkeletonCardProps {
  delay?: number
}

/** Patient alert types */
type AlertSeverity = 'warning' | 'critical'

/** Patient alert data structure */
interface PatientAlert {
  id: string
  patientCode: string
  patientName: string
  alertType: 'adherence' | 'fatigue' | 'performance'
  severity: AlertSeverity
  value: string | number
  description: string
  actionRequired: string
}


// ===== CUSTOM HOOKS =====

/** 
 * Optimized visibility hook for progressive content loading
 * Reduces the number of individual timers by batching visibility updates
 */
const useProgressiveVisibility = (delay: number) => {
  const [isVisible, setIsVisible] = useState(delay === ANIMATION_DELAYS.IMMEDIATE)
  
  useEffect(() => {
    if (delay > ANIMATION_DELAYS.IMMEDIATE) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)
      
      return () => clearTimeout(timer)
    }
  }, [delay])
  
  return isVisible
}

// Format session date for display
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

// Mock data functions for demo alerts (TODO: Remove in production)
function getMockFatigueAlerts(): PatientAlert[] {
  // Demo data with realistic patient references
  return [
    {
      id: 'fatigue-001',
      patientCode: 'P001',
      patientName: 'Maria Smith',
      alertType: 'fatigue',
      severity: 'critical',
      value: 9.2,
      description: 'Reported extremely high fatigue level',
      actionRequired: 'Immediate consultation recommended'
    }
  ]
}

function getMockPerformanceDropAlerts(): PatientAlert[] {
  // Demo data with realistic patient references
  return [
    {
      id: 'performance-001', 
      patientCode: 'P002',
      patientName: 'John Garcia',
      alertType: 'performance',
      severity: 'warning',
      value: '-23%',
      description: 'Performance dropped 23% in last 6 sessions',
      actionRequired: 'Review exercise technique and motivation'
    }
  ]
}

// Create adherence alerts from real adherence data
function createAdherenceAlerts(adherenceData: any[]): PatientAlert[] {
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
  
  return [{
    id: `adherence-${worst.patient_id}`,
    patientCode: worst.patient_id,
    patientName: `Patient ${worst.patient_id}`, // TODO: Get real name in production
    alertType: 'adherence',
    severity: worst.adherence_score < 50 ? 'critical' : 'warning',
    value: `${Math.round(worst.adherence_score)}%`,
    description: `Only ${worst.sessions_completed} of ${worst.sessions_expected} sessions completed`,
    actionRequired: worst.adherence_score < 50 
      ? 'Immediate intervention required'
      : 'Schedule follow-up call'
  }]
}


// Enhanced metrics card component with improved typography and spacing
const MetricCard = React.memo(function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  comingSoon = false,
  iconColor = "text-muted-foreground",
  placeholder = "Coming Soon",
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
            React.isValidElement(tooltip) ? tooltip : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                      <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3" side="left">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {typeof tooltip === 'object' && tooltip && 'content' in tooltip ? tooltip.content : ''}
                    </p>
                    {typeof tooltip === 'object' && tooltip && 'subtext' in tooltip && tooltip.subtext && (
                      <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                        {tooltip.subtext}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-5">
        {comingSoon ? (
          <div className="space-y-1">
            <div className="text-3xl font-bold text-gray-400 font-display">--</div>
            <p className="text-xs text-gray-500 font-medium">{placeholder}</p>
          </div>
        ) : loading ? (
          <div className="space-y-1" role="status" aria-label="Loading metric data">
            <div 
              className={`h-8 ${SHIMMER_CLASS} mb-2`}
              style={{ 
                width: SKELETON_SIZES.CARD_VALUE,
                animationDelay: `${ANIMATION_DELAYS.FAST}ms`
              }}
              aria-hidden="true"
            />
            <div 
              className={`h-3 ${SHIMMER_CLASS}`}
              style={{ 
                width: SKELETON_SIZES.CARD_SUBTITLE,
                animationDelay: `${ANIMATION_DELAYS.SLOW}ms`
              }}
              aria-hidden="true"
            />
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

// Enhanced recent C3D file item component with improved styling
const RecentC3DFileItem = React.memo(function RecentC3DFileItem({ file }: { file: RecentC3DFile }) {
  const navigate = useNavigate()
  
  const handleClick = useCallback(() => {
    // Direct navigation to C3D analysis
    navigate(`/analysis?file=${file.name}${file.created_at ? `&date=${file.created_at}` : ''}`)
  }, [navigate, file.name, file.created_at])

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
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-gray-900">
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

// Enhanced loading skeleton with staggered animations
const SkeletonCard = React.memo(function SkeletonCard({ delay = ANIMATION_DELAYS.IMMEDIATE }: SkeletonCardProps) {
  return (
    <Card className="overflow-hidden" role="status" aria-label="Loading metric card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div 
          className={`h-4 ${SHIMMER_CLASS}`}
          style={{ 
            width: SKELETON_SIZES.CARD_TITLE,
            animationDelay: `${delay}ms`
          }} 
          aria-hidden="true"
        />
        <div 
          className={`h-4 w-4 ${SHIMMER_CLASS}`}
          style={{ animationDelay: `${delay + ANIMATION_DELAYS.FAST}ms` }}
          aria-hidden="true"
        />
      </CardHeader>
      <CardContent>
        <div 
          className={`h-8 ${SHIMMER_CLASS} mb-2`}
          style={{ 
            width: SKELETON_SIZES.CARD_VALUE,
            animationDelay: `${delay + ANIMATION_DELAYS.SLOW}ms`
          }}
          aria-hidden="true"
        />
        <div 
          className={`h-3 ${SHIMMER_CLASS}`}
          style={{ 
            width: SKELETON_SIZES.CARD_SUBTITLE,
            animationDelay: `${delay + ANIMATION_DELAYS.SLOWEST}ms`
          }}
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  )
})

// Progressive loading component with better UX
function DashboardLoading() {
  const [showProgressiveContent, setShowProgressiveContent] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowProgressiveContent(true)
    }, ANIMATION_DELAYS.PROGRESSIVE_THRESHOLD)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <div 
      className="flex-1 space-y-8 bg-gradient-to-br from-gray-50/50 via-blue-50/20 to-indigo-50/30 min-h-full p-6"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard content"
    >
      {/* Welcome Header with shimmer */}
      <div className="text-center space-y-2 py-4">
        <div className={`h-8 ${SHIMMER_CLASS} mx-auto`} style={{ width: SKELETON_SIZES.WELCOME_HEADER }} aria-hidden="true" />
        {showProgressiveContent && (
          <div className={`h-4 ${SHIMMER_CLASS} mx-auto animate-fade-in`} style={{ width: SKELETON_SIZES.WELCOME_SUBTITLE }} aria-hidden="true" />
        )}
      </div>

      {/* Metrics Grid with staggered loading */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <SkeletonCard delay={ANIMATION_DELAYS.IMMEDIATE} />
        <SkeletonCard delay={ANIMATION_DELAYS.FAST} />
        <SkeletonCard delay={ANIMATION_DELAYS.SLOW} />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Alerts Card Skeleton */}
        <Card className="border border-orange-200/60 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100">
                <div className="h-5 w-5 bg-orange-200 rounded animate-pulse" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '150px' }} />
                {showProgressiveContent && (
                  <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded animate-fade-in" style={{ width: '200px' }} />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <div className="w-6 h-6 bg-orange-200 rounded animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded mx-auto" style={{ width: '100px' }} />
                <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded mx-auto" style={{ width: '180px' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Card Skeleton */}
        <Card className="border border-blue-200/60 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100">
                  <div className="h-5 w-5 bg-blue-200 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '180px' }} />
                  {showProgressiveContent && (
                    <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded animate-fade-in" style={{ width: '120px' }} />
                  )}
                </div>
              </div>
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '60px' }} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="h-9 w-9 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-full" />
                  <div className="space-y-1 flex-1">
                    <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '120px' }} />
                    <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" style={{ width: '150px' }} />
                  </div>
                  <div className="h-4 w-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {showProgressiveContent && (
        <div className="text-center text-sm text-gray-500 animate-fade-in">
          <div className="flex items-center justify-center gap-2">
            <Spinner />
            <span>Loading your dashboard data...</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Error state component
const DashboardError = React.memo(function DashboardError({ error }: { error: Error }) {
  const handleTryAgain = useCallback(() => {
    window.location.reload()
  }, [])
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Icons.ExclamationTriangleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
            <p className="text-muted-foreground mb-4">
              {error.message || 'An error occurred while loading your dashboard data.'}
            </p>
            <Button onClick={handleTryAgain}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

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

// Main TherapistOverview component
export function TherapistOverview({ className }: TherapistOverviewProps) {
  const { user, userProfile } = useAuth()
  const { activePatients, recentC3DFiles, adherence, loading, error } = useTherapistDashboardQuery(user?.id)
  const [contentLoaded, setContentLoaded] = useState(false)

  // Extract and memoize the first name for welcome message
  const therapistFirstName = useMemo(() => {
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
    return 'Therapist'
  }, [userProfile?.first_name, userProfile?.full_name, user?.email])

  // Memoize expensive adherence calculations
  const averageAdherence = useMemo(() => {
    const avg = calculateAverageAdherence(adherence)
    return avg !== null ? `${Math.round(avg)}%` : "--"
  }, [adherence])

  const adherenceSubtitle = useMemo(() => {
    // Count eligible patients (protocol_day >= 3)
    const eligibleCount = adherence.filter(a => a.protocol_day >= 3).length
    const totalCount = adherence.length
    if (eligibleCount === 0) return "No eligible patients"
    if (eligibleCount === totalCount) return `All ${totalCount} patients`
    return `${eligibleCount} of ${totalCount} patients`
  }, [adherence])

  // Detect adherence-specific loading state
  const isAdherenceLoading = useMemo(() => {
    return loading || // General loading state
           (adherence.length === 0 && !error) || // No data loaded yet
           (adherence.length > 0 && adherence.every(a => a.adherence_score === null)) // Data exists but scores not calculated
  }, [loading, adherence, error])

  // Generate patient alerts from all data sources
  const patientAlerts = useMemo(() => {
    const alerts: PatientAlert[] = []
    
    // 1. Low adherence alerts (real data)
    if (!isAdherenceLoading && adherence.length > 0) {
      alerts.push(...createAdherenceAlerts(adherence))
    }
    
    // 2. High fatigue alerts (demo data - TODO: Replace with real data)
    alerts.push(...getMockFatigueAlerts())
    
    // 3. Performance drop alerts (demo data - TODO: Replace with real data)
    alerts.push(...getMockPerformanceDropAlerts())
    
    return alerts.slice(0, 3) // Limit to 3 most critical alerts
  }, [adherence, isAdherenceLoading])

  // Progressive content loading effect
  useEffect(() => {
    if (!loading && !error) {
      const timer = setTimeout(() => {
        setContentLoaded(true)
      }, ANIMATION_DELAYS.CONTENT_LOAD)
      
      return () => clearTimeout(timer)
    }
  }, [loading, error])

  if (loading) {
    return <DashboardLoading />
  }

  if (error) {
    return <DashboardError error={error} />
  }

  return (
    <div className={`flex-1 space-y-8 bg-gradient-to-br from-gray-50/50 via-blue-50/20 to-indigo-50/30 min-h-full p-6 ${className || ''}`}>
      {/* Welcome Header with progressive loading */}
      <ProgressiveContent delay={ANIMATION_DELAYS.IMMEDIATE} className="text-center space-y-2 py-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
          Welcome back, {therapistFirstName}!
        </h1>
        <ProgressiveContent delay={ANIMATION_DELAYS.SLOW}>
          <p className="text-base text-gray-600 font-medium">
            Here's what's happening with your patients today
          </p>
        </ProgressiveContent>
      </ProgressiveContent>

      {/* 3-card summary grid with staggered loading */}
      <ProgressiveContent delay={ANIMATION_DELAYS.FAST}>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
          <ProgressiveContent delay={ANIMATION_DELAYS.IMMEDIATE}>
            <MetricCard
              title="Active Patients"
              value={activePatients}
              icon={Icons.PersonIcon}
              subtitle="Currently under care"
              iconColor="text-blue-600"
              tooltip={{
                content: "Number of patients currently assigned to you with active treatment status.",
                subtext: "Includes all patients in the GHOSTLY+ 14-day trial protocol"
              }}
            />
          </ProgressiveContent>
          
          <ProgressiveContent delay={ANIMATION_DELAYS.MEDIUM}>
            <MetricCard
              title="Average Adherence"
              value={averageAdherence}
              icon={Icons.TargetIcon}
              iconColor="text-green-600"
              subtitle={adherenceSubtitle}
              loading={isAdherenceLoading}
              tooltip={
                <Suspense fallback={
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                    <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                  </Button>
                }>
                  <ClinicalTooltip
                    title="Average Adherence"
                    description="Average adherence score across eligible patients (≥3 trial days). Calculated as game sessions completed vs expected based on GHOSTLY+ protocol."
                    sections={[
                      {
                        title: "Formula",
                        type: "formula",
                        items: [{
                          label: "Adherence(t)",
                          value: " = <div style='display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; margin: 0 4px;'><div style='border-bottom: 1px solid currentColor; padding-bottom: 2px; font-size: 0.9em;'>Game Sessions Completed(t)</div><div style='padding-top: 2px; font-size: 0.9em;'>Game Sessions Expected(t)</div></div>"
                        }]
                      },
                      {
                        title: "Calculation Details",
                        type: "list",
                        items: [{
                          description: "Game Sessions Expected(t): 2.14 × Current Trial Day (t)"
                        }, {
                          description: "Average across all eligible patients (t ≥ 3 days)"
                        }]
                      }
                    ]}
                    side="left"
                    variant="compact"
                  >
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                      <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                    </Button>
                  </ClinicalTooltip>
                </Suspense>
              }
            />
          </ProgressiveContent>
          
          <ProgressiveContent delay={ANIMATION_DELAYS.SLOWEST}>
            <MetricCard
              title="Avg. Session Performance"
              value={(() => {
                // TODO: remove in prod - demo mode functionality
                const isDemo = true; // Demo mode flag
                if (isDemo) {
                  // Calculate demo percentage using GHOSTLY+ Performance Score formula
                  // P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game
                  // Default weights: w_c = 0.5, w_s = 0.25, w_e = 0.25, w_g = 0.0
                  const demoScores = {
                    compliance: 87.3, // Example from metricsDefinitions.md
                    symmetry: 98.8,   // Example from metricsDefinitions.md  
                    effort: 100,      // Example from metricsDefinitions.md
                    gameScore: 85     // Example from metricsDefinitions.md
                  };
                  const weights = { compliance: 0.5, symmetry: 0.25, effort: 0.25, gameScore: 0.0 };
                  const demoPerformance = (
                    weights.compliance * demoScores.compliance +
                    weights.symmetry * demoScores.symmetry +
                    weights.effort * demoScores.effort +
                    weights.gameScore * demoScores.gameScore
                  ).toFixed(1);
                  return `${demoPerformance}%`;
                }
                return "--";
              })()}
              icon={Icons.ActivityLogIcon}
              iconColor="text-purple-600"
              subtitle={(() => {
                // TODO: remove in prod - demo mode functionality
                const isDemo = true; // Demo mode flag
                return isDemo ? "Demo calculation (3 patients)" : "Performance metrics coming";
              })()}
              comingSoon={false}
              tooltip={
                <Suspense fallback={
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                    <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                  </Button>
                }>
                  <ClinicalTooltip
                    title="Average Session Performance"
                    description="Average performance across all patients and rehabilitation sessions. Performance depends on exercise compliance (50%), muscle balance (25%), and patient effort (25%)."
                    sections={[
                      {
                        title: "Score Ranges:",
                        type: "list",
                        items: [
                          { description: "90%+ = Excellent progress" },
                          { description: "80-89% = Good compliance" },
                          { description: "70-79% = Needs improvement" },
                          { description: "Below 70% = Intervention might be required (depends on trial protocol)" }
                        ]
                      }
                    ]}
                  >
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                      <Icons.InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                    </Button>
                  </ClinicalTooltip>
                </Suspense>
              }
            />
          </ProgressiveContent>
        </div>
      </ProgressiveContent>

      {/* Two-column layout with progressive loading */}
      <ProgressiveContent delay={ANIMATION_DELAYS.SECTION}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Patients with Alerts */}
          <ProgressiveContent delay={ANIMATION_DELAYS.IMMEDIATE}>
            <Card className="border border-orange-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/40 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200/80 shadow-sm">
                    <Icons.BellIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Patients with Alerts</CardTitle>
                    <p className="text-sm text-gray-600 font-medium mt-1">
                      Critical notifications and reminders
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                {patientAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {patientAlerts.map((alert, index) => (
                      <ProgressiveContent key={alert.id} delay={ANIMATION_DELAYS.FAST + (index * 50)}>
                        <Link
                          to={`/patients/${alert.patientCode}`}
                          className="block p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all duration-200 group"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-full shrink-0 ${
                              alert.severity === 'critical' 
                                ? 'bg-red-100 text-red-600' 
                                : 'bg-orange-100 text-orange-600'
                            }`}>
                              {alert.alertType === 'adherence' && <Icons.CrossCircledIcon className="h-3 w-3" />}
                              {alert.alertType === 'fatigue' && <Icons.ExclamationTriangleIcon className="h-3 w-3" />}
                              {alert.alertType === 'performance' && <Icons.ArrowDownIcon className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className={`font-semibold text-sm ${
                                    alert.severity === 'critical' ? 'text-red-800' : 'text-orange-800'
                                  } group-hover:underline`}>
                                    {alert.patientName}
                                  </h4>
                                  <p className="text-xs text-gray-600 mt-0.5">{alert.description}</p>
                                </div>
                                <div className={`text-right shrink-0 font-bold text-sm ${
                                  alert.severity === 'critical' ? 'text-red-700' : 'text-orange-700'
                                }`}>
                                  {alert.value}
                                </div>
                              </div>
                            </div>
                            <Icons.ChevronRightIcon className="h-4 w-4 text-gray-400 group-hover:text-orange-600 transition-colors shrink-0" />
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

          {/* Recent Session Activity */}
          <ProgressiveContent delay={ANIMATION_DELAYS.SLOW}>
            <Card className="border border-blue-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200/80 shadow-sm">
                      <Icons.FileIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Recent Session Activity</CardTitle>
                      <p className="text-sm text-gray-600 font-medium mt-1">
                        Last 5 sessions
                      </p>
                    </div>
                  </div>
                  <Button variant="link" asChild className="text-blue-600 hover:text-blue-700 font-semibold">
                    <Link to="/dashboard" state={{ activeTab: 'sessions' }}>View all</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                {recentC3DFiles.length > 0 ? (
                  <div className="space-y-1">
                    {recentC3DFiles.map((file, index) => (
                      <ProgressiveContent key={`${file.name}-${index}`} delay={index * FILE_ITEM_DELAY}>
                        <RecentC3DFileItem file={file} />
                      </ProgressiveContent>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Icons.FileIcon className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">No Recent Files</p>
                      <p className="text-sm text-gray-600">C3D files will appear here when uploaded</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </ProgressiveContent>
        </div>
      </ProgressiveContent>
    </div>
  )
}