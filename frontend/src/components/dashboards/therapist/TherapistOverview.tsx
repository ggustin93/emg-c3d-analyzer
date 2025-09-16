import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useTherapistDashboardData, RecentC3DFile } from '../../../hooks/useTherapistDashboardData'
import { calculateAverageAdherence } from '../../../services/adherenceService'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Avatar, AvatarFallback } from '../../ui/avatar'
import { Button } from '../../ui/button'
import { ClinicalTooltip } from '../../ui/clinical-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
import Spinner from '../../ui/Spinner'
import {
  PersonIcon,
  FileIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ActivityLogIcon,
  TargetIcon,
  BellIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons'

interface TherapistOverviewProps {
  className?: string
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


// Enhanced metrics card component with improved typography and spacing
function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle,
  comingSoon = false,
  iconColor = "text-muted-foreground",
  placeholder = "Coming Soon",
  tooltip
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  comingSoon?: boolean
  iconColor?: string
  placeholder?: string
  tooltip?: {
    content: string
    subtext?: string
  } | React.ReactNode
}) {
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
                      <InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3" side="left">
                    <p className="text-sm font-medium text-gray-900 mb-1">{(tooltip as any).content}</p>
                    {(tooltip as any).subtext && (
                      <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                        {(tooltip as any).subtext}
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
}

// Enhanced recent C3D file item component with improved styling
function RecentC3DFileItem({ file }: { file: RecentC3DFile }) {
  const navigate = useNavigate()
  
  const handleClick = () => {
    // Direct navigation to C3D analysis
    navigate(`/analysis?file=${file.name}${file.created_at ? `&date=${file.created_at}` : ''}`)
  }

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
        <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500 group-hover:scale-110" />
      </div>
    </div>
  )
}

// Loading state component
function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <div className="h-8 bg-muted rounded animate-pulse mb-2" style={{ width: '300px' }} />
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '80px' }} />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse mb-2" style={{ width: '60px' }} />
              <div className="h-3 bg-muted rounded animate-pulse" style={{ width: '100px' }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded animate-pulse" style={{ width: '200px' }} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Error state component
function DashboardError({ error }: { error: Error }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
            <p className="text-muted-foreground mb-4">
              {error.message || 'An error occurred while loading your dashboard data.'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Main TherapistOverview component
export function TherapistOverview({ className }: TherapistOverviewProps) {
  const { user, userProfile } = useAuth()
  const { activePatients, recentC3DFiles, adherence, loading, error } = useTherapistDashboardData(user?.id)

  // Extract just the first name for welcome message
  const getFirstName = () => {
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
  }
  
  const therapistFirstName = getFirstName()

  if (loading) {
    return <DashboardLoading />
  }

  if (error) {
    return <DashboardError error={error} />
  }

  return (
    <div className={`flex-1 space-y-8 bg-gradient-to-br from-gray-50/50 via-blue-50/20 to-indigo-50/30 min-h-full p-6 ${className || ''}`}>
      {/* Welcome Header with improved typography */}
      <div className="text-center space-y-2 py-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-display">
          Welcome back, {therapistFirstName}!
        </h1>
        <p className="text-base text-gray-600 font-medium">
          Here's what's happening with your patients today
        </p>
      </div>

      {/* 3-card summary grid with better spacing */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
        <MetricCard
          title="Active Patients"
          value={activePatients}
          icon={PersonIcon}
          subtitle="Currently under care"
          iconColor="text-blue-600"
          tooltip={{
            content: "Number of patients currently assigned to you with active treatment status.",
            subtext: "Includes all patients in the GHOSTLY+ 14-day trial protocol"
          }}
        />
        <MetricCard
          title="Average Adherence"
          value={(() => {
            const avgAdherence = calculateAverageAdherence(adherence)
            return avgAdherence !== null ? `${Math.round(avgAdherence)}%` : "--"
          })()}
          icon={TargetIcon}
          iconColor="text-green-600"
          subtitle={(() => {
            // Count eligible patients (protocol_day >= 3)
            const eligibleCount = adherence.filter(a => a.protocol_day >= 3).length
            const totalCount = adherence.length
            if (eligibleCount === 0) return "No eligible patients"
            if (eligibleCount === totalCount) return `All ${totalCount} patients`
            return `${eligibleCount} of ${totalCount} patients`
          })()}
          tooltip={
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
                <InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
              </Button>
            </ClinicalTooltip>
          }
        />
        <MetricCard
          title="Avg. Session Performance"
          value="--"
          icon={ActivityLogIcon}
          iconColor="text-purple-600"
          placeholder="Performance metrics coming"
          comingSoon
        />
      </div>

      {/* Two-column layout for cards with enhanced styling and borders */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Patients with Alerts */}
        <Card className="border border-orange-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200/80 shadow-sm">
                <BellIcon className="h-5 w-5 text-orange-600" />
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
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <BellIcon className="w-6 h-6 text-orange-500" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-gray-900">Alert System</p>
                <p className="text-sm text-gray-600">Patient monitoring features in development</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Session Activity */}
        <Card className="border border-blue-200/60 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200/80 shadow-sm">
                  <FileIcon className="h-5 w-5 text-blue-600" />
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
                  <RecentC3DFileItem key={`${file.name}-${index}`} file={file} />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <FileIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">No Recent Files</p>
                  <p className="text-sm text-gray-600">C3D files will appear here when uploaded</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}