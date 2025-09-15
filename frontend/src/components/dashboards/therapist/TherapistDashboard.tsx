import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import C3DFileBrowser from '../../c3d/C3DFileBrowser'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../ui/card'
import Spinner from '../../ui/Spinner'
import { PatientManagement } from './PatientManagement'
import { TherapistOverview } from './TherapistOverview'
import { AboutPage } from '../../about/AboutPage'

/**
 * Therapist Dashboard - Patient management and session tracking
 * Access: THERAPIST or ADMIN roles
 */
export function TherapistDashboard({ activeTab = 'sessions' }: { activeTab?: string }) {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const [isNavigatingToAnalysis, setIsNavigatingToAnalysis] = useState(false)
  
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

  const handleFileSelect = (filename: string, uploadDate?: string) => {
    setIsNavigatingToAnalysis(true)
    // Small delay to show loading state before navigation
    setTimeout(() => {
      navigate(`/analysis?file=${filename}${uploadDate ? `&date=${uploadDate}` : ''}`)
    }, 100)
  }

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="h-full bg-gray-50/30">
            <div className="p-6">
              <TherapistOverview />
            </div>
          </div>
        )
      
      case 'sessions':
        return (
          <div className="h-full bg-gray-50/30">
            <div className="p-6">
              <C3DFileBrowser onFileSelect={handleFileSelect} />
            </div>
          </div>
        )
      
      case 'patients':
        return (
          <div className="h-full bg-gray-50/30">
            <div className="p-6">
              <PatientManagement />
            </div>
          </div>
        )
      
      case 'about':
        return <AboutPage />
      
      default:
        return null
    }
  }

  // KISS: Dashboard content only - SideNav is now handled by SidebarLayout in App.tsx
  // This eliminates duplicate navigation rendering
  return (
    <div className="h-full overflow-auto bg-white">
      {renderContent()}
    </div>
  )
}