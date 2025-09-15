import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { useAuth } from '../../../contexts/AuthContext'
import { Badge } from '../../ui/badge'
import { PersonIcon, ActivityLogIcon } from '@radix-ui/react-icons'

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Badge variant="secondary" className="bg-red-100 text-red-800">
          <PersonIcon className="w-4 h-4 mr-1" />
          Administrator
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityLogIcon className="w-5 h-5" />
              ⚙️ System Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded border">
                <span>Scoring Configuration</span>
                <Badge variant="outline">
                  {userRole === 'ADMIN' ? 'Full Access' : 'Read Only'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded border">
                <span>Global Settings</span>
                <Badge variant="outline">
                  Full Access
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded border">
                <span>System Configuration</span>
                <Badge variant="outline">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PersonIcon className="w-5 h-5" />
              👥 User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold text-blue-600">5</div>
                  <div className="text-sm text-muted-foreground">Admins</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold text-green-600">12</div>
                  <div className="text-sm text-muted-foreground">Therapists</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold text-purple-600">8</div>
                  <div className="text-sm text-muted-foreground">Researchers</div>
                </div>
              </div>
              <div className="mt-4">
                <Badge variant="secondary" className="w-full justify-center p-2">
                  User Management Available
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityLogIcon className="w-5 h-5" />
              📊 Site Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded border text-center">
                  <div className="text-xl font-bold">1,247</div>
                  <div className="text-sm text-muted-foreground">Total Sessions</div>
                </div>
                <div className="p-3 rounded border text-center">
                  <div className="text-xl font-bold">89</div>
                  <div className="text-sm text-muted-foreground">Active Patients</div>
                </div>
                <div className="p-3 rounded border text-center">
                  <div className="text-xl font-bold">2.3GB</div>
                  <div className="text-sm text-muted-foreground">Data Storage</div>
                </div>
                <div className="p-3 rounded border text-center">
                  <div className="text-xl font-bold">99.2%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityLogIcon className="w-5 h-5" />
              🔍 Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRole === 'ADMIN' ? (
                <div className="space-y-2">
                  <div className="p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">User Login</span>
                      <Badge variant="outline">2 min ago</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Session Created</span>
                      <Badge variant="outline">15 min ago</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Config Updated</span>
                      <Badge variant="outline">1 hour ago</Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <ActivityLogIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Audit access required</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}