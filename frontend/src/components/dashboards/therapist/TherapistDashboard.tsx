import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import C3DFileBrowser from '../../c3d/C3DFileBrowser'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../ui/card'
import Spinner from '../../ui/Spinner'

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
          <div className="flex items-center justify-center h-full min-h-[600px]">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Overview Dashboard</h2>
              <p className="text-sm text-gray-500 mb-6">
                Your comprehensive metrics and insights will appear here once configured.
              </p>
              <div className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-xs text-gray-600 rounded-full">
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </div>
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
          <div className="flex items-center justify-center h-full min-h-[600px]">
            <div className="text-center max-w-md mx-auto p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Management</h2>
              <p className="text-sm text-gray-500 mb-6">
                Manage patient records, track progress, and monitor treatment outcomes.
              </p>
              <div className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-xs text-gray-600 rounded-full">
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon
              </div>
            </div>
          </div>
        )
      
      case 'about':
        return (
          <div className="h-full overflow-auto">
            <div className="max-w-4xl mx-auto p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">About Ghostly+ EMG Analysis Platform</h1>
                <p className="text-lg text-gray-600">
                  Advanced rehabilitation technology for evidence-based therapy assessment
                </p>
              </div>
              
              <div className="space-y-8">
                {/* Trial Information Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Clinical Trial Information</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Trial details and protocol information will be displayed here.
                    </p>
                  </div>
                </section>
                
                {/* Research Team Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Research Team</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Information about the research team and principal investigators.
                    </p>
                  </div>
                </section>
                
                {/* Institution Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Institution</h2>
                  <div className="prose prose-gray max-w-none">
                    <div className="flex items-center gap-4 mb-4">
                      <img 
                        src="/vub_etro_logo.png" 
                        alt="VUB ETRO Logo" 
                        className="h-20 object-contain"
                      />
                    </div>
                    <p className="text-gray-600 mb-2">
                      <strong>ETRO - Electronics and Informatics</strong>
                    </p>
                    <p className="text-gray-600">
                      Vrije Universiteit Brussel (VUB)
                    </p>
                  </div>
                </section>
                
                {/* Technology Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Technology</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Information about the Ghostly+ system and EMG analysis technology.
                    </p>
                  </div>
                </section>
                
                {/* Contact Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Contact details for the research team and support.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )
      
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