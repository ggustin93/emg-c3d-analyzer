/**
 * Admin Audit Service
 * 
 * Purpose: Track and log admin actions for compliance and security
 * Uses existing audit_log table - no new backend endpoints needed
 * 
 * Architecture: 100% Direct Supabase integration following KISS principles
 */

import { supabase } from '@/lib/supabase'

export interface AuditLogEntry {
  id: string
  user_id: string
  user_role: string
  action: string
  table_name?: string
  record_id?: string
  changes?: Record<string, any>
  ip_address?: string
  created_at: string
}

export interface AuditLogOptions {
  action: string
  tableName?: string
  recordId?: string
  changes?: Record<string, any>
}

/**
 * Log an admin action to the audit log
 */
export async function logAdminAction(options: AuditLogOptions) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No authenticated user')

    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        user_id: user.id,
        user_role: 'admin',
        action: options.action,
        table_name: options.tableName,
        record_id: options.recordId,
        changes: options.changes,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Failed to log admin action:', error)
    return { data: null, error }
  }
}

/**
 * Get recent audit logs with optional filtering
 */
export async function getRecentAuditLogs(limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return { data: null, error }
  }
}

/**
 * Get audit logs for a specific target (user, patient, etc.)
 */
export async function getAuditLogsForTarget(targetType: string, targetId: string) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', targetType)
      .eq('record_id', targetId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch target audit logs:', error)
    return { data: null, error }
  }
}

/**
 * Export audit logs for a date range
 */
export async function exportAuditLogs(startDate: Date, endDate: Date) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    // Convert to CSV format for export
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map(row => 
        Object.values(row).map(val => 
          typeof val === 'object' ? JSON.stringify(val) : val
        ).join(',')
      ).join('\n')
      
      const csv = `${headers}\n${rows}`
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      
      // Trigger download
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_log_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      return { success: true, count: data.length, error: null }
    }
    
    return { success: false, count: 0, error: 'No data to export' }
  } catch (error) {
    console.error('Failed to export audit logs:', error)
    return { success: false, count: 0, error }
  }
}

/**
 * Get audit log statistics for dashboard
 */
export async function getAuditLogStats() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get today's actions count
    const { data: todayData, error: todayError } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Get this week's actions count
    const { data: weekData, error: weekError, count: weekCount } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thisWeek.toISOString())

    // Get action type distribution
    const { data: actionTypes, error: actionError } = await supabase
      .from('audit_log')
      .select('action')
      .gte('created_at', thisWeek.toISOString())

    if (todayError || weekError || actionError) {
      throw new Error('Failed to fetch audit stats')
    }

    // Count action types
    const actionCounts: Record<string, number> = {}
    actionTypes?.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
    })

    return {
      todayCount: todayData?.length || 0,
      weekCount: weekCount || 0,
      actionTypes: actionCounts,
      error: null
    }
  } catch (error) {
    console.error('Failed to fetch audit stats:', error)
    return {
      todayCount: 0,
      weekCount: 0,
      actionTypes: {},
      error
    }
  }
}