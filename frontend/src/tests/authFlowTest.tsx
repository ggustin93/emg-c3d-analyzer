import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { logger, LogCategory } from '../services/logger'

/**
 * Simple Auth Flow Test Component
 * Tests auth guard behavior and data flow
 */
export const AuthFlowTest: React.FC = () => {
  const { authState, isAuthenticated, isLoading } = useAuth()
  const [renderCount, setRenderCount] = useState(0)
  const [mountTime] = useState(Date.now())
  
  useEffect(() => {
    setRenderCount(prev => prev + 1)
  }, [authState, isAuthenticated, isLoading])
  
  // Track auth state changes
  useEffect(() => {
    logger.debug(LogCategory.AUTH, '🔍 Auth State Changed:', {
      isAuthenticated,
      isLoading,
      user: authState.user?.email,
      error: authState.error,
      renderCount,
      timeSinceMount: Date.now() - mountTime
    })
  }, [authState, isAuthenticated, isLoading, renderCount, mountTime])
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-bold mb-2">Auth Flow Test</h2>
      
      <div className="space-y-2 text-sm">
        <div>
          <strong>Status:</strong>{' '}
          {isLoading ? '⏳ Loading...' : isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
        </div>
        
        <div>
          <strong>User:</strong> {authState.user?.email || 'None'}
        </div>
        
        <div>
          <strong>Error:</strong> {authState.error || 'None'}
        </div>
        
        <div>
          <strong>Render Count:</strong> {renderCount}
        </div>
        
        <div>
          <strong>Time Since Mount:</strong> {Date.now() - mountTime}ms
        </div>
      </div>
      
      {renderCount > 10 && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          ⚠️ Warning: Excessive re-renders detected ({renderCount})
        </div>
      )}
    </div>
  )
}

// Test wrapper to isolate auth behavior
export const AuthTestWrapper: React.FC = () => {
  const [showTest, setShowTest] = useState(false)
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Flow Test</h1>
      
      <div className="space-y-4">
        <button
          onClick={() => setShowTest(!showTest)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showTest ? 'Hide' : 'Show'} Auth Test
        </button>
        
        {showTest && <AuthFlowTest />}
      </div>
      
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold text-yellow-800 mb-2">Expected Behavior:</h3>
        <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
          <li>Should render only 2-3 times during initialization</li>
          <li>Auth state should stabilize within 2 seconds</li>
          <li>No infinite loops or excessive re-renders</li>
          <li>Clear loading → authenticated/unauthenticated transition</li>
        </ul>
      </div>
    </div>
  )
}