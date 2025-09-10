import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import C3DSourceSelector from '../../c3d/C3DSourceSelector'
import { useSessionStore } from '../../../store/sessionStore'
import { SideNav } from '../../navigation/SideNav'
import { Card, CardContent } from '../../ui/card'
import { 
  ArchiveIcon,
  BarChartIcon,
  InfoCircledIcon,
  RocketIcon
} from '@radix-ui/react-icons'

// Custom navigation items for Researcher role
const researcherNavItems = [
  { 
    id: 'sessions', 
    label: 'Sessions', 
    icon: ArchiveIcon,
    description: 'C3D files & analysis'
  },
  { 
    id: 'analytics', 
    label: 'Analytics', 
    icon: BarChartIcon,
    description: 'Custom analytics'
  },
  { 
    id: 'about', 
    label: 'About', 
    icon: InfoCircledIcon,
    description: 'Trial information'
  }
]

/**
 * Researcher Dashboard - Enhanced with sidebar navigation
 * Access: RESEARCHER or ADMIN roles
 */
export function ResearcherDashboard({ 
  onQuickSelect, 
  activeTab = 'sessions' 
}: { 
  onQuickSelect: (filename: string, uploadDate?: string) => void
  activeTab?: string
}) {
  const { userRole } = useAuth()
  const { sessionParams } = useSessionStore()
  
  if (userRole !== 'RESEARCHER' && userRole !== 'ADMIN') {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">Researcher access required</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'sessions':
        return (
          <div className="h-full">
            <C3DSourceSelector
              onUploadSuccess={() => {}} // Not used in dashboard mode
              onUploadError={() => {}} // Not used in dashboard mode
              setIsLoading={() => {}} // Not used in dashboard mode
              onQuickSelect={onQuickSelect}
              isLoading={false}
              sessionParams={sessionParams}
            />
          </div>
        )
      
      case 'analytics':
        return (
          <div className="flex items-center justify-center h-full min-h-[600px]">
            <div className="text-center max-w-2xl mx-auto p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChartIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Custom Analytics Platform</h2>
              <p className="text-base text-gray-600 mb-6">
                For advanced analytics and custom dashboards, we recommend using our Metabase integration.
              </p>
              
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Why Metabase?</h3>
                <ul className="text-sm text-gray-600 space-y-2 text-left max-w-md mx-auto">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Create custom visualizations and dashboards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Build complex queries without SQL knowledge</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Share insights with your research team</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-0.5">•</span>
                    <span>Export data in multiple formats</span>
                  </li>
                </ul>
              </div>
              
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer">
                <RocketIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Request Metabase Access</span>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                Contact your administrator to set up Metabase access for your research team.
              </p>
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
                {/* Research Information Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Research Protocol</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Research protocol and methodology information will be displayed here.
                    </p>
                  </div>
                </section>
                
                {/* Data Analysis Section */}
                <section className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Analysis Guidelines</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600">
                      {/* Content to be added later */}
                      Guidelines for EMG data analysis and interpretation.
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