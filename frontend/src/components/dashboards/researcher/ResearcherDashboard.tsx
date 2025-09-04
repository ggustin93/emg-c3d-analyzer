import React from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import C3DSourceSelector from '../../c3d/C3DSourceSelector'
import { useSessionStore } from '../../../store/sessionStore'

/**
 * Researcher Dashboard - Simple C3D File Browser (matches existing researcher experience)
 * Access: RESEARCHER or ADMIN roles
 */
export function ResearcherDashboard({ onQuickSelect }: { 
  onQuickSelect: (filename: string, uploadDate?: string) => void 
}) {
  const { userRole, canViewFeature } = useAuth()
  const { sessionParams } = useSessionStore()
  
  if (!canViewFeature('reports') && userRole !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h1 className="text-xl font-semibold text-red-800">Access Denied</h1>
          <p className="text-red-700">Researcher access required</p>
        </div>
      </div>
    )
  }

  return (
    <C3DSourceSelector
      onUploadSuccess={() => {}} // Not used in dashboard mode
      onUploadError={() => {}} // Not used in dashboard mode
      setIsLoading={() => {}} // Not used in dashboard mode
      onQuickSelect={onQuickSelect}
      isLoading={false}
      sessionParams={sessionParams}
    />
  )
}