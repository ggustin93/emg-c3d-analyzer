import { useCallback, useRef } from 'react'

interface PerformanceMetrics {
  operation: string
  duration: number
  timestamp: number
  success: boolean
}

/**
 * Performance monitoring hook for tracking loading operations
 * Helps identify performance bottlenecks and optimize user experience
 */
export const usePerformanceMonitor = (componentName: string) => {
  const metricsRef = useRef<PerformanceMetrics[]>([])
  const operationStartTimes = useRef<Record<string, number>>({})

  const startOperation = useCallback((operation: string) => {
    operationStartTimes.current[operation] = Date.now()
    if (process.env.NODE_ENV === 'development') {
      console.time(`${componentName}:${operation}`)
    }
  }, [componentName])

  const endOperation = useCallback((operation: string, success: boolean = true) => {
    const startTime = operationStartTimes.current[operation]
    if (!startTime) return

    const duration = Date.now() - startTime
    const metric: PerformanceMetrics = {
      operation,
      duration,
      timestamp: Date.now(),
      success
    }

    metricsRef.current.push(metric)

    // Keep only last 50 metrics to prevent memory leaks
    if (metricsRef.current.length > 50) {
      metricsRef.current = metricsRef.current.slice(-50)
    }

    if (process.env.NODE_ENV === 'development') {
      console.timeEnd(`${componentName}:${operation}`)
      
      // Warn about slow operations
      if (duration > 2000) {
        console.warn(`🐌 Slow operation detected: ${componentName}:${operation} took ${duration}ms`)
      } else if (duration > 500) {
        console.info(`⚡ ${componentName}:${operation} took ${duration}ms`)
      }
    }

    delete operationStartTimes.current[operation]
  }, [componentName])

  const getMetrics = useCallback(() => {
    return [...metricsRef.current]
  }, [])

  const getAverageTime = useCallback((operation: string) => {
    const operationMetrics = metricsRef.current.filter(m => m.operation === operation && m.success)
    if (operationMetrics.length === 0) return 0
    
    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0)
    return Math.round(total / operationMetrics.length)
  }, [])

  return {
    startOperation,
    endOperation,
    getMetrics,
    getAverageTime
  }
}