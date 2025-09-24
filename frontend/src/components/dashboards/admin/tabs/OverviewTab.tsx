/**
 * Overview Tab Component for Admin Dashboard
 * 
 * Purpose: Display system metrics, quick actions, and recent activity
 * Architecture: Direct Supabase integration with real-time updates
 * Inspired by TherapistOverview.tsx patterns
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { supabase } from '@/lib/supabase'
import { getAuditLogStats, getRecentAuditLogs, type AuditLogEntry } from '@/services/adminAuditService'
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
  trialConfigStatus: string
}

interface AuditStats {
  todayCount: number
  weekCount: number
  monthCount?: number
  topActions?: string[]
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

export function OverviewTab() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    usersByRole: { admin: 0, therapist: 0, researcher: 0 },
    totalPatients: 0,
    activePatients: 0,
    sessionsToday: 0,
    sessionsThisWeek: 0,
    trialConfigStatus: 'Active'
  })
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([])
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)

  useEffect(() => {
    loadMetricsData()
    loadAuditData()
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
        weekSessionsResult,
        trialConfigResult
      ] = await Promise.all([
        // User metrics
        supabase
          .from('user_profiles')
          .select('role'),
        
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
          .gte('created_at', dateRanges.weekAgo),
        
        // Trial config status
        supabase
          .from('scoring_configuration')
          .select('active')
          .eq('id', 'a0000000-0000-0000-0000-000000000001')
          .single()
      ])

      // Process user metrics
      const users = usersResult.data || []
      const usersByRole = users.reduce((acc, user) => {
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
        sessionsThisWeek: weekSessionsResult.count || 0,
        trialConfigStatus: trialConfigResult.data?.active ? 'Active' : 'Inactive'
      })
      
    } catch (error) {
      console.error('Failed to load metrics:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

  const loadAuditData = async () => {
    try {
      // Execute audit queries in parallel (independent of metrics)
      const [auditStatsResult, recentLogsResult] = await Promise.all([
        getAuditLogStats(),
        getRecentAuditLogs(10)
      ])

      // Update audit stats and recent activity
      setAuditStats(auditStatsResult)
      if (recentLogsResult.data) {
        setRecentActivity(recentLogsResult.data)
      }
      
    } catch (error) {
      console.error('Failed to load audit data:', error)
    } finally {
      setAuditLoading(false)
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

  // Optimized formatters with useCallback to prevent recreation
  const formatAction = useCallback((action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }, [])

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }, [])

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          title="Trial Config"
          value={metrics.trialConfigStatus}
          icon={Icons.GearIcon}
          subtitle="GHOSTLY-TRIAL-DEFAULT"
          iconColor="text-orange-600"
          loading={metricsLoading}
          tooltip={{
            content: "Clinical trial configuration status",
            subtext: "System-wide scoring and parameter settings"
          }}
        />
      </div>

      {/* Quick Actions */}
      <Card className="border border-gray-200/70 shadow-lg bg-gradient-to-br from-white via-gray-50/20 to-blue-50/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="hover:shadow-md transition-all">
              <Icons.PlusIcon className="mr-2 h-4 w-4" />
              Add New User
            </Button>
            <Button variant="outline" size="sm" className="hover:shadow-md transition-all">
              <Icons.GearIcon className="mr-2 h-4 w-4" />
              Configure Trial Settings
            </Button>
            <Button variant="outline" size="sm" className="hover:shadow-md transition-all">
              <Icons.ActivityLogIcon className="mr-2 h-4 w-4" />
              View Full Audit Log
            </Button>
            <Button variant="outline" size="sm" className="hover:shadow-md transition-all">
              <Icons.FileIcon className="mr-2 h-4 w-4" />
              C3D File Browser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-blue-200/60 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200/80 shadow-sm">
              <Icons.ActivityLogIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Recent Admin Activity</CardTitle>
              <p className="text-sm text-gray-600 font-medium mt-1">
                Last 10 administrative actions
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((log) => (
                <div key={log.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-indigo-50/60 transition-all duration-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icons.ActivityLogIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formatAction(log.action)}
                      </span>
                      {log.table_name && (
                        <Badge variant="outline" className="text-xs">
                          {log.table_name}
                        </Badge>
                      )}
                    </div>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Changes: {Object.keys(log.changes).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icons.ClockIcon className="h-3 w-3" />
                    {formatTime(log.created_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icons.ActivityLogIcon className="w-6 h-6 text-blue-500" />
                </div>
                <p className="font-medium">No recent activity</p>
                <p className="text-sm mt-1">Admin actions will appear here</p>
              </div>
            )}
          </div>
          
          {/* Audit Stats Summary */}
          {auditStats && auditStats.todayCount !== undefined && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Actions Today:</span>
                  <span className="font-semibold text-gray-900">{auditStats.todayCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">This Week:</span>
                  <span className="font-semibold text-gray-900">{auditStats.weekCount}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}