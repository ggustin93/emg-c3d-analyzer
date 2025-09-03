import React from 'react'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'

interface AnalysisWorkspaceProps {
  onReturnToDashboard: () => void
}

/**
 * Analysis Workspace - Placeholder view for EMG analysis mode
 * Shows when user is in analysis mode but no file has been selected yet
 */
export function AnalysisWorkspace({ onReturnToDashboard }: AnalysisWorkspaceProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">🔬 EMG Analysis Workspace</h1>
        
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
            nostrud exercitation ullamco laboris.
          </p>
          
        </div>
      </div>
    </div>
  )
}