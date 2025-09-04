import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { logger, LogCategory } from '../services/logger'

/**
 * Auth Context Test Component
 * Tests the singleton auth provider behavior
 */
const AuthStateMonitor: React.FC<{ id: string }> = ({ id }) => {
  const { authState, isAuthenticated, isLoading } = useAuth()
  const [renderCount, setRenderCount] = useState(0)
  const [mountTime] = useState(Date.now())
  
  useEffect(() => {
    setRenderCount(prev => prev + 1)
  }, [authState, isAuthenticated, isLoading])
  
  useEffect(() => {
    logger.debug(LogCategory.AUTH,`🔍 Auth Monitor ${id}:`, {
      isAuthenticated,
      isLoading,
      user: authState.user?.email,
      error: authState.error,
      renderCount,
      timeSinceMount: Date.now() - mountTime
    })
  }, [authState, isAuthenticated, isLoading, renderCount, mountTime, id])
  
  return (
    <div className="p-3 border rounded bg-gray-50">
      <h3 className="font-bold text-sm mb-2">Auth Monitor {id}</h3>
      <div className="space-y-1 text-xs">
        <div>Status: {isLoading ? '⏳ Loading' : isAuthenticated ? '✅ Auth' : '❌ Not Auth'}</div>
        <div>User: {authState.user?.email || 'None'}</div>
        <div>Error: {authState.error || 'None'}</div>
        <div>Renders: {renderCount}</div>
      </div>
      {renderCount > 8 && (
        <div className="mt-1 p-1 bg-red-100 text-red-700 text-xs rounded">
          ⚠️ Excessive renders: {renderCount}
        </div>
      )}
    </div>
  )
}

/**
 * Test multiple components using auth context
 */
const MultipleAuthUsers: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <AuthStateMonitor id="A" />
      <AuthStateMonitor id="B" />
      <AuthStateMonitor id="C" />
      <AuthStateMonitor id="D" />
    </div>
  )
}

/**
 * Auth Context Test Wrapper
 */
export const AuthContextTest: React.FC = () => {
  const [showTest, setShowTest] = useState(false)
  const [testStartTime, setTestStartTime] = useState<number | null>(null)
  
  const startTest = () => {
    setTestStartTime(Date.now())
    setShowTest(true)
    logger.debug(LogCategory.AUTH,'🧪 Auth Context Test: Starting...')
  }
  
  const stopTest = () => {
    if (testStartTime) {
      const duration = Date.now() - testStartTime
      logger.debug(LogCategory.AUTH,`🧪 Auth Context Test: Completed in ${duration}ms`)
    }
    setShowTest(false)
    setTestStartTime(null)
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Context Test</h1>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={startTest}
            disabled={showTest}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Start Test
          </button>
          <button
            onClick={stopTest}
            disabled={!showTest}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Stop Test
          </button>
        </div>
        
        {testStartTime && (
          <div className="text-sm text-gray-600">
            Test running for: {Math.round((Date.now() - testStartTime) / 1000)}s
          </div>
        )}
        
        {showTest && (
          <AuthProvider>
            <div className="border-2 border-blue-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Multiple Auth Context Users</h2>
              <MultipleAuthUsers />
            </div>
          </AuthProvider>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold text-yellow-800 mb-2">Expected Behavior:</h3>
        <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
          <li><strong>Single Init:</strong> Only one "Auth Provider: Single initialization" log</li>
          <li><strong>Shared State:</strong> All monitors show identical auth state</li>
          <li><strong>Low Renders:</strong> Each monitor should render &lt;8 times total</li>
          <li><strong>Fast Stable:</strong> Auth state stabilizes within 2-3 seconds</li>
          <li><strong>No Timeouts:</strong> No timeout errors in console</li>
        </ul>
      </div>
      
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
        <h3 className="font-bold text-green-800 mb-2">Console Logs to Watch For:</h3>
        <div className="text-sm text-green-700 space-y-1 font-mono">
          <div>✅ "🔐 Auth Provider: Single initialization starting..."</div>
          <div>✅ "🔍 Auth Monitor A: &#123;isAuthenticated: true...&#125;"</div>
          <div>❌ Multiple "🔐 Initializing authentication..." (old pattern)</div>
          <div>❌ "Request timeout" or similar errors</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Simple component to add to App.tsx for testing
 */
export const QuickAuthTest: React.FC = () => {
  const { isAuthenticated, isLoading, authState } = useAuth()
  
  return (
    <div className="fixed top-4 right-4 p-2 bg-white border rounded shadow-sm text-xs">
      <div>Auth: {isAuthenticated ? '✅' : '❌'}</div>
      <div>Loading: {isLoading ? '⏳' : '✅'}</div>
      <div>User: {authState.user?.email?.slice(0, 10) || 'None'}</div>
    </div>
  )
}