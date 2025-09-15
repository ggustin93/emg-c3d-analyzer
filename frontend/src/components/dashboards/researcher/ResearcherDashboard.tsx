import React, { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import C3DSourceSelector from '../../c3d/C3DSourceSelector'
import { useSessionStore } from '../../../store/sessionStore'
import { SideNav } from '../../navigation/SideNav'
import { Card, CardContent } from '../../ui/card'
import { AboutPage } from '../../about/AboutPage'
import { 
  ArchiveIcon,
  BarChartIcon,
  InfoCircledIcon,
  RocketIcon,
  ExternalLinkIcon,
  TableIcon,
  MixIcon,
  GearIcon
} from '@radix-ui/react-icons'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion'

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
          <div className="h-full overflow-auto">
            <div className="max-w-4xl mx-auto p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChartIcon className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-3xl font-semibold text-gray-900 mb-3">Data Analytics & Management</h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  For analytics beyond this app's built-in Export Tab (session-specific data and raw C3D files), 
                  use these external tools for comprehensive data workflows.
                </p>
              </div>

              {/* Organized Content with Accordions */}
              <Accordion type="multiple" defaultValue={["data-management", "advanced-analytics"]} className="w-full">
                
                {/* Data Management & CSV Tools */}
                <AccordionItem value="data-management" className="border rounded-lg mb-4 px-6">
                  <AccordionTrigger className="text-left py-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <TableIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Data Management & CSV Tools</h3>
                        <p className="text-sm text-gray-600">Quick exports and spreadsheet-style editing</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      
                      {/* Supabase Studio */}
                      <div className="bg-gray-50 rounded-lg p-5">
                        <h4 className="font-medium text-gray-900 mb-2">Supabase Studio</h4>
                        <p className="text-sm text-gray-600 mb-3">Direct database access for quick CSV exports</p>
                        <ul className="text-sm text-gray-600 space-y-1 mb-4">
                          <li>• Instant CSV downloads from any table</li>
                          <li>• SQL query interface</li>
                          <li>• Real-time data viewer</li>
                        </ul>
                      </div>

                      {/* NocoDB */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5">
                        <h4 className="font-medium text-gray-900 mb-2">NocoDB</h4>
                        <p className="text-sm text-gray-600 mb-3">Spreadsheet interface for collaborative data editing</p>
                        <ul className="text-sm text-gray-600 space-y-1 mb-4">
                          <li>• Excel-like interface for database tables</li>
                          <li>• Collaborative editing and sharing</li>
                          <li>• Form builder and API generation</li>
                        </ul>
                        <a 
                          href="https://nocodb.com/docs" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium"
                        >
                          View NocoDB Documentation <ExternalLinkIcon className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Advanced Analytics */}
                <AccordionItem value="advanced-analytics" className="border rounded-lg mb-4 px-6">
                  <AccordionTrigger className="text-left py-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <MixIcon className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Advanced Analytics with Metabase</h3>
                        <p className="text-sm text-gray-600">Custom dashboards and complex visualizations</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      
                      {/* Capabilities */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Capabilities</h4>
                        <ul className="space-y-2">
                          <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">Custom visualizations and dashboard creation</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">Query builder with graphical and SQL interfaces</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">Data sharing and collaboration features</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">Multiple export formats (CSV, JSON, Excel)</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">Direct Supabase database connection</span>
                          </li>
                        </ul>
                      </div>

                      {/* Documentation */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Resources</h4>
                        <div className="space-y-3">
                          <a 
                            href="https://www.metabase.com/docs/latest" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-purple-900">Metabase Documentation</span>
                              <ExternalLinkIcon className="w-4 h-4 text-purple-600 group-hover:text-purple-800" />
                            </div>
                            <p className="text-sm text-purple-700 mt-1">Complete setup and usage guide</p>
                          </a>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Technical Implementation */}
                <AccordionItem value="implementation" className="border rounded-lg mb-6 px-6">
                  <AccordionTrigger className="text-left py-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                        <GearIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Technical Implementation</h3>
                        <p className="text-sm text-gray-600">Deployment and setup details</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Setup Steps</h4>
                      <ol className="space-y-3 text-sm text-gray-700">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center justify-center font-medium">1</span>
                          <span>Connect your Supabase database to Metabase and NocoDB instances</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center justify-center font-medium">2</span>
                          <span>Deploy both platforms using Docker containers</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center justify-center font-medium">3</span>
                          <span>Monitor deployments with Coolify platform integration</span>
                        </li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>

              {/* Setup Note */}
              <div className="text-center">
                <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-gray-700">
                    These tools require separate installation and database connection setup. 
                    Consult your system administrator for deployment assistance.
                  </p>
                </div>
              </div>
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