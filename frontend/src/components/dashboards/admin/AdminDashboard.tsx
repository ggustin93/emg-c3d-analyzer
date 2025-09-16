import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { useAuth } from '../../../contexts/AuthContext'
import { Badge } from '../../ui/badge'
import { PersonIcon, ActivityLogIcon, GearIcon } from '@radix-ui/react-icons'
import { SessionSettings } from '../shared/SessionSettings'

/**
 * Admin Dashboard - System administration and configuration
 * Access: ADMIN role only
 */
export function AdminDashboard() {
  const { userRole } = useAuth()
  
  if (userRole !== 'ADMIN') {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">Admin access required</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <SessionSettings />
    </div>
  )
}