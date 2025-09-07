import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { useAuth } from '../../../contexts/AuthContext'
import { Badge } from '../../ui/badge'
import { User, File, Activity } from 'lucide-react'

/**
 * Therapist Dashboard - Patient management and session tracking
 * Access: THERAPIST or ADMIN roles
 */
export function TherapistDashboard() {
  const { userRole } = useAuth()
  
  if (userRole !== 'THERAPIST' && userRole !== 'ADMIN') {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">Therapist access required</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Therapist Dashboard</h1>
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <Activity className="w-4 h-4 mr-1" />
          Therapist
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              👥 My Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRole === 'THERAPIST' || userRole === 'ADMIN' ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded border text-center">
                      <div className="text-2xl font-bold text-blue-600">12</div>
                      <div className="text-sm text-muted-foreground">Active</div>
                    </div>
                    <div className="p-3 rounded border text-center">
                      <div className="text-2xl font-bold text-gray-600">3</div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Patient P001</span>
                          <div className="text-sm text-muted-foreground">Last session: 2 days ago</div>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">Patient P002</span>
                          <div className="text-sm text-muted-foreground">Last session: 1 week ago</div>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Patient access required</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              📈 Session Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRole === 'THERAPIST' || userRole === 'ADMIN' ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded border text-center">
                      <div className="text-2xl font-bold text-green-600">47</div>
                      <div className="text-sm text-muted-foreground">This Week</div>
                    </div>
                    <div className="p-3 rounded border text-center">
                      <div className="text-2xl font-bold text-purple-600">85%</div>
                      <div className="text-sm text-muted-foreground">Compliance</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Average Performance</span>
                        <Badge variant="outline">7.8/10</Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">MVC Achievement</span>
                        <Badge variant="outline">92%</Badge>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Session access required</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clinical Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="w-5 h-5" />
              📝 Clinical Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRole === 'THERAPIST' || userRole === 'ADMIN' ? (
                <div className="space-y-2">
                  <div className="p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Session Note - P001</span>
                        <div className="text-sm text-muted-foreground">Patient showed improvement in contraction control</div>
                      </div>
                      <Badge variant="outline">Today</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Progress Note - P002</span>
                        <div className="text-sm text-muted-foreground">Reached 90% MVC target consistently</div>
                      </div>
                      <Badge variant="outline">Yesterday</Badge>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Badge variant="secondary" className="w-full justify-center p-2">
                      Notes Editor Available
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Notes access required</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload C3D */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              📤 Upload C3D Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userRole === 'THERAPIST' || userRole === 'ADMIN' ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-muted-foreground">
                      Drop C3D files here or click to browse
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded border text-center">
                      <div className="text-lg font-bold">23</div>
                      <div className="text-sm text-muted-foreground">Files Today</div>
                    </div>
                    <div className="p-3 rounded border text-center">
                      <div className="text-lg font-bold">156MB</div>
                      <div className="text-sm text-muted-foreground">Total Size</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Upload access required</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}